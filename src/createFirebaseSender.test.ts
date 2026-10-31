import { describe, expect, it, vi } from 'vitest';
import { aKeyPair } from './aKeyPair.js';
import { createFirebaseSender } from './createFirebaseSender.js';
import type { Push } from './Push.types.js';

const PUSH: Push = {
  platform: 'android',
  token: 'f'.repeat(64),
  environment: 'production',
  deliveryId: 'n-1',
  serverId: 'server',
  collapseId: 'requests',
};

const ACCOUNT = {
  projectId: 'valence',
  clientEmail: 'relay@valence.iam.gserviceaccount.com',
  privateKeyPem: aKeyPair('rsa'),
};

/**
 * Where a request was sent.
 *
 * @param address - What fetch was handed.
 * @returns The address.
 */
const addressOf = (address: string | URL | Request): string =>
  typeof address === 'string' ? address : address instanceof URL ? address.href : address.url;

/**
 * Google's two addresses for a test: one hands out an access token, the other answers a send.
 *
 * @param sent - What sending answers.
 * @returns The fetch.
 */
const aGoogle = (sent: Response) =>
  vi.fn<typeof fetch>((address) =>
    Promise.resolve(
      addressOf(address).includes('oauth2')
        ? Response.json({ access_token: 'access', expires_in: 3600 })
        : sent.clone(),
    ),
  );

describe('createFirebaseSender', () => {
  it('sends a data message alone, carrying only the identifiers', async () => {
    const fetch = aGoogle(Response.json({ name: 'sent' }));

    expect(await createFirebaseSender({ account: ACCOUNT, fetch })(PUSH)).toBe('sent');

    const sending = fetch.mock.calls.find(([address]) => addressOf(address).includes('fcm'));
    const sent = sending?.[1]?.body;
    const body: unknown = JSON.parse(typeof sent === 'string' ? sent : '');

    expect(body).toEqual({
      message: {
        token: PUSH.token,
        data: { valence: '1', d: 'n-1', s: 'server' },
        android: { priority: 'HIGH', ttl: '900s', collapse_key: 'requests' },
      },
    });
  });

  it('asks Google for an access token once while it lasts', async () => {
    const fetch = aGoogle(Response.json({ name: 'sent' }));
    const sender = createFirebaseSender({ account: ACCOUNT, fetch });

    await sender(PUSH);
    await sender(PUSH);

    expect(
      fetch.mock.calls.filter(([address]) => addressOf(address).includes('oauth2')),
    ).toHaveLength(1);
  });

  it('says a phone is gone where Firebase no longer knows its token', async () => {
    const fetch = aGoogle(
      Response.json(
        { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } },
        { status: 404 },
      ),
    );

    expect(await createFirebaseSender({ account: ACCOUNT, fetch })(PUSH)).toBe('gone');
  });
});
