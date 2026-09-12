import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
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
