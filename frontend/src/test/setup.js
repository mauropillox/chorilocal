import '@testing-library/jest-dom';
import { vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

// Make React available globally for JSX transforms
global.React = React;

// Mock localStorage with actual storage behavior
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i) => Object.keys(store)[i] || null),
    // Helper to reset store between tests
    __reset: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch
global.fetch = vi.fn();

// Mock window.dispatchEvent with event tracking
const dispatchedEvents = [];
global.dispatchEvent = vi.fn((event) => {
  dispatchedEvents.push(event);
  return true;
});
global.__getDispatchedEvents = () => dispatchedEvents;
global.__clearDispatchedEvents = () => {
  dispatchedEvents.length = 0;
};

// Mock window.addEventListener for storage events
const storageListeners = [];
global.addEventListener = vi.fn((type, handler) => {
  if (type === 'storage') {
    storageListeners.push(handler);
  }
});
global.removeEventListener = vi.fn((type, handler) => {
  if (type === 'storage') {
    const idx = storageListeners.indexOf(handler);
    if (idx > -1) storageListeners.splice(idx, 1);
  }
});

// Mock CustomEvent
global.CustomEvent = class CustomEvent extends Event {
  constructor(type, eventInitDict = {}) {
    super(type);
    this.detail = eventInitDict.detail || null;
  }
};

// Mock import.meta.env
vi.stubGlobal('import', {
  meta: {
    env: {
      MODE: 'test',
      VITE_API_URL: 'http://localhost:8000',
      VITE_SENTRY_DSN: undefined,
    },
  },
});

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.__reset();
  global.__clearDispatchedEvents();
});

// Clean up after tests
afterEach(() => {
  vi.restoreAllMocks();
});

// Mock console methods to suppress expected errors in tests
global.console = {
  ...console,
  // Keep error/warn for debugging but allow suppression
  error: vi.fn(),
  warn: vi.fn(),
  log: console.log,
  info: console.info,
  debug: console.debug,
};
