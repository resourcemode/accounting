module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/test/**/*.test.ts'
  ],
  roots: ['<rootDir>/src/', '<rootDir>/test/'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.interface.ts'
  ],
  coverageDirectory: './coverage',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^test/(.*)$': '<rootDir>/test/$1',
    '^@models/(.*)$': '<rootDir>/db/models/$1'
  },
  moduleDirectories: ['node_modules', 'src'],
  modulePaths: ['<rootDir>'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js']
};
