/**
 * Repère les doublons dans une liste : même e-mail, même téléphone ou même nom + prénom.
 * Renvoie les identifiants concernés (toutes les copies, pour que tu choisisses laquelle garder).
 */
const norm = (v: string | null | undefined) =>
  (v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "").replace(/^33/, "0");

export interface DoublonInput {
  id: string;
  email?: string | null;
  telephone?: string | null;
  nom?: string | null;
  prenom?: string | null;
}

export function trouverDoublons(items: DoublonInput[]): Map<string, string> {
  const groups = new Map<string, string[]>();
  const add = (key: string, id: string) => {
    const arr = groups.get(key) ?? [];
    arr.push(id);
    groups.set(key, arr);
  };
  for (const it of items) {
    const e = norm(it.email);
    if (e) add(`e:${e}`, it.id);
    const t = digits(it.telephone);
    if (t.length >= 9) add(`t:${t}`, it.id);
    const n = norm(`${it.prenom ?? ""} ${it.nom ?? ""}`);
    if (n.length >= 5 && n.includes(" ")) add(`n:${n}`, it.id);
  }
  const out = new Map<string, string>();
  groups.forEach((ids, key) => {
    if (ids.length < 2) return;
    const raison = key.startsWith("e:") ? "même e-mail" : key.startsWith("t:") ? "même téléphone" : "même nom";
    ids.forEach((id) => { if (!out.has(id)) out.set(id, raison); });
  });
  return out;
}
