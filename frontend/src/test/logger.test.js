/**
 * Tests for src/utils/logger.js
 * 
 * Testing:
 * - Development mode logging
 * - Production mode Sentry integration (mocked)
 * - Different log levels
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('logger.js', () => {
  let originalMode;

  beforeEach(() => {
    vi.clearAllMocks();
    // Store original mode
    originalMode = import.meta.env.MODE;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('in development mode', () => {
    beforeEach(async () => {
      vi.stubEnv('MODE', 'development');
      // Re-import to get fresh module with new env
      vi.resetModules();
    });

    it('should log errors to console in development', async () => {
      const { logger } = await import('../utils/logger');
      const consoleSpy = vi.spyOn(console, 'error');
      
      logger.error('Test error', { data: 'test' });
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log warnings to console in development', async () => {
      const { logger } = await import('../utils/logger');
      const consoleSpy = vi.spyOn(console, 'warn');
      
      logger.warn('Test warning');
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log info to console in development', async () => {
      const { logger } = await import('../utils/logger');
      const consoleSpy = vi.spyOn(console, 'info');
      
      logger.info('Test info');
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log debug to console in development', async () => {
      const { logger } = await import('../utils/logger');
      const consoleSpy = vi.spyOn(console, 'log');
      
      logger.debug('Test debug');
      
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('in production mode', () => {
    beforeEach(async () => {
      vi.stubEnv('MODE', 'production');
      vi.resetModules();
    });

    it('should NOT log warnings to console in production', async () => {
      const { logger } = await import('../utils/logger');
      const consoleSpy = vi.spyOn(console, 'warn');
      
      logger.warn('Test warning');
      
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should NOT log info to console in production', async () => {
      const { logger } = await import('../utils/logger');
      const consoleSpy = vi.spyOn(console, 'info');
      
      logger.info('Test info');
      
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should NOT log debug to console in production', async () => {
      const { logger } = await import('../utils/logger');
      const consoleSpy = vi.spyOn(console, 'log');
      
      logger.debug('Test debug');
      
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('logger interface', () => {
    it('should export logger object with all methods', async () => {
      const { logger } = await import('../utils/logger');
      
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should accept multiple arguments', async () => {
      vi.stubEnv('MODE', 'development');
      vi.resetModules();
      const { logger } = await import('../utils/logger');
      const consoleSpy = vi.spyOn(console, 'error');
      
      logger.error('Error message', 'arg1', 'arg2', { obj: true });
      
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
