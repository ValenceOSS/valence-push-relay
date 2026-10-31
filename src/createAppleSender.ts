import { z } from 'zod';
import { readJson } from './readJson.js';
import { sendOverHttp2 } from './sendOverHttp2.js';
import { signJwt } from './signJwt.js';
import type { AppleKey } from './AppleKey.types.js';
import type { PushSender } from './Push.types.js';

const TOKEN_LASTS_MS = 40 * 60 * 1000;

const EXPIRES_AFTER_SECONDS = 15 * 60;

const ORIGINS = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
} as const;

const AppleRefusalSchema = z.object({ reason: z.string() });

const GONE = new Set(['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic']);

type AppleSenderOptions = {
  key: AppleKey;
  send?: typeof sendOverHttp2;
  now?: () => number;
  timeoutMs?: number;
};

/**
 * Sends a push to an iPhone through Apple's push service: always the same alert, which the app's
 * notification service extension replaces with what the delivery is once it has read it from the
 * server, carrying only the delivery's and the server's identifiers. The token Apple is asked with is
 * made again every forty minutes rather than for each push, as Apple asks.
 *
 * @param options - The app's push key, and how to send and tell the time, so a test need not.
 * @returns The sender.
 */
const createAppleSender = ({
  key,
  send = sendOverHttp2,
  now = Date.now,
  timeoutMs = 10_000,
}: AppleSenderOptions): PushSender => {
  let token: { value: string; until: number } | null = null;

  const authorisation = (): string => {
    if (token === null || token.until <= now()) {
      token = {
        value: signJwt(
          'ES256',
          key.privateKeyPem,
          { kid: key.keyId },
          { iss: key.teamId, iat: Math.floor(now() / 1000) },
        ),
        until: now() + TOKEN_LASTS_MS,
      };
    }

    return token.value;
  };

  return async (push) => {
    const answered = await send(
      ORIGINS[push.environment],
      {
        ':path': `/3/device/${push.token}`,
        authorization: `bearer ${authorisation()}`,
        'apns-topic': key.topic,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-expiration': String(Math.floor(now() / 1000) + EXPIRES_AFTER_SECONDS),
        ...(push.collapseId === null ? {} : { 'apns-collapse-id': push.collapseId }),
        'content-type': 'application/json',
      },
      JSON.stringify({
        aps: {
          alert: { title: 'Valence', body: 'New notification' },
          sound: 'default',
          'mutable-content': 1,
        },
        valence: { d: push.deliveryId, s: push.serverId },
      }),
      timeoutMs,
    ).catch(() => null);

    if (answered === null) {
      return 'failed';
    }

    if (answered.status === 200) {
      return 'sent';
    }

    if (answered.status === 403) {
      token = null;
    }

    const refusal = AppleRefusalSchema.safeParse(readJson(answered.body));
    const reason = refusal.success ? refusal.data.reason : '';

    return answered.status === 410 || GONE.has(reason)
      ? 'gone'
      : answered.status >= 500 || answered.status === 429 || answered.status === 403
        ? 'failed'
        : 'refused';
  };
};

export { createAppleSender };
