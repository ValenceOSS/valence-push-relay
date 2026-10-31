import { describe, expect, it } from 'vitest';
import { readConfig } from './readConfig.js';

const KEY = 'k'.repeat(32);

describe('readConfig', () => {
  it('reads the keys, and each platform from its file', () => {
    const files: Record<string, string> = {
      '/apple.p8': 'APPLE KEY',
      '/firebase.json': JSON.stringify({
        project_id: 'valence',
        client_email: 'relay@valence.iam.gserviceaccount.com',
        private_key: 'GOOGLE KEY',
      }),
    };
    const config = readConfig(
      {
        CREDENTIAL_KEYS: `${KEY}, ${'o'.repeat(32)}`,
        APPLE_KEY_FILE: '/apple.p8',
        APPLE_KEY_ID: 'KEYID',
        APPLE_TEAM_ID: 'TEAMID',
        FIREBASE_SERVICE_ACCOUNT_FILE: '/firebase.json',
      },
      (path) => files[path] ?? '',
    );

    expect(config.credentialKeys).toEqual([KEY, 'o'.repeat(32)]);
    expect(config.apple).toEqual({
      privateKeyPem: 'APPLE KEY',
      keyId: 'KEYID',
      teamId: 'TEAMID',
      topic: 'app.valence.ios',
    });
    expect(config.firebase?.projectId).toBe('valence');
    expect(config.port).toBe(8080);
  });

  it('starts without a platform that is not set up', () => {
    const config = readConfig({ CREDENTIAL_KEYS: KEY });

    expect(config.apple).toBeNull();
    expect(config.firebase).toBeNull();
  });

  it('refuses to start without a long enough key', () => {
    expect(() => readConfig({})).toThrow('CREDENTIAL_KEYS');
    expect(() => readConfig({ CREDENTIAL_KEYS: 'short' })).toThrow('CREDENTIAL_KEYS');
  });
});
