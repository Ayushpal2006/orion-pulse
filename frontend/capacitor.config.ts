import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.apkabill.pos",
  appName: "Apka Bill POS",
  // Output of `npm run build:capacitor` (static SPA shell), not the SSR/Workers build.
  webDir: "dist-capacitor/client",
};

export default config;
