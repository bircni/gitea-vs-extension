// ...existing code...
import { createLimiter } from "../util/limiter";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

test("createLimiter enforces serial execution with maxConcurrent=1", async () => {
  const limiter = createLimiter(1);
  const events: string[] = [];

  const taskA = limiter(async () => {
    events.push("startA");
    await delay(20);
    events.push("endA");
    return "A";
  });

  const taskB = limiter(async () => {
    events.push("startB");
    events.push("endB");
    return "B";
  });

  const results = await Promise.all([taskA, taskB]);

  expect(results).toEqual(["A", "B"]);
  expect(events).toEqual(["startA", "endA", "startB", "endB"]);
});

test("createLimiter rejects invalid maxConcurrent values", () => {
  expect(() => createLimiter(0)).toThrow(/maxConcurrent/);
});

test("createLimiter allows two concurrent tasks", async () => {
  const limiter = createLimiter(2);
  let started = 0;
  let gateResolve: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    gateResolve = resolve;
  });

  const task = (label: string) =>
    limiter(async () => {
      started += 1;
      if (started === 2) {
        gateResolve?.();
      }
      await gate;
      return label;
    });

  const taskA = task("A");
  const taskB = task("B");
  const taskC = task("C");

  await gate;
  expect(started).toBe(2);

  const results = await Promise.all([taskA, taskB, taskC]);
  expect(started).toBe(3);
  expect(results.sort()).toEqual(["A", "B", "C"]);
});
