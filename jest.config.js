/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts', '**/*.spec.tsx'],
  clearMocks: true,
  resetMocks: true,
  resetModules: true,
  restoreMocks: true,
  testPathIgnorePatterns: ['node_modules', 'e2e'],
};
