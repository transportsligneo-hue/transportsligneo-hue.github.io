import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Bouton Notifications du tableau de bord : même compteur, même rendu et même lien que dans le menu de gauche. */
export function useAdminUnread() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("admin_notifications" as never)
        .select("id", { count: "exact", head: true })
        .eq("lu" as never, false as never);
      setUnread(count ?? 0);
    };
    void fetchUnread();
    const channel = supabase
      .channel("admin-notif-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notifications" }, fetchUnread)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);
  return unread;
}

export function AdminNotifButton() {
  const unread = useAdminUnread();
  return (
    <div className="lig-nav w-[220px] max-w-full">
      <Link to="/admin/notifications" className={`lig-nav-item${unread > 0 ? " lig-nav-alert" : ""}`}>
        <span className="lig-nav-ic"><Bell size={15} /></span>
        <span className="flex-1">Notifications</span>
        {unread > 0 && (
          <span className="lig-nav-badge lig-notif-badge ml-auto" aria-label={`${unread} notification(s) non lue(s)`}>
            <i aria-hidden="true" />{unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    </div>
  );
}
