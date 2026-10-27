/**
 * Repère les documents de démonstration ou de test (démo flotte, comptes de test…)
 * pour les ranger à part dans l'admin, sans jamais les mélanger aux vrais clients.
 * Règle : e-mail contenant « demo » / « test », ou nom / société commençant par « démo » / « test ».
 */
const norm = (v: string | null | undefined) =>
  (v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function isDemoOrTestIdentity(p: {
  email?: string | null;
  nom?: string | null;
  prenom?: string | null;
  societe?: string | null;
}): boolean {
  const email = norm(p.email);
  if (email && (/(^|[^a-z])(demo|test)([^a-z]|$)/.test(email.split("@")[0]) || /@(example\.(com|org|net|fr)|test\.[a-z]+)$/.test(email))) return true;
  const startsDemo = (v: string | null | undefined) => /^(demo|test)\b/.test(norm(v));
  return startsDemo(p.nom) || startsDemo(p.prenom) || startsDemo(p.societe);
}

const DEMO_FLOTTE_EMAIL = "demo-flotte@transportsligneo.fr";
const FAKE_PLATES = new Set(["AA-123-BB", "BB-456-CC", "CC-789-DD"]);

/** Mission / demande de démonstration : case « test » en base, compte Démo Flotte, identité démo ou plaque factice. */
export function isDemoMission(p: {
  isTestData?: boolean | null;
  email?: string | null;
  nom?: string | null;
  plate?: string | null;
}): boolean {
  if (p.isTestData) return true;
  if (norm(p.email) === DEMO_FLOTTE_EMAIL) return true;
  if (isDemoOrTestIdentity({ email: p.email, nom: p.nom })) return true;
  const plate = (p.plate ?? "").toUpperCase().replace(/\s+/g, "-");
  return FAKE_PLATES.has(plate);
}
