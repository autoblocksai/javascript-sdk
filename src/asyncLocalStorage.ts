import { AsyncLocalStorage } from 'async_hooks';

export const testCaseAsyncLocalStorage = new AsyncLocalStorage<{
  testCaseHash: string;
  testId: string;
}>();
