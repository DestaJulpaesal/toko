const configuredApiUrl = String(import.meta.env.VITE_API_URL || '').trim();

export const API_BASE_URL = (configuredApiUrl || 'http://127.0.0.1:5000/api').replace(/\/$/, '');

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
  return fetch(apiUrl(path), { ...options, headers });
}
