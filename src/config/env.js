import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  COMPANY_TZ: z.string().default('Asia/Kolkata'),
  WORK_START: z.string().default('09:30'),
  LATE_GRACE_MINUTES: z.coerce.number().default(15),
  FULL_DAY_MINUTES: z.coerce.number().default(480),
  HALF_DAY_MINUTES: z.coerce.number().default(240),
  WEEKEND_DAYS: z.string().default('0,6'),
  LEAVE_BACKDATE_DAYS: z.coerce.number().default(7),
  SEED_PASSWORD: z.string().default('Passw0rd!23'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const weekendDays = env.WEEKEND_DAYS.split(',').map(Number);
