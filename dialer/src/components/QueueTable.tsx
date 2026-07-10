import type { QueueItem } from '../types';

interface Props {
  items: QueueItem[];
  activeCallQueueId: number | null;
  onSkip: (id: number) => void;
  onRetry: (id: number) => void;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  calling: 'Calling…',
  completed: 'Completed',
  'no-answer': 'No Answer',
  failed: 'Failed',
  skipped: 'Skipped',
};

export function QueueTable({ items, activeCallQueueId, onSkip, onRetry }: Props) {
  if (items.length === 0) {
    return <p className="hint">No numbers loaded yet — import a CSV to get started.</p>;
  }

  return (
    <table className="queue-table">
      <thead>
        <tr>
          <th>Business</th>
          <th>Number</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className={`status-${item.status}`}>
            <td>{item.business_name || '—'}</td>
            <td>{item.number}</td>
            <td>{STATUS_LABEL[item.status] ?? item.status}</td>
            <td>
              {item.status === 'pending' && <button onClick={() => onSkip(item.id)}>Skip</button>}
              {(item.status === 'failed' ||
                item.status === 'no-answer' ||
                item.status === 'skipped') && (
                <button onClick={() => onRetry(item.id)}>Retry</button>
              )}
              {item.status === 'calling' && item.id !== activeCallQueueId && (
                // Stuck in 'calling' but no live call in this app — e.g. the
                // app was closed mid-call. Let the operator requeue it.
                <button onClick={() => onRetry(item.id)}>Reset</button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
