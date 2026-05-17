import path from "node:path";
import * as dotenv from "dotenv";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

dotenv.config({ path: path.resolve(__dirname, ".env") });

const proxyTarget = process.env.DEV_API_PROXY_TARGET;
const proxySecure = proxyTarget?.startsWith("https") ?? false;
// Minio proxy for local full-stack setup (presigned upload URLs use the browser's host)
const minioProxyTarget = process.env.DEV_MINIO_PROXY_TARGET;

// Expose only vars starting with VITE_
const viteEnv = Object.keys(process.env)
  .filter((k) => k.startsWith("VITE_"))
  .reduce<Record<string, string>>((a, k) => {
    a[k] = process.env[k] ?? "";
    return a;
  }, {});

export default defineConfig(() => ({
  define: {
    "process.env": JSON.stringify(viteEnv),
  },
  build: {
    assetsInlineLimit: 0,
  },
  plugins: [
    // Skip reactRouter plugin during vitest — it scans routes and causes hangs
    ...(!process.env.VITEST ? [reactRouter()] : []),
    tsconfigPaths({ projects: [path.resolve(__dirname, "tsconfig.json")] }),
  ],
  resolve: {
    alias: {
      // Next.js compatibility shims used within web
      "next/link": path.resolve(__dirname, "app/compat/next/link.tsx"),
      "next/navigation": path.resolve(__dirname, "app/compat/next/navigation.ts"),
      "next/script": path.resolve(__dirname, "app/compat/next/script.tsx"),
    },
    dedupe: ["react", "react-dom", "@headlessui/react"],
  },
  server: {
    host: "127.0.0.1",
    proxy: proxyTarget
      ? {
          "/api": {
            target: proxyTarget,
            // When Minio runs locally, keep the original Host header so Django's
            // request.get_host() returns the Vite dev-server host (e.g. localhost:3000).
            // Presigned upload URLs then point back to Vite, which proxies /uploads to Minio.
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
          "/static": {
            target: proxyTarget,
            changeOrigin: !minioProxyTarget,
            secure: proxySecure,
          },
          // Proxy presigned Minio upload/download URLs (bucket path) to local Minio.
          // changeOrigin must be false: presigned URL signatures include the Host header,
          // so Minio must see the same host that boto3 used when signing (localhost:3000).
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
  // No SSR-specific overrides needed; alias resolves to ESM build
}));
