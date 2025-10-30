import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { pgTable, serial, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";

// __dirname banane ka ES module compatible tarika
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env load karo
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// DATABASE_URL check karo
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in .env");
}

// Drizzle ORM + Postgres
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

// ✅ Connection retry logic with better error handling
const createDatabaseConnection = (maxRetries = 3, retryDelay = 2000) => {
  let retries = 0;
  
  const connect = () => {
    try {
      console.log(`Attempting database connection (attempt ${retries + 1}/${maxRetries})...`);
      
      const sql = postgres(process.env.DATABASE_URL, {
        ssl: { rejectUnauthorized: false },
        connect_timeout: 10,
        idle_timeout: 30,
        // ✅ Additional connection options
        max: 10, // Maximum number of connections
        connection: {
          application_name: 'vitecab-app'
        }
      });
      
      console.log("✅ Database connection established successfully");
      return sql;
    } catch (error) {
      retries++;
      
      if (retries >= maxRetries) {
        console.error("❌ Failed to establish database connection after", maxRetries, "attempts");
        throw error;
      }
      
      console.warn(`Retrying connection in ${retryDelay/1000} seconds...`);
      setTimeout(connect, retryDelay);
    }
  };
  
  return connect();
};

// ✅ Create database connection with retry logic
export const sql = createDatabaseConnection();
export const db = drizzle(sql, { schema });

// ✅ Add connection error handling
sql`SELECT 1`
  .then(() => console.log("✅ Database connection test successful"))
  .catch((err) => {
    console.error("❌ Database connection test failed:", err.message);
    // Fallback logic yahan add kar sakte hain
  });

export const partnerApplications = pgTable("partner_applications", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  website: varchar("website", { length: 255 }),
  country: varchar("country", { length: 128 }),
  payoutMethod: varchar("payout_method", { length: 64 }),
  description: text("description"),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  archived: boolean("archived").notNull().default(false),
});