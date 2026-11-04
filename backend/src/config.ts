import { config as dotenv } from "dotenv";
import { resolve } from "node:path";
dotenv({ path: resolve(__dirname, "../../.env"), quiet: true });
export const env = {
  port: Number(process.env.PORT || 4000),
  frontend: process.env.FRONTEND_URL || "http://localhost:3100",
  production: process.env.NODE_ENV === "production",
  redis: process.env.REDIS_URL || "redis://localhost:6379",
  bloggerMode: process.env.BLOGGER_MODE === "live" ? "live" : "mock",
};
export function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 32)
    throw new Error(`${name} must be configured securely; run npm run setup.`);
  return value;
}
