import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface AvisPublic {
  id: string;
  note: number | null;
  commentaire: string | null;
  nom_affiche_public: string | null;
  ville: string | null;
  type_client: string | null;
  date_avis: string | null;
}

/**
 * Avis publiés destinés au site public.
 * Lecture via la vue publique `avis_publics` (rôle anonyme) : seules les
 * colonnes d'affichage sont exposées, jamais le nom réel ni la mission liée.
 */
export const getAvisPublics = createServerFn({ method: "GET" }).handler(async () => {
  const supabasePublic = createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await (supabasePublic as any)
    .from("avis_publics")
    .select("id, note, commentaire, nom_affiche_public, ville, type_client, date_avis")
    .order("date_avis", { ascending: false })
    .limit(6);

  if (error) return [] as AvisPublic[];
  return (data ?? []) as AvisPublic[];
});
