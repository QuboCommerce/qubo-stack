import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

config({ path: resolve(import.meta.dirname, "../../.env"), quiet: true });

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Integration tests share one database; keep them sequential.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
