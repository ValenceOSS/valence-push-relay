type Platform = 'apple' | 'android';

type Push = {
  platform: Platform;
  token: string;
  environment: 'production' | 'sandbox';
  deliveryId: string;
  serverId: string;
  collapseId: string | null;
};

type PushOutcome = 'sent' | 'gone' | 'refused' | 'failed';

type PushSender = (push: Push) => Promise<PushOutcome>;

export type { Platform, Push, PushOutcome, PushSender };
