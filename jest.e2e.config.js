// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextJest = require('next/jest')
const createJestConfig = nextJest({ dir: './' })
module.exports = createJestConfig({
  setupFilesAfterEnv: ['<rootDir>/jest.e2e.setup.js'],
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testMatch: ['<rootDir>/e2e/**/*.test.[jt]s?(x)'],
  maxWorkers: 1,
})
