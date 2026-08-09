module.exports = {
  setupFilesAfterEnv: ['<rootDir>/jest.e2e.setup.js'],
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testMatch: ['<rootDir>/src/__e2e__/**/*.test.ts'],
  collectCoverage: false,
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: { module: 'ESNext' } }],
    '^.+\\.cts$': ['ts-jest', { useESM: false, tsconfig: { module: 'CommonJS' } }],
  },
}
