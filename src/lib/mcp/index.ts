import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import listMyMissions from "./tools/list-my-missions";
import listMyDevis from "./tools/list-my-devis";
import searchCatalogue from "./tools/search-catalogue";

// Direct Supabase issuer required for MCP OAuth (the `.lovable.cloud` proxy is rejected).
// Inlined at build time by Vite; the sentinel keeps the value well-formed during the
// throwaway manifest-extract eval — a real token will never verify against it.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "transports-ligneo-mcp",
  title: "Transports Ligneo",
  version: "0.1.0",
  instructions:
    "Outils Transports Ligneo pour convoyeurs et clients : consulter vos missions, vos devis, votre profil, et le catalogue des missions disponibles. Chaque appel agit avec les permissions de l'utilisateur connecté.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoami, listMyMissions, listMyDevis, searchCatalogue],
});
