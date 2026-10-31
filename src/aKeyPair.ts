import { generateKeyPairSync } from 'node:crypto';

/**
 * A private key for a test, of the kind Apple's push key or a Google service account holds.
 *
 * @param kind - Which kind.
 * @returns The private key, as PEM.
 */
const aKeyPair = (kind: 'ec' | 'rsa'): string =>
  kind === 'ec'
    ? generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
        .privateKey.export({ type: 'pkcs8', format: 'pem' })
        .toString()
    : generateKeyPairSync('rsa', { modulusLength: 2048 })
        .privateKey.export({ type: 'pkcs8', format: 'pem' })
        .toString();

export { aKeyPair };
