function getStorageKey() {
  try {
    const user = JSON.parse(localStorage.getItem('glosir_user') || 'null');
    return `glosir_notifications_read_${user?.id || 'guest'}`;
  } catch {
    return 'glosir_notifications_read_guest';
  }
}

export function getReadNotificationIds() {
  try {
    const value = JSON.parse(localStorage.getItem(getStorageKey()) || '[]');
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

export function markNotificationsRead(items) {
  const readIds = getReadNotificationIds();
  items.forEach((item) => readIds.add(item.id));
  localStorage.setItem(getStorageKey(), JSON.stringify([...readIds].slice(-500)));
  window.dispatchEvent(new Event('glosir-notifications-read'));
}
