import crypto from 'crypto';

export function isPrimitive(value: unknown): boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

export function makeTestCaseHash<TestCaseType>(
  testCase: TestCaseType,
  testCaseHash:
    | (keyof TestCaseType & string)[]
    | ((testCase: TestCaseType) => string),
): string {
  if (Array.isArray(testCaseHash)) {
    const concatenated = testCaseHash
      .map((key) => JSON.stringify(testCase[key]))
      .join('');
    return crypto.createHash('md5').update(concatenated).digest('hex');
  }

  return testCaseHash(testCase);
}
