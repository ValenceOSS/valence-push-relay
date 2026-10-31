import type { PushSender } from './Push.types.js';

type RelayOptions = {
  credentialKeys: readonly string[];
  revoked: () => ReadonlySet<string>;
  senders: { apple: PushSender | null; android: PushSender | null };
  now?: () => number;
  credentialLastsMs?: number;
  renewableForMs?: number;
  registrationsPerHour?: number;
  pushesPerMinute?: number;
  pushesPerDevicePerMinute?: number;
};

export type { RelayOptions };
