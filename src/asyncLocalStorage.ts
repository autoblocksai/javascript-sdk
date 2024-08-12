import { AsyncLocalStorage } from 'node:async_hooks';
import { HumanReviewField } from './testing/models';

export const testCaseRunAsyncLocalStorage = new AsyncLocalStorage<{
  testCaseHash: string;
  testId: string;
  runId: string;
  testEvents: {
    message: string;
    traceId: string | undefined;
    timestamp: string;
    properties: object;
    systemProperties: {
      humanReviewFields: HumanReviewField[] | undefined;
    };
  }[];
}>();

// This gets exported from the testing package since it is testing related.
// See testing/index.ts
export const gridSearchAsyncLocalStorage = new AsyncLocalStorage<
  Record<string, string> | undefined
>();
