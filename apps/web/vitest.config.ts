import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["ce/**/*.test.{ts,tsx}", "core/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["ce/**/*.{ts,tsx}", "core/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts", "**/*.test.{ts,tsx}"],
    },
  },
  resolve: {
    alias: [
      { find: "@/plane-web/", replacement: path.resolve(__dirname, "./ce/") },
      { find: "@/app/", replacement: path.resolve(__dirname, "./app/") },
      { find: "@/helpers/", replacement: path.resolve(__dirname, "./helpers/") },
      { find: "@/styles/", replacement: path.resolve(__dirname, "./styles/") },
      { find: "@/", replacement: path.resolve(__dirname, "./core/") },
    ],
  },
});
