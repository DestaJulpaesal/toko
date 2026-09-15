const listeners = new Set();

export function subscribeNotice(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// type: 'success' | 'error' | 'info'
export function showNotice(message, type = 'info') {
  if (!message) return;
  listeners.forEach((listener) => listener({ message, type, id: Date.now() + Math.random() }));
}

export function showSuccess(message) {
  showNotice(message, 'success');
}

export function showError(message) {
  showNotice(message, 'error');
}
