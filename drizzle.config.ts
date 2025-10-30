import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: './shared/schema.ts',    // tumhare project me ye file already hai
  out: './drizzle',                // migrations/output folder
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!, // .env se read hoga
  },
  strict: true,
  verbose: true,
});