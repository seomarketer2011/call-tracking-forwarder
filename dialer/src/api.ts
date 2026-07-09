import type { QueueItem, Settings } from './types';

class ApiError extends Error {}

function url(settings: Settings, path: string): string {
  return settings.apiUrl.replace(/\/+$/, '') + path;
}

async function request<T>(settings: Settings, path: string, options: RequestInit = {}): Promise<T> {
  if (!settings.apiUrl || !settings.apiKey) {
    throw new ApiError('Set the API URL and API key in Settings first.');
  }

  const response = await fetch(url(settings, path), {
    ...options,
    headers: {
      'X-Api-Key': settings.apiKey,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(`${response.status}: ${text}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function fetchQueue(settings: Settings): Promise<QueueItem[]> {
  return request(settings, '/api/queue');
}

export function importQueue(
  settings: Settings,
  rows: { businessName: string; number: string }[]
): Promise<{ imported: number; skipped: unknown[] }> {
  return request(settings, '/api/queue', {
    method: 'POST',
    body: JSON.stringify(rows),
  });
}

export function updateQueueItem(settings: Settings, id: number, status: string): Promise<QueueItem> {
  return request(settings, `/api/queue/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function clearFinishedQueue(settings: Settings): Promise<{ ok: boolean }> {
  return request(settings, '/api/queue?clear=done', { method: 'POST', body: '{}' });
}

export function triggerDial(settings: Settings, queueId: number): Promise<{ callSid: string; status: string }> {
  return request(settings, '/api/dial', {
    method: 'POST',
    body: JSON.stringify({ queueId }),
  });
}
