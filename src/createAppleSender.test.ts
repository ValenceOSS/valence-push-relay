import { describe, expect, it, vi } from 'vitest';
import { aKeyPair } from './aKeyPair.js';
import { createAppleSender } from './createAppleSender.js';
import type { Push } from './Push.types.js';
import type { sendOverHttp2 } from './sendOverHttp2.js';

const PUSH: Push = {
  platform: 'apple',
  token: 'a'.repeat(64),
  environment: 'sandbox',
  deliveryId: 'n-1',
  serverId: 'server',
  collapseId: null,
};

const KEY = {
  teamId: 'TEAM',
  keyId: 'KEY',
  privateKeyPem: aKeyPair('ec'),
  topic: 'app.valence.ios',
};

describe('createAppleSender', () => {
  it('sends the same alert to the right place, carrying only the identifiers', async () => {
    const send = vi.fn<typeof sendOverHttp2>(() => Promise.resolve({ status: 200, body: '' }));
    const sender = createAppleSender({ key: KEY, send });

    expect(await sender(PUSH)).toBe('sent');

    const [origin, headers, body] = send.mock.calls[0] ?? [];

    expect(origin).toBe('https://api.sandbox.push.apple.com');
    expect(headers).toMatchObject({
      ':path': `/3/device/${PUSH.token}`,
      'apns-topic': 'app.valence.ios',
      'apns-push-type': 'alert',
    });
    expect(JSON.parse(body ?? '')).toEqual({
      aps: {
        alert: { title: 'Valence', body: 'New notification' },
        sound: 'default',
        'mutable-content': 1,
      },
      valence: { d: 'n-1', s: 'server' },
    });
  });

  it('signs a token for Apple once, and again only when it runs out', async () => {
    let now = 0;
    const send = vi.fn<typeof sendOverHttp2>(() => Promise.resolve({ status: 200, body: '' }));
    const sender = createAppleSender({ key: KEY, send, now: () => now });
    const tokenOf = (call: number): unknown => send.mock.calls[call]?.[1]?.authorization;

    await sender(PUSH);
    await sender(PUSH);
    now = 41 * 60 * 1000;
    await sender(PUSH);

    expect(tokenOf(0)).toBe(tokenOf(1));
    expect(tokenOf(2)).not.toBe(tokenOf(0));
  });

  it('says a phone is gone where Apple no longer knows its token', async () => {
    const send = vi.fn<typeof sendOverHttp2>(() =>
      Promise.resolve({ status: 400, body: JSON.stringify({ reason: 'BadDeviceToken' }) }),
    );

    expect(await createAppleSender({ key: KEY, send })(PUSH)).toBe('gone');
  });

  it('says it failed where Apple could not be reached', async () => {
    const send = vi.fn<typeof sendOverHttp2>(() => Promise.reject(new Error('offline')));

    expect(await createAppleSender({ key: KEY, send })(PUSH)).toBe('failed');
  });
});
