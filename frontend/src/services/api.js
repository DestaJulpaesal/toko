const configuredApiUrl = String(import.meta.env.VITE_API_URL || '').trim();
let sessionExpiryTimer;

export const API_BASE_URL = (configuredApiUrl || 'http://127.0.0.1:5000/api').replace(/\/$/, '');

function clearExpiredSession() {
  localStorage.removeItem('glosir_token');
  localStorage.removeItem('glosir_user');
  if (window.location.pathname !== '/login') window.location.replace('/login');
}

export function monitorSessionExpiry() {
  window.clearTimeout(sessionExpiryTimer);
  const token = localStorage.getItem('glosir_token');
  if (!token) return;

  try {
    const payload = JSON.parse(window.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const remainingMs = Number(payload.exp) * 1000 - Date.now();
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
      clearExpiredSession();
      return;
    }
    sessionExpiryTimer = window.setTimeout(clearExpiredSession, remainingMs);
  } catch {
    clearExpiredSession();
  }
}

monitorSessionExpiry();

export function authHeaders(extraHeaders = {}) {
  const token = localStorage.getItem('glosir_token');
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
}

export function apiUrl(path = '') {
  return `${API_BASE_URL}/${String(path).replace(/^\//, '')}`;
}

export function apiFetch(path, options = {}) {
  const headers = authHeaders(options.headers || {});
  const hasStoredToken = Boolean(localStorage.getItem('glosir_token'));

  return fetch(apiUrl(path), { ...options, headers }).then((response) => {
    const isLoginRequest = String(path).replace(/^\//, '') === 'auth/login';
    const sessionIsInvalid = hasStoredToken && (response.status === 401 || response.status === 403);

    if (sessionIsInvalid && !isLoginRequest && window.location.pathname !== '/login') {
      clearExpiredSession();
    }

    return response;
  });
}
