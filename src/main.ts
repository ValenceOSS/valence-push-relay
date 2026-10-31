import { serve } from '@hono/node-server';
import { createAppleSender } from './createAppleSender.js';
import { createFirebaseSender } from './createFirebaseSender.js';
import { createRelay } from './createRelay.js';
import { readConfig } from './readConfig.js';
import { readRevoked } from './readRevoked.js';

const config = readConfig(process.env);

const relay = createRelay({
  credentialKeys: config.credentialKeys,
  revoked: readRevoked(config.revokedFile),
  senders: {
    apple: config.apple === null ? null : createAppleSender({ key: config.apple }),
    android: config.firebase === null ? null : createFirebaseSender({ account: config.firebase }),
  },
});

const server = serve({ fetch: relay.fetch, port: config.port, hostname: '0.0.0.0' });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
  });
}
