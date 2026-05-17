import { defineConfig } from "vitest/config";
import path from "path";

// Standalone vitest config — vitest.config.ts replaces vite.config.ts entirely.
// The reactRouter() plugin from vite.config.ts is not loaded (it causes hangs).
// Path aliases are defined explicitly here.
export default defineConfig({
  define: {
    "process.env": JSON.stringify({}),
  },
  resolve: {
    alias: [
      { find: /^@\/plane-web\/(.*)/, replacement: path.resolve(__dirname, "./ce/$1") },
      { find: /^@\/(.*)/, replacement: path.resolve(__dirname, "./core/$1") },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["ce/**/*.test.{ts,tsx}", "core/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 30000,
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["ce/**/*.{ts,tsx}", "core/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts", "**/*.test.{ts,tsx}"],
    },
  },
});
