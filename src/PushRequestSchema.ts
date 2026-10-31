import { z } from 'zod';

const OPAQUE_ID = /^[A-Za-z0-9_-]{1,64}$/;

const APPLE_TOKEN = /^[0-9a-fA-F]{64,200}$/;

const ANDROID_TOKEN = /^[A-Za-z0-9_:-]{64,512}$/;

const PushRequestSchema = z
  .object({
    platform: z.enum(['apple', 'android']),
    token: z.string(),
    environment: z.enum(['production', 'sandbox']).default('production'),
    deliveryId: z.string().regex(OPAQUE_ID),
    collapseId: z.string().regex(OPAQUE_ID).optional(),
  })
  .strict()
  .refine(
    ({ platform, token }) => (platform === 'apple' ? APPLE_TOKEN : ANDROID_TOKEN).test(token),
    { path: ['token'] },
  );

export { PushRequestSchema };
