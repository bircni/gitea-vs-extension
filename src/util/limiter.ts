export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

export function createLimiter(maxConcurrent: number): Limiter {
  if (maxConcurrent <= 0) {
    throw new Error("maxConcurrent must be greater than zero");
  }

  let activeCount = 0;
  const queue: (() => void)[] = [];

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
    new Promise<T>((resolve) => {
      const execute = async (): Promise<void> => {
        activeCount += 1;
        const running = task();
        // Adopting the task promise forwards its settlement — value or rejection reason — as is.
        resolve(running);
        try {
          await running;
        } catch {
          // Already surfaced to the caller through the adopted promise.
        } finally {
          activeCount -= 1;
          next();
        }
      };

      queue.push(() => void execute());
      next();
    });
}
