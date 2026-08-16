/**
 * Prefetch léger déclenché au survol / focus d'un item de liste de missions.
 * Réchauffe :
 *   - l'attribution associée (par numero_mission ou par trajet)
 *   - la liste d'inspections + première batch d'URLs signées photos
 *   - la liste des documents partagés
 *
 * Résultat : lorsque l'utilisateur clique et ouvre le détail, les requêtes
 * réseau sont déjà résolues (Supabase / navigateur HTTP cache) et le
 * MissionTrackingPanel se remplit quasi-instantanément.
 *
 * Idempotent — chaque missionId est prefetché au maximum une fois par session.
 */
import { supabase } from "@/integrations/supabase/client";

const prefetched = new Set<string>();

export function prefetchMissionTracking(missionNumero: string | null | undefined, missionId: string): void {
  if (!missionId || prefetched.has(missionId)) return;
  prefetched.add(missionId);

  // On lance en fire-and-forget — jamais bloquant, jamais throw.
  void (async () => {
    try {
      let attributionId: string | null = null;
      let trajetId: string | null = null;

      if (missionNumero) {
        const { data: attr } = await supabase
          .from("attributions")
          .select("id, trajet_id")
          .eq("numero_mission", missionNumero)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (attr) {
          attributionId = attr.id;
          trajetId = attr.trajet_id ?? null;
        }
      }

      if (!attributionId) return;

      // Warm-up parallèle : inspections + docs + carte grise + signatures
      await Promise.all([
        supabase
          .from("inspections")
          .select("id, type")
          .eq("attribution_id", attributionId)
          .then(async ({ data }) => {
            const ids = ((data as { id: string }[] | null) ?? []).map(i => i.id);
            if (!ids.length) return;
            await supabase
              .from("inspection_photos")
              .select("id, inspection_id, vue_type, url_photo")
              .in("inspection_id", ids);
          }),
        supabase
          .from("mission_documents")
          .select("id, type_document, nom_fichier, url_fichier, created_at")
          .eq("attribution_id", attributionId)
          .order("created_at", { ascending: false }),
        supabase
          .from("mission_signatures")
          .select("kind, signature_data, signed_at, created_at")
          .eq("attribution_id", attributionId),
        trajetId
          ? supabase.from("trajets_client_safe").select("carte_grise_recto_url, carte_grise_verso_url").eq("id", trajetId).maybeSingle()
          : Promise.resolve(null),
      ]);
    } catch {
      // Prefetch silencieux — jamais visible pour l'utilisateur
      prefetched.delete(missionId);
    }
  })();
}
