export function normalizeIndonesianPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('08')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  if (digits.startsWith('628')) return digits;
  return digits;
}

export function isValidIndonesianPhone(value) {
  const raw = String(value || '').trim();
  if (!/^(?:08|\+?628|8)/.test(raw.replace(/[\s-]/g, ''))) return false;
  const normalized = normalizeIndonesianPhone(raw);
  return normalized.startsWith('628') && normalized.length >= 10 && normalized.length <= 15;
}
