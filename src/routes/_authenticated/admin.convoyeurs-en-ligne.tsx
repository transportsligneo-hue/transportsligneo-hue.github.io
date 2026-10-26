/**
 * Admin · Opérations › Convoyeurs en ligne.
 * Qui a l'appli Driver ouverte (signal de moins de 90 s), libre ou en mission, sa version,
 * sa position sur la carte Mapbox, et les actions : proposer une mission, notifier, chat.
 * Données : convoyeur_presence (migration 20261026000600), convoyeurs, attributions, driver_app_updates.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, MessageSquare, Send } from "lucide-react";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import { Modal } from "@/components/admin/AdminUI";
import { AssignDriverDialog } from "@/components/admin/AssignDriverDialog";
import { LiveMissionMap } from "@/components/map/LiveMissionMap";
import { supabase } from "@/integrations/supabase/client";
import { sendAdminPushNotification } from "@/lib/admin-communication.functions";
import "@/components/admin/stats/admin-stats.css";

export const Route = createFileRoute("/_authenticated/admin/convoyeurs-en-ligne")({
  head: () => ({ meta: [{ title: "Convoyeurs en ligne | Transports Ligneo" }] }),
  component: ConvoyeursEnLigne,
});

// Tables récentes (types Supabase pas encore régénérés)
const db = supabase as unknown as { from: (t: string) => any };

const ONLINE_MS = 90_000;
const FINISHED = ["terminee", "termine", "validee", "livree", "annulee", "annule", "refusee", "refuse"];
const STARTED = new Set(["prise_en_charge", "edl_depart", "edl_depart_fait", "en_route", "en_livraison", "pause", "reprise",
  "sur_place", "arrive_destination", "arrive_livraison", "edl_arrivee", "edl_arrivee_fait", "signature_arrivee"]);

type Convoyeur = { id: string; user_id: string | null; prenom: string | null; nom: string | null; ville: string | null; statut: string | null };
type Presence = { user_id: string; convoyeur_id: string | null; last_seen: string; online_since: string; app_version: string | null; latitude: number | null; longitude: number | null; position_at: string | null };
type Mission = { convoyeur_id: string; numero: string | null; depart: string | null; arrivee: string | null };
type Trip = { id: string; depart: string; arrivee: string; date_trajet: string | null };
type Row = Convoyeur & { presence?: Presence; online: boolean; mission?: Mission };

function cmpVersion(a: string, b: string) {
  const x = a.split(".").map((n) => parseInt(n, 10) || 0), y = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return d; }
  return 0;
}
function ago(iso: string, now: number) {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const d = new Date(iso);
  const sameDay = new Date(now).toDateString() === d.toDateString();
  const hm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `aujourd'hui à ${hm}`;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (y.toDateString() === d.toDateString()) return `hier à ${hm}`;
  return `le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
}
function since(iso: string, now: number) {
  const min = Math.max(1, Math.round((now - new Date(iso).getTime()) / 60_000));
  return min < 60 ? `En ligne depuis ${min} min` : `En ligne depuis ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}
const fullName = (c: Convoyeur) => `${c.prenom ?? ""} ${c.nom ?? ""}`.trim() || "Convoyeur";
const initials = (c: Convoyeur) => `${(c.prenom ?? "?")[0] ?? ""}${(c.nom ?? "")[0] ?? ""}`.toUpperCase();

function ConvoyeursEnLigne() {
  const [convoyeurs, setConvoyeurs] = useState<Convoyeur[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [required, setRequired] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<"all" | "free" | "mission" | "off">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [notifFor, setNotifFor] = useState<Row | null>(null);
  const [notifText, setNotifText] = useState("");
  const [sending, setSending] = useState(false);
  const [proposeFor, setProposeFor] = useState<Row | null>(null);
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [assign, setAssign] = useState<{ trip: Trip; row: Row } | null>(null);
  const sendPush = useServerFn(sendAdminPushNotification);

  const loadPresence = useCallback(async () => {
    const { data, error } = await db.from("convoyeur_presence").select("user_id, convoyeur_id, last_seen, online_since, app_version, latitude, longitude, position_at");
    if (error) { console.warn("Présence :", error); return; }
    setPresence((data as Presence[]) ?? []);
  }, []);

  const loadAll = useCallback(async () => {
    const [cv, att, upd] = await Promise.all([
      supabase.from("convoyeurs").select("id, user_id, prenom, nom, ville, statut").order("prenom", { ascending: true }).limit(500),
      supabase.from("attributions").select("convoyeur_id, numero_mission, statut, etape_courante, trajets(depart, arrivee, statut)")
        .not("statut", "in", `(${FINISHED.map((s) => `"${s}"`).join(",")})`).limit(300),
      db.from("driver_app_updates").select("version").eq("active", true).maybeSingle(),
    ]);
    setConvoyeurs(((cv.data as Convoyeur[]) ?? []).filter((c) => !["refuse", "refusee", "suspendu"].includes(c.statut ?? "")));
    const ms: Mission[] = [];
    for (const a of (att.data ?? []) as any[]) {
      const t = Array.isArray(a.trajets) ? a.trajets[0] : a.trajets;
      if (!t || FINISHED.includes(t.statut ?? "")) continue;
      const started = ["en_cours", "livraison", "en_livraison", "incident"].includes(a.statut) || STARTED.has(a.etape_courante ?? "");
      if (started) ms.push({ convoyeur_id: a.convoyeur_id, numero: a.numero_mission, depart: t.depart, arrivee: t.arrivee });
    }
    setMissions(ms);
    setRequired((upd.data as { version?: string } | null)?.version ?? null);
    await loadPresence();
    setLoading(false);
  }, [loadPresence]);

  useEffect(() => {
    void loadAll();
    const ch = supabase.channel("admin-convoyeurs-en-ligne")
      .on("postgres_changes", { event: "*", schema: "public", table: "convoyeur_presence" }, () => void loadPresence())
      .subscribe();
    const poll = window.setInterval(() => void loadPresence(), 20_000);
    const full = window.setInterval(() => void loadAll(), 120_000);
    const clock = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => { void supabase.removeChannel(ch); window.clearInterval(poll); window.clearInterval(full); window.clearInterval(clock); };
  }, [loadAll, loadPresence]);

  const latest = useMemo(() => {
    let v = required ?? "";
    for (const p of presence) if (p.app_version && (!v || cmpVersion(p.app_version, v) > 0)) v = p.app_version;
    return v || null;
  }, [presence, required]);

  const rows: Row[] = useMemo(() => {
    const byUser = new Map(presence.map((p) => [p.user_id, p]));
    const byConv = new Map(missions.map((m) => [m.convoyeur_id, m]));
    return convoyeurs.map((c) => {
      const p = c.user_id ? byUser.get(c.user_id) : undefined;
      const online = !!p && now - new Date(p.last_seen).getTime() < ONLINE_MS;
      return { ...c, presence: p, online, mission: byConv.get(c.id) };
    })
      .filter((r) => r.presence) // seulement ceux qui ont déjà ouvert l'appli
      .sort((a, b) => Number(b.online) - Number(a.online) || new Date(b.presence!.last_seen).getTime() - new Date(a.presence!.last_seen).getTime());
  }, [convoyeurs, presence, missions, now]);

  const online = rows.filter((r) => r.online);
  const free = online.filter((r) => !r.mission);
  const inMission = online.filter((r) => r.mission);
  const outdated = rows.filter((r) => latest && r.presence?.app_version && cmpVersion(r.presence.app_version, latest) < 0);
  const list = rows.filter((r) => filter === "all" || (filter === "off" ? !r.online : r.online && (filter === "free" ? !r.mission : !!r.mission)));

  const fleet = useMemo(() => online.flatMap((r) => {
    const p = r.presence!;
    if (p.latitude == null || p.longitude == null) return [];
    return [{ lat: p.latitude, lng: p.longitude, label: `${fullName(r)} · ${r.mission ? `En mission ${r.mission.numero ?? ""}` : "Libre"}`, stale: false }];
  }), [online]);

  async function openPropose(r: Row) {
    setProposeFor(r);
    setTrips(null);
    const { data: trajets } = await supabase.from("trajets").select("id, depart, arrivee, date_trajet")
      .in("statut", ["en_attente", "attribue"]).order("date_trajet", { ascending: true, nullsFirst: false }).limit(100);
    const ids = (trajets ?? []).map((t) => t.id);
    const { data: existing } = ids.length ? await supabase.from("attributions").select("trajet_id, statut").in("trajet_id", ids) : { data: [] };
    const busy = new Set((existing ?? []).filter((a) => !["annule", "refusee", "refuse"].includes(a.statut)).map((a) => a.trajet_id));
    setTrips(((trajets ?? []) as Trip[]).filter((t) => !busy.has(t.id)));
  }

  async function sendNotif() {
    if (!notifFor?.user_id || notifText.trim().length < 2) return;
    setSending(true);
    try {
      await sendPush({ data: { target: { mode: "user", userId: notifFor.user_id }, payload: { title: "Transports Ligneo", body: notifText.trim(), url: "/convoyeur" } } });
      toast.success(`Notification envoyée à ${notifFor.prenom ?? "ce convoyeur"}`);
      setNotifFor(null);
    } catch (e) {
      toast.error("Notification non envoyée", { description: e instanceof Error ? e.message : "" });
    } finally { setSending(false); }
  }

  return (
    <div className="ast">
      <AdminSectionHeader
        breadcrumb="Opérations"
        eyebrow="Convoyeurs en ligne"
        title="Convoyeurs"
        highlight="en ligne"
        subtitle="Qui a l'appli ouverte en ce moment, qui est libre, et qui doit faire la mise à jour."
      />

      <div className="ast-chips">
        <span><i className="ast-live" /><b>{online.length}</b> en ligne</span>
        <span className="is-green"><b>{free.length}</b> libre{free.length > 1 ? "s" : ""}</span>
        <span className="is-blue"><b>{inMission.length}</b> en mission</span>
        <span className="is-warn"><b>{outdated.length}</b> à mettre à jour</span>
      </div>

      <div className="ast-grid2">
        <section className="ast-card">
          <div className="ast-card-hd"><div><h2>Où sont les convoyeurs</h2><p>Position pendant que l'appli est ouverte</p></div></div>
          <div className="ast-map">
            {fleet.length > 0
              ? <LiveMissionMap points={[]} fleet={fleet} hideOverlay className="absolute inset-0 !rounded-none" />
              : <p className="ast-empty ast-map-empty">{loading ? "Chargement…" : "Aucune position pour le moment."}</p>}
          </div>
        </section>

        <section className="ast-card">
          <div className="ast-card-hd"><div><h2>Tous les convoyeurs</h2><p>Mis à jour en direct</p></div></div>
          <div className="ast-filters" role="tablist" aria-label="Filtrer">
            {([["all", "Tous"], ["free", "Libres"], ["mission", "En mission"], ["off", "Hors ligne"]] as const).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
          {loading && <div className="ast-loadbar" aria-label="Chargement"><i /></div>}
          {!loading && list.length === 0 && (
            <p className="ast-empty">{rows.length === 0 ? "Aucun convoyeur n'a encore ouvert l'appli depuis cette mise à jour." : "Personne dans cette catégorie."}</p>
          )}
          <div className="ast-cv-list">
            {list.map((r) => {
              const p = r.presence!;
              const old = !!(latest && p.app_version && cmpVersion(p.app_version, latest) < 0);
              return (
                <div key={r.id} className={`ast-cv${selected === r.id ? " is-sel" : ""}`} onClick={() => setSelected(r.id)}>
                  <div className={`ast-av${r.online ? "" : " off"}`}>{initials(r)}<i /></div>
                  <div className="ast-cv-t">
                    <b>{fullName(r)}</b>
                    <small>
                      {r.online
                        ? r.mission ? <span className="ast-chip blue">En mission</span> : <span className="ast-chip ok">● Libre</span>
                        : <span className="ast-chip no">Vu {ago(p.last_seen, now)}</span>}
                      {r.ville && <span>{r.ville}</span>}
                    </small>
                    <small>
                      {r.online && r.mission && <span>{r.mission.numero ?? "Mission"} · {r.mission.depart ?? "?"} → {r.mission.arrivee ?? "?"}</span>}
                      {r.online && <span>{since(p.online_since, now)}</span>}
                      {p.app_version
                        ? <span className={`ast-chip ${old ? "warn" : "no"}`}>v{p.app_version}{old ? " · à mettre à jour" : ""}</span>
                        : <span className="ast-chip no">Version web</span>}
                    </small>
                  </div>
                  <div className="ast-cv-act">
                    <button type="button" className="ast-btn pri" disabled={!!r.mission && r.online} onClick={(e) => { e.stopPropagation(); void openPropose(r); }}><Send size={15} /> Proposer une mission</button>
                    <button type="button" className="ast-btn" disabled={!r.user_id} onClick={(e) => { e.stopPropagation(); setNotifFor(r); setNotifText(`Bonjour ${r.prenom ?? ""}, une mission est disponible. Tu es dispo ?`.replace("  ", " ")); }}><Bell size={15} /> Notifier</button>
                    <Link to="/admin/messagerie" className="ast-btn" onClick={(e) => e.stopPropagation()}><MessageSquare size={15} /> Chat</Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <p className="ast-note">Les convoyeurs apparaissent ici dès qu'ils ouvrent l'appli Driver. Hors ligne = aucun signal depuis 90 secondes (appli fermée, téléphone en veille ou sans réseau).</p>

      <Modal open={!!notifFor} onClose={() => setNotifFor(null)} title={`Notifier ${notifFor?.prenom ?? ""}`} size="sm">
        <div className="ast-modal">
          <p>Une notification arrive sur son téléphone, même appli fermée.</p>
          <label htmlFor="ast-notif" className="ast-lab">Message</label>
          <textarea id="ast-notif" value={notifText} onChange={(e) => setNotifText(e.target.value)} maxLength={500} />
          <button type="button" className="ast-btn pri ast-wide" disabled={sending || notifText.trim().length < 2} onClick={() => void sendNotif()}>{sending ? "Envoi…" : "Envoyer la notification"}</button>
        </div>
      </Modal>

      <Modal open={!!proposeFor && !assign} onClose={() => setProposeFor(null)} title={`Proposer une mission à ${proposeFor?.prenom ?? ""}`} size="md">
        <div className="ast-modal">
          <p>Choisis la mission. Il la reçoit dans son appli et peut accepter ou refuser.</p>
          {trips === null && <div className="ast-loadbar"><i /></div>}
          {trips?.length === 0 && <p className="ast-empty">Aucune mission à attribuer en ce moment.</p>}
          <div className="ast-picks">
            {trips?.map((t) => (
              <button key={t.id} type="button" className="ast-pick" onClick={() => proposeFor && setAssign({ trip: t, row: proposeFor })}>
                <b>{t.depart} → {t.arrivee}</b>
                <small>{t.date_trajet ? new Date(t.date_trajet).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "Date à définir"}</small>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {assign && (
        <AssignDriverDialog
          open
          onClose={() => { setAssign(null); setProposeFor(null); }}
          trip={{ id: assign.trip.id, depart: assign.trip.depart, arrivee: assign.trip.arrivee, date: assign.trip.date_trajet, source: "trajet" }}
          preselectConvoyeurId={assign.row.id}
          defaultMode="propose"
          onAssigned={(t) => { toast.success(`Mission envoyée à ${t.label}`); setAssign(null); setProposeFor(null); void loadAll(); }}
        />
      )}
    </div>
  );
}
