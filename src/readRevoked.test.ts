import { describe, expect, it } from 'vitest';
import { readRevoked } from './readRevoked.js';

describe('readRevoked', () => {
  it('reads one server to a line, passing over blanks and remarks, at most once a minute', () => {
    let now = 0;
    let file = '# turned away\nabc\n\ndef\n';
    const revoked = readRevoked(
      '/revoked',
      () => now,
      () => file,
    );

    expect([...revoked()]).toEqual(['abc', 'def']);

    file = 'ghi\n';

    expect([...revoked()]).toEqual(['abc', 'def']);

    now = 60_000;

    expect([...revoked()]).toEqual(['ghi']);
  });

  it('turns nobody away where there is no file', () => {
    expect(readRevoked(null)().size).toBe(0);
    expect(
      readRevoked('/missing', Date.now, () => {
        throw new Error('missing');
      })().size,
    ).toBe(0);
  });
});
