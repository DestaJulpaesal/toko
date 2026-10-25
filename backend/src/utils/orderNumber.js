import { randomUUID } from 'node:crypto';

export function createOnlineOrderNumber(date = new Date(), uuid = randomUUID()) {
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, '');
  const reference = uuid.replace(/-/g, '').slice(0, 12).toUpperCase();
  return `WEB-${datePart}-${reference}`;
}
