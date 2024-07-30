import {
  Semaphore,
  cartesianProduct,
  makeGridSearchParamCombos,
} from '../../src/testing/util';

describe('Semaphore', () => {
  it('initializes with the correct available count', () => {
    const max = 3;
    const semaphore = new Semaphore(max);
    expect(semaphore['available']).toBe(max);
  });

  it('acquires and releases correctly', async () => {
    const semaphore = new Semaphore(1);
    await semaphore.run(async () => {
      expect(semaphore['available']).toBe(0);
    });
    expect(semaphore['available']).toBe(1);
  });

  it('releases if the wrapped function throws an error', async () => {
    const semaphore = new Semaphore(1);
    try {
      await semaphore.run(async () => {
        expect(semaphore['available']).toBe(0);
        throw new Error('oops');
      });
    } catch {
      // Expected
    }

    expect(semaphore['available']).toBe(1);
  });

  it('does not allow more than max concurrent operations', async () => {
    const max = 2;
    const semaphore = new Semaphore(max);

    let running = 0;
    const increaseRunning = async () => {
      running++;
      expect(running).toBeLessThanOrEqual(max);
      await new Promise((resolve) => setTimeout(resolve, 50));
      running--;
    };

    await Promise.all([
      semaphore.run(increaseRunning),
      semaphore.run(increaseRunning),
      semaphore.run(increaseRunning),
      semaphore.run(increaseRunning),
    ]);
  });

  it('queues tasks correctly when full', async () => {
    const semaphore = new Semaphore(1);
    let firstTaskDone = false;
    let secondTaskDone = false;

    const firstTask = async () => {
      // There should be no availability and two waiters (the second task and the third task)
      expect(semaphore['available']).toBe(0);
      expect(semaphore['waiters'].size).toBe(2);

      await new Promise((resolve) => setTimeout(resolve, 50));
      firstTaskDone = true;
    };

    const secondTask = async () => {
      // There should be no availability and one waiter (the third task)
      expect(semaphore['available']).toBe(0);
      expect(semaphore['waiters'].size).toBe(1);
      expect(firstTaskDone).toBe(true);

      secondTaskDone = true;
    };

    const thirdTask = async () => {
      // There should be no availability and no waiters
      expect(semaphore['available']).toBe(0);
      expect(semaphore['waiters'].size).toBe(0);
      expect(firstTaskDone).toBe(true);
      expect(secondTaskDone).toBe(true);
    };

    await Promise.all([
      semaphore.run(firstTask),
      semaphore.run(secondTask),
      semaphore.run(thirdTask),
    ]);
  });
});

describe('cartesianProduct', () => {
  it('returns the correct cartesian product', () => {
    const result = cartesianProduct([1, 2], [3, 4]);
    expect(result).toEqual([
      [1, 3],
      [1, 4],
      [2, 3],
      [2, 4],
    ]);
  });
});

describe('makeGridSearchParamCombos', () => {
  it('Returns the correct grid search combinations', () => {
    const result = makeGridSearchParamCombos({
      a: ['1', '2'],
      b: ['3', '4'],
    });
    expect(result).toEqual([
      { a: '1', b: '3' },
      { a: '1', b: '4' },
      { a: '2', b: '3' },
      { a: '2', b: '4' },
    ]);
  });
});
