import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Coquille mobile Transports Ligneo (Convoyeur + Admin).
 *
 * Le site étant rendu côté serveur, l'app native charge directement le site
 * publié (server.url). Le flag `?app=1` + l'User-Agent personnalisé permettent
 * au front de savoir qu'il tourne dans l'app et de masquer le site vitrine.
 *
 * Pour un build local pointant sur la preview :
 *   CAP_SERVER_URL=https://id-preview--....lovable.app npx cap sync
 */
const serverUrl = process.env.CAP_SERVER_URL || "https://transportsligneo.fr";

const config: CapacitorConfig = {
  appId: "com.transportsligneo.driver",
  appName: "Ligneo Driver",
  webDir: "dist",
  server: {
    url: `${serverUrl}/?app=1`,
    cleartext: false,
    androidScheme: "https",
    allowNavigation: [
      "transportsligneo.fr",
      "www.transportsligneo.fr",
      "*.lovable.app",
      "*.supabase.co",
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0b1026",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Geolocation: {},
    Camera: {},
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#0b1026",
  },
  android: {
    backgroundColor: "#0b1026",
  },
  appendUserAgent: "LigneoDriverApp",
};


export default config;
