/**
 * Production-safe logger utility.
 * 
 * - In development: Logs to console
 * - In production: Silently ignores (or can send to Sentry)
 * 
 * Usage:
 *   import { logger } from './utils/logger';
 *   logger.error('Something failed', error);
 *   logger.warn('Potential issue', data);
 *   logger.info('Information', data);
 */

const isDev = import.meta.env.MODE === 'development';

// Optional: Import Sentry for production error tracking
// import * as Sentry from '@sentry/react';

/**
 * Centralized logger that respects environment
 */
export const logger = {
    /**
     * Log error messages - only in development
     * In production, consider sending to Sentry
     */
    error: (message, ...args) => {
        if (isDev) {
            console.error(`[ERROR] ${message}`, ...args);
        }
        // Production: Uncomment when Sentry is configured
        // else if (typeof Sentry !== 'undefined') {
        //   Sentry.captureException(args[0] instanceof Error ? args[0] : new Error(message));
        // }
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
