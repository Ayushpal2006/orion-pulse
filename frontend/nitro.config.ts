import { defineConfig } from "nitro";

export default defineConfig({
  output: {
    dir: "dist",
    serverDir: "dist/server",
    publicDir: "dist/public"
  }
});
