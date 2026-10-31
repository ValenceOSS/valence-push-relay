import { describe, expect, it } from 'vitest';
import { readCredential } from './readCredential.js';
import { signCredential } from './signCredential.js';

const KEY = 'k'.repeat(32);

const CREDENTIAL = {
  serverId: '0b8c9a3e-5c1a-4b7e-9f0d-2a3b4c5d6e7f',
  issuedAt: 1,
  expiresAt: 2,
};

describe('signCredential', () => {
  it('writes a credential the relay can read back', () => {
    const written = signCredential(CREDENTIAL, KEY);

    expect(written.startsWith('v1.')).toBe(true);
    expect(readCredential(written, [KEY])).toEqual(CREDENTIAL);
  });
});
