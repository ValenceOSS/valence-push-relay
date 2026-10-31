import { createHash, randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { createDeliveryLedger } from './createDeliveryLedger.js';
import { createRateLimiter } from './createRateLimiter.js';
import { PushRequestSchema } from './PushRequestSchema.js';
import { readCredential } from './readCredential.js';
import { signCredential } from './signCredential.js';
import type { Context } from 'hono';
import type { Credential } from './Credential.types.js';
import type { RelayOptions } from './RelayOptions.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const MOST_BODY_BYTES = 8 * 1024;

/**
 * The address a request came from, as Cloudflare reports it, since nothing else reaches the relay.
 *
 * @param context - The request.
 * @returns The address.
 */
const addressOf = (context: Context): string =>
  context.req.header('cf-connecting-ip') ?? context.req.header('x-forwarded-for') ?? 'unknown';

/**
 * The relay: a self-hosted Valence registers with it once and is handed a credential, and then asks
 * it to wake its people's phones. It is told only where to send a push and an opaque delivery
 * identifier, never what the notification says, and refuses any field it does not name, so nothing
 * more can be sent through it by mistake. A credential is a signed statement rather than a record,
 * so the relay keeps nothing about a server but the list of those it has turned away.
 *
 * Asking is limited: registering per address, pushing per server, and pushing to each phone per
 * server — so one server cannot use up another's turns at a phone and keep its notifications away.
 * A delivery is sent once even if a server unsure whether it went asks again within a day.
 *
 * @param options - The signing keys, the turned-away servers, the senders, and the limits.
 * @returns The application.
 */
const createRelay = ({
  credentialKeys,
  revoked,
  senders,
  now = Date.now,
  credentialLastsMs = 90 * DAY_MS,
  renewableForMs = 30 * DAY_MS,
  registrationsPerHour = 10,
  pushesPerMinute = 600,
  pushesPerDevicePerMinute = 10,
}: RelayOptions): Hono => {
  const app = new Hono();
  const registering = createRateLimiter(registrationsPerHour, 60 * 60 * 1000, now);
  const pushing = createRateLimiter(pushesPerMinute, 60 * 1000, now);
  const reaching = createRateLimiter(pushesPerDevicePerMinute, 60 * 1000, now);
  const ledger = createDeliveryLedger(DAY_MS, now);
  const [signingKey] = credentialKeys;

  const issue = (serverId: string) => {
    const credential: Credential = {
      serverId,
      issuedAt: now(),
      expiresAt: now() + credentialLastsMs,
    };

    return {
      serverId,
      credential: signCredential(credential, signingKey ?? ''),
      expiresAt: new Date(credential.expiresAt).toISOString(),
    };
  };

  const presented = (context: Context, graceMs: number): Credential | null => {
    const [scheme, value] = (context.req.header('authorization') ?? '').split(' ');
    const credential =
      scheme?.toLowerCase() === 'bearer' && value !== undefined
        ? readCredential(value, credentialKeys)
        : null;

    return credential === null ||
      credential.expiresAt + graceMs <= now() ||
      revoked().has(credential.serverId)
      ? null
      : credential;
  };

  app.use('/v1/*', async (context, next) => {
    if (Number(context.req.header('content-length') ?? 0) > MOST_BODY_BYTES) {
      return context.json({ error: 'too_large' }, 413);
    }

    return next();
  });

  app.get('/health', (context) =>
    context.json({
      ok: true,
      apple: senders.apple !== null,
      android: senders.android !== null,
    }),
  );

  app.post('/v1/servers', (context) => {
    if (!registering.allows(addressOf(context))) {
      return context.json({ error: 'rate_limited' }, 429);
    }

    return context.json(issue(randomUUID()), 201);
  });

  app.post('/v1/servers/renew', (context) => {
    const credential = presented(context, renewableForMs);

    return credential === null
      ? context.json({ error: 'unauthorised' }, 401)
      : context.json(issue(credential.serverId), 200);
  });

  app.post('/v1/push', async (context) => {
    const credential = presented(context, 0);

    if (credential === null) {
      return context.json({ error: 'unauthorised' }, 401);
    }

    const asked = PushRequestSchema.safeParse(await context.req.json().catch(() => null));

    if (!asked.success) {
      return context.json({ error: 'invalid' }, 400);
    }

    const push = {
      ...asked.data,
      serverId: credential.serverId,
      collapseId: asked.data.collapseId ?? null,
    };
    const sender = senders[push.platform];

    if (sender === null) {
      return context.json({ error: 'unsupported_platform' }, 501);
    }

    const device = createHash('sha256').update(push.token).digest('base64url');

    if (
      !pushing.allows(credential.serverId) ||
      !reaching.allows(`${credential.serverId}:${device}`)
    ) {
      return context.json({ error: 'rate_limited' }, 429);
    }

    const delivery = createHash('sha256')
      .update(`${credential.serverId}:${push.deliveryId}:${device}`)
      .digest('base64url');

    if (!ledger.claim(delivery)) {
      return context.json({ status: 'duplicate' }, 200);
    }

    const outcome = await sender(push);

    if (outcome !== 'sent') {
      ledger.release(delivery);
    }

    return outcome === 'sent'
      ? context.json({ status: 'sent' }, 200)
      : outcome === 'gone'
        ? context.json({ status: 'gone' }, 410)
        : outcome === 'refused'
          ? context.json({ status: 'refused' }, 422)
          : context.json({ status: 'failed' }, 502);
  });

  app.notFound((context) => context.json({ error: 'not_found' }, 404));

  return app;
};

export { createRelay };
