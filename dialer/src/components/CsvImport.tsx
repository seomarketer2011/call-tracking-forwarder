import { useRef, useState } from 'react';
import { parseCsv } from '../csv';

interface Props {
  onImport: (rows: { businessName: string; number: string }[]) => Promise<void>;
}

export function CsvImport({ onImport }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>('');

  async function handleFile(file: File) {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      setStatus('No rows found in that file.');
      return;
    }
    setStatus(`Importing ${rows.length} rows...`);
    await onImport(rows);
    setStatus(`Imported ${rows.length} rows.`);
    if (fileInput.current) fileInput.current.value = '';
  }

  return (
    <div className="panel">
      <h2>Import Numbers</h2>
      <p className="hint">CSV with columns: business name, number. UK numbers only.</p>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {status && <p className="hint">{status}</p>}
    </div>
  );
}
