/**
 * Remembers which deliveries have been sent, for a day, so a server retrying one it is unsure of
 * does not wake a phone twice. Only a hash of each delivery is held, and only in memory.
 *
 * @param keepsForMs - How long a delivery is remembered.
 * @param now - The clock.
 * @returns A way to claim a delivery, and to let one go when it could not be sent.
 */
const createDeliveryLedger = (keepsForMs: number, now: () => number = Date.now) => {
  const held = new Map<string, number>();

  const forget = (): void => {
    const at = now();

    for (const [key, until] of held) {
      if (until <= at) {
        held.delete(key);
      }
    }
  };

  return {
    claim: (key: string): boolean => {
      if (held.size > 500_000) {
        forget();
      }

      const until = held.get(key);

      if (until !== undefined && until > now()) {
        return false;
      }

      held.set(key, now() + keepsForMs);

      return true;
    },
    release: (key: string): void => {
      held.delete(key);
    },
  };
};

export { createDeliveryLedger };
