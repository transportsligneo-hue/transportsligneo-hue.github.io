import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load server env vars so process.env has SUPABASE_SERVICE_ROLE_KEY etc.
const serverEnv = loadEnv("production", process.cwd(), "");
Object.assign(process.env, serverEnv);

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(__dirname, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(__dirname, "node_modules/entities/lib/encode.js"),
        "entities": path.resolve(__dirname, "node_modules/entities"),
      },
    },
  },
});
