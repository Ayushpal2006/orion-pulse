import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// `npm run build:capacitor` sets CAPACITOR_BUILD=1. The native app has no server to SSR
// from, so that build prerenders a static SPA shell (index.html) into dist-capacitor/client
// and skips nitro entirely. The default build (Cloudflare Workers via nitro) is unchanged.
const isCapacitorBuild = process.env.CAPACITOR_BUILD === "1";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ...(isCapacitorBuild && {
      spa: { enabled: true, prerender: { outputPath: "/index.html" } },
    }),
  },
  ...(isCapacitorBuild && { nitro: false as const }),
  vite: {
    ...(isCapacitorBuild && { build: { outDir: "dist-capacitor" } }),
    server: {
      port: 8081,
      strictPort: true,
    },
    // recharts (with its victory-vendor/d3-* graph, ~800 files) and lucide-react
    // (~1950 files) both ship usable CJS entry points, so let Node require() them
    // directly during SSR instead of having Vite transform every internal file one at
    // a time — that was making the first SSR request take minutes on a loaded machine.
    ssr: {
      external: ["recharts", "lucide-react"],
    },
  },
});
