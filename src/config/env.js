const { z } = require("zod");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  FRONTEND_ORIGIN: z.string().url(),
  GLOBAL_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  GLOBAL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  MESSAGE_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(24 * 60 * 60 * 1000),
  MESSAGE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(3),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHAT_ID: z.string().min(1),
  BREVO_API_KEY: z.string().min(1),
  NOTIFY_EMAIL: z.string().email(),
  SMTP_FROM_EMAIL: z.string().email(),
  MONGODB_URI: z.string().min(10),
  TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
});

function parseEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "env";
      return `${path}: ${issue.message}`;
    });

    const error = new Error(`Invalid environment variables: ${issues.join("; ")}`);
    error.statusCode = 500;
    throw error;
  }

  return parsed.data;
}

module.exports = { parseEnv };
