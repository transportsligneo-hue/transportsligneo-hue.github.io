import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { PendingProposalsBanner } from "@/components/convoyeur/PendingProposalsBanner";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import {
  Truck, Clock, CheckCircle2, CheckSquare, ChevronRight, ArrowRight, ArrowUpRight,
  Calendar, TrendingUp, FileText, Loader2,
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
  const [revenueMonth, setRevenueMonth] = useState(0);
  const [revenueDelta, setRevenueDelta] = useState<number | null>(null);
  const [convoyeurName, setConvoyeurName] = useState("");
  const [todayMission, setTodayMission] = useState<TodayMission | null>(null);
  const [nextMission, setNextMission] = useState<TodayMission | null>(null);
  const [loading, setLoading] = useState(true);

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

      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const firstOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const termineIds = (attrs ?? [])
        .filter((a) => a.statut === "termine")
        .map((a) => a.trajet_id)
        .filter(Boolean) as string[];
      if (termineIds.length > 0) {
        const { data: trs } = await supabase
          .from("trajets")
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
        setNextMission(upcoming ?? null);
      }
      setLoading(false);
    })();
  }, [user]);

  const statCards = [
    { label: "Proposées", value: stats.proposed, icon: Clock, pill: "En attente",
      iconBg: "from-[#3d2a10] to-[#2a1d0b]", iconBorder: "border-[rgba(234,179,8,0.35)]", iconColor: "text-[#f59e0b]",
      dotColor: "bg-[#f59e0b]", pillColor: "text-[#fbbf24]" },
    { label: "Acceptées", value: stats.accepted, icon: CheckSquare, pill: "Planifiées",
      iconBg: "from-[#0d1f4d] to-[#0a1638]", iconBorder: "border-[rgba(96,165,250,0.35)]", iconColor: "text-[#60a5fa]",
      dotColor: "bg-[#60a5fa]", pillColor: "text-[#93c5fd]" },
    { label: "En cours", value: stats.inProgress, icon: Truck, pill: "Actives",
      iconBg: "from-[#0f2e28] to-[#0a1f1a]", iconBorder: "border-[rgba(52,211,153,0.35)]", iconColor: "text-[#34d399]",
      dotColor: "bg-[#34d399]", pillColor: "text-[#6ee7b7]" },
    { label: "Terminées", value: stats.completed, icon: CheckCircle2, pill: "Archivées",
      iconBg: "from-[#26183d] to-[#1a1128]", iconBorder: "border-[rgba(167,139,250,0.35)]", iconColor: "text-[#a78bfa]",
      dotColor: "bg-[#a78bfa]", pillColor: "text-[#c4b5fd]" },
  ];

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#4EA8FF]" size={28} /></div>;
  }

  return (
    <div className="space-y-5 pb-4">
      <PendingProposalsBanner />

      {/* Greeting + Revenue */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-start">
        <div className="min-w-0">
          <h1 className="text-[34px] leading-[1.05] font-bold tracking-tight text-white">
            Bonjour,
          </h1>
          <h1 className="text-[28px] leading-[1.1] font-bold tracking-tight text-white mt-0.5 truncate">
            {convoyeurName || "Convoyeur"}
          </h1>
          <p className="text-[13.5px] text-[#8fa3cc] mt-2">Vos missions, en un coup d'œil.</p>
        </div>

        {/* Revenue card */}
        <div className="relative overflow-hidden rounded-[22px] border border-[rgba(96,165,250,0.22)] bg-gradient-to-br from-[#0e1e4a] via-[#0a1738] to-[#081230] px-4 py-3.5 min-w-[170px] shadow-[0_10px_30px_-15px_rgba(0,0,0,0.6)]">
          {/* mini chart bg */}
          <svg className="absolute right-0 bottom-0 opacity-40 pointer-events-none" width="120" height="55" viewBox="0 0 120 55" fill="none">
            <path d="M0 40 Q20 35 35 30 T70 20 T105 8 L120 5 L120 55 L0 55 Z" fill="url(#g1)" />
            <path d="M0 40 Q20 35 35 30 T70 20 T105 8 L120 5" stroke="#4EA8FF" strokeWidth="1.5" fill="none" />
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4EA8FF" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#4EA8FF" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <div className="relative flex items-start justify-between gap-2">
            <p className="text-[12px] text-[#c9d6f2]">Revenus du mois</p>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2F7DFF] to-[#1a5ad6] flex items-center justify-center shadow-[0_0_12px_rgba(78,168,255,0.5)]">
              <TrendingUp size={14} className="text-white" />
            </div>
          </div>
          <p className="relative text-[30px] font-bold text-[#f5b940] mt-1 tabular-nums leading-none tracking-tight">
            {revenueMonth.toFixed(0)} €
          </p>
          {revenueDelta !== null && (
            <p className="relative flex items-center gap-1 text-[11px] mt-3 text-[#8fa3cc]">
              <ArrowUpRight size={12} className={revenueDelta >= 0 ? "text-[#34d399]" : "text-[#34d399] rotate-90"} />
              <span className={revenueDelta >= 0 ? "text-[#34d399] font-semibold" : "text-[#34d399] font-semibold"}>
                {revenueDelta > 0 ? "+" : ""}{revenueDelta}%
              </span>
              <span>vs mois dernier</span>
            </p>
          )}
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-4 gap-2">
        {statCards.map((c) => (
          <div
            key={c.label}
            className="relative min-w-0 rounded-[18px] border border-[rgba(96,165,250,0.15)] bg-gradient-to-br from-[#0c1a42] via-[#0a1636] to-[#081230] p-2.5 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.7)] transition-transform active:scale-[0.97]"
          >
            <div className="flex items-start justify-between mb-1">
              <div className={`w-8 h-8 rounded-lg border ${c.iconBorder} bg-gradient-to-br ${c.iconBg} flex items-center justify-center`}>
                <c.icon size={14} className={c.iconColor} strokeWidth={2.4} />
              </div>
              <ChevronRight size={12} className="text-[#5a6b93] mt-1" />
            </div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-[#8fa3cc] font-black leading-tight">{c.label}</p>
            <p className="text-[17px] font-normal text-white mt-0.5 tabular-nums leading-none">{c.value}</p>
            <div className="mt-1.5 flex items-center gap-1 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full ${c.dotColor} shrink-0`} />
              <span className={`text-[10px] font-bold ${c.pillColor} leading-tight`}>{c.pill}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Hero mission card */}
      {todayMission && todayMission.trajet ? (
        <Link
          to="/convoyeur/missions"
          className="relative block overflow-hidden rounded-[24px] border border-[rgba(96,165,250,0.22)] bg-gradient-to-br from-[#0e1e4a] via-[#0a1738] to-[#081230] p-5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]"
        >
          <img src={heroCar} alt="" className="absolute inset-0 w-full h-full object-cover object-right opacity-55 pointer-events-none" width={1536} height={1024} />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1738] via-[rgba(10,23,56,0.75)] to-transparent pointer-events-none" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#4EA8FF]">Mission active</p>
            <h2 className="text-[22px] font-bold text-white mt-2 leading-tight max-w-[60%]">
              {todayMission.trajet.depart}
            </h2>
            <p className="text-[13px] text-[#c9d6f2] mt-2 max-w-[55%]">
              → {todayMission.trajet.arrivee}
            </p>
            <button className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-[#2F7DFF] to-[#1a5ad6] text-white text-[13px] font-semibold shadow-[0_10px_25px_-5px_rgba(47,125,255,0.6)]">
              Ouvrir la mission <ArrowRight size={16} />
            </button>
          </div>
        </Link>
      ) : (
        <div className="relative overflow-hidden rounded-[24px] border border-[rgba(96,165,250,0.22)] bg-gradient-to-br from-[#0e1e4a] via-[#0a1738] to-[#081230] p-5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] min-h-[240px]">
          <img src={heroCar} alt="" className="absolute inset-0 w-full h-full object-cover object-right opacity-70 pointer-events-none" width={1536} height={1024} />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1738] via-[rgba(10,23,56,0.75)] to-transparent pointer-events-none" />
          <div className="relative max-w-[60%]">
            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#4EA8FF]">Missions actives</p>
            <h2 className="text-[22px] font-bold text-white mt-2 leading-tight">
              Aucune mission active aujourd'hui
            </h2>
            <p className="text-[12.5px] text-[#c9d6f2] mt-2 leading-relaxed">
              Consultez les missions disponibles ou attendez une attribution.
            </p>
            <Link
              to="/convoyeur/catalogue"
              className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-[#2F7DFF] to-[#1a5ad6] text-white text-[13px] font-semibold shadow-[0_10px_25px_-5px_rgba(47,125,255,0.6)]"
            >
              Voir les missions disponibles <ArrowRight size={16} />
            </Link>
          </div>
        </div>
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
