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
    // Point d'entrée natif : écran de connexion driver (jamais le site vitrine)
    url: `${serverUrl}/login?app=1`,
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
      // Le splash reste affiché jusqu'à ce que le JS appelle SplashScreen.hide()
      // (NativeAppInit) : évite l'écran noir pendant le chargement distant.
      launchShowDuration: 15000,
      launchAutoHide: false,
      backgroundColor: "#0b1026",
      showSpinner: true,
      spinnerColor: "#e7c76a",
      androidSpinnerStyle: "large",
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
    // Permet d'inspecter la WebView via chrome://inspect en cas de blocage
    webContentsDebuggingEnabled: true,
  },
  appendUserAgent: "LigneoDriverApp",
};


export default config;
