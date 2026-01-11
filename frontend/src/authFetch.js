import { obtenerToken, borrarToken, guardarToken, decodeToken } from './auth';
import { queueRequest } from './offline/sync';
import { toastSuccess, toastWarn, toastError } from './toast';
import { logger } from './utils/logger';
import { validateResponse } from './utils/schemas';

// Token refresh: intenta refrescar el token antes de que expire
let refreshPromise = null;

// Configuración de timeouts y retries
const FETCH_TIMEOUT = 30000; // 30 segundos
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 segundo

async function refreshToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const token = obtenerToken();
      if (!token) return null;

      const res = await fetchWithTimeout(`${import.meta.env.VITE_API_URL}/refresh`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }, 10000); // 10s timeout para refresh

      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          guardarToken(data.access_token);
          return data.access_token;
        }
      }
      return null;
    } catch (e) {
      logger.error('Token refresh failed:', e);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Fetch con timeout usando AbortController
// If caller provides a signal, use it; otherwise create timeout-based abort
async function fetchWithTimeout(input, init = {}, timeout = FETCH_TIMEOUT) {
  // If caller provided a signal, we need to combine it with our timeout
  const callerSignal = init.signal;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // If caller's signal is already aborted, abort immediately
  if (callerSignal?.aborted) {
    clearTimeout(timeoutId);
    throw new DOMException('Aborted', 'AbortError');
  }

  // Listen to caller's signal
  const onCallerAbort = () => controller.abort();
  callerSignal?.addEventListener('abort', onCallerAbort);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
}

// Función para determinar si un error es retryable
function isRetryableError(error, response) {
  // Errores de red
  if (error?.name === 'TypeError' && error?.message?.includes('network')) return true;
  if (error?.name === 'AbortError') return false; // No retry timeouts

  // Errores de servidor (5xx)
  if (response && response.status >= 500) return true;

  return false;
}

// Función de delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Verifica si el token está próximo a expirar (menos de 5 minutos)
function isTokenExpiringSoon(token) {
  try {
    const payload = decodeToken(token);
    if (!payload || !payload.exp) return false;
    const exp = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    return exp - now < fiveMinutes;
  } catch (e) {
    return false;
  }
}

async function authFetch(input, init = {}, retryCount = 0) {
  let token = obtenerToken();

  // Refresh token proactively if expiring soon
  if (token && isTokenExpiringSoon(token)) {
    const newToken = await refreshToken();
    if (newToken) token = newToken;
  }

  const headers = init.headers ? { ...init.headers } : {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  init = { ...init, headers };

  try {
    // If offline and this is a mutating request, queue it locally
    const method = (init.method || 'GET').toUpperCase();
    if (typeof navigator !== 'undefined' && !navigator.onLine && method !== 'GET') {
      try {
        await queueRequest({ method, url: input, headers, body: init.body ? JSON.parse(init.body) : null });
        try { window.dispatchEvent(new CustomEvent('offline-request-queued', { detail: { method, url: input } })); } catch (e) { }
        try { toastWarn('Acción encolada — se enviará cuando vuelva la conexión'); } catch (e) { }
      } catch (e) {
        logger.warn('Failed to queue request offline', e);
        try { toastError('No se pudo encolar la acción'); } catch (e) { }
      }
      // Return a synthetic 202 Accepted response indicating queued
      return new Response(JSON.stringify({ queued: true }), { status: 202, headers: { 'Content-Type': 'application/json' } });
    }

    const res = await fetchWithTimeout(input, init);

    // Handle rate limiting (429)
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10);
      logger.warn(`Rate limited. Retry after ${retryAfter}s`);
      // Dispatch event for UI to show user-friendly message
      try {
        window.dispatchEvent(new CustomEvent('rate-limited', {
          detail: { retryAfter, url: input }
        }));
      } catch (e) { }
      return res; // Return the 429 response for caller to handle
    }

    // Retry en errores 5xx
    if (res.status >= 500 && retryCount < MAX_RETRIES) {
      await delay(RETRY_DELAY * (retryCount + 1));
      return authFetch(input, init, retryCount + 1);
    }

    if (res.status === 401) {
      try { borrarToken(); } catch (e) { }
      // notify the app/other tabs
      try { window.dispatchEvent(new CustomEvent('unauthenticated')); } catch (e) { }
    }
    return res;
  } catch (error) {
    // Retry en errores de red
    if (isRetryableError(error) && retryCount < MAX_RETRIES) {
      await delay(RETRY_DELAY * (retryCount + 1));
      return authFetch(input, init, retryCount + 1);
    }
    // If network down and mutating request, attempt to queue
    const method = (init.method || 'GET').toUpperCase();
    if ((typeof navigator !== 'undefined' && !navigator.onLine) && method !== 'GET') {
      try {
        await queueRequest({ method, url: input, headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : null });
        try { window.dispatchEvent(new CustomEvent('offline-request-queued', { detail: { method, url: input } })); } catch (e) { }
        try { toastWarn('Acción encolada — se enviará cuando vuelva la conexión'); } catch (e) { }
      } catch (e) { }
      return new Response(JSON.stringify({ queued: true }), { status: 202, headers: { 'Content-Type': 'application/json' } });
    }
    throw error;
  }
}

async function authFetchJson(input, init = {}, options = {}) {
  const res = await authFetch(input, init);
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();

    // Zod validation disabled - causing too many false positives with production data
    // TODO: Re-enable when backend returns consistent data structures
    // const shouldValidate = options.validate !== false && (init.method || 'GET').toUpperCase() === 'GET';
    // if (shouldValidate && res.ok && data) {
    //   const validation = validateResponse(input, data, { strict: false, silent: options.silent });
    //   if (!validation.success && !options.silent) {
    //     logger.warn(`[Zod] API response validation warning for ${input}`);
    //   }
    // }

    return { res, data };
  }
  return { res, data: null };
}

export { authFetch, authFetchJson };
export default authFetch;
