import crypto from 'crypto';
import { Evaluation } from './models';

interface Waiter {
  done: boolean;
  wakeUp: () => void;
}

/**
 * Implementation of a Semaphore class to control the number of
 * concurrent operations for a given task.
 *
 * https://github.com/python/cpython/blob/5dc8c84d397110f9edfa56793ad8887b1f176d79/Lib/asyncio/locks.py#L352
 */
export class Semaphore {
  private available: number;
  private waiters: Set<Waiter>;

  constructor(max: number) {
    this.available = max;
    this.waiters = new Set<Waiter>();
  }

  private makeNewWaiter(): { waiter: Waiter; promise: Promise<void> } {
    const waiter: Waiter = { done: false, wakeUp: () => {} };

    const promise = new Promise<void>((resolve) => {
      waiter.wakeUp = resolve;
      this.waiters.add(waiter);
    }).finally(() => {
      waiter.done = true;
    });

    return { waiter, promise };
  }

  private async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--;
      return;
    }

    const { promise, waiter } = this.makeNewWaiter();

    try {
      try {
        await promise;
      } finally {
        this.waiters.delete(waiter);
      }
    } finally {
      while (this.available > 0) {
        if (!this.wakeUpNext()) {
          break;
        }
      }
    }
  }

  private release(): void {
    this.available++;
    this.wakeUpNext();
  }

  private wakeUpNext(): boolean {
    for (const waiter of this.waiters) {
      if (!waiter.done) {
        this.available--;
        waiter.wakeUp();
        return true;
      }
    }
    return false;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

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

/**
 * Generates the Cartesian product of multiple arrays.
 *
 * @param arrays - An array of arrays, each containing elements of type T.
 *                 It generates all possible combinations where each combination
 *                 contains one element from each array.
 *
 * @returns An array of arrays, where each inner array is a combination of elements
 *          from the input arrays.
 *
 * @example
 * // returns [['1', '3', '4'], ['2', '3', '4']]
 * cartesianProduct(['1', '2'], ['3'], ['4']);
 */
export function cartesianProduct<T>(
  ...arrays: Array<Array<T>>
): Array<Array<T>> {
  return arrays.reduce<Array<Array<T>>>(
    (acc, array) => {
      return acc.flatMap((accItem) => {
        return array.map((arrayItem) => {
          return [...accItem, arrayItem];
        });
      });
    },
    [[]],
  );
}

/**
 * Generates all combinations of parameters for a grid search.
 *
 * @example
 * // returns [{ a: '1', b: '3' }, { a: '1', b: '4' }, { a: '2', b: '3' }, { a: '2', b: '4' }]
 * makeGridSearchParamCombos({ a: ['1', '2'], b: ['3', '4'] });
 */
export function makeGridSearchParamCombos(
  params: Record<string, string[]>,
): Record<string, string>[] {
  const keys = Object.keys(params);
  const values = Object.values(params);
  const combinations = cartesianProduct(...values);

  return combinations.map((combination) => {
    return keys.reduce(
      (acc, key, index) => {
        acc[key] = combination[index];
        return acc;
      },
      {} as Record<string, string>,
    );
  });
}

export function determineIfEvaluationPassed(args: {
  evaluation: Evaluation;
}): boolean | undefined {
  const results: boolean[] = [];
  const { score, threshold } = args.evaluation;
  if (threshold?.lt !== undefined) {
    results.push(score < threshold.lt);
  }
  if (threshold?.lte !== undefined) {
    results.push(score <= threshold.lte);
  }
  if (threshold?.gt !== undefined) {
    results.push(score > threshold.gt);
  }
  if (threshold?.gte !== undefined) {
    results.push(score >= threshold.gte);
  }
  if (results.length === 0) {
    return undefined;
  }
  return results.every((r) => r);
}
