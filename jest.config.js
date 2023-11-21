const nodeMajorVersion = parseFloat(process.versions.node.split('.')[0]);

const testFilesToMinimumNodeVersion = {
  'ai-jsx.spec.tsx': 18,
  'langchain.spec.ts': 18,
};

const testFilesToIgnore = Object.entries(testFilesToMinimumNodeVersion)
  .map(([file, minVersion]) => {
    return nodeMajorVersion < minVersion ? file : undefined;
  })
  .filter(Boolean);

if (testFilesToIgnore.length) {
  console.log(
    `Ignoring test files for node version ${nodeMajorVersion}: ${testFilesToIgnore.join(
      ', ',
    )}`,
  );
}

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts', '**/*.spec.tsx'],
  clearMocks: true,
  resetMocks: true,
  resetModules: true,
  testPathIgnorePatterns: ['node_modules', 'e2e', ...testFilesToIgnore],
};
