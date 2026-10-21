import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type InfoKind = "urgent" | "maintenance" | "changement" | "nouveau";

export interface InfoLigneo {
  id: string;
  kind: InfoKind;
  titre: string;
  corps: string;
  publieLe: string | null;
  lue: boolean;
}

// Tables créées par la migration 20261022000000 (types Supabase pas encore régénérés).
const db = supabase as unknown as { from: (t: string) => any };

/** Infos Ligneo publiées par l'admin, avec l'état « lue » du convoyeur connecté. */
export function useInfosLigneo() {
  const { user } = useAuth();
  const [infos, setInfos] = useState<InfoLigneo[]>([]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [{ data: rows }, { data: lues }] = await Promise.all([
      db.from("infos_ligneo").select("id, kind, titre, corps, publie_le").eq("publie", true).order("publie_le", { ascending: false }).limit(30),
      db.from("infos_ligneo_lues").select("info_id").eq("user_id", user.id),
    ]);
    const seen = new Set<string>(((lues as Array<{ info_id: string }>) ?? []).map((l) => l.info_id));
    setInfos(
      ((rows as Array<{ id: string; kind: InfoKind; titre: string; corps: string; publie_le: string | null }>) ?? []).map((r) => ({
        id: r.id, kind: r.kind, titre: r.titre, corps: r.corps, publieLe: r.publie_le, lue: seen.has(r.id),
      })),
    );
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const markRead = useCallback(async (id: string) => {
    if (!user?.id) return;
    setInfos((l) => l.map((i) => (i.id === id ? { ...i, lue: true } : i)));
    await db.from("infos_ligneo_lues").upsert({ info_id: id, user_id: user.id });
  }, [user?.id]);

  return { infos, markRead, reload: load };
}
