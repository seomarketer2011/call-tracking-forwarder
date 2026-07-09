import type { QueueItem } from '../types';

interface Props {
  items: QueueItem[];
  onSkip: (id: number) => void;
  onRetry: (id: number) => void;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  calling: 'Calling…',
  completed: 'Completed',
  failed: 'Failed',
  skipped: 'Skipped',
};

export function QueueTable({ items, onSkip, onRetry }: Props) {
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
              {(item.status === 'failed' || item.status === 'skipped') && (
                <button onClick={() => onRetry(item.id)}>Retry</button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
