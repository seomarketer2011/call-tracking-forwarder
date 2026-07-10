import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueueItem, Settings } from './types';
import { loadSettings, saveSettings } from './settings';
import { clearFinishedQueue, fetchQueue, importQueue, triggerDial, updateQueueItem } from './api';
import { SettingsPanel } from './components/SettingsPanel';
import { CallerIdPanel } from './components/CallerIdPanel';
import { CsvImport } from './components/CsvImport';
import { QueueTable } from './components/QueueTable';

const POLL_MS = 4000;

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [autoDialing, setAutoDialing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!settings.apiUrl || !settings.apiKey) return;
    try {
      const items = await fetchQueue(settings);
      setQueue(items);
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

  const dialNext = useCallback(
    async (item: QueueItem) => {
      if (dialInFlight.current) return;
      dialInFlight.current = true;
      try {
        await triggerDial(settings, item.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        dialInFlight.current = false;
        refresh();
      }
    },
    [settings, refresh]
  );

  // Auto-dial loop: whenever nothing is currently "calling" and auto-dial is
  // on, kick off the next pending item. A real person handles the actual
  // conversation once bridged — this just keeps the queue moving.
  useEffect(() => {
    if (!autoDialing) return;
    const calling = queue.some((q) => q.status === 'calling');
    if (calling || dialInFlight.current) return;
    const next = queue.find((q) => q.status === 'pending');
    if (!next) {
      setAutoDialing(false);
      return;
    }
    dialNext(next);
  }, [autoDialing, queue, dialNext]);

  const pendingCount = queue.filter((q) => q.status === 'pending').length;
  const callingItem = queue.find((q) => q.status === 'calling');

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
          {pendingCount} pending &middot; {callingItem ? `currently calling ${callingItem.number}` : 'idle'}
        </p>
        <div className="controls">
          <button
            disabled={autoDialing || pendingCount === 0}
            onClick={() => setAutoDialing(true)}
          >
            Start Auto-Dial
          </button>
          <button disabled={!autoDialing} onClick={() => setAutoDialing(false)}>
            Stop
          </button>
          <button
            disabled={autoDialing || pendingCount === 0 || !!callingItem}
            onClick={() => {
              const next = queue.find((q) => q.status === 'pending');
              if (next) dialNext(next);
            }}
          >
            Call Next
          </button>
          <button
            onClick={async () => {
              await clearFinishedQueue(settings);
              refresh();
            }}
          >
            Clear Completed/Failed/Skipped
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>Queue</h2>
        <QueueTable
          items={queue}
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
