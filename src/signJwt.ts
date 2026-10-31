import { createPrivateKey, sign } from 'node:crypto';
import { base64url } from './base64url.js';

/**
 * Signs a JSON Web Token with a private key: ES256 for Apple's push service, RS256 for Google's.
 *
 * @param algorithm - Which signature.
 * @param privateKeyPem - The key, as PEM.
 * @param header - Header fields beyond the algorithm and type.
 * @param claims - What it says.
 * @returns The token.
 */
const signJwt = (
  algorithm: 'ES256' | 'RS256',
  privateKeyPem: string,
  header: Record<string, string>,
  claims: Record<string, string | number>,
): string => {
  const unsigned = `${base64url(JSON.stringify({ alg: algorithm, typ: 'JWT', ...header }))}.${base64url(JSON.stringify(claims))}`;
  const signature = sign('sha256', Buffer.from(unsigned), {
    key: createPrivateKey(privateKeyPem),
    ...(algorithm === 'ES256' ? { dsaEncoding: 'ieee-p1363' as const } : {}),
  });

  return `${unsigned}.${base64url(signature)}`;
};

export { signJwt };
