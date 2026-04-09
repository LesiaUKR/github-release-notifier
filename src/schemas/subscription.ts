import { z } from 'zod/v4';

export const createSubscriptionSchema = z.object({
  email: z.string().email('Invalid email format'),
  repo: z
    .string()
    .regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/, 'Invalid repo format. Expected: owner/repo'),
});

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export type CreateSubscriptionBody = z.infer<typeof createSubscriptionSchema>;
