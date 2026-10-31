import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (val) => val.startsWith('postgresql://') || val.startsWith('postgres://'),
      { message: 'DATABASE_URL must be a valid PostgreSQL connection URI (e.g. postgresql://user:pass@localhost:5432/dbname)' }
    ),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long for cryptographic security'),
  JWT_EXPIRES_IN: z
    .string()
    .default('1d'),
  CLIENT_URL: z
    .string()
    .url('CLIENT_URL must be a valid URL (e.g. http://localhost:5173)')
    .default('http://localhost:5173'),
}).refine(
  (data) => {
    if (data.NODE_ENV === 'production') {
      return data.CLIENT_URL.startsWith('https://');
    }
    return true;
  },
  {
    message: 'In production mode, CLIENT_URL must use HTTPS (e.g. https://ruralcare.org)',
    path: ['CLIENT_URL'],
  }
);

export type Environment = z.infer<typeof envSchema>;

function validateEnvironment(): Environment {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('\n=============================================================');
    console.error('❌ CRITICAL CONFIGURATION ERROR: Invalid or Missing Environment');
    console.error('=============================================================');
    console.error('The server cannot start because the following required variables are invalid:\n');

    result.error.issues.forEach((issue) => {
      const field = issue.path.join('.') || 'CONFIGURATION';
      console.error(`  • [${field}]: ${issue.message}`);
    });

    console.error('\nAction Required:');
    console.error('  1. Create a ".env" file in the "server" directory:');
    console.error('     copy .env.example .env');
    console.error('  2. Set your actual PostgreSQL connection string and a secure JWT_SECRET.');
    console.error('  3. Restart the server.\n');
    console.error('Note: Never commit your .env file or reveal private database passwords.');
    console.error('=============================================================\n');

    process.exit(1);
    throw new Error('Critical configuration error: Environment validation failed.');
  }

  return result.data;
}

export const env: Environment = validateEnvironment();
