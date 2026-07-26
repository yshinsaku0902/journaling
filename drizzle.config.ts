import type { Config } from "drizzle-kit";
import dotenv from "dotenv";

// db:push / db:generate を CLI から実行するとき、.env.local の DATABASE_URL を読み込む
dotenv.config({ path: ".env.local" });

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
