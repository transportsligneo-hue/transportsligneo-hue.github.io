import { createServerFn } from "@tanstack/react-start";

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
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await (supabaseAdmin as any)
    .from("avis_publics")
    .select("id, note, commentaire, nom_affiche_public, ville, type_client, date_avis")
    .order("date_avis", { ascending: false })
    .limit(6);

  if (error) return [] as AvisPublic[];
  return (data ?? []) as AvisPublic[];
});
