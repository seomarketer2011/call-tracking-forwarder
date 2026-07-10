import { useState } from 'react';
import type { Settings } from '../types';
import { Lead, searchLeads } from '../api';

interface Props {
  settings: Settings;
  onImport: (rows: { businessName: string; number: string }[]) => Promise<void>;
}

export function LeadFinder({ settings, onImport }: Props) {
  const [query, setQuery] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function runSearch() {
    if (!query.trim()) return;
    setBusy(true);
    setStatus('Searching Google Business Profiles…');
    try {
      const result = await searchLeads(settings, query.trim());
      setLeads(result.leads);
      // Pre-tick everything that isn't already in the queue.
      setChecked(new Set(result.leads.filter((l) => !l.inQueue).map((l) => l.number)));
      setStatus(
        `${result.total} businesses with usable UK numbers` +
          (result.noPhone ? ` (${result.noPhone} listings had no usable number)` : '')
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function importChecked() {
    const rows = leads
      .filter((l) => checked.has(l.number))
      .map((l) => ({ businessName: l.businessName, number: l.number }));
    if (rows.length === 0) return;
    setBusy(true);
    try {
      await onImport(rows);
      setStatus(`Added ${rows.length} to the call queue.`);
      setLeads([]);
      setChecked(new Set());
      setQuery('');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function toggle(number: string) {
    const next = new Set(checked);
    if (next.has(number)) next.delete(number);
    else next.add(number);
    setChecked(next);
  }

  return (
    <div className="panel">
      <h2>Lead Finder</h2>
      <p className="hint">
        Search Google Business Profile listings (via DataForSEO) and add the results to your call
        queue — e.g. “painters and decorators Birmingham”.
      </p>
      <div className="controls">
        <input
          type="text"
          className="lead-query"
          placeholder="e.g. painters and decorators Birmingham"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
        />
        <button disabled={busy || !query.trim()} onClick={runSearch}>
          Search
        </button>
        {leads.length > 0 && (
          <button disabled={busy || checked.size === 0} onClick={importChecked}>
            Add {checked.size} to Queue
          </button>
        )}
      </div>
      {status && <p className="hint">{status}</p>}
      {leads.length > 0 && (
        <table className="queue-table">
          <thead>
            <tr>
              <th></th>
              <th>Business</th>
              <th>Number</th>
              <th>Category</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.number}>
                <td>
                  {lead.inQueue ? (
                    <span className="hint">in queue</span>
                  ) : (
                    <input
                      type="checkbox"
                      checked={checked.has(lead.number)}
                      onChange={() => toggle(lead.number)}
                    />
                  )}
                </td>
                <td>{lead.businessName}</td>
                <td>{lead.number}</td>
                <td>{lead.category}</td>
                <td>{lead.rating ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
