import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Ic } from "@/components/driver2/icons";
import { NOTIF_KIND, useUserNotifications, type UserNotif } from "@/hooks/useUserNotifications";
import { formatRelativeTime } from "@/lib/notify";
import "@/styles/driver-v2.css";

export const Route = createFileRoute("/_authenticated/convoyeur/notifications")({
  component: DriverNotifications,
});

const FILTRES: Array<[string, string]> = [
  ["all", "Toutes"], ["unread", "Non lues"], ["mission", "Missions"], ["paiement", "Paiements"], ["document", "Documents"], ["systeme", "Système"],
];

function jourLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= start) return "Aujourd'hui";
  if (t >= start - 86400000) return "Hier";
  if (t >= start - 6 * 86400000) return "Cette semaine";
  return "Plus ancien";
}

function DriverNotifications() {
  const { items, loading, unread, markRead, markAllRead } = useUserNotifications(300);
  const navigate = useNavigate();
  const [f, setF] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((n) =>
      (f === "all" || (f === "unread" ? !n.lu : n.category === f)) &&
      (!needle || `${n.titre} ${n.message ?? ""}`.toLowerCase().includes(needle)),
    );
  }, [items, f, q]);

  const jours = useMemo(() => Array.from(new Set(list.map((n) => jourLabel(n.created_at)))), [list]);
  const ids = list.map((n) => n.id);
  const cnt = ids.filter((i) => sel.has(i)).length;
  const allOn = ids.length > 0 && cnt === ids.length;

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSel(allOn ? new Set() : new Set(ids));
  const readSelected = async () => { await markRead(Array.from(sel)); setSel(new Set()); };
  const open = async (n: UserNotif) => {
    await markRead([n.id]);
    if (n.link && n.link.startsWith("/")) void navigate({ to: n.link as never });
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={28} /></div>;

  return (
    <div className="drv2">
      <div className="stack">
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="sp"><h1>Notifications</h1><p className="sub">Historique complet, rien n'est supprimé.</p></div>
          {unread.length > 0 && <button className="nlink" onClick={() => void markAllRead()}><Ic n="check2" s={14} sw={2.4} />Tout lire</button>}
        </div>

        <div className="search"><Ic n="search" s={14} /><input className="fld" placeholder="Rechercher dans les notifications…" value={q} onChange={(e) => setQ(e.target.value)} /></div>

        <div className="filters">
          {FILTRES.map(([k, l]) => (
            <button key={k} className={`fl${f === k ? " on" : ""}`} onClick={() => setF(k)}>
              {l}{k === "unread" && unread.length > 0 && <em>{unread.length}</em>}
            </button>
          ))}
        </div>

        {list.length > 0 && (
          <div className="nbar">
            <button className={`nsa${allOn ? " on" : ""}`} onClick={toggleAll}>
              <span className={`nchk${allOn ? " on" : ""}`}><Ic n="check2" s={12} sw={3} /></span>Tout sélectionner
            </button>
            <span className="nbc">{cnt ? `${cnt} sélectionnée${cnt > 1 ? "s" : ""}` : `${list.length} notification${list.length > 1 ? "s" : ""}`}</span>
            {cnt > 0 && <button className="nlink nrd" onClick={() => void readSelected()}><Ic n="check2" s={14} sw={2.4} />Marquer comme lues</button>}
          </div>
        )}

        {list.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 30 }}><p className="sm semi">Aucune notification.</p></div>
        ) : jours.map((j) => (
          <div key={j}>
            <div className="grp"><span>{j}</span><i /></div>
            {list.filter((n) => jourLabel(n.created_at) === j).map((n) => {
              const k = NOTIF_KIND[n.category] ?? NOTIF_KIND.systeme;
              return (
                <div key={n.id} className={`ncard${n.lu ? " is-read" : ""}${sel.has(n.id) ? " is-sel" : ""}`}>
                  <button className={`nchk${sel.has(n.id) ? " on" : ""}`} onClick={() => toggle(n.id)} aria-label="Sélectionner"><Ic n="check2" s={12} sw={3} /></button>
                  <span className="nic"><Ic n={k.icon} s={18} /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="npt"><span className="nk">{k.label}</span><small>{formatRelativeTime(n.created_at)}</small></div>
                    <b>{n.titre}</b>
                    {n.message && <p>{n.message}</p>}
                    <div className="nact">
                      <button onClick={() => void open(n)}>Voir le détail <Ic n="arr" s={13} sw={2.4} /></button>
                      {n.lu ? <span className="rd"><Ic n="check2" s={12} sw={2.6} /> Lue</span> : <button className="mk" onClick={() => void markRead([n.id])}>Marquer comme lue</button>}
                    </div>
                  </div>
                  {!n.lu && <i className="ud" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
