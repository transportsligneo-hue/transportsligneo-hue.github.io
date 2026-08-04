import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Truck, Clock, CheckCircle, Calendar, MapPin, PlusCircle, ArrowRight,
  Loader2, FileText, Inbox, ArrowUpRight,
} from "lucide-react";
import { ActiveMissionsMap } from "@/components/map/ActiveMissionsMap";
import ClientPageHeader from "@/components/dashboard/ClientPageHeader";

export const Route = createFileRoute("/_authenticated/dashboard-client/")({
  component: ClientDashboard,
});

interface DevisRow {
  id: string;
  numero: string;
  depart: string;
  arrivee: string;
  distance_km: number | null;
  prix_estime: number;
  statut: string;
  created_at: string;
  date_souhaitee: string | null;
  marque: string | null;
  modele: string | null;
  option_trajet: string | null;
  mission_id: string | null;
  paid_at: string | null;
}

interface DemandeRow {
  id: string;
  depart: string;
  arrivee: string;
  date_souhaitee: string | null;
  marque: string | null;
  modele: string | null;
  statut: string;
  created_at: string;
  prix_estime: number | null;
  distance_km: number | null;
}

// Item unifié pour la section "Mes demandes"
interface DemandeItem {
  id: string;
  source: "devis" | "demande";
  numero: string;
  depart: string;
  arrivee: string;
  created_at: string;
  date_souhaitee: string | null;
  vehicule: string;
  trajetType: string;
  distance_km: number | null;
  prix: number | null;
  status: { label: string; cls: string };
  linkTo: string;
}

interface MissionRow {
  id: string;
  numero: string;
  ville_depart: string;
  ville_arrivee: string;
  date_prise_en_charge: string;
  statut: string;
  prix_total: number;
  created_at: string;
}

interface Stats {
  enCours: number;
  terminees: number;
  aVenir: number;
  demandes: number;
}

const V3_STATUS: Record<string, { cls: string; label: string }> = {
  en_attente: { cls: "wait", label: "En attente" },
  confirmee: { cls: "progress", label: "Confirmée" },
  en_cours: { cls: "progress", label: "En route" },
  livree: { cls: "done", label: "Livrée" },
  terminee: { cls: "done", label: "Terminée" },
  annulee: { cls: "danger", label: "Annulée" },
  refuse: { cls: "danger", label: "Refusée" },
};

function ClientDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ enCours: 0, terminees: 0, aVenir: 0, demandes: 0 });
  const [lastMission, setLastMission] = useState<MissionRow | null>(null);
  const [items, setItems] = useState<DemandeItem[]>([]);
  const [prenom, setPrenom] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      // Profil pour le prénom + email
      const { data: prof } = await supabase
        .from("profiles")
        .select("prenom, email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled && prof?.prenom) setPrenom(prof.prenom);
      const clientEmail = prof?.email ?? user.email ?? "";

      const orFilter = `user_id.eq.${user.id}${clientEmail ? `,email.eq.${clientEmail}` : ""}`;

      // Missions (par user_id OU email)
      const missionsPromise = supabase
        .from("missions")
        .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total, created_at")
        .or(orFilter)
        .order("created_at", { ascending: false });

      // Devis = demandes de devis du client
      const devisPromise = supabase
        .from("devis")
        .select("id, numero, depart, arrivee, distance_km, prix_estime, statut, created_at, date_souhaitee, marque, modele, option_trajet, mission_id, paid_at")
        .or(orFilter)
        .order("created_at", { ascending: false })
        .limit(10);

      // Demandes de convoyage (formulaire de contact direct)
      const demandesPromise = supabase
        .from("demandes_convoyage")
        .select("id, depart, arrivee, date_souhaitee, marque, modele, statut, created_at, prix_estime, distance_km")
        .or(orFilter)
        .order("created_at", { ascending: false })
        .limit(10);

      const [{ data: missionData }, { data: devisData }, { data: demandeData }] = await Promise.all([
        missionsPromise,
        devisPromise,
        demandesPromise,
      ]);

      if (cancelled) return;

      const missions = (missionData ?? []) as MissionRow[];
      const devisAll = (devisData ?? []) as DevisRow[];
      const demandesAll = (demandeData ?? []) as DemandeRow[];
      const today = new Date().toISOString().slice(0, 10);

      const devisItems: DemandeItem[] = devisAll.map(d => ({
        id: `devis-${d.id}`,
        source: "devis",
        numero: d.numero,
        depart: d.depart,
        arrivee: d.arrivee,
        created_at: d.created_at,
        date_souhaitee: d.date_souhaitee,
        vehicule: [d.marque, d.modele].filter(Boolean).join(" ").trim(),
        trajetType: (d.option_trajet || "").toLowerCase().includes("retour") ? "Livraison + Restitution" : "Livraison simple",
        distance_km: d.distance_km,
        prix: d.prix_estime != null ? Number(d.prix_estime) : null,
        status: devisStatusInfo(d),
        linkTo: "/dashboard-client/devis",
      }));

      const demandeItems: DemandeItem[] = demandesAll.map(d => ({
        id: `demande-${d.id}`,
        source: "demande",
        numero: `DEM-${d.id.slice(0, 6).toUpperCase()}`,
        depart: d.depart,
        arrivee: d.arrivee,
        created_at: d.created_at,
        date_souhaitee: d.date_souhaitee,
        vehicule: [d.marque, d.modele].filter(Boolean).join(" ").trim(),
        trajetType: "Demande",
        distance_km: d.distance_km,
        prix: d.prix_estime != null ? Number(d.prix_estime) : null,
        status: demandeStatusInfo(d.statut),
        linkTo: "/dashboard-client/devis",
      }));

      const allItems = [...devisItems, ...demandeItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Compte des demandes "en attente de traitement admin"
      const demandesEnAttente =
        devisAll.filter(d => d.statut !== "convertit" && d.statut !== "refuse" && !d.mission_id).length +
        demandesAll.filter(d => d.statut !== "convertie" && d.statut !== "refusee" && d.statut !== "annulee").length;

      setStats({
        enCours: missions.filter(m => m.statut === "en_cours").length,
        terminees: missions.filter(m => m.statut === "livree" || m.statut === "terminee").length,
        aVenir: missions.filter(m => m.statut === "confirmee" && m.date_prise_en_charge >= today).length,
        demandes: demandesEnAttente,
      });
      setLastMission(missions[0] ?? null);
      setItems(allItems);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-v3-blue" size={28} />
      </div>
    );
  }

  const hasPendingButNoMission = !lastMission && items.length > 0;
  const displayName = prenom || (user?.email?.split("@")[0] ?? "");

  return (
    <div className="v3-aurora -mx-4 sm:-mx-6 lg:-mx-8 -my-4 sm:-my-6 lg:-my-8 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 min-h-full font-v3-body">
      <ClientPageHeader
        breadcrumb="Vue d'ensemble"
        eyebrow="Espace client"
        title={`Bonjour${displayName ? `, ${displayName}` : ""}`}
        subtitle="Voici un aperçu de vos convoyages et de leur suivi en temps réel."
        actions={
          <Link
            to="/dashboard-client/nouvelle-reservation"
            className="client-btn-blue inline-flex items-center gap-2 rounded-[9px] px-4 py-2.5 text-[12.5px] font-semibold"
          >
            <PlusCircle size={14} /> Réserver un convoyage
          </Link>
        }
      />

      <div className="h-6" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          tone="warn" label="Demandes en attente" value={stats.demandes} trendLabel="à traiter"
          icon={<Inbox size={18} />}
        />
        <KpiCard
          tone="blue" label="Convoyages planifiés" value={stats.aVenir} trendLabel="à venir"
          icon={<Calendar size={18} />}
        />
        <KpiCard
          tone="violet" label="En cours" value={stats.enCours} trendLabel="live"
          icon={<Truck size={18} />}
        />
        <KpiCard
          tone="ok" label="Terminés" value={stats.terminees} trendLabel={`+${stats.terminees}`}
          icon={<CheckCircle size={18} />}
        />
      </div>

      {/* Suivi + CTA */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 mb-8">
        <ActiveMissionsMap
          title="Suivi de vos convoyages"
          emptyMessage="Aucun convoyage en cours actuellement."
        />
        <div className="v3-cta-gold p-6 flex flex-col justify-center text-center">
          <h3 className="font-v3-display text-[17px] font-semibold text-v3 m-0">
            Un véhicule à faire convoyer ?
          </h3>
          <p className="text-v3-muted text-[13px] mt-1.5 mb-4">
            Réservez en moins de 2 minutes, réponse de notre équipe sous 1h ouvrée.
          </p>
          <Link
            to="/dashboard-client/nouvelle-reservation"
            className="v3-btn-gold inline-flex items-center gap-2 self-center"
          >
            <PlusCircle size={14} /> Réserver un convoyage
          </Link>
        </div>
      </div>

      {/* Dernière mission */}
      <div className="v3-section-head">
        <h2>{lastMission ? "Dernière mission" : "Vos missions"}</h2>
        <Link to="/dashboard-client/missions" className="text-v3-blue text-[12.5px] font-semibold inline-flex items-center gap-1 hover:underline">
          Tout voir <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="mb-8">
        {lastMission ? (
          <Link
            to="/dashboard-client/missions/$missionId"
            params={{ missionId: lastMission.id }}
            className="v3-card v3-card-hover block p-5 group"
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <div className="v3-mono-id">{lastMission.numero}</div>
                <p className="font-v3-display text-[15px] font-semibold text-v3 mt-1 flex items-center gap-2 truncate">
                  <MapPin size={14} className="text-v3-blue shrink-0" />
                  {lastMission.ville_depart} → {lastMission.ville_arrivee}
                </p>
              </div>
              <span className={`v3-status ${(V3_STATUS[lastMission.statut] ?? { cls: "neutral" }).cls}`}>
                {(V3_STATUS[lastMission.statut] ?? { label: lastMission.statut }).label}
              </span>
            </div>
            <div className="flex items-center justify-between text-[12px] text-v3-muted">
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={12} />
                {new Date(lastMission.date_prise_en_charge).toLocaleDateString("fr-FR")}
              </span>
              <span className="v3-price text-[15px]">{Number(lastMission.prix_total).toFixed(2)} €</span>
              <ArrowRight size={14} className="text-v3-dim group-hover:text-v3-blue group-hover:translate-x-1 transition-all" />
            </div>
          </Link>
        ) : hasPendingButNoMission ? (
          <div className="v3-card p-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--v3-warn-soft)] text-[color:var(--v3-warn)] flex items-center justify-center shrink-0">
                <Clock size={16} />
              </div>
              <div className="min-w-0">
                <p className="font-v3-display text-[15px] font-semibold text-v3">
                  Votre demande est en cours de validation
                </p>
                <p className="text-v3-muted text-[13px] mt-1 leading-relaxed">
                  Une fois validée par notre équipe, elle apparaîtra ici comme mission en cours
                  et vous pourrez suivre son avancement en temps réel.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="v3-card p-12 text-center">
            <Truck className="text-v3-dim mx-auto mb-3" size={36} />
            <p className="text-v3-muted text-sm">Aucune mission pour le moment.</p>
            <Link
              to="/dashboard-client/nouvelle-reservation"
              className="inline-flex items-center gap-1.5 mt-4 text-v3-blue text-sm font-semibold hover:underline"
            >
              <PlusCircle size={14} /> Réserver maintenant
            </Link>
          </div>
        )}
      </div>

      {/* Mes demandes en cours */}
      {items.length > 0 && (
        <>
          <div className="v3-section-head">
            <h2>Mes demandes</h2>
            <Link to="/dashboard-client/devis" className="text-v3-blue text-[12.5px] font-semibold inline-flex items-center gap-1 hover:underline">
              Tout voir <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="v3-card overflow-hidden">
            {items.map(it => (
              <Link
                key={it.id}
                to={it.linkTo}
                className="v3-trow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="v3-mono-id inline-flex items-center gap-1.5">
                      <FileText size={11} className="text-v3-blue" /> {it.numero}
                    </span>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${it.status.cls}`}>
                      {it.status.label}
                    </span>
                    <span className="text-[10.5px] uppercase tracking-wider text-v3-dim">· {it.trajetType}</span>
                  </div>
                  <p className="font-v3-display text-[14px] font-semibold text-v3 mt-1.5 truncate">
                    {it.depart} → {it.arrivee}
                  </p>
                  <p className="text-v3-muted text-[12px] mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span>
                      <Calendar size={11} className="inline mr-1" />
                      {new Date(it.created_at).toLocaleDateString("fr-FR")}
                    </span>
                    {it.date_souhaitee && (
                      <span>Prise en charge : {new Date(it.date_souhaitee).toLocaleDateString("fr-FR")}</span>
                    )}
                    {it.vehicule && <span>{it.vehicule}</span>}
                    {it.distance_km ? <span>{it.distance_km} km</span> : null}
                  </p>
                </div>
                <div className="shrink-0 flex sm:block items-center justify-between gap-2 text-left sm:text-right">
                  {it.prix != null ? (
                    <p className="v3-price text-[18px]">{it.prix.toFixed(0)} €</p>
                  ) : (
                    <p className="text-v3-dim text-[11px] uppercase tracking-wider">Prix à venir</p>
                  )}
                  <ArrowRight size={14} className="text-v3-dim hidden sm:inline mt-1" />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function devisStatusInfo(d: DevisRow): { label: string; cls: string } {
  if (d.mission_id || d.statut === "convertit") {
    return { label: "Mission créée", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  if (d.paid_at) {
    return { label: "Payé", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  switch (d.statut) {
    case "accepte":
      return { label: "Validé — à payer", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "refuse":
      return { label: "Refusé", cls: "bg-red-50 text-red-700 border-red-200" };
    case "envoye":
    default:
      return { label: "En attente", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  }
}

function demandeStatusInfo(statut: string): { label: string; cls: string } {
  switch (statut) {
    case "convertie":
    case "convertit":
      return { label: "Mission créée", cls: "bg-blue-50 text-blue-700 border-blue-200" };
    case "en_traitement":
    case "en_cours":
      return { label: "En cours de traitement", cls: "bg-blue-50 text-blue-700 border-blue-200" };
    case "refusee":
    case "annulee":
      return { label: "Refusée", cls: "bg-red-50 text-red-700 border-red-200" };
    case "nouvelle":
    default:
      return { label: "Demande envoyée", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  }
}

function KpiCard({
  tone, icon, label, value, trendLabel,
}: {
  tone: "blue" | "gold" | "ok" | "warn" | "violet";
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trendLabel?: string;
}) {
  return (
    <div className={`v3-kpi-grad ${tone} p-5 sm:p-6`}>
      <div className="flex justify-between items-start mb-3.5 relative z-[1]">
        <div className={`v3-kpi-icon ${tone}`}>{icon}</div>
        {trendLabel && <span className="v3-kpi-trend flat">{trendLabel}</span>}
      </div>
      <div className="v3-kpi-label relative z-[1]">{label}</div>
      <div className="v3-kpi-value relative z-[1]">{value}</div>
    </div>
  );
}
