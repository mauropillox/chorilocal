/**
 * Centralized API error handling utilities.
 * Provides consistent error extraction and user-friendly messages.
 */
import { logger } from './logger';

/**
 * Extracts error message from various API error response formats.
 * Handles FastAPI validation errors, HTTPException details, and network errors.
 * 
 * @param {Error|Response|Object} error - The error object
 * @param {string} fallback - Fallback message if no error can be extracted
 * @returns {string} User-friendly error message
 */
export function extractErrorMessage(error, fallback = 'Error desconocido') {
    if (!error) return fallback;

    // String error
    if (typeof error === 'string') return error;

    // FastAPI validation error format: { detail: [{ msg, loc, type }] }
    if (error.detail && Array.isArray(error.detail)) {
        return error.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
    }

    // FastAPI HTTPException format: { detail: "message" }
    if (error.detail && typeof error.detail === 'string') {
        return error.detail;
    }

    // Standard Error object
    if (error.message) return error.message;

    // Object with error field
    if (error.error) {
        return typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
    }

    // Response object (from fetch)
    if (error.statusText) return error.statusText;

    // Unknown object - try to stringify
    try {
        return JSON.stringify(error);
    } catch {
        return fallback;
    }
}

/**
 * Extracts error from a fetch Response.
 * Attempts to parse JSON body, falls back to status text.
 * 
 * @param {Response} response - Fetch response object
 * @returns {Promise<string>} Error message
 */
export async function extractResponseError(response) {
    if (!response) return 'Error de conexión';

    try {
        const contentType = response.headers?.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await response.json();
            return extractErrorMessage(data, response.statusText);
        }
        return response.statusText || `Error ${response.status}`;
    } catch {
        return response.statusText || `Error ${response.status}`;
    }
}

/**
 * User-friendly error messages for common HTTP status codes.
 */
export const HTTP_ERROR_MESSAGES = {
    400: 'Datos inválidos',
    401: 'Sesión expirada. Iniciá sesión nuevamente.',
    403: 'No tenés permiso para esta acción',
    404: 'No encontrado',
    409: 'Conflicto: el recurso ya existe o está siendo modificado',
    422: 'Error de validación',
    429: 'Demasiadas solicitudes. Esperá un momento.',
    500: 'Error interno del servidor',
    502: 'Servidor no disponible',
    503: 'Servicio temporalmente no disponible',
    504: 'Tiempo de espera agotado',
};

/**
 * Gets user-friendly message for HTTP status code.
 * 
 * @param {number} status - HTTP status code
 * @returns {string} User-friendly message
 */
export function getHttpErrorMessage(status) {
    return HTTP_ERROR_MESSAGES[status] || `Error ${status}`;
}

/**
 * Safe localStorage wrapper that handles errors.
 */
export const safeStorage = {
    getItem(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item !== null ? item : defaultValue;
        } catch {
            logger.warn(`localStorage.getItem failed for key: ${key}`);
            return defaultValue;
        }
    },

    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            logger.warn(`localStorage.setItem failed for key: ${key}`, e);
            return false;
        }
    },

    removeItem(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch {
            logger.warn(`localStorage.removeItem failed for key: ${key}`);
            return false;
        }
    },

    getJSON(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch {
            return defaultValue;
        }
    },

    setJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch {
            logger.warn(`localStorage.setJSON failed for key: ${key}`);
            return false;
        }
    },
};
