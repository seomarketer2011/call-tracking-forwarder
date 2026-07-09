export type QueueStatus =
  | 'pending'
  | 'calling'
  | 'completed'
  | 'no-answer'
  | 'failed'
  | 'skipped';

export interface QueueItem {
  id: number;
  business_name: string | null;
  number: string;
  status: QueueStatus;
  call_sid: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Settings {
  apiUrl: string;
  apiKey: string;
}
