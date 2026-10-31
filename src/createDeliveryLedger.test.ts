import { describe, expect, it } from 'vitest';
import { createDeliveryLedger } from './createDeliveryLedger.js';

describe('createDeliveryLedger', () => {
  it('lets a delivery be claimed once while it is remembered', () => {
    let now = 0;
    const ledger = createDeliveryLedger(1000, () => now);

    expect(ledger.claim('d')).toBe(true);
    expect(ledger.claim('d')).toBe(false);

    now = 1000;

    expect(ledger.claim('d')).toBe(true);
  });

  it('lets a delivery that could not be sent be tried again', () => {
    const ledger = createDeliveryLedger(1000);

    ledger.claim('d');
    ledger.release('d');

    expect(ledger.claim('d')).toBe(true);
  });
});
