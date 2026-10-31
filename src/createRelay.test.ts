import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createRelay } from './createRelay.js';
import type { PushSender } from './Push.types.js';

const KEY = 'k'.repeat(32);

const TOKEN = 'a'.repeat(64);

/**
 * A relay for a test, with senders that remember what they were asked.
 *
 * @param apple - What sending to an iPhone answers.
 * @param revoked - The servers turned away.
 * @returns The relay and its senders.
 */
const aRelay = (
  apple: PushSender = vi.fn<PushSender>(() => Promise.resolve('sent' as const)),
  revoked = new Set<string>(),
) => {
  const android = vi.fn<PushSender>(() => Promise.resolve('sent'));
  const relay = createRelay({
    credentialKeys: [KEY],
    revoked: () => revoked,
    senders: { apple, android },
    registrationsPerHour: 2,
    pushesPerDevicePerMinute: 3,
  });

  return { relay, android };
};

/**
 * Registers a server with a relay.
 *
 * @param relay - The relay.
 * @returns The server's identifier and credential.
 */
const register = async (relay: ReturnType<typeof createRelay>) => {
  const answered = await relay.request('/v1/servers', {
    method: 'POST',
    headers: { 'cf-connecting-ip': '203.0.113.1' },
  });
  return z.object({ serverId: z.string(), credential: z.string() }).parse(await answered.json());
};

/**
 * Asks a relay to push.
 *
 * @param relay - The relay.
 * @param credential - The server's credential.
 * @param body - What it asks.
 * @returns The answer.
 */
const push = (relay: ReturnType<typeof createRelay>, credential: string, body: object) =>
  relay.request('/v1/push', {
    method: 'POST',
    headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('createRelay', () => {
  it('registers a server, and wakes a phone for it with nothing but where and which delivery', async () => {
    const apple = vi.fn<PushSender>(() => Promise.resolve('sent'));
    const { relay } = aRelay(apple);
    const { serverId, credential } = await register(relay);

    const answered = await push(relay, credential, {
      platform: 'apple',
      token: TOKEN,
      deliveryId: 'n-1',
    });

    expect(answered.status).toBe(200);
    expect(apple).toHaveBeenCalledWith({
      platform: 'apple',
      token: TOKEN,
      environment: 'production',
      deliveryId: 'n-1',
      serverId,
      collapseId: null,
    });
  });

  it('refuses anything that would carry what a notification says', async () => {
    const { relay, android } = aRelay();
    const { credential } = await register(relay);

    const answered = await push(relay, credential, {
      platform: 'android',
      token: TOKEN,
      deliveryId: 'n-1',
      title: 'Your film is ready',
    });

    expect(answered.status).toBe(400);
    expect(android).not.toHaveBeenCalled();
  });

  it('refuses a server without a credential of its own, or one turned away', async () => {
    const revoked = new Set<string>();
    const { relay } = aRelay(undefined, revoked);
    const { serverId, credential } = await register(relay);

    expect(
      (
        await push(relay, 'v1.forged.credential', {
          platform: 'apple',
          token: TOKEN,
          deliveryId: 'n',
        })
      ).status,
    ).toBe(401);

    revoked.add(serverId);

    expect(
      (await push(relay, credential, { platform: 'apple', token: TOKEN, deliveryId: 'n' })).status,
    ).toBe(401);
  });

  it('sends a delivery once, however often a server asks', async () => {
    const { relay, android } = aRelay();
    const { credential } = await register(relay);
    const asked = { platform: 'android', token: TOKEN, deliveryId: 'n-1' };

    await push(relay, credential, asked);
    const again = await push(relay, credential, asked);

    expect(await again.json()).toEqual({ status: 'duplicate' });
    expect(android).toHaveBeenCalledTimes(1);
  });

  it('says a phone is gone, so the server can forget it, and lets the delivery be tried again', async () => {
    const apple = vi.fn<PushSender>(() => Promise.resolve('gone'));
    const { relay } = aRelay(apple);
    const { credential } = await register(relay);
    const asked = { platform: 'apple', token: TOKEN, deliveryId: 'n-1' };

    expect((await push(relay, credential, asked)).status).toBe(410);
    expect((await push(relay, credential, asked)).status).toBe(410);
  });

  it('limits how often one address registers and one phone is woken', async () => {
    const { relay } = aRelay();
    const { credential } = await register(relay);

    await register(relay);

    expect(
      (
        await relay.request('/v1/servers', {
          method: 'POST',
          headers: { 'cf-connecting-ip': '203.0.113.1' },
        })
      ).status,
    ).toBe(429);

    for (const deliveryId of ['a', 'b', 'c']) {
      await push(relay, credential, { platform: 'android', token: TOKEN, deliveryId });
    }

    expect(
      (await push(relay, credential, { platform: 'android', token: TOKEN, deliveryId: 'd' }))
        .status,
    ).toBe(429);
  });

  it('renews a credential for the same server', async () => {
    const { relay } = aRelay();
    const { serverId, credential } = await register(relay);

    const answered = await relay.request('/v1/servers/renew', {
      method: 'POST',
      headers: { authorization: `Bearer ${credential}` },
    });
    const renewed = z.object({ serverId: z.string() }).parse(await answered.json());

    expect(renewed.serverId).toBe(serverId);
  });

  it('says which platforms it can reach', async () => {
    const { relay } = aRelay();

    expect(await (await relay.request('/health')).json()).toEqual({
      ok: true,
      apple: true,
      android: true,
    });
  });
});
