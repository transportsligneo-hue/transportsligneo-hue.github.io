import { useCallback, useEffect, useId, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UserNotif {
  id: string;
  type: string;
  titre: string;
  message: string | null;
  link: string | null;
  category: string;
  priority: string;
  lu: boolean;
  created_at: string;
}

const table = () => supabase.from("user_notifications" as never);

/** Notifications du convoyeur connecté, avec mise à jour en direct. */
export function useUserNotifications(limit = 300) {
  const { user } = useAuth();
  const channelId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [items, setItems] = useState<UserNotif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await table()
      .select("id, type, titre, message, link, category, priority, lu, created_at")
      .eq("user_id" as never, user.id as never)
      .order("created_at", { ascending: false })
      .limit(limit);
    setItems((data as unknown as UserNotif[]) ?? []);
    setLoading(false);
  }, [user?.id, limit]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`drv-notif-${user.id}-${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, load, channelId]);

  const markRead = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    setItems((l) => l.map((n) => (ids.includes(n.id) ? { ...n, lu: true } : n)));
    await table().update({ lu: true } as never).in("id" as never, ids as never);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    setItems((l) => l.map((n) => ({ ...n, lu: true })));
    await table().update({ lu: true } as never).eq("user_id" as never, user.id as never).eq("lu" as never, false as never);
  }, [user?.id]);

  return { items, loading, unread: items.filter((n) => !n.lu), markRead, markAllRead, reload: load };
}

/** Catégorie base de données → libellé + icône de l'appli Driver. */
export const NOTIF_KIND: Record<string, { label: string; icon: string }> = {
  mission: { label: "Missions", icon: "truck" },
  paiement: { label: "Paiements", icon: "wallet" },
  document: { label: "Documents", icon: "folder" },
  message: { label: "Messages", icon: "bell" },
  systeme: { label: "Système", icon: "spark" },
  compte: { label: "Compte", icon: "user" },
};
