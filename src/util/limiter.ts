export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

export function createLimiter(maxConcurrent: number): Limiter {
  if (maxConcurrent <= 0) {
    throw new Error("maxConcurrent must be greater than zero");
  }

  let activeCount = 0;
  const queue: Array<() => void> = [];

  const next = (): void => {
    if (activeCount >= maxConcurrent) {
      return;
    }
    const run = queue.shift();
    if (!run) {
      return;
    }
    run();
  };

  return async <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const execute = (): void => {
        activeCount += 1;
        task()
          .then(resolve, reject)
          .finally(() => {
            activeCount -= 1;
            next();
          });
      };

      queue.push(execute);
      next();
    });
}
