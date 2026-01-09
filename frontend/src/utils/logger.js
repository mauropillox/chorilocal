/**
 * Production-safe logger utility.
 * 
 * - In development: Logs to console
 * - In production: Sends errors to Sentry (if configured)
 * 
 * Usage:
 *   import { logger } from './utils/logger';
 *   logger.error('Something failed', error);
 *   logger.warn('Potential issue', data);
 *   logger.info('Information', data);
 */

const isDev = import.meta.env.MODE === 'development';

// Lazy-load Sentry to avoid import errors if not installed
let Sentry = null;
const getSentry = async () => {
    if (Sentry === null && !isDev && import.meta.env.VITE_SENTRY_DSN) {
        try {
            Sentry = await import('@sentry/react');
        } catch {
            Sentry = undefined; // Mark as unavailable
        }
    }
    return Sentry;
};

/**
 * Centralized logger that respects environment
 */
export const logger = {
    /**
     * Log error messages
     * - Development: logs to console
     * - Production: sends to Sentry
     */
    error: (message, ...args) => {
        if (isDev) {
            console.error(`[ERROR] ${message}`, ...args);
        } else {
            // Production: send to Sentry
            getSentry().then(s => {
                if (s && s.captureException) {
                    const error = args[0] instanceof Error ? args[0] : new Error(String(message));
                    s.captureException(error, { extra: { message, args } });
                }
            });
        }
    },

    /**
     * Log warning messages - only in development
     */
    warn: (message, ...args) => {
        if (isDev) {
            console.warn(`[WARN] ${message}`, ...args);
        }
    },

    /**
     * Log info messages - only in development
     */
    info: (message, ...args) => {
        if (isDev) {
            console.info(`[INFO] ${message}`, ...args);
        }
    },

    /**
     * Log debug messages - only in development
     */
    debug: (message, ...args) => {
        if (isDev) {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    },
};

export default logger;
