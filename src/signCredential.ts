import { createHmac } from 'node:crypto';
import { base64url } from './base64url.js';
import type { Credential } from './Credential.types.js';

/**
 * Writes the credential a server proves itself with: what it says, signed with the relay's key, so
 * the relay can believe it later without having kept anything.
 *
 * @param credential - Which server, and for how long.
 * @param key - The relay's signing key.
 * @returns The credential.
 */
const signCredential = (credential: Credential, key: string): string => {
  const said = base64url(
    JSON.stringify({
      sid: credential.serverId,
      iat: credential.issuedAt,
      exp: credential.expiresAt,
    }),
  );

  return `v1.${said}.${base64url(createHmac('sha256', key).update(`v1.${said}`).digest())}`;
};

export { signCredential };
