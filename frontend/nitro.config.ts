import { defineConfig } from "nitro";

export default defineConfig({
  // Pinned rather than left to default: Nitro stamps the generated wrangler.json with
  // the local build date, and Cloudflare rejects a compatibility date that is in the
  // future in UTC ("Can't set compatibility date in the future", code 10021) — which
  // any build run from a timezone ahead of UTC will produce. Matches the date the
  // backend Worker already deploys with.
  compatibilityDate: "2026-03-01",
  output: {
    dir: "dist",
    serverDir: "dist/server",
    publicDir: "dist/public"
  }
});
