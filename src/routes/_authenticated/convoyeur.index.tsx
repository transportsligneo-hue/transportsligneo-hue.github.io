import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { PendingProposalsBanner } from "@/components/convoyeur/PendingProposalsBanner";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { DriverLoader } from "@/components/driver2/DriverLoader";
import { Ic, Plate } from "@/components/driver2/icons";
import { InfosLigneoBar } from "@/components/driver2/InfosLigneo";
import { useDriverIdentity } from "@/hooks/useDriverIdentity";
import heroCar from "@/assets/driver-v2/hero.jpg";
import "@/styles/driver-v2.css";

export const Route = createFileRoute("/_authenticated/convoyeur/")({
  component: ConvoyeurDashboard,
});

interface HomeMission {
  id: string;
  statut: string;
  trajet: {
    depart: string;
    arrivee: string;
    date_trajet: string | null;
    heure_trajet: string | null;
    marque: string | null;
    modele: string | null;
    immatriculation: string | null;
  } | null;
}

const JOURS = ["L", "M", "M", "J", "V", "S", "D"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function ConvoyeurDashboard() {
  const { user } = useAuth();
  const me = useDriverIdentity();
  const [catalogueCount, setCatalogueCount] = useState(0);
  const [revenueMonth, setRevenueMonth] = useState(0);
  const [revenueDelta, setRevenueDelta] = useState<number | null>(null);
  const [weekBars, setWeekBars] = useState<number[]>([0, 0, 0, 0]);
  const [doneCount, setDoneCount] = useState(0);
  const [note, setNote] = useState<number | null>(null);
  const [kmMonth, setKmMonth] = useState(0);
  const [next, setNext] = useState<HomeMission | null>(null);
  const [busy, setBusy] = useState<Record<string, number>>({});
  const [weekTotal, setWeekTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: conv } = await supabase
        .from("convoyeurs")
        .select("id, note_moyenne")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!conv) { setLoading(false); return; }
      setNote(conv.note_moyenne != null ? Number(conv.note_moyenne) : null);

      const { count: catCount } = await supabase
        .from("trajets_publies_safe" as never)
        .select("id", { count: "exact", head: true });
      setCatalogueCount(catCount ?? 0);

      const { data: attrs } = await supabase
        .from("attributions")
        .select("id, statut, trajet_id")
        .eq("convoyeur_id", conv.id);

      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const termineIds = (attrs ?? []).filter((a) => a.statut === "termine").map((a) => a.trajet_id).filter(Boolean) as string[];
      setDoneCount(termineIds.length);

      if (termineIds.length > 0) {
        const { data: trs } = await supabase
          .from("trajets_assigned_safe" as never)
          .select("tarif_convoyeur, updated_at")
          .in("id", termineIds)
          .gte("updated_at", firstOfLast.toISOString());
        const rows = (trs ?? []) as unknown as Array<{ tarif_convoyeur: number | null; updated_at: string }>;
        const thisMonth = rows.filter((t) => new Date(t.updated_at) >= firstOfMonth);
        const cur = thisMonth.reduce((s, t) => s + Number(t.tarif_convoyeur ?? 0), 0);
        const prev = rows
          .filter((t) => new Date(t.updated_at) < firstOfMonth)
          .reduce((s, t) => s + Number(t.tarif_convoyeur ?? 0), 0);
        setRevenueMonth(cur);
        if (prev > 0) setRevenueDelta(Math.round(((cur - prev) / prev) * 100));
        const bars = [0, 0, 0, 0];
        thisMonth.forEach((t) => {
          const w = Math.min(3, Math.floor((new Date(t.updated_at).getDate() - 1) / 7));
          bars[w] += Number(t.tarif_convoyeur ?? 0);
        });
        setWeekBars(bars);

        // Kilomètres du mois : distance des rémunérations calculées (facultatif).
        const { data: remus } = await supabase
          .from("remunerations_missions")
          .select("distance_km, date_mission")
          .eq("convoyeur_id", conv.id)
          .neq("statut", "annule")
          .gte("date_mission", iso(firstOfMonth));
        setKmMonth(Math.round((remus ?? []).reduce((s, r) => s + Number(r.distance_km ?? 0), 0)));
      }

      const DONE = new Set(["termine", "en_attente_validation", "validee", "refusee", "refuse", "annule"]);
      const active = (attrs ?? []).filter((a) => !DONE.has(a.statut));
      const enriched: HomeMission[] = [];
      for (const a of active) {
        const { data: t } = await supabase
          .from("trajets_assigned_safe" as never)
          .select("depart, arrivee, date_trajet, heure_trajet, marque, modele, immatriculation")
          .eq("id", a.trajet_id)
          .maybeSingle();
        enriched.push({ id: a.id, statut: a.statut, trajet: (t as unknown as HomeMission["trajet"]) ?? null });
      }

      // Semaine en cours (lundi → dimanche) : nombre de missions par jour.
      const monday = new Date(now);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const perDay: Record<string, number> = {};
      let total = 0;
      enriched.forEach((m) => {
        const d = m.trajet?.date_trajet;
        if (!d) return;
        const diff = Math.round((new Date(d).getTime() - monday.getTime()) / 86400000);
        if (diff >= 0 && diff < 7) { perDay[d] = (perDay[d] ?? 0) + 1; total++; }
      });
      setBusy(perDay);
      setWeekTotal(total);

      // Prochaine mission : en cours d'abord, puis la plus proche dans le temps.
      const today = iso(now);
      const inProg = enriched.find((m) => m.statut === "en_cours");
      const upcoming = enriched
        .filter((m) => m.trajet?.date_trajet && m.trajet.date_trajet >= today)
        .sort((a, b) => `${a.trajet!.date_trajet} ${a.trajet!.heure_trajet ?? ""}`.localeCompare(`${b.trajet!.date_trajet} ${b.trajet!.heure_trajet ?? ""}`))[0];
      setNext(inProg ?? upcoming ?? null);
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return <DriverLoader full label="" />;
  }

  const now = new Date();
  const dateLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const days = JOURS.map((l, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { l, n: d.getDate(), key: iso(d), today: iso(d) === iso(now) };
  });
  const maxBar = Math.max(1, ...weekBars);
  const t = next?.trajet;
  const when = (() => {
    if (!t?.date_trajet) return "";
    if (t.date_trajet === iso(now)) return `Aujourd'hui${t.heure_trajet ? ` · ${t.heure_trajet.slice(0, 5).replace(":", "h")}` : ""}`;
    return `${new Date(t.date_trajet).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}${t.heure_trajet ? ` · ${t.heure_trajet.slice(0, 5).replace(":", "h")}` : ""}`;
  })();

  return (
    <div className="drv2">
      <div className="stack hm2">
        <PendingProposalsBanner />

        <div className="hm-top">
          {me.avatarUrl ? <div className="hm-av has-photo" style={{ backgroundImage: `url(${me.avatarUrl})` }} /> : <div className="hm-av">{me.initiales}</div>}
          <div className="sp">
            <div className="hm-date">{dateLabel}</div>
            <div className="hm-hello">Bonjour, <span className="grn">{me.prenom || "Convoyeur"}</span></div>
          </div>
        </div>

        <InfosLigneoBar />

        {next && t && (
          <div className="nm">
            <div className="row">
              <span className="eyebrow sp">Prochaine mission</span>
              {when && <span className="chipx"><Ic n="clock" s={12} /> {when}</span>}
            </div>
            <div className="nmr">
              <div className="nmr-s"><i className="nmr-d" /><div className="nmr-t"><small>Enlèvement</small><b>{t.depart}</b></div></div>
              <div className="nmr-s"><i className="nmr-d" /><div className="nmr-t"><small>Livraison</small><b>{t.arrivee}</b></div></div>
            </div>
            <div className="row" style={{ marginTop: 14, gap: 8 }}>
              {(t.marque || t.modele) && <span className="chipx"><Ic n="car" s={12} /> {[t.marque, t.modele].filter(Boolean).join(" ")}</span>}
              <Plate p={t.immatriculation} />
            </div>
            <Link to="/convoyeur/missions" search={{ open: next.id } as never} className="btn" style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              Ouvrir la mission <Ic n="arr" s={16} />
            </Link>
          </div>
        )}

        {!(next && t) && (
          <div className="nm">
            <span className="eyebrow">Prochaine mission</span>
            <div className="nm-empty" style={{ marginTop: 12 }}>
              <span className="ic"><Ic n="car" s={22} sw={2} /></span>
              <div><b>Aucune mission à venir</b><p>Positionnez-vous sur une mission du catalogue pour remplir votre agenda.</p></div>
            </div>
            <Link to="/convoyeur/catalogue" className="btn" style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              Voir le catalogue <Ic n="arr" s={16} />
            </Link>
          </div>
        )}

        <Link to="/convoyeur/disponibilites" className="wk">
          <div className="wk-h">
            <b>Cette semaine · {weekTotal} mission{weekTotal > 1 ? "s" : ""}</b>
            <span>Mon calendrier <Ic n="chev" s={12} sw={2.6} /></span>
          </div>
          <div className="wk-r">
            {days.map((d) => (
              <div key={d.key} className={`wk-d${d.today ? " on" : ""}`}>
                <small>{d.l}</small>
                <b>{d.n}</b>
                <i className={busy[d.key] ? "has" : ""}>{busy[d.key] ? <u>{busy[d.key]}</u> : null}</i>
              </div>
            ))}
          </div>
          <p className="wk-lg">Le chiffre indique le nombre de missions du jour</p>
        </Link>

        <div className="rev3">
          <div className="rv-h"><small>Revenus du mois</small><span className="rv-mo">{MOIS[now.getMonth()].replace(/^./, (c) => c.toUpperCase())}</span></div>
          <div className="rv-m">
            <b>{Math.round(revenueMonth).toLocaleString("fr-FR")} €</b>
            {revenueDelta !== null && <span className="delta">{revenueDelta >= 0 ? "↗" : "↘"} {revenueDelta > 0 ? "+" : ""}{revenueDelta} %</span>}
          </div>
          <div className="rv-bars">
            {weekBars.map((v, i) => (
              <div key={i} className={`rv-b${i === Math.min(3, Math.floor((now.getDate() - 1) / 7)) ? " cur" : ""}`}>
                <i style={{ height: `${Math.max(6, Math.round((v / maxBar) * 100))}%` }} />
                <small>S{i + 1}</small>
              </div>
            ))}
          </div>
          <div className="rv-f">
            <div><b>{doneCount}</b><small>Missions</small></div>
            <div><b>{note != null ? `${note.toFixed(1).replace(".", ",")} ★` : "—"}</b><small>Note</small></div>
            <div><b>{kmMonth.toLocaleString("fr-FR")}</b><small>Km</small></div>
          </div>
        </div>

        <Link to="/convoyeur/catalogue" className="promo">
          <img src={heroCar} alt="" />
          <div className="in">
            <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "#6effcd" }}>Catalogue missions</span>
            <h2>{catalogueCount > 0 ? `${catalogueCount} mission${catalogueCount > 1 ? "s" : ""} disponible${catalogueCount > 1 ? "s" : ""}` : "Aucune mission pour le moment"}</h2>
            <p>{catalogueCount > 0 ? "Positionnez-vous en un clic." : "Revenez bientôt : de nouveaux trajets arrivent."}</p>
            <span className="pill-cta">Ouvrir le catalogue <Ic n="arr" s={14} /></span>
          </div>
        </Link>
      </div>
    </div>
  );
}
