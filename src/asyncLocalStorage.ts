import { AsyncLocalStorage } from 'node:async_hooks';

export const testCaseRunAsyncLocalStorage = new AsyncLocalStorage<{
  testCaseHash: string;
  testId: string;
  runId: string;
}>();
