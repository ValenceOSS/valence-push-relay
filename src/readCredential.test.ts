import { describe, expect, it } from 'vitest';
import { readCredential } from './readCredential.js';
import { signCredential } from './signCredential.js';

const KEY = 'k'.repeat(32);

const OLD_KEY = 'o'.repeat(32);

const CREDENTIAL = {
  serverId: '0b8c9a3e-5c1a-4b7e-9f0d-2a3b4c5d6e7f',
  issuedAt: 1,
  expiresAt: 2,
};

describe('readCredential', () => {
  it('believes one signed with a key the relay still holds', () => {
    expect(readCredential(signCredential(CREDENTIAL, OLD_KEY), [KEY, OLD_KEY])).toEqual(CREDENTIAL);
  });

  it('believes nothing signed by anybody else, or changed after signing', () => {
    const [version, , signature] = signCredential(CREDENTIAL, KEY).split('.');
    const forged = Buffer.from(JSON.stringify({ sid: CREDENTIAL.serverId, iat: 1, exp: 9e12 }));

    expect(readCredential(signCredential(CREDENTIAL, 'x'.repeat(32)), [KEY])).toBeNull();
    expect(
      readCredential(`${version}.${forged.toString('base64url')}.${signature}`, [KEY]),
    ).toBeNull();
    expect(readCredential('nonsense', [KEY])).toBeNull();
  });
});
