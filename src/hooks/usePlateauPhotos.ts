import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const VIEWS = [
  { id: "face_avant", label: "Face avant" },
  { id: "face_arriere", label: "Face arrière" },
  { id: "cote_gauche", label: "Côté gauche" },
  { id: "cote_droit", label: "Côté droit" },
] as const;

export interface PlateauPhoto {
  vue: string;
  label: string;
  url: string;
  storagePath: string;
}

/** The four plateau photos live in edl_non_roulant, not inspection_photos. */
export function usePlateauPhotos(attributionId: string | null) {
  const [result, setResult] = useState<{ attributionId: string | null; isPlateau: boolean; photos: PlateauPhoto[] }>({
    attributionId: null, isPlateau: false, photos: [],
  });

  useEffect(() => {
    if (!attributionId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("edl_non_roulant")
        .select("photos")
        .eq("attribution_id", attributionId)
        .maybeSingle();
      if (error) {
        console.warn("Plateau photos lookup failed:", error);
        return;
      }
      const raw = Array.isArray(data?.photos) ? data.photos as Array<{ vue?: string; storage_path?: string | null }> : [];
      const ordered = VIEWS.flatMap((view) => raw.filter((p) => p?.vue === view.id && p.storage_path).map((p) => ({
        vue: view.id, label: view.label, storagePath: p.storage_path as string,
      })));
      const signed = await Promise.all(ordered.map(async (p): Promise<PlateauPhoto | null> => {
        const { data: asset } = await supabase.storage.from("mission-documents").createSignedUrl(p.storagePath, 3600);
        return asset?.signedUrl ? { ...p, url: asset.signedUrl } : null;
      }));
      if (!cancelled) setResult({ attributionId, isPlateau: !!data, photos: signed.filter((p): p is PlateauPhoto => p !== null) });
    })();
    return () => { cancelled = true; };
  }, [attributionId]);

  return result.attributionId === attributionId ? result : { attributionId, isPlateau: false, photos: [] as PlateauPhoto[] };
}