import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .default('3001')
    .transform((s) => Number.parseInt(s, 10))
    .pipe(z.number().int().positive()),
  DATABASE_URL: z.string().url(),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z
    .string()
    .refine((s) => {
      try {
        return Buffer.from(s, 'base64').length === 32;
      } catch {
        return false;
      }
    }, 'ENCRYPTION_KEY must be 32 bytes base64')
    .transform((s) => Buffer.from(s, 'base64')),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1),
  GOOGLE_OAUTH_CALLBACK_URL: z.string().url(),
  ALLOWED_EMAIL_DOMAINS: z
    .string()
    .transform((s) => s.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean))
    .pipe(z.array(z.string()).min(1, 'At least one allowed domain required')),
  // Individual email overrides — emails that bypass the ALLOWED_EMAIL_DOMAINS
  // check. Use sparingly for non-student inteli accounts (e.g. consulting club
  // mailbox) that need access without opening the entire parent domain.
  ALLOWED_EMAIL_EXCEPTIONS: z
    .string()
    .optional()
    .default('')
    .transform((s) => s.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)),
  BOOTSTRAP_ADMIN_EMAILS: z
    .string()
    .optional()
    .default('')
    .transform((s) => s.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)),
  FRONTEND_BASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  EVOLUTION_API_BASE_URL: z.string().url().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE: z.string().optional(),
  ADMIN_WHATSAPP_NUMBER: z.string().optional(),
  // Sandbox / Challenge Mode. The API calls the sandbox-host-service via
  // HTTP; the host service holds the docker socket. See docs/sandbox-setup.md.
  // All optional with sane defaults so deploys without the feature still boot.
  SANDBOX_HOST_URL: z.string().url().optional(),
  SANDBOX_AUTH_TOKEN: z.string().min(16).optional(),
  // SANDBOX_PYTHON_IMAGE / SANDBOX_CPP_IMAGE / SANDBOX_MAX_CONCURRENT /
  // SANDBOX_QUEUE_TIMEOUT_MS are read by the host service now, not the API.
  // Keep them recognized here only so a single .env file can configure both
  // sides without spurious "unknown variable" warnings.
  SANDBOX_PYTHON_IMAGE: z.string().optional(),
  SANDBOX_CPP_IMAGE: z.string().optional(),
  SANDBOX_MAX_CONCURRENT: z.coerce.number().int().min(1).max(32).optional(),
  SANDBOX_QUEUE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${formatted}`);
  }
  return parsed.data;
}
