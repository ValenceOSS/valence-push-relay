import { z } from 'zod';
import { readJson } from './readJson.js';
import { signJwt } from './signJwt.js';
import type { FirebaseAccount } from './FirebaseAccount.types.js';
import type { PushSender } from './Push.types.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

const AccessTokenSchema = z.object({ access_token: z.string(), expires_in: z.number() });

const FirebaseRefusalSchema = z.object({
  error: z.object({
    status: z.string().optional(),
    details: z.array(z.object({ errorCode: z.string().optional() })).optional(),
  }),
});

type FirebaseSenderOptions = {
  account: FirebaseAccount;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  timeoutMs?: number;
};

/**
 * Sends a push to an Android phone through Firebase Cloud Messaging: a data message alone, carrying
 * only the delivery's and the server's identifiers, which the app wakes for, reads from the server
 * and shows itself. Google is asked for an access token with the service account, and it is kept
 * until shortly before it runs out.
 *
 * @param options - The service account, and how to fetch and tell the time, so a test need not.
 * @returns The sender.
 */
const createFirebaseSender = ({
  account,
  fetch = globalThis.fetch,
  now = Date.now,
  timeoutMs = 10_000,
}: FirebaseSenderOptions): PushSender => {
  let token: { value: string; until: number } | null = null;

  const accessToken = async (): Promise<string | null> => {
    if (token !== null && token.until > now()) {
      return token.value;
    }

    const at = Math.floor(now() / 1000);
    const assertion = signJwt(
      'RS256',
      account.privateKeyPem,
      {},
      { iss: account.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: at, exp: at + 3600 },
    );
    const answered = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
      signal: AbortSignal.timeout(timeoutMs),
    }).catch(() => null);
    const read = AccessTokenSchema.safeParse(
      answered?.ok === true ? await answered.json().catch(() => null) : null,
    );

    if (!read.success) {
      return null;
    }

    token = {
      value: read.data.access_token,
      until: now() + Math.max(0, read.data.expires_in - 300) * 1000,
    };

    return token.value;
  };

  return async (push) => {
    const bearer = await accessToken();

    if (bearer === null) {
      return 'failed';
    }

    const answered = await fetch(
      `https://fcm.googleapis.com/v1/projects/${account.projectId}/messages:send`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: push.token,
            data: { valence: '1', d: push.deliveryId, s: push.serverId },
            android: {
              priority: 'HIGH',
              ttl: '900s',
              ...(push.collapseId === null ? {} : { collapse_key: push.collapseId }),
            },
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    ).catch(() => null);

    if (answered === null) {
      return 'failed';
    }

    if (answered.ok) {
      return 'sent';
    }

    if (answered.status === 401) {
      token = null;
    }

    const refusal = FirebaseRefusalSchema.safeParse(readJson(await answered.text()));
    const codes = refusal.success
      ? [
          refusal.data.error.status,
          ...(refusal.data.error.details ?? []).map((detail) => detail.errorCode),
        ]
      : [];

    return codes.includes('UNREGISTERED') || answered.status === 404
      ? 'gone'
      : answered.status >= 500 || answered.status === 429 || answered.status === 401
        ? 'failed'
        : 'refused';
  };
};

export { createFirebaseSender };
