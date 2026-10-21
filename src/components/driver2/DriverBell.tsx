import { useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "@tanstack/react-router";
import { Ic } from "@/components/driver2/icons";
import { NOTIF_KIND, useUserNotifications } from "@/hooks/useUserNotifications";
import { formatRelativeTime } from "@/lib/notify";

/** Cloche de l'en-tête Driver + panneau des notifications non lues (comme l'appli validée). */
export function DriverBell() {
  const { unread, markRead, markAllRead } = useUserNotifications(40);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const u = unread.length;

  const openOne = async (id: string, link: string | null) => {
    await markRead([id]);
    setOpen(false);
    if (link && link.startsWith("/")) void navigate({ to: link as never });
  };

  return (
    <>
      <button className="hbtn bellb" onClick={() => setOpen((v) => !v)} aria-label="Notifications">
        <Ic n="bell" s={16} />
        {u > 0 && <b className="bbadge">{u > 99 ? "99+" : u}</b>}
      </button>
      {open && typeof document !== "undefined" &&
        createPortal(
          <div className="drv2">
            <div className="npan-bg" onClick={() => setOpen(false)}>
              <div className="npan" onClick={(e) => e.stopPropagation()}>
                <div className="npan-h">
                  <span className="npan-ic"><Ic n="bell" s={22} /></span>
                  <div style={{ flex: 1 }}>
                    <b>Notifications</b>
                    <small className={u ? "" : "ok"}><i className="dotg" />{u ? `${u} non lue${u > 1 ? "s" : ""}` : "Tout est à jour"}</small>
                  </div>
                  <button className="hbtn" onClick={() => setOpen(false)} aria-label="Fermer"><Ic n="x" s={16} /></button>
                </div>
                <div className="npan-l">
                  {u > 0 ? unread.map((n) => {
                    const k = NOTIF_KIND[n.category] ?? NOTIF_KIND.systeme;
                    return (
                      <button key={n.id} className="npan-i" onClick={() => void openOne(n.id, n.link)}>
                        <span className="nic"><Ic n={k.icon} s={18} /></span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="npt"><b>{n.titre}</b><small>{formatRelativeTime(n.created_at)}</small></div>
                          {n.message && <p>{n.message}</p>}
                        </div>
                        <i className="ud" />
                      </button>
                    );
                  }) : (
                    <div className="npan-e">
                      <Ic n="check2" s={26} sw={2.4} />
                      <b>Vous êtes à jour</b>
                      <p>Les notifications lues sont rangées dans l'historique.</p>
                    </div>
                  )}
                </div>
                <div className="npan-f">
                  {u > 0 && <button className="nlink" onClick={() => void markAllRead()}><Ic n="check2" s={14} sw={2.4} />Tout marquer comme lu</button>}
                  <Link to={"/convoyeur/notifications" as never} className="btn green" onClick={() => setOpen(false)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    Voir toutes les notifications <Ic n="arr" s={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
