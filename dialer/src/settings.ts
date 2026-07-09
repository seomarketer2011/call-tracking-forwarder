import type { Settings } from './types';

const STORAGE_KEY = 'call-maker-dialer:settings';

export function loadSettings(): Settings {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { apiUrl: '', apiKey: '' };
  try {
    return JSON.parse(raw);
  } catch {
    return { apiUrl: '', apiKey: '' };
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
