import { AsyncLocalStorage } from 'async_hooks';

export const testCaseRunAsyncLocalStorage = new AsyncLocalStorage<{
  testCaseHash: string;
  testId: string;
}>();
