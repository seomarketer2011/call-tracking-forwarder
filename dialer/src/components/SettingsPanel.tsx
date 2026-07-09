import { useState } from 'react';
import type { Settings } from '../types';

interface Props {
  settings: Settings;
  onSave: (settings: Settings) => void;
}

export function SettingsPanel({ settings, onSave }: Props) {
  const [apiUrl, setApiUrl] = useState(settings.apiUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey);

  return (
    <div className="panel">
      <h2>Settings</h2>
      <label>
        Forwarder API URL
        <input
          type="text"
          placeholder="https://your-project.pages.dev"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
        />
      </label>
      <label>
        Admin API Key
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      </label>
      <button onClick={() => onSave({ apiUrl, apiKey })}>Save Settings</button>
    </div>
  );
}
