// Production database configuration for Hostinger deployment
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set for production");
}

// This is what you'll use on Hostinger with your Supabase database
const client = postgres(process.env.DATABASE_URL, {
  ssl: 'require', // Required for Supabase
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

// Note: Replace the contents of server/db.ts with this code when deploying to Hostinger