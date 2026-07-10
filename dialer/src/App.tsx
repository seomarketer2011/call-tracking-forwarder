import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueueItem, Settings } from './types';
import { loadSettings, saveSettings } from './settings';
import { clearFinishedQueue, fetchQueue, importQueue, updateQueueItem } from './api';
import { Softphone, SoftphoneState } from './softphone';
import { SettingsPanel } from './components/SettingsPanel';
import { CallerIdPanel } from './components/CallerIdPanel';
import { CsvImport } from './components/CsvImport';
import { QueueTable } from './components/QueueTable';

const POLL_MS = 4000;
// Breather between calls so the operator can finish notes before the next dial.
const NEXT_CALL_DELAY_MS = 2000;

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [autoDialing, setAutoDialing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneState, setPhoneState] = useState<SoftphoneState>('offline');
  const [phoneDetail, setPhoneDetail] = useState<string>('');
  const [cooldown, setCooldown] = useState(false);

  const softphone = useRef<Softphone | null>(null);
  const dialInFlight = useRef(false);
  const activeQueueId = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!settings.apiUrl || !settings.apiKey) return;
    try {
      setQueue(await fetchQueue(settings));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [settings]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // (Re)create the softphone when settings change; tear down on unmount.
  useEffect(() => {
    softphone.current?.stop();
    softphone.current = new Softphone(settings, {
      onStateChange: (state, detail) => {
        setPhoneState(state);
        setPhoneDetail(detail ?? '');
      },
      onCallEnded: () => {
        activeQueueId.current = null;
        setCooldown(true);
        setTimeout(() => {
          setCooldown(false);
          refresh();
        }, NEXT_CALL_DELAY_MS);
      },
    });
    return () => softphone.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const connectHeadset = useCallback(async () => {
    try {
      await softphone.current?.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const dialItem = useCallback(
    async (item: QueueItem) => {
      const phone = softphone.current;
      if (!phone || phone.inCall || dialInFlight.current) return;
      dialInFlight.current = true;
      try {
        activeQueueId.current = item.id;
        await phone.dial(item.number, item.id);
      } catch (err) {
        activeQueueId.current = null;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        dialInFlight.current = false;
        setTimeout(refresh, 500);
      }
    },
    [refresh]
  );

  // Auto-dial loop: headset connected, no active call, not cooling down ->
  // dial the next pending item. The human just talks; this keeps it moving.
  useEffect(() => {
    if (!autoDialing || cooldown) return;
    if (phoneState !== 'ready') return;
    if (dialInFlight.current || softphone.current?.inCall) return;
    const next = queue.find((q) => q.status === 'pending');
    if (!next) {
      setAutoDialing(false);
      return;
    }
    dialItem(next);
  }, [autoDialing, cooldown, phoneState, queue, dialItem]);

  const pendingCount = queue.filter((q) => q.status === 'pending').length;

  const phoneLabel: Record<SoftphoneState, string> = {
    offline: 'Headset not connected',
    ready: 'Ready',
    connecting: `Dialing ${phoneDetail}…`,
    'in-call': `In call with ${phoneDetail}`,
    error: `Error: ${phoneDetail}`,
  };

  return (
    <div className="app">
      <h1>Call Maker Dialer</h1>
      {error && <div className="error">{error}</div>}

      <SettingsPanel
        settings={settings}
        onSave={(s) => {
          setSettings(s);
          saveSettings(s);
        }}
      />

      <CallerIdPanel settings={settings} />

      <CsvImport
        onImport={async (rows) => {
          await importQueue(settings, rows);
          refresh();
        }}
      />

      <div className="panel">
        <h2>Dialer</h2>
        <p className="hint">
          <strong>{phoneLabel[phoneState]}</strong> &middot; {pendingCount} pending
        </p>
        <div className="controls">
          {phoneState === 'offline' || phoneState === 'error' ? (
            <button onClick={connectHeadset}>Connect Headset</button>
          ) : null}
          <button
            disabled={phoneState !== 'ready' || autoDialing || pendingCount === 0}
            onClick={() => setAutoDialing(true)}
          >
            Start Auto-Dial
          </button>
          <button disabled={!autoDialing} onClick={() => setAutoDialing(false)}>
            Stop After This Call
          </button>
          <button
            disabled={phoneState !== 'ready' || autoDialing || pendingCount === 0}
            onClick={() => {
              const next = queue.find((q) => q.status === 'pending');
              if (next) dialItem(next);
            }}
          >
            Call Next
          </button>
          <button
            disabled={phoneState !== 'in-call' && phoneState !== 'connecting'}
            onClick={() => softphone.current?.hangUp()}
          >
            Hang Up
          </button>
          <button
            onClick={async () => {
              await clearFinishedQueue(settings);
              refresh();
            }}
          >
            Clear Finished
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>Queue</h2>
        <QueueTable
          items={queue}
          activeCallQueueId={activeQueueId.current}
          onSkip={async (id) => {
            await updateQueueItem(settings, id, 'skipped');
            refresh();
          }}
          onRetry={async (id) => {
            await updateQueueItem(settings, id, 'pending');
            refresh();
          }}
        />
      </div>
    </div>
  );
}
