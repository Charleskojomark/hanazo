import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const isOffline = process.env.OFFLINE_MODE === "true";

export default defineConfig(
  isOffline
    ? {
        schema: "./src/db/sqlite-schema.ts",
        out: "./drizzle/sqlite",
        dialect: "sqlite",
        dbCredentials: {
          url: "./hanazo-offline.db",
        },
      }
    : {
        schema: "./src/db/schema.ts",
        out: "./drizzle/pg",
        dialect: "postgresql",
        dbCredentials: {
          url: process.env.DATABASE_URL || "",
        },
      }
);

