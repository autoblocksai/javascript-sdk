const nodeMajorVersion = parseFloat(process.versions.node.split('.')[0]);

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  clearMocks: true,
  resetMocks: true,
  resetModules: true,
  testPathIgnorePatterns: ['node_modules', 'e2e'],
};
