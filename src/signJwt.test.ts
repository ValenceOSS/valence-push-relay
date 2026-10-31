import { createPublicKey, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { aKeyPair } from './aKeyPair.js';
import { signJwt } from './signJwt.js';

describe('signJwt', () => {
  it('signs with ES256 in the form Apple reads, which a public key can check', () => {
    const key = aKeyPair('ec');
    const token = signJwt('ES256', key, { kid: 'ABC' }, { iss: 'TEAM', iat: 1 });
    const [header, claims, signature] = token.split('.');

    expect(JSON.parse(Buffer.from(header ?? '', 'base64url').toString())).toEqual({
      alg: 'ES256',
      typ: 'JWT',
      kid: 'ABC',
    });
    expect(JSON.parse(Buffer.from(claims ?? '', 'base64url').toString())).toEqual({
      iss: 'TEAM',
      iat: 1,
    });
    expect(
      verify(
        'sha256',
        Buffer.from(`${header}.${claims}`),
        { key: createPublicKey(key), dsaEncoding: 'ieee-p1363' },
        Buffer.from(signature ?? '', 'base64url'),
      ),
    ).toBe(true);
  });

  it('signs with RS256 for Google', () => {
    const key = aKeyPair('rsa');
    const [header, claims, signature] = signJwt('RS256', key, {}, { iss: 'me' }).split('.');

    expect(
      verify(
        'sha256',
        Buffer.from(`${header}.${claims}`),
        createPublicKey(key),
        Buffer.from(signature ?? '', 'base64url'),
      ),
    ).toBe(true);
  });
});
