/**
 * Tests for src/toast.js
 * 
 * Testing:
 * - Toast creation with different types
 * - Custom event dispatch
 * - Duration and options handling
 * - Undo callback support
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  toast,
  toastSuccess,
  toastError,
  toastWarn,
  toastInfo,
  toastWithUndo,
} from '../toast';

describe('toast.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.__clearDispatchedEvents();
  });

  describe('toast', () => {
    it('should dispatch CustomEvent with correct type', () => {
      toast('Hello', 'info');
      
      expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
      const event = global.__getDispatchedEvents()[0];
      expect(event.type).toBe('toast');
    });

    it('should include message in event detail', () => {
      toast('Test message', 'info');
      
      const event = global.__getDispatchedEvents()[0];
      expect(event.detail.message).toBe('Test message');
    });

    it('should include type in event detail', () => {
      toast('Message', 'error');
      
      const event = global.__getDispatchedEvents()[0];
      expect(event.detail.type).toBe('error');
    });

    it('should default to info type', () => {
      toast('Message');
      
      const event = global.__getDispatchedEvents()[0];
      expect(event.detail.type).toBe('info');
    });

    it('should include duration in event detail', () => {
      toast('Message', 'info', 5000);
      
      const event = global.__getDispatchedEvents()[0];
      expect(event.detail.duration).toBe(5000);
    });

    it('should default to 3000ms duration', () => {
      toast('Message');
      
      const event = global.__getDispatchedEvents()[0];
      expect(event.detail.duration).toBe(3000);
    });

    it('should include custom options in event detail', () => {
      toast('Message', 'info', 3000, { customProp: 'value' });
      
      const event = global.__getDispatchedEvents()[0];
      expect(event.detail.customProp).toBe('value');
    });
  });

  describe('toastSuccess', () => {
    it('should dispatch success toast', () => {
      toastSuccess('Operation successful');
      
      const event = global.__getDispatchedEvents()[0];
      expect(event.detail.type).toBe('success');
      expect(event.detail.message).toBe('Operation successful');
    });

    it('should accept custom duration', () => {
      toastSuccess('Success!', 5000);
      
      const event = global.__getDispatchedEvents()[0];
      expect(event.detail.duration).toBe(5000);
    });
  });

  describe('toastError', () => {
    it('should dispatch error toast', () => {
      toastError('Something went wrong');
      
      const event = global.__getDispatchedEvents()[0];
      expect(event.detail.type).toBe('error');
      expect(event.detail.message).toBe('Something went wrong');
    });

    it('should accept custom duration', () => {
      toastError('Error!', 10000);
      
      const event = global.__getDispatchedEvents()[0];
      expect(event.detail.duration).toBe(10000);
    });
  });

  describe('toastWarn', () => {
    it('should dispatch warn toast', () => {
      toastWarn('Be careful');
      
      const event = global.__getDispatchedEvents()[0];
      expect(event.detail.type).toBe('warn');
      expect(event.detail.message).toBe('Be careful');
    });
  });

  describe('toastInfo', () => {
    it('should dispatch info toast', () => {
      toastInfo('FYI');
      
      const event = global.__getDispatchedEvents()[0];
      expect(event.detail.type).toBe('info');
      expect(event.detail.message).toBe('FYI');
    });
  });

  describe('toastWithUndo', () => {
    it('should dispatch toast with undo callback', () => {
      const undoFn = vi.fn();
      toastWithUndo('Item deleted', undoFn);
      
      const event = global.__getDispatchedEvents()[0];
      expect(event.detail.type).toBe('info');
      expect(event.detail.message).toBe('Item deleted');
      expect(event.detail.undoCallback).toBe(undoFn);
      expect(event.detail.showUndo).toBe(true);
    });

    it('should default to 5000ms duration', () => {
      toastWithUndo('Deleted', vi.fn());
      
      const event = global.__getDispatchedEvents()[0];
      expect(event.detail.duration).toBe(5000);
    });

    it('should accept custom duration', () => {
      toastWithUndo('Deleted', vi.fn(), 10000);
      
      const event = global.__getDispatchedEvents()[0];
      expect(event.detail.duration).toBe(10000);
    });
  });
});
