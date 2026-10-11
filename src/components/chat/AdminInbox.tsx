import { useEffect, useMemo, useState } from "react";
import { Search, MessageCircle, Truck, UserRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChatThread } from "./ChatThread";

type Conv = {
  id: string;
  kind: "mission_client" | "mission_convoyeur" | "conseiller";
  mission_id: string | null;
  mission_reference: string | null;
  visitor_name: string | null;
  visitor_email: string | null;
  client_user_id: string | null;
  source: string;
  status: "ouverte" | "en_attente" | "resolue";
  vroomy_summary: string | null;
  unread_admin: number;
  last_message_at: string;
  last_message_preview: string | null;
};

const STATUS_LABEL = { ouverte: "Ouverte", en_attente: "En attente", resolue: "Résolue" } as const;

function useConversations(mode: "missions" | "conseiller") {
  const [rows, setRows] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = async () => {
      let q = supabase
        .from("chat_conversations")
        .select("id, kind, mission_id, mission_reference, visitor_name, visitor_email, client_user_id, source, status, vroomy_summary, unread_admin, last_message_at, last_message_preview")
        .order("last_message_at", { ascending: false })
        .limit(300);
      q = mode === "conseiller" ? q.eq("kind", "conseiller") : q.in("kind", ["mission_client", "mission_convoyeur"]);
      const { data } = await q;
      setRows((data as Conv[]) ?? []);
      setLoading(false);
    };
    void load();
    const ch = supabase
      .channel(`admin-inbox-${mode}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [mode]);
  return { rows, loading, setRows };
}

export function AdminMissionInbox() {
  const { rows, loading } = useConversations("missions");
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"mission_client" | "mission_convoyeur">("mission_client");
  const [convId, setConvId] = useState<string | null>(null);

  const missions = useMemo(() => {
    const map = new Map<string, { mission_id: string; ref: string; client: Conv | null; convoyeur: Conv | null; last: string }>();
    for (const c of rows) {
      if (!c.mission_id) continue;
      const m = map.get(c.mission_id) ?? { mission_id: c.mission_id, ref: c.mission_reference ?? c.mission_id.slice(0, 8), client: null, convoyeur: null, last: c.last_message_at };
      if (c.kind === "mission_client") m.client = c; else m.convoyeur = c;
      if (c.last_message_at > m.last) m.last = c.last_message_at;
      map.set(c.mission_id, m);
    }
    const s = search.trim().toLowerCase();
    return [...map.values()]
      .filter((m) => !s || m.ref.toLowerCase().includes(s))
      .filter((m) => !unreadOnly || (m.client?.unread_admin ?? 0) + (m.convoyeur?.unread_admin ?? 0) > 0)
      .sort((a, b) => b.last.localeCompare(a.last));
  }, [rows, search, unreadOnly]);

  useEffect(() => {
    if (!selected) { setConvId(null); return; }
    setConvId(null);
    supabase.rpc("chat_open_mission", { _mission_id: selected, _kind: tab }).then(({ data }) => setConvId((data as string) ?? null));
  }, [selected, tab]);

  const current = missions.find((m) => m.mission_id === selected);

  return (
    <div className="lgc-admin">
      <aside className="lgc-admin-list">
        <div className="lgc-search">
          <Search size={16} aria-hidden="true" />
          <input placeholder="Rechercher une mission (numéro)" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="lgc-filter"><input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> Non lus uniquement</label>
        {loading ? <div className="lgc-empty"><Loader2 className="animate-spin" size={18} /></div> : missions.length === 0 ? (
          <div className="lgc-empty">Aucune conversation de mission pour le moment.</div>
        ) : missions.map((m) => (
          <button key={m.mission_id} type="button" className={`lgc-item${selected === m.mission_id ? " active" : ""}`} onClick={() => setSelected(m.mission_id)}>
            <div className="lgc-item-top">
              <span className="lgc-ref">{m.ref}</span>
              <span className="lgc-date">{new Date(m.last).toLocaleDateString("fr-FR")}</span>
            </div>
            <div className="lgc-counts">
              <span className="lgc-count-blue" title="Messages client non lus"><UserRound size={12} /> {m.client?.unread_admin ?? 0}</span>
              <span className="lgc-count-green" title="Messages convoyeur non lus"><Truck size={12} /> {m.convoyeur?.unread_admin ?? 0}</span>
            </div>
            <div className="lgc-preview">{(m.client?.last_message_at ?? "") > (m.convoyeur?.last_message_at ?? "") ? m.client?.last_message_preview : m.convoyeur?.last_message_preview}</div>
          </button>
        ))}
      </aside>
      <section className="lgc-admin-main">
        {!current && !selected ? (
          <div className="lgc-empty lgc-empty-big"><MessageCircle size={28} /> Sélectionnez une mission pour voir ses conversations.</div>
        ) : (
          <>
            <div className="lgc-tabs" role="tablist">
              <button role="tab" aria-selected={tab === "mission_client"} className={`lgc-tab-blue${tab === "mission_client" ? " on" : ""}`} onClick={() => setTab("mission_client")}>
                <UserRound size={15} /> Client {current?.client?.unread_admin ? <b>{current.client.unread_admin}</b> : null}
              </button>
              <button role="tab" aria-selected={tab === "mission_convoyeur"} className={`lgc-tab-green${tab === "mission_convoyeur" ? " on" : ""}`} onClick={() => setTab("mission_convoyeur")}>
                <Truck size={15} /> Convoyeur {current?.convoyeur?.unread_admin ? <b>{current.convoyeur.unread_admin}</b> : null}
              </button>
              <span className="lgc-tab-ref">Mission {current?.ref}</span>
            </div>
            <p className="lgc-hint">Les deux fils sont séparés : le client ne voit jamais les messages du convoyeur, et inversement.</p>
            {convId ? (
              <ChatThread key={convId} conversationId={convId} viewer="admin" accent={tab === "mission_convoyeur" ? "green" : "blue"} height={520} />
            ) : <div className="lgc-empty"><Loader2 className="animate-spin" size={18} /></div>}
          </>
        )}
      </section>
    </div>
  );
}

export function AdminConseillerInbox() {
  const { rows, loading } = useConversations("conseiller");
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Conv["status"]>("all");
  const [settings, setSettings] = useState<{ advisor_available: boolean; quick_replies: string[] } | null>(null);

  useEffect(() => {
    supabase.from("chat_settings").select("advisor_available, quick_replies").maybeSingle().then(({ data }) => {
      if (data) setSettings({ advisor_available: data.advisor_available, quick_replies: (data.quick_replies as string[]) ?? [] });
    });
  }, []);

  const list = rows.filter((r) => filter === "all" || r.status === filter);
  const cur = rows.find((r) => r.id === selected) ?? null;

  const toggleAvail = async () => {
    if (!settings) return;
    const v = !settings.advisor_available;
    setSettings({ ...settings, advisor_available: v });
    await supabase.from("chat_settings").update({ advisor_available: v, updated_at: new Date().toISOString() }).eq("id", true);
  };
  const setStatus = async (s: Conv["status"]) => {
    if (!cur) return;
    await supabase.from("chat_conversations").update({ status: s }).eq("id", cur.id);
  };

  return (
    <div className="lgc-admin">
      <aside className="lgc-admin-list">
        <button type="button" className={`lgc-availability${settings?.advisor_available ? " on" : ""}`} onClick={toggleAvail}>
          <span aria-hidden="true" /> {settings?.advisor_available ? "Je suis disponible" : "Indisponible (message d'absence)"}
        </button>
        <div className="lgc-statuses">
          {(["all", "ouverte", "en_attente", "resolue"] as const).map((s) => (
            <button key={s} type="button" className={filter === s ? "on" : ""} onClick={() => setFilter(s)}>
              {s === "all" ? "Toutes" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        {loading ? <div className="lgc-empty"><Loader2 className="animate-spin" size={18} /></div> : list.length === 0 ? (
          <div className="lgc-empty">Aucune conversation.</div>
        ) : list.map((c) => (
          <button key={c.id} type="button" className={`lgc-item${selected === c.id ? " active" : ""}`} onClick={() => setSelected(c.id)}>
            <div className="lgc-item-top">
              <span className="lgc-name">{c.visitor_name ?? (c.client_user_id ? "Client connecté" : "Visiteur")}</span>
              {c.unread_admin > 0 && <span className="lgc-badge">{c.unread_admin}</span>}
            </div>
            <div className="lgc-item-sub">
              <span className={`lgc-st lgc-st-${c.status}`}>{STATUS_LABEL[c.status]}</span>
              <span>{c.source === "vroomy" ? "Depuis Vroomy" : c.client_user_id ? "Client" : "Visiteur"}</span>
            </div>
            <div className="lgc-preview">{c.last_message_preview}</div>
          </button>
        ))}
      </aside>
      <section className="lgc-admin-main">
        {!cur ? (
          <div className="lgc-empty lgc-empty-big"><MessageCircle size={28} /> Sélectionnez une conversation.</div>
        ) : (
          <>
            <div className="lgc-conv-head">
              <div>
                <h3>{cur.visitor_name ?? "Client connecté"}</h3>
                {cur.visitor_email && <a href={`mailto:${cur.visitor_email}`}>{cur.visitor_email}</a>}
              </div>
              <select value={cur.status} onChange={(e) => void setStatus(e.target.value as Conv["status"])} aria-label="Statut">
                <option value="ouverte">Ouverte</option>
                <option value="en_attente">En attente</option>
                <option value="resolue">Résolue</option>
              </select>
            </div>
            {cur.vroomy_summary && (
              <div className="lgc-summary"><b>Résumé de l'échange avec Vroomy</b><p>{cur.vroomy_summary}</p></div>
            )}
            {cur.visitor_email && !cur.client_user_id && (
              <p className="lgc-hint">Visiteur non connecté : il voit vos réponses dans Vroomy tant qu'il garde la page ouverte. Pour une réponse longue, écrivez-lui aussi par email.</p>
            )}
            <ChatThread key={cur.id} conversationId={cur.id} viewer="admin" accent="blue" height={480} quickReplies={settings?.quick_replies} />
          </>
        )}
      </section>
    </div>
  );
}
