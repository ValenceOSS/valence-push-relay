/**
 * Counts what each caller has asked for in a window of time and says when one has asked too often,
 * held in memory, since a restart forgetting the counts costs nothing.
 *
 * @param limit - How many asks a window allows.
 * @param windowMs - How long a window lasts.
 * @param now - The clock.
 * @returns A way to ask whether one more is allowed.
 */
const createRateLimiter = (limit: number, windowMs: number, now: () => number = Date.now) => {
  const windows = new Map<string, { startedAt: number; count: number }>();

  return {
    allows: (key: string): boolean => {
      const at = now();

      if (windows.size > 100_000) {
        for (const [held, window] of windows) {
          if (at - window.startedAt >= windowMs) {
            windows.delete(held);
          }
        }
      }

      const window = windows.get(key);

      if (window === undefined || at - window.startedAt >= windowMs) {
        windows.set(key, { startedAt: at, count: 1 });

        return true;
      }

      window.count += 1;

      return window.count <= limit;
    },
  };
};

export { createRateLimiter };
