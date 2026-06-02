import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.billinglottery.app",
  appName: "billing",
  webDir: "public",
  server: {
    url: "https://hotwheelscar.vercel.app",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#020617",
      showSpinner: true,
      androidSpinnerStyle: "large",
      spinnerColor: "#34d399",
      splashFullScreen: false,
      splashImmersive: false
    }
  }
};

export default config;