// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextJest = require('next/jest')
const createJestConfig = nextJest({ dir: './' })
module.exports = createJestConfig({
  setupFilesAfterEnv: ['<rootDir>/jest.e2e.setup.js'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/generated/prisma/client(?:\\.js)?$': '<rootDir>/.e2e-generated/index.js',
    '^\\.\\./generated/prisma/client(?:\\.js)?$': '<rootDir>/.e2e-generated/index.js',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/e2e/**/*.test.[jt]s?(x)'],
  transformIgnorePatterns: ['/node_modules/(?!(?:@auth|@prisma|\\.prisma)/)'],
  maxWorkers: 1,
})
