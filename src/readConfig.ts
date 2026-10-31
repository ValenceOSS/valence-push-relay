import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { RelayConfig } from './RelayConfig.types.js';

const ServiceAccountSchema = z.object({
  project_id: z.string(),
  client_email: z.string(),
  private_key: z.string(),
});

/**
 * Reads how the relay is set up from its environment: the keys it signs credentials with, Apple's
 * push key and Firebase's service account — each from a file, so neither sits in the environment —
 * and the file listing servers it has turned away. A platform with nothing set up is left out, and
 * the relay refuses pushes for it rather than failing to start.
 *
 * @param environment - The environment.
 * @param read - How to read a file, so a test need not.
 * @returns The setup.
 */
const readConfig = (
  environment: NodeJS.ProcessEnv,
  read: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): RelayConfig => {
  const credentialKeys = (environment.CREDENTIAL_KEYS ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);

  if (credentialKeys.some((key) => key.length < 32) || credentialKeys.length === 0) {
    throw new Error('CREDENTIAL_KEYS needs at least one key of 32 characters or more.');
  }

  const appleKeyFile = environment.APPLE_KEY_FILE;
  const firebaseFile = environment.FIREBASE_SERVICE_ACCOUNT_FILE;
  const account =
    firebaseFile === undefined ? null : ServiceAccountSchema.parse(JSON.parse(read(firebaseFile)));

  return {
    port: Number(environment.PORT ?? 8080),
    credentialKeys,
    apple:
      appleKeyFile === undefined
        ? null
        : {
            privateKeyPem: read(appleKeyFile),
            keyId: z.string().min(1).parse(environment.APPLE_KEY_ID),
            teamId: z.string().min(1).parse(environment.APPLE_TEAM_ID),
            topic: environment.APPLE_TOPIC ?? 'app.valence.ios',
          },
    firebase:
      account === null
        ? null
        : {
            projectId: account.project_id,
            clientEmail: account.client_email,
            privateKeyPem: account.private_key,
          },
    revokedFile: environment.REVOKED_FILE ?? null,
  };
};

export { readConfig };
