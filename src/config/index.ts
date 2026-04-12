import { z } from 'zod/v4';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  TRUST_PROXY: z.preprocess(value => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
      if (['0', 'false', 'no', 'off', ''].includes(normalized)) return false;
    }
    return value;
  }, z.boolean().default(false)),

  DATABASE_URL: z.url(),

  REDIS_URL: z.string().optional(),

  GITHUB_TOKEN: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('noreply@github-release-notifier.com'),
  BREVO_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default('onboarding@resend.dev'),
  BASE_URL: z.string().default('http://localhost:3000'),

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
