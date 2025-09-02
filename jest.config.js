module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/test/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/__tests__/**/*.test.ts', '!<rootDir>/src/__tests__/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts']
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/__tests__/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts']
    }
  ]
};