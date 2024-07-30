import { AsyncLocalStorage } from 'node:async_hooks';

export const testCaseRunAsyncLocalStorage = new AsyncLocalStorage<{
  testCaseHash: string;
  testId: string;
  runId: string;
}>();

// This gets exported from the testing package since it is testing related.
// See testing/index.ts
export const gridSearchAsyncLocalStorage = new AsyncLocalStorage<
  Record<string, string> | undefined
>();
