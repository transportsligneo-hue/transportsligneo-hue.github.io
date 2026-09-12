import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";

const playfair = loadPlayfair("normal", { weights: ["500", "700"], subsets: ["latin"] });
const poppins = loadPoppins("normal", { weights: ["300", "400", "500", "600"], subsets: ["latin"] });

export const display = playfair.fontFamily;
export const body = poppins.fontFamily;

export const C = {
  navy: "#0b1026",
  navy2: "#111a3d",
  navy3: "#16224d",
  cream: "#faf7ef",
  cream2: "#fdfcf8",
  gold: "#d4af37",
  goldSoft: "#e7c76a",
  blue: "#2f6bff",
  green: "#2fbf71",
  text: "#0b1026",
  muted: "rgba(250,247,239,0.62)",
  mutedDark: "rgba(11,16,38,0.55)",
};

export const navyBg = `radial-gradient(1200px 700px at 20% 10%, ${C.navy3} 0%, ${C.navy2} 42%, ${C.navy} 100%)`;
export const creamBg = `radial-gradient(1100px 700px at 75% 15%, #ffffff 0%, ${C.cream2} 45%, ${C.cream} 100%)`;
