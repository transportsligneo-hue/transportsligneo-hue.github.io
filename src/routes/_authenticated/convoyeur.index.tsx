import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { PendingProposalsBanner } from "@/components/convoyeur/PendingProposalsBanner";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import {
  Truck, Clock, CheckCircle2, CheckSquare, ChevronRight, ArrowRight, ArrowUpRight,
  Calendar, FileText, Loader2, ChevronDown,
} from "lucide-react";
import heroCar from "@/assets/driver-hero-supercar.jpg";

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
  } | null;
}

function ConvoyeurDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ proposed: 0, accepted: 0, inProgress: 0, completed: 0 });
  const [catalogueCount, setCatalogueCount] = useState(0);
  const [revenueMonth, setRevenueMonth] = useState(0);
  const [revenueDelta, setRevenueDelta] = useState<number | null>(null);
  const [convoyeurName, setConvoyeurName] = useState("");
  const [todayMission, setTodayMission] = useState<TodayMission | null>(null);
  const [nextMission, setNextMission] = useState<TodayMission | null>(null);
  const [loading, setLoading] = useState(true);
  // Replié par défaut, déplié dès qu'une mission est active/du jour.
  const [kpiOpen, setKpiOpen] = useState(false);

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

      // Catalogue disponible (via vue sécurisée)
      const { count: catCount } = await supabase
        .from("trajets_publies_safe" as never)
        .select("id", { count: "exact", head: true });
      setCatalogueCount(catCount ?? 0);

      const { data: attrs } = await supabase
        .from("attributions")
        .select("id, statut, trajet_id")
        .eq("convoyeur_id", conv.id);

      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const firstOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const termineIds = (attrs ?? [])
        .filter((a) => a.statut === "termine")
        .map((a) => a.trajet_id)
        .filter(Boolean) as string[];
      if (termineIds.length > 0) {
        const { data: trs } = await supabase
          .from("trajets_assigned_safe" as never)
          .select("tarif_convoyeur, updated_at")
          .in("id", termineIds)
          .gte("updated_at", firstOfLast);
        const cur = (trs ?? [])
          .filter((t) => (t as { updated_at: string }).updated_at >= firstOfMonth)
          .reduce((s, t) => s + Number((t as { tarif_convoyeur: number | null }).tarif_convoyeur ?? 0), 0);
        const prev = (trs ?? [])
          .filter((t) => {
            const u = (t as { updated_at: string }).updated_at;
            return u >= firstOfLast && u < firstOfMonth;
          })
          .reduce((s, t) => s + Number((t as { tarif_convoyeur: number | null }).tarif_convoyeur ?? 0), 0);
        setRevenueMonth(cur);
        if (prev > 0) setRevenueDelta(Math.round(((cur - prev) / prev) * 100));
      }

      if (attrs && attrs.length > 0) {
        setStats({
          proposed: attrs.filter((a) => a.statut === "propose").length,
          accepted: attrs.filter((a) => a.statut === "accepte").length,
          inProgress: attrs.filter((a) => a.statut === "en_cours").length,
          completed: attrs.filter((a) => a.statut === "termine").length,
        });

        const today = new Date().toISOString().split("T")[0];
        const enriched: TodayMission[] = [];
        for (const a of attrs) {
          if (a.statut === "termine") continue;
          const { data: t } = await supabase
            .from("trajets_assigned_safe" as never)
            .select("depart, arrivee, date_trajet, heure_trajet, marque, modele, immatriculation")
            .eq("id", a.trajet_id)
            .maybeSingle();
          enriched.push({ id: a.id, statut: a.statut, trajet: (t as unknown as TodayMission["trajet"]) ?? null });
        }

        const inProg = enriched.find(m => m.statut === "en_cours");
        const todayM = enriched.find(m => m.trajet?.date_trajet === today && m.statut !== "en_cours");
        const upcoming = enriched
          .filter(m => m.trajet?.date_trajet && m.trajet.date_trajet > today)
          .sort((a, b) => (a.trajet!.date_trajet! > b.trajet!.date_trajet! ? 1 : -1))[0];

        setTodayMission(inProg ?? todayM ?? null);
        setKpiOpen(Boolean(inProg ?? todayM));
        setNextMission(upcoming ?? null);
      }
      setLoading(false);
    })();
  }, [user]);

  const clearStoredOpenMission = () => {
    try {
      sessionStorage.removeItem("driver:openMissionId");
      localStorage.removeItem("driver:openMissionId");
    } catch { /* noop */ }
  };

  const statCards = [
    { to: "/convoyeur/missions", search: { f: "proposed" as const }, label: "Missions proposées", value: stats.proposed, icon: Clock, pill: "En attente",
      accent: "#f0a94e" },
    { to: "/convoyeur/missions", search: { f: "accepted" as const }, label: "Missions acceptées", value: stats.accepted, icon: CheckSquare, pill: "Planifiées",
      accent: "#4f8cff" },
    { to: "/convoyeur/missions", search: { f: "in_progress" as const }, label: "Missions en cours", value: stats.inProgress, icon: Truck, pill: "Actives",
      accent: "#3ddc97" },
    { to: "/convoyeur/historique", search: undefined, label: "Missions terminées", value: stats.completed, icon: CheckCircle2, pill: "Archivées",
      accent: "#b98af0" },
  ] as const;


  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#4EA8FF]" size={28} /></div>;
  }

  return (
    <div className="space-y-5 pb-4">
      <PendingProposalsBanner />

      {/* Greeting */}
      <div className="min-w-0">
        <h1 className="text-[26px] leading-[1.1] font-bold tracking-tight text-white font-driver">
          Bonjour, {convoyeurName || "Convoyeur"}
        </h1>
        <p className="text-[12.5px] text-[#8fa3d9] mt-1">Vos missions, en un coup d'œil.</p>
      </div>

      {/* Revenus + KPI fusionnés (repliable) */}
      <div className={`drv-stats-card${kpiOpen ? " is-open" : ""}`}>
        <button
          type="button"
          onClick={() => setKpiOpen((v) => !v)}
          aria-expanded={kpiOpen}
          className="drv-stats-head"
        >
          <span className="flex items-baseline gap-2.5 min-w-0">
            <span className="text-[10.5px] uppercase tracking-[0.06em] font-semibold text-[#8fa3d9]">Revenus du mois</span>
            <span className="font-driver text-[22px] font-bold text-[#f0d78a] tabular-nums leading-none">
              {revenueMonth.toFixed(0)} €
            </span>
            {revenueDelta !== null && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#3ddc97]">
                <ArrowUpRight size={11} className={revenueDelta >= 0 ? "" : "rotate-90"} />
                {revenueDelta > 0 ? "+" : ""}{revenueDelta}%
              </span>
            )}
          </span>
          <span className="drv-chevron">
            <ChevronDown size={12} />
          </span>
        </button>

        <div className="drv-kpi-grid">
          {statCards.map((c) => (
            <Link
              key={c.label}
              to={c.to}
              search={c.search as never}
              onClick={clearStoredOpenMission}
              className="drv-kpi-cell"
              style={{ ["--glow" as string]: c.accent }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="w-8 h-8 rounded-[11px] flex items-center justify-center shrink-0"
                  style={{ background: `${c.accent}26`, border: `1px solid ${c.accent}59` }}
                >
                  <c.icon size={16} strokeWidth={2.2} style={{ color: c.accent }} />
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] pl-1.5 pr-2 py-[3px]">
                  <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: c.accent }} />
                  <span className="text-[8.5px] font-bold uppercase tracking-[0.04em] text-[#8fa3d9]">{c.pill}</span>
                </span>
              </div>
              <p className="font-driver text-[26px] font-bold text-white leading-none tabular-nums mb-1.5">{c.value}</p>
              <p className="text-[11px] font-semibold text-[#8fa3d9] leading-snug">{c.label}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Catalogue */}
      {catalogueCount > 0 ? (
        <Link
          to="/convoyeur/catalogue"
          className="relative block overflow-hidden rounded-[24px] border border-[rgba(96,165,250,0.22)] bg-gradient-to-br from-[#0e1e4a] via-[#0a1738] to-[#081230] p-5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]"
        >
          <img src={heroCar} alt="" className="absolute inset-0 w-full h-full object-cover object-right opacity-55 pointer-events-none" width={1536} height={1024} />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1738] via-[rgba(10,23,56,0.75)] to-transparent pointer-events-none" />
          <div className="relative max-w-[62%]">
            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#4f8cff]">Catalogue missions</p>
            <h2 className="font-driver text-[22px] font-bold text-white mt-2 leading-tight">
              {catalogueCount} mission{catalogueCount > 1 ? "s" : ""} disponible{catalogueCount > 1 ? "s" : ""}
            </h2>
            <p className="text-[12.5px] text-[#c9d6f2] mt-2 leading-relaxed">
              Parcourez les trajets ouverts et positionnez-vous en un clic.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-[#2f5fff] to-[#4f8cff] text-white text-[13px] font-semibold shadow-[0_10px_25px_-5px_rgba(47,95,255,0.6)]">
              Ouvrir le catalogue <ArrowRight size={16} />
            </span>
          </div>
        </Link>
      ) : (
        <Link
          to="/convoyeur/catalogue"
          className="flex items-center gap-3.5 rounded-[24px] border border-[rgba(143,163,217,0.14)] bg-[#101d47] p-4"
        >
          <span className="w-11 h-11 rounded-[18px] shrink-0 flex items-center justify-center bg-gradient-to-br from-[#1c3684] to-[#2f5fff]">
            <Truck size={22} className="text-white" strokeWidth={2} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[9px] font-bold uppercase tracking-[0.1em] text-[#4f8cff]">Catalogue</span>
            <span className="block font-driver text-[13.5px] font-bold text-white mt-[3px] mb-2">Aucune mission disponible</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#2f5fff] to-[#4f8cff] px-3 py-[7px] text-[11.5px] font-bold text-white">
              Parcourir <ArrowRight size={11} />
            </span>
          </span>
        </Link>
      )}


      {/* Prochaine mission */}
      {nextMission && nextMission.trajet && (
        <Link
          to="/convoyeur/missions"
          className="block rounded-[22px] border border-[rgba(96,165,250,0.18)] bg-gradient-to-br from-[#0c1a42] via-[#0a1636] to-[#081230] p-4 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.7)]"
        >
          <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#4EA8FF] mb-3">Prochaine mission</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl border border-[rgba(96,165,250,0.30)] bg-gradient-to-br from-[#0d1f4d] to-[#0a1638] flex items-center justify-center shrink-0">
              <Calendar size={18} className="text-[#60a5fa]" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold text-white truncate">{nextMission.trajet.depart}</p>
              <p className="text-[12px] text-[#8fa3cc] mt-0.5 tabular-nums capitalize">
                {nextMission.trajet.date_trajet && new Date(nextMission.trajet.date_trajet).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                {nextMission.trajet.heure_trajet && ` • ${nextMission.trajet.heure_trajet}`}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl border border-[rgba(96,165,250,0.22)] bg-white/[0.03] flex items-center justify-center shrink-0">
              <ArrowRight size={16} className="text-[#8fa3cc]" />
            </div>
          </div>
        </Link>
      )}

      {/* Two bottom quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/convoyeur/catalogue" className="rounded-[22px] border border-[rgba(96,165,250,0.18)] bg-gradient-to-br from-[#0c1a42] via-[#0a1636] to-[#081230] p-3.5 flex items-center gap-3 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.7)]">
          <div className="w-11 h-11 rounded-xl border border-[rgba(234,179,8,0.35)] bg-gradient-to-br from-[#3d2a10] to-[#2a1d0b] flex items-center justify-center shrink-0">
            <Truck size={18} className="text-[#f59e0b]" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-white truncate">Missions dispo</p>
            <p className="text-[11px] text-[#8fa3cc] mt-0.5">Voir le catalogue</p>
          </div>
          <ChevronRight size={16} className="text-[#5a6b93] shrink-0" />
        </Link>
        <Link to="/convoyeur/documents" className="rounded-[22px] border border-[rgba(96,165,250,0.18)] bg-gradient-to-br from-[#0c1a42] via-[#0a1636] to-[#081230] p-3.5 flex items-center gap-3 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.7)]">
          <div className="w-11 h-11 rounded-xl border border-[rgba(96,165,250,0.35)] bg-gradient-to-br from-[#0d1f4d] to-[#0a1638] flex items-center justify-center shrink-0">
            <FileText size={18} className="text-[#60a5fa]" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-white truncate">Mes documents</p>
            <p className="text-[11px] text-[#8fa3cc] mt-0.5">Permis, RIB, KBis…</p>
          </div>
          <ChevronRight size={16} className="text-[#5a6b93] shrink-0" />
        </Link>
      </div>
    </div>
  );
}
