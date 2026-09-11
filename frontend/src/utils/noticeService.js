const listeners = new Set();

export function subscribeNotice(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function showNotice(message, type = 'info') {
  listeners.forEach((listener) => listener({ message, type, id: Date.now() }));
}
