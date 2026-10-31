import { readFileSync } from 'node:fs';

/**
 * Reads the servers the relay has turned away, one identifier to a line, and reads the file again
 * at most once a minute, so turning one away needs no restart. A missing file turns nobody away.
 *
 * @param path - The file, or nothing where there is none.
 * @param now - The clock.
 * @param read - How to read the file, so a test need not.
 * @returns A way to ask who is turned away.
 */
const readRevoked = (
  path: string | null,
  now: () => number = Date.now,
  read: (at: string) => string = (at) => readFileSync(at, 'utf8'),
): (() => ReadonlySet<string>) => {
  let held = new Set<string>();
  let readAt = Number.NEGATIVE_INFINITY;

  return () => {
    if (path === null || now() - readAt < 60_000) {
      return held;
    }

    readAt = now();

    try {
      held = new Set(
        read(path)
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !line.startsWith('#')),
      );
    } catch {
      held = new Set();
    }

    return held;
  };
};

export { readRevoked };
