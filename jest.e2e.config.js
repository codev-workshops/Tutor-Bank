/* eslint-disable @typescript-eslint/no-require-imports */
const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

module.exports = createJestConfig({
  setupFilesAfterEnv: ['<rootDir>/jest.e2e.setup.js'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@auth/prisma-adapter$': '<rootDir>/src/__e2e__/prisma-adapter-bridge.js',
    '^next-auth/providers/credentials$': '<rootDir>/src/__e2e__/credentials-provider-bridge.js',
  },
  testMatch: ['<rootDir>/src/__e2e__/**/*.e2e.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  transformIgnorePatterns: [],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { useESM: true, tsconfig: { module: 'NodeNext' } }],
  },
  collectCoverage: false,
})
