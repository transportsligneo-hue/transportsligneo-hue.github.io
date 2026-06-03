import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import {
  Truck, Clock, CheckCircle, AlertCircle, ArrowRight,
  Calendar, MapPin, Navigation, Phone, FileText, Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/convoyeur/")({
  component: ConvoyeurDashboard,
});

interface TodayMission {
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
    client_telephone: string | null;
    client_nom: string | null;
  } | null;
}

function ConvoyeurDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ proposed: 0, accepted: 0, inProgress: 0, completed: 0, total: 0 });
  const [convoyeurName, setConvoyeurName] = useState("");
  const [todayMission, setTodayMission] = useState<TodayMission | null>(null);
  const [nextMission, setNextMission] = useState<TodayMission | null>(null);
  const [availableCount, setAvailableCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Compte des missions publiées (prix fixe ou enchère) disponibles
  useEffect(() => {
    let cancelled = false;
    const fetchAvail = async () => {
      const { count } = await supabase
        .from("trajets_publies_safe")
        .select("id", { count: "exact", head: true })
        .eq("statut_publication", "publie");
      if (!cancelled) setAvailableCount(count ?? 0);
    };
    fetchAvail();
    // Poll instead of Realtime to avoid broadcasting client PII via CDC payloads.
    const interval = setInterval(fetchAvail, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: conv } = await supabase
        .from("convoyeurs")
        .select("id, prenom, nom")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!conv) { setLoading(false); return; }
      setConvoyeurName(`${conv.prenom} ${conv.nom}`);

      const { data: attrs } = await supabase
        .from("attributions")
        .select("id, statut, trajet_id")
        .eq("convoyeur_id", conv.id);

      if (attrs && attrs.length > 0) {
        setStats({
          proposed: attrs.filter((a) => a.statut === "propose").length,
          accepted: attrs.filter((a) => a.statut === "accepte").length,
          inProgress: attrs.filter((a) => a.statut === "en_cours").length,
          completed: attrs.filter((a) => a.statut === "termine").length,
          total: attrs.length,
        });

        // Hydrate today/next missions
        const today = new Date().toISOString().split("T")[0];
        const enriched: TodayMission[] = [];
        for (const a of attrs) {
          if (a.statut === "termine") continue;
          const { data: t } = await supabase
            .from("trajets_assigned_safe" as never)
            .select("depart, arrivee, date_trajet, heure_trajet, marque, modele, immatriculation, contact_depart_tel, contact_depart_nom, contact_arrivee_tel, contact_arrivee_nom")
            .eq("id", a.trajet_id)
            .maybeSingle();
          enriched.push({ id: a.id, statut: a.statut, trajet: (t as unknown as TodayMission["trajet"]) ?? null });
        }

        // Priority: in_progress > today's > next upcoming
        const inProg = enriched.find(m => m.statut === "en_cours");
        const todayM = enriched.find(m => m.trajet?.date_trajet === today && m.statut !== "en_cours");
        const upcoming = enriched
          .filter(m => m.trajet?.date_trajet && m.trajet.date_trajet > today)
          .sort((a, b) => (a.trajet!.date_trajet! > b.trajet!.date_trajet! ? 1 : -1))[0];

        setTodayMission(inProg ?? todayM ?? null);
        setNextMission(!inProg && !todayM ? upcoming ?? null : upcoming ?? null);
      }
      setLoading(false);
    })();
  }, [user]);

  const cards = [
    { label: "Proposées", value: stats.proposed, icon: Clock, tone: "amber" as const },
    { label: "Acceptées", value: stats.accepted, icon: AlertCircle, tone: "blue" as const },
    { label: "En cours", value: stats.inProgress, icon: Truck, tone: "green" as const, live: stats.inProgress > 0 },
    { label: "Terminées", value: stats.completed, icon: CheckCircle, tone: "muted" as const },
  ];

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#e7c76a]" size={24} /></div>;
  }

  const heroStatus = todayMission?.statut;
  const heroTone: "green" | "blue" | "amber" =
    heroStatus === "en_cours" ? "green" : heroStatus === "accepte" ? "blue" : "amber";
  const heroLabel =
    heroStatus === "en_cours" ? "En cours" :
    heroStatus === "accepte" ? "À démarrer" : "À accepter";

  return (
    <div className="space-y-6 pb-6">
      {/* Greeting */}
      <div>
        <p className="brex-label-xs">Tableau de bord</p>
        <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-tight text-[var(--driver-text)] mt-1">
          Bonjour, {convoyeurName || "Convoyeur"}
        </h1>
        <p className="text-[13px] text-[var(--driver-text-soft)] mt-1">Vos missions, en un coup d'œil.</p>
      </div>

      {/* Bandeau "Nouvelles missions disponibles" — realtime */}
      {availableCount > 0 && (
        <Link
          to="/convoyeur/disponibles"
          className="brex-card flex items-center justify-between p-4 border border-[rgba(212,175,55,0.40)] bg-[rgba(212,175,55,0.06)] hover:bg-[rgba(212,175,55,0.10)] transition"
        >
          <div className="flex items-center gap-3">
            <span className="brex-pill brex-pill--amber brex-pill--live">
              <span className="brex-pill-dot" />
              Nouveau
            </span>
            <div>
              <p className="text-[14px] font-semibold text-[var(--driver-text)]">
                {availableCount} mission{availableCount > 1 ? "s" : ""} disponible{availableCount > 1 ? "s" : ""}
              </p>
              <p className="text-[12px] text-[var(--driver-text-soft)] mt-0.5">
                À accepter ou enchérir maintenant
              </p>
            </div>
          </div>
          <ArrowRight size={16} className="text-[#e7c76a] shrink-0" />
        </Link>
      )}

      {/* Hero : mission active */}
      {todayMission && todayMission.trajet && (
        <Link
          to="/convoyeur/missions"
          className="brex-card block p-6 hover:no-underline"
        >
          <div className="flex items-center justify-between mb-5">
            <span className={`brex-pill brex-pill--${heroTone} ${heroStatus === "en_cours" ? "brex-pill--live" : ""}`}>
              <span className="brex-pill-dot" />
              {heroLabel}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-[var(--driver-muted)]">
              Ouvrir <ArrowRight size={13} />
            </span>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center gap-1 pt-2 shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-[#e7c76a] ring-2 ring-[rgba(212,175,55,0.20)]" />
              <div className="w-px h-10 bg-[rgba(255,255,255,0.12)]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#93c5fd] ring-2 ring-[rgba(59,130,246,0.20)]" />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <p className="brex-label-xs">Départ</p>
                <p className="text-[15px] font-medium text-[var(--driver-text)] truncate mt-0.5">{todayMission.trajet.depart}</p>
              </div>
              <div>
                <p className="brex-label-xs">Arrivée</p>
                <p className="text-[15px] font-medium text-[var(--driver-text)] truncate mt-0.5">{todayMission.trajet.arrivee}</p>
              </div>
            </div>
          </div>

          <div className="brex-divider mt-5 pt-4 flex items-center justify-between text-[12px] text-[var(--driver-text-soft)]">
            <span className="flex items-center gap-1.5 tabular-nums">
              <Calendar size={12} className="text-[var(--driver-muted)]" />
              {todayMission.trajet.date_trajet
                ? new Date(todayMission.trajet.date_trajet).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
                : "Date à définir"}
              {todayMission.trajet.heure_trajet && <span> · {todayMission.trajet.heure_trajet}</span>}
            </span>
            {todayMission.trajet.immatriculation && (
              <span className="font-mono text-[11px] text-[var(--driver-text-soft)] px-2 py-0.5 rounded border border-[rgba(255,255,255,0.10)] bg-white/[0.03]">
                {todayMission.trajet.immatriculation}
              </span>
            )}
          </div>
        </Link>
      )}

      {/* Quick actions */}
      {todayMission && todayMission.trajet && (
        <div className="grid grid-cols-3 gap-2">
          <a
            href={todayMission.trajet.depart ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(todayMission.trajet.depart)}` : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="brex-action flex-col py-3.5"
          >
            <Navigation size={16} />
            <span className="text-[11px] mt-0.5">Itinéraire</span>
          </a>
          <a
            href={todayMission.trajet.client_telephone ? `tel:${todayMission.trajet.client_telephone}` : "#"}
            className={`brex-action flex-col py-3.5 ${!todayMission.trajet.client_telephone ? "opacity-40 pointer-events-none" : ""}`}
          >
            <Phone size={16} />
            <span className="text-[11px] mt-0.5">Appeler</span>
          </a>
          <Link
            to="/convoyeur/missions"
            className="brex-action brex-action--primary flex-col py-3.5"
          >
            <FileText size={16} />
            <span className="text-[11px] mt-0.5">Détails</span>
          </Link>
        </div>
      )}

      {/* Empty state */}
      {!todayMission && (
        <div className="brex-card p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-[rgba(212,175,55,0.30)] bg-[rgba(212,175,55,0.08)] mb-3">
            <Truck size={20} className="text-[#e7c76a]" />
          </div>
          <p className="text-[var(--driver-text)] font-medium text-[14px]">Aucune mission active aujourd'hui</p>
          <p className="text-[var(--driver-text-soft)] text-[12.5px] mt-1">Consultez les missions disponibles ou attendez une attribution.</p>
          <Link
            to="/convoyeur/disponibles"
            className="brex-action brex-action--primary inline-flex mt-5 px-5 py-2.5"
          >
            Voir les missions disponibles <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Stats — Brex KPI tiles */}
      <div>
        <p className="brex-label-xs mb-3">Vue d'ensemble</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((c) => (
            <div key={c.label} className="brex-tile">
              <p className="brex-tile-label">
                <c.icon size={13} className="opacity-70" />
                {c.label}
              </p>
              <p className="brex-tile-value">{c.value}</p>
              <p className="brex-tile-delta">
                <span className={`brex-pill brex-pill--${c.tone} ${c.tone === "green" && c.live ? "brex-pill--live" : ""}`}>
                  <span className="brex-pill-dot" />
                  {c.tone === "green" ? "Actives" : c.tone === "muted" ? "Archivées" : c.tone === "blue" ? "Planifiées" : "En attente"}
                </span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick alert */}
      {stats.proposed > 0 && (
        <Link
          to="/convoyeur/missions"
          className="brex-card flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-3">
            <span className="brex-pill brex-pill--amber">
              <span className="brex-pill-dot" />
              Action requise
            </span>
            <div>
              <p className="text-[13.5px] font-medium text-[var(--driver-text)]">
                {stats.proposed} mission{stats.proposed > 1 ? "s" : ""} en attente de réponse
              </p>
              <p className="text-[11.5px] text-[var(--driver-text-soft)] mt-0.5">Acceptez ou refusez vos missions proposées</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-[var(--driver-muted)] shrink-0" />
        </Link>
      )}

      {/* Next mission */}
      {nextMission && nextMission.trajet && nextMission.id !== todayMission?.id && (
        <div>
          <p className="brex-label-xs mb-3">Prochaine mission</p>
          <Link
            to="/convoyeur/missions"
            className="brex-card flex items-start gap-3 p-4"
          >
            <div className="w-10 h-10 rounded-xl border border-[rgba(59,130,246,0.30)] bg-[rgba(59,130,246,0.08)] flex items-center justify-center shrink-0">
              <Calendar size={16} className="text-[#93c5fd]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-[var(--driver-text)] truncate">
                {nextMission.trajet.depart} → {nextMission.trajet.arrivee}
              </p>
              <p className="text-[11.5px] text-[var(--driver-text-soft)] mt-0.5 tabular-nums">
                {nextMission.trajet.date_trajet && new Date(nextMission.trajet.date_trajet).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                {nextMission.trajet.heure_trajet && ` · ${nextMission.trajet.heure_trajet}`}
              </p>
            </div>
            <ArrowRight size={16} className="text-[var(--driver-muted)] shrink-0 mt-2" />
          </Link>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Link to="/convoyeur/disponibles" className="brex-card flex items-center gap-3 p-4">
          <div className="w-10 h-10 rounded-xl border border-[rgba(212,175,55,0.30)] bg-[rgba(212,175,55,0.08)] flex items-center justify-center">
            <Truck size={16} className="text-[#e7c76a]" />
          </div>
          <div>
            <p className="text-[13.5px] font-medium text-[var(--driver-text)]">Missions dispo</p>
            <p className="text-[11.5px] text-[var(--driver-muted)]">Voir le catalogue</p>
          </div>
        </Link>
        <Link to="/convoyeur/documents" className="brex-card flex items-center gap-3 p-4">
          <div className="w-10 h-10 rounded-xl border border-[rgba(59,130,246,0.30)] bg-[rgba(59,130,246,0.08)] flex items-center justify-center">
            <FileText size={16} className="text-[#93c5fd]" />
          </div>
          <div>
            <p className="text-[13.5px] font-medium text-[var(--driver-text)]">Mes documents</p>
            <p className="text-[11.5px] text-[var(--driver-muted)]">Permis, RIB, KBIS…</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
