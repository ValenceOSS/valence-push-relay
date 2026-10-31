import type { AppleKey } from './AppleKey.types.js';
import type { FirebaseAccount } from './FirebaseAccount.types.js';

type RelayConfig = {
  port: number;
  credentialKeys: string[];
  apple: AppleKey | null;
  firebase: FirebaseAccount | null;
  revokedFile: string | null;
};

export type { RelayConfig };
