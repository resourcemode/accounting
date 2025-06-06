// Import the existing setupJest.ts logic to maintain compatibility
require('../src/tests/setupJest');

// Set longer timeout for integration tests
jest.setTimeout(30000);

// Global setup
beforeAll(() => {
  console.log('Starting test suite...');
});

// Global teardown
afterAll(() => {
  console.log('All tests completed.');
});
