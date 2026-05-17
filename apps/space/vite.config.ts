import path from "node:path";
import * as dotenv from "dotenv";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { joinUrlPath } from "@plane/utils";

dotenv.config({ path: path.resolve(__dirname, ".env") });

const proxyTarget = process.env.DEV_API_PROXY_TARGET;
const proxySecure = proxyTarget?.startsWith("https") ?? false;
const minioProxyTarget = process.env.DEV_MINIO_PROXY_TARGET;

// Expose only vars starting with VITE_
const viteEnv = Object.keys(process.env)
  .filter((k) => k.startsWith("VITE_"))
  .reduce<Record<string, string>>((a, k) => {
    a[k] = process.env[k] ?? "";
    return a;
  }, {});

const basePath = joinUrlPath(process.env.VITE_SPACE_BASE_PATH ?? "", "/") ?? "/";

export default defineConfig(() => ({
  base: basePath,
  define: {
    "process.env": JSON.stringify(viteEnv),
  },
  build: {
    assetsInlineLimit: 0,
  },
  plugins: [reactRouter(), tsconfigPaths({ projects: [path.resolve(__dirname, "tsconfig.json")] })],
  resolve: {
    alias: {
      // Next.js compatibility shims used within space
      "next/navigation": path.resolve(__dirname, "app/compat/next/navigation.ts"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "127.0.0.1",
    proxy: proxyTarget
      ? {
          "/api": {
            target: proxyTarget,
            changeOrigin: !minioProxyTarget,
            secure: proxySecure,
            cookieDomainRewrite: { "*": "" },
          },
          "/auth": {
            target: proxyTarget,
            changeOrigin: !minioProxyTarget,
            secure: proxySecure,
            cookieDomainRewrite: { "*": "" },
          },
          ...(minioProxyTarget
            ? {
                "/uploads": {
                  target: minioProxyTarget,
                  changeOrigin: false,
                },
              }
            : {}),
        }
      : undefined,
  },
}));
