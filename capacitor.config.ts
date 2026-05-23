import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.billinglottery.app",
  appName: "billing",
  webDir: "public",
  server: {
    url: "https://hotwheelscar.vercel.app",
    cleartext: false,
  },
};

export default config;