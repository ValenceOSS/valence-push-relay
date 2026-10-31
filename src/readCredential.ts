import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { readJson } from './readJson.js';
import type { Credential } from './Credential.types.js';

const ClaimsSchema = z.object({
  sid: z.string().uuid(),
  iat: z.number().int(),
  exp: z.number().int(),
});

/**
 * Reads a credential a server presented, believing it only where the relay's own key signed it.
 * Any key the relay has signed with is tried, so the key can be changed without every server
 * registering again.
 *
 * @param presented - What the server sent.
 * @param keys - Every key the relay signs or has signed with.
 * @returns What it says, or nothing where it is not one of the relay's.
 */
const readCredential = (presented: string, keys: readonly string[]): Credential | null => {
  const [version, said, signature] = presented.split('.');

  if (version !== 'v1' || said === undefined || signature === undefined) {
    return null;
  }

  const given = Buffer.from(signature, 'base64url');
  const isSigned = keys.some((key) => {
    const expected = createHmac('sha256', key).update(`v1.${said}`).digest();

    return expected.length === given.length && timingSafeEqual(expected, given);
  });

  if (!isSigned) {
    return null;
  }

  const claims = ClaimsSchema.safeParse(readJson(Buffer.from(said, 'base64url').toString('utf8')));

  return claims.success
    ? { serverId: claims.data.sid, issuedAt: claims.data.iat, expiresAt: claims.data.exp }
    : null;
};

export { readCredential };
