const listeners = new Set();

export function subscribeConfirm(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function confirmAction(message, title = 'Konfirmasi tindakan') {
  return new Promise((resolve) => {
    listeners.forEach((listener) => listener({ message, title, resolve }));
  });
}
