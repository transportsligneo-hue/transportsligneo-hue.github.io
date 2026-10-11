import { supabase } from "@/integrations/supabase/client";

export type CatalogEntry = { id: string; marque: string; modele: string; version: string | null; energie: string | null; categorie: string | null; photo_path: string | null; actif: boolean };

export const norm = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Trouve le modèle le plus proche (marque exacte, modèle contenu dans l'un ou l'autre). */
export function matchCatalog(list: CatalogEntry[], marque: string, modele: string): CatalogEntry | null {
  const m = norm(marque), mo = norm(modele);
  if (!m || !mo) return null;
  const same = list.filter((c) => c.actif && c.photo_path && norm(c.marque) === m);
  return same.find((c) => norm(c.modele) === mo)
    ?? same.filter((c) => mo.includes(norm(c.modele)) || norm(c.modele).includes(mo)).sort((a, b) => b.modele.length - a.modele.length)[0]
    ?? null;
}

const urlCache = new Map<string, string>();
export async function catalogPhotoUrl(path: string): Promise<string | null> {
  if (urlCache.has(path)) return urlCache.get(path)!;
  const { data } = await supabase.storage.from("vehicle-catalog").createSignedUrl(path, 60 * 60 * 6);
  if (data?.signedUrl) urlCache.set(path, data.signedUrl);
  return data?.signedUrl ?? null;
}

export async function loadCatalog(): Promise<CatalogEntry[]> {
  const { data } = await supabase.from("vehicle_catalog").select("*").order("marque").order("modele");
  return (data ?? []) as CatalogEntry[];
}
