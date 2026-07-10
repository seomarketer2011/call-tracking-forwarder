// Parsing/normalization for DataForSEO Google Maps results -> dialable leads.

// Best-effort UK normalization: "0121 496 0000" / "+44 121 496 0000" /
// "(0121) 496-0000" all become "+441214960000".
export function normalizeUkNumber(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/[^\d+]/g, '');
  if (digits.startsWith('+44')) return digits;
  if (digits.startsWith('0')) return '+44' + digits.slice(1);
  if (digits.startsWith('44')) return '+' + digits;
  return digits;
}

export function isUkE164(number) {
  return /^\+44\d{9,10}$/.test(number);
}

// Extracts leads from a DataForSEO SERP Google Maps "live advanced" response.
// Returns { leads, noPhone } where leads have a valid, normalized UK number.
export function parseMapsResponse(response) {
  const leads = [];
  let noPhone = 0;

  const tasks = response?.tasks ?? [];
  for (const task of tasks) {
    for (const result of task?.result ?? []) {
      for (const item of result?.items ?? []) {
        if (item.type !== 'maps_search' && item.type !== 'maps_paid_item') continue;
        const number = normalizeUkNumber(item.phone);
        if (!isUkE164(number)) {
          noPhone += 1;
          continue;
        }
        leads.push({
          businessName: item.title ?? '',
          number,
          category: item.category ?? '',
          rating: item.rating?.value ?? null,
          address: item.address ?? '',
        });
      }
    }
  }

  // Dedupe by number within the result set (chains often list one number).
  const seen = new Set();
  const deduped = leads.filter((lead) => {
    if (seen.has(lead.number)) return false;
    seen.add(lead.number);
    return true;
  });

  return { leads: deduped, noPhone };
}
