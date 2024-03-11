import crypto from 'crypto';

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
  } else {
    return testCaseHash(testCase);
  }
}
