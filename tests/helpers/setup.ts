// Jest setup file
// This runs before all tests

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/szamla_api_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.API_KEY_SECRET = 'test-secret-key-for-testing-only';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Add custom matchers if needed
// expect.extend({...});

// Global test timeout
jest.setTimeout(10000);
