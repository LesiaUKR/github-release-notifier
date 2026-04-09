import { z } from 'zod/v4';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.url(),

  REDIS_URL: z.url().optional(),

  GITHUB_TOKEN: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('noreply@github-release-notifier.com'),

  SCAN_INTERVAL_MS: z.coerce.number().default(300_000),

  GRPC_PORT: z.coerce.number().default(50051),
});

export type Config = z.infer<typeof envSchema>;

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables:');
  console.error(z.prettifyError(result.error));
  process.exit(1);
}

export const config = result.data;
