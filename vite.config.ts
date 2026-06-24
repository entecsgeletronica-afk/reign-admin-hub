// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Disable the Cloudflare plugin only when building on Vercel (so the Vercel
// build emits `.vercel/output`). In the Lovable preview (Cloudflare Worker)
// we MUST keep the cloudflare plugin enabled, otherwise the SSR bundle is
// missing runtime modules like `h3-v2` and the worker returns 502
// "Internal server error".
const isVercelBuild = !!process.env.VERCEL;

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    // Add any custom vite options here
  }
});
