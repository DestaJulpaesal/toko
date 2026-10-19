export function normalizeIndonesianPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

export function isValidIndonesianPhone(value) {
  const raw = String(value || '').trim();
  const normalized = normalizeIndonesianPhone(raw);
  return normalized.startsWith('628') && normalized.length >= 10 && normalized.length <= 15;
}
