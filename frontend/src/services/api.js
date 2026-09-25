import { showSuccess, showError } from '../utils/noticeService';
import { clearStaffCaches } from '../utils/catalogStorage';

const configuredApiUrl = String(import.meta.env.VITE_API_URL || '').trim();
let sessionExpiryTimer;

export const API_BASE_URL = (configuredApiUrl || 'http://127.0.0.1:5000/api').replace(/\/$/, '');

function clearExpiredSession() {
  localStorage.removeItem('glosir_token');
  localStorage.removeItem('glosir_user');
  clearStaffCaches();
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

const ACTION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Endpoints that are noisy, read-like, or already show their own dedicated
// feedback UI (e.g. login has its own inline form error). Keep this list
// short — it's an opt-out, not an opt-in.
const SILENT_PATH_PATTERNS = [/^auth\/login$/, /^auth\/refresh$/, /^whatsapp\/webhook/];

function isSilentPath(cleanPath) {
  return SILENT_PATH_PATTERNS.some((pattern) => pattern.test(cleanPath));
}

async function notifyActionResult(response) {
  let data = null;
  try {
    data = await response.clone().json();
  } catch {
    data = null;
  }

  const ok = response.ok && data?.success !== false;
  if (ok) {
    const message = (data && typeof data.message === 'string' && data.message) || 'Aksi berhasil dilakukan.';
    showSuccess(message);
  } else {
    const message = (data && typeof data.message === 'string' && data.message)
      || (response.status >= 500 ? 'Terjadi kesalahan di server. Coba lagi sebentar.' : 'Aksi gagal dilakukan.');
    showError(message);
  }
}

export function apiFetch(path, options = {}) {
  const { silentNotify, ...fetchOptions } = options;
  const headers = authHeaders(fetchOptions.headers || {});
  const hasStoredToken = Boolean(localStorage.getItem('glosir_token'));
  const cleanPath = String(path).replace(/^\//, '');
  const method = String(fetchOptions.method || 'GET').toUpperCase();
  const shouldNotify = ACTION_METHODS.has(method) && !isSilentPath(cleanPath) && !silentNotify;

  return fetch(apiUrl(path), { ...fetchOptions, headers })
    .then((response) => {
      const isLoginRequest = cleanPath === 'auth/login';
      const sessionIsInvalid = hasStoredToken && response.status === 401;

      if (sessionIsInvalid && !isLoginRequest && window.location.pathname !== '/login') {
        clearExpiredSession();
      }

      if (shouldNotify) {
        notifyActionResult(response);
      }

      return response;
    })
    .catch((error) => {
      if (shouldNotify) {
        showError('Tidak bisa terhubung ke server. Periksa koneksi internet atau backend.');
      }
      throw error;
    });
}
