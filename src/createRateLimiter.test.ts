import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './createRateLimiter.js';

describe('createRateLimiter', () => {
  it('allows each caller so many in a window, and as many again in the next', () => {
    let now = 0;
    const limiter = createRateLimiter(2, 1000, () => now);

    expect([limiter.allows('a'), limiter.allows('a'), limiter.allows('a')]).toEqual([
      true,
      true,
      false,
    ]);
    expect(limiter.allows('b')).toBe(true);

    now = 1000;

    expect(limiter.allows('a')).toBe(true);
  });
});
