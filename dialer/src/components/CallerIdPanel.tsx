import { useEffect, useState } from 'react';
import type { Settings } from '../types';
import { fetchServerSettings, fetchTwilioNumbers, saveCallerId } from '../api';

interface Props {
  settings: Settings;
}

export function CallerIdPanel({ settings }: Props) {
  const [numbers, setNumbers] = useState<{ number: string; label: string }[]>([]);
  const [current, setCurrent] = useState<string>('');
  const [selected, setSelected] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    if (!settings.apiUrl || !settings.apiKey) return;
    Promise.all([fetchTwilioNumbers(settings), fetchServerSettings(settings)])
      .then(([nums, server]) => {
        setNumbers(nums);
        const active = server.outbound_caller_id ?? '';
        setCurrent(active);
        setSelected(active || (nums[0]?.number ?? ''));
        setStatus('');
      })
      .catch((err) => setStatus(err instanceof Error ? err.message : String(err)));
  }, [settings]);

  if (!settings.apiUrl || !settings.apiKey) return null;

  return (
    <div className="panel">
      <h2>Outbound Caller ID</h2>
      <p className="hint">
        The number businesses see when the dialer calls them.{' '}
        {current ? `Currently: ${current}` : 'Currently using the server default.'}
      </p>
      <div className="controls">
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {numbers.map((n) => (
            <option key={n.number} value={n.number}>
              {n.number}
              {n.label && n.label !== n.number.replace('+', '') ? ` — ${n.label}` : ''}
            </option>
          ))}
        </select>
        <button
          disabled={!selected || selected === current}
          onClick={async () => {
            try {
              const result = await saveCallerId(settings, selected);
              setCurrent(result.outbound_caller_id ?? '');
              setStatus('Saved.');
            } catch (err) {
              setStatus(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          Set Caller ID
        </button>
      </div>
      {status && <p className="hint">{status}</p>}
    </div>
  );
}
