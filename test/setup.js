// Jest setup file
import '@testing-library/jest-dom';
import fetchMock from 'fetch-mock-jest';

// Mock de rrweb
jest.mock('rrweb', () => ({
  record: jest.fn((config) => {
    // Simular la función de stop que retorna record
    const stopFn = jest.fn();
    
    // Simular emisión de eventos
    if (config && config.emit) {
      // Emitir un snapshot inicial
      setTimeout(() => {
        config.emit({
          type: 2,
          data: { 
            node: { type: 0, childNodes: [] },
            initialOffset: { top: 0, left: 0 }
          },
          timestamp: Date.now()
        });
      }, 0);
    }
    
    return stopFn;
  }),
  pack: jest.fn((event) => event),
  EventType: {
    DomContentLoaded: 0,
    Load: 1,
    FullSnapshot: 2,
    IncrementalSnapshot: 3,
    Meta: 4,
    Custom: 5,
    Plugin: 6
  }
}));

// Mock de pako
jest.mock('pako', () => ({
  deflate: jest.fn((data) => {
    // Simular compresión retornando un Uint8Array
    return new Uint8Array(Buffer.from(JSON.stringify(data)));
  }),
  inflate: jest.fn((data) => {
    // Simular descompresión
    return JSON.parse(Buffer.from(data).toString());
  })
}));

// Mock de localforage
jest.mock('localforage', () => ({
  createInstance: jest.fn(() => ({
    setItem: jest.fn().mockResolvedValue(true),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(true),
    keys: jest.fn().mockResolvedValue([]),
    clear: jest.fn().mockResolvedValue(true)
  }))
}));

// Mock de uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9))
}));

// Global fetch mock
global.fetch = fetchMock;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = localStorageMock;

// Mock window properties
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000/test',
    hostname: 'localhost',
    pathname: '/test',
    search: '',
    hash: ''
  },
  writable: true
});

Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Testing) Jest',
    language: 'en-US',
    platform: 'Win32'
  },
  writable: true
});

Object.defineProperty(window, 'screen', {
  value: {
    width: 1920,
    height: 1080,
    colorDepth: 24
  },
  writable: true
});

// Reset mocks before each test
beforeEach(() => {
  fetchMock.reset();
  jest.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
});

afterEach(() => {
  fetchMock.restore();
});