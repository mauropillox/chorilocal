import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

// Make React available globally for JSX transforms
global.React = React

global.fetch = vi.fn()
global.localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
}

// Mock window.dispatchEvent
global.dispatchEvent = vi.fn()
