import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Clock, CheckCircle, Calendar, MapPin, PlusCircle, ArrowRight, Loader2, FileText, Inbox } from "lucide-react";
import { StatusBadge, missionStatusKind, missionStatusLabel } from "@/components/dashboard/StatusBadge";
import { ActiveMissionsMap } from "@/components/map/ActiveMissionsMap";

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
        trajetType: (d.option_trajet || "").toLowerCase().includes("retour") ? "Aller-retour" : "Aller simple",
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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={28} /></div>;

  const hasPendingButNoMission = !lastMission && items.length > 0;

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="card-premium rounded p-6 md:p-8 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.3em] text-primary/80 mb-2">Bienvenue</p>
          <h1 className="font-heading text-2xl md:text-3xl text-cream tracking-wide">
            {prenom ? `Bonjour, ${prenom}` : "Bonjour"}
          </h1>
          <p className="text-cream/70 text-sm mt-2">Voici un aperçu de vos convoyages.</p>
          <Link
            to="/dashboard-client/nouvelle-reservation"
            className="inline-flex items-center gap-2 mt-5 px-6 py-3 bg-primary text-navy font-heading text-sm tracking-[0.15em] uppercase hover:bg-gold-light transition-colors"
          >
            <PlusCircle size={16} /> Réserver un convoyage
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
        <StatCard icon={Clock} label="En cours" value={stats.enCours} accent="text-primary" />
        <StatCard icon={Calendar} label="À venir" value={stats.aVenir} accent="text-blue-300" />
        <StatCard icon={CheckCircle} label="Terminées" value={stats.terminees} accent="text-green-300" />
        <StatCard icon={Inbox} label="Demandes" value={stats.demandes} accent="text-[#e7c76a]" />
      </div>

      {/* Last mission OU bloc rassurant */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-lg text-cream tracking-wider">
            {lastMission ? "Dernière mission" : "Vos missions"}
          </h2>
          <Link to="/dashboard-client/missions" className="text-xs text-primary hover:text-gold-light transition-colors uppercase tracking-wider">
            Voir tout →
          </Link>
        </div>
        {lastMission ? (
          <Link
            to="/dashboard-client/missions/$missionId"
            params={{ missionId: lastMission.id }}
            className="block card-premium p-5 rounded hover:border-primary/40 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-cream/60 text-xs uppercase tracking-wider">{lastMission.numero}</p>
                <p className="text-cream font-heading text-base mt-1 flex items-center gap-2">
                  <MapPin size={14} className="text-primary" />
                  {lastMission.ville_depart} → {lastMission.ville_arrivee}
                </p>
              </div>
              <StatusBadge kind={missionStatusKind(lastMission.statut)} size="md">
                {missionStatusLabel(lastMission.statut)}
              </StatusBadge>
            </div>
            <div className="flex items-center justify-between text-xs text-cream/70">
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {new Date(lastMission.date_prise_en_charge).toLocaleDateString("fr-FR")}
              </span>
              <span className="font-heading text-primary text-base">{Number(lastMission.prix_total).toFixed(2)} €</span>
              <ArrowRight size={14} className="text-cream/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </Link>
        ) : hasPendingButNoMission ? (
          <div className="card-premium p-6 rounded">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-500/15 border border-amber-500/30 p-2 mt-0.5">
                <Clock size={16} className="text-amber-300" />
              </div>
              <div className="flex-1">
                <p className="font-heading text-base text-cream tracking-wide">
                  Votre demande est en cours de validation
                </p>
                <p className="text-cream/60 text-sm mt-1 leading-relaxed">
                  Une fois validée par notre équipe, elle apparaîtra ici comme mission en cours
                  et vous pourrez suivre son avancement en temps réel.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="card-premium p-8 rounded text-center">
            <Truck className="text-cream/20 mx-auto mb-3" size={32} />
            <p className="text-cream/70 text-sm">Aucune mission pour le moment.</p>
            <Link
              to="/dashboard-client/nouvelle-reservation"
              className="inline-block mt-4 text-primary text-xs uppercase tracking-wider hover:text-gold-light transition-colors"
            >
              Réserver maintenant →
            </Link>
          </div>
        )}
      </div>

      {/* Mes demandes en cours */}
      {items.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg text-cream tracking-wider">Mes demandes</h2>
            <Link
              to="/dashboard-client/devis"
              className="text-primary text-xs uppercase tracking-wider hover:text-gold-light transition-colors"
            >
              Tout voir →
            </Link>
          </div>
          <div className="space-y-3">
            {items.map(it => (
              <Link
                key={it.id}
                to={it.linkTo}
                className="card-premium p-4 md:p-5 rounded flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-primary/40 transition-colors cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-cream/60 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={12} className="text-primary" /> {it.numero}
                    </p>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${it.status.cls}`}>
                      {it.status.label}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-cream/60">· {it.trajetType}</span>
                  </div>
                  <p className="text-cream font-heading text-sm mt-1.5 truncate">{it.depart} → {it.arrivee}</p>
                  <p className="text-cream/70 text-xs mt-1 flex flex-wrap gap-x-3 gap-y-1">
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
                <div className="text-left sm:text-right shrink-0 flex sm:block items-center justify-between gap-2">
                  {it.prix != null ? (
                    <p className="font-heading text-primary text-xl">{it.prix.toFixed(0)} €</p>
                  ) : (
                    <p className="text-cream/60 text-[11px] uppercase tracking-wider">Prix à venir</p>
                  )}
                  <ArrowRight size={14} className="text-cream/30 hidden sm:inline mt-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function devisStatusInfo(d: DevisRow): { label: string; cls: string } {
  if (d.mission_id || d.statut === "convertit") {
    return { label: "Mission créée", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" };
  }
  if (d.paid_at) {
    return { label: "Payé", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
  }
  switch (d.statut) {
    case "accepte":
      return { label: "Validé — à payer", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
    case "refuse":
      return { label: "Refusé", cls: "bg-red-500/15 text-red-300 border-red-500/30" };
    case "envoye":
    default:
      return { label: "En attente", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
  }
}

function demandeStatusInfo(statut: string): { label: string; cls: string } {
  switch (statut) {
    case "convertie":
    case "convertit":
      return { label: "Mission créée", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" };
    case "en_traitement":
    case "en_cours":
      return { label: "En cours de traitement", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" };
    case "refusee":
    case "annulee":
      return { label: "Refusée", cls: "bg-red-500/15 text-red-300 border-red-500/30" };
    case "nouvelle":
    default:
      return { label: "Demande envoyée", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
  }
}

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Truck; label: string; value: number; accent: string }) {
  return (
    <div className="card-premium p-4 md:p-5 rounded">
      <Icon className={`${accent} opacity-70 mb-2`} size={20} />
      <p className={`font-heading text-2xl md:text-3xl ${accent}`}>{value}</p>
      <p className="text-cream/70 text-[10px] md:text-xs uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
