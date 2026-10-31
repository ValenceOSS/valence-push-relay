import { z } from 'zod';

const OPAQUE_ID = /^[A-Za-z0-9_-]{1,64}$/;

const PushRequestSchema = z
  .object({
    platform: z.enum(['apple', 'android']),
    token: z
      .string()
      .min(16)
      .max(4096)
      .regex(/^[A-Za-z0-9_:.-]+$/),
    environment: z.enum(['production', 'sandbox']).default('production'),
    deliveryId: z.string().regex(OPAQUE_ID),
    collapseId: z.string().regex(OPAQUE_ID).optional(),
  })
  .strict();

export { PushRequestSchema };
