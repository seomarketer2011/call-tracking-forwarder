// Small dependency-free CSV parser. Handles quoted fields containing commas.
// Expects columns in either order as long as a header row names them
// "business name"/"business_name"/"name" and "number"/"phone"/"phone number".

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

export function parseCsv(text: string): { businessName: string; number: string }[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = parseLine(lines[0]).map((h) => h.toLowerCase());
  const nameIdx = header.findIndex((h) => ['business name', 'business_name', 'name'].includes(h));
  const numberIdx = header.findIndex((h) => ['number', 'phone', 'phone number', 'phone_number'].includes(h));

  const hasHeader = nameIdx !== -1 || numberIdx !== -1;
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const resolvedNameIdx = nameIdx === -1 ? 0 : nameIdx;
  const resolvedNumberIdx = numberIdx === -1 ? 1 : numberIdx;

  return dataLines
    .map(parseLine)
    .filter((fields) => fields.length > Math.max(resolvedNameIdx, resolvedNumberIdx))
    .map((fields) => ({
      businessName: fields[resolvedNameIdx] ?? '',
      number: normalizeUkNumber(fields[resolvedNumberIdx] ?? ''),
    }));
}

// Best-effort normalization: turns "07911 123456" or "07911-123456" into "+447911123456".
// Numbers already in +44 E.164 form pass through unchanged.
export function normalizeUkNumber(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+44')) return digits;
  if (digits.startsWith('0')) return '+44' + digits.slice(1);
  if (digits.startsWith('44')) return '+' + digits;
  return digits;
}
