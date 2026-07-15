import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sendTransactionalEmail } from "@/lib/email/send";
import {
  Calendar,
  CarFront,
  Euro,
  CheckCircle2,
  Send,
  Clock,
  XCircle,
  Loader2,
  Radar,
  Navigation,
  KeyRound,
  ClipboardCheck,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/convoyeur/disponibles")({
  component: ConvoyeurDisponibles,
});

interface TrajetDispo {
  id: string;
  depart: string;
  arrivee: string;
  date_trajet: string | null;
  heure_trajet: string | null;
  marque: string | null;
  modele: string | null;
  prix_suggere: number | null;
  statut_publication: string;
  created_at: string;
  // B1 — pricing mode
  pricing_mode: "fixe" | "enchere" | null;
  prix_convoyeur_fixe: number | null;
  prix_convoyeur_min: number | null;
  prix_convoyeur_max: number | null;
  // Lot 3 — A/R group + bidding
  mission_group_id: string | null;
  leg_type: "simple" | "aller" | "retour" | null;
  bidding_enabled: boolean | null;
}

interface MyOffre {
  id: string;
  trajet_id: string;
  prix_propose: number;
  statut: string;
  type_offre: string;
  message: string | null;
  admin_counter_offer?: number | null;
  admin_counter_at?: string | null;
}

const offreStatutLabel: Record<string, string> = {
  en_attente: "En attente",
  acceptee: "Acceptée",
  refusee: "Refusée",
  retiree: "Retirée",
};

function ConvoyeurDisponibles() {
  const { user, convoyeurStatut } = useAuth();
  const isValidated = convoyeurStatut === "valide" || convoyeurStatut === "actif";
  const [hasTraining, setHasTraining] = useState(false);
  const [convoyeurId, setConvoyeurId] = useState<string | null>(null);
  const [trajets, setTrajets] = useState<TrajetDispo[]>([]);
  const [myOffres, setMyOffres] = useState<Record<string, MyOffre>>({});
  const [loading, setLoading] = useState(true);

  const [openTrajetId, setOpenTrajetId] = useState<string | null>(null);
  const [contrePrix, setContrePrix] = useState<string>("");
  const [contreMessage, setContreMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Charger l'id du convoyeur connecté
  useEffect(() => {
    if (!user) return;
    supabase
      .from("convoyeurs")
      .select("id, has_completed_training")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const row = data as { id: string; has_completed_training?: boolean };
          setConvoyeurId(row.id);
          setHasTraining(Boolean(row.has_completed_training));
        }
      });
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!convoyeurId) return;
    setLoading(true);
    const [{ data: trajetsData }, { data: offresData }] = await Promise.all([
      supabase
        .from("trajets_publies_safe" as never)
        .select("id, depart, arrivee, date_trajet, heure_trajet, marque, modele, prix_suggere, statut_publication, created_at, pricing_mode, prix_convoyeur_fixe, prix_convoyeur_min, prix_convoyeur_max, mission_group_id, leg_type, bidding_enabled")
        .order("created_at", { ascending: false }),
      supabase
        .from("mission_offres" as never)
        .select("*")
        .eq("convoyeur_id" as never, convoyeurId as never),
    ]);
    if (trajetsData) setTrajets(trajetsData as unknown as TrajetDispo[]);
    if (offresData) {
      const map: Record<string, MyOffre> = {};
      (offresData as unknown as MyOffre[]).forEach((o) => {
        map[o.trajet_id] = o;
      });
      setMyOffres(map);
    }
    setLoading(false);
  }, [convoyeurId]);

  useEffect(() => {
    if (convoyeurId) fetchData();
  }, [convoyeurId, fetchData]);

  useEffect(() => {
    if (!convoyeurId) return;

    const channel = supabase
      .channel(`convoyeur-disponibles-${convoyeurId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "trajets",
      }, () => {
        void fetchData();
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "mission_offres",
        filter: `convoyeur_id=eq.${convoyeurId}`,
      }, () => {
        void fetchData();
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "attributions",
        filter: `convoyeur_id=eq.${convoyeurId}`,
      }, () => {
        void fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [convoyeurId, fetchData]);

  const notifyAdmin = async (
    trajet: TrajetDispo,
    prix: number,
    typeOffre: string,
    message?: string,
  ) => {
    if (!convoyeurId) return;
    const { data: conv } = await supabase
      .from("convoyeurs")
      .select("prenom, nom")
      .eq("id", convoyeurId)
      .maybeSingle();
    const convoyeurNom = conv ? `${conv.prenom} ${conv.nom}` : "Convoyeur";

    // Notification interne admin (feed temps réel) — via RPC sécurisée
    await supabase.rpc("create_admin_notification" as never, {
      _type: "mission_offre",
      _titre: typeOffre === "acceptation_directe"
        ? `${convoyeurNom} accepte la mission ${trajet.depart} → ${trajet.arrivee}`
        : `${convoyeurNom} propose ${prix}€ pour ${trajet.depart} → ${trajet.arrivee}`,
      _message: message ?? null,
      _link: "/admin/attributions",
      _entity_type: "trajet",
      _entity_id: trajet.id,
      _metadata: { prix, type_offre: typeOffre, prix_suggere: trajet.prix_suggere } as never,
    } as never);

    sendTransactionalEmail({
      templateName: "nouvelle-offre-admin",
      recipientEmail: "contact@transportsligneo.fr",
      idempotencyKey: `nouvelle-offre-${trajet.id}-${convoyeurId}-${Date.now()}`,
      templateData: {
        convoyeurNom,
        depart: trajet.depart,
        arrivee: trajet.arrivee,
        date: trajet.date_trajet
          ? new Date(trajet.date_trajet).toLocaleDateString("fr-FR")
          : "—",
        prixSuggere: trajet.prix_suggere,
        prixPropose: prix,
        typeOffre,
        message: message ?? null,
      },
    }).catch(() => {});
  };

  /** Prix net convoyeur effectif d'un trajet (selon le mode). */
  const prixDriverEffectif = (t: TrajetDispo): number | null => {
    if (t.pricing_mode === "fixe" && t.prix_convoyeur_fixe != null) return t.prix_convoyeur_fixe;
    return t.prix_suggere ?? null;
  };

  const accepterPrixSuggere = async (trajet: TrajetDispo) => {
    if (!isValidated) {
      toast.error("Vos documents doivent être validés avant d'accepter une mission.");
      return;
    }
    if (!hasTraining) {
      toast.error("Formation obligatoire à terminer avant d'accepter une mission.");
      return;
    }

    const prix = prixDriverEffectif(trajet);
    if (!convoyeurId || prix == null) return;
    setSubmitting(true);

    // PRIX FIXE → attribution instantanée via RPC (premier arrivé = attribué)
    if (trajet.pricing_mode === "fixe") {
      const { error } = await supabase.rpc("accept_mission_fixe" as never, {
        _trajet_id: trajet.id,
      } as never);
      if (error) {
        toast.error(error.message || "Cette mission n'est plus disponible.");
        setSubmitting(false);
        fetchData();
        return;
      }
      notifyAdmin(trajet, prix, "acceptation_directe");
      setSubmitting(false);
      setOpenTrajetId(null);
      fetchData();
      return;
    }

    // ENCHÈRE → offre en attente de validation admin
    await supabase.from("mission_offres" as never).insert({
      trajet_id: trajet.id,
      convoyeur_id: convoyeurId,
      prix_propose: prix,
      prix_suggere_snapshot: prix,
      type_offre: "acceptation_directe",
      statut: "en_attente",
    } as never);
    notifyAdmin(trajet, prix, "acceptation_directe");
    setSubmitting(false);
    setOpenTrajetId(null);
    fetchData();
  };

  const envoyerContreProposition = async (trajet: TrajetDispo) => {
    if (!isValidated) {
      toast.error("Vos documents doivent être validés avant de proposer un prix.");
      return;
    }
    if (!hasTraining) {
      toast.error("Formation obligatoire à terminer avant de proposer un prix.");
      return;
    }

    if (trajet.pricing_mode === "fixe") {
      toast.error("Cette mission est en prix fixe, vous ne pouvez pas proposer un autre prix.");
      return;
    }
    if (!convoyeurId || !contrePrix) return;
    const prix = parseFloat(contrePrix);
    if (isNaN(prix) || prix <= 0) return;
    if (trajet.prix_convoyeur_min != null && prix < trajet.prix_convoyeur_min) {
      toast.error(`Votre prix doit être au moins ${trajet.prix_convoyeur_min} €.`);
      return;
    }
    if (trajet.prix_convoyeur_max != null && prix > trajet.prix_convoyeur_max) {
      toast.error(`Votre prix doit être au maximum ${trajet.prix_convoyeur_max} €.`);
      return;
    }
    setSubmitting(true);
    await supabase.from("mission_offres" as never).insert({
      trajet_id: trajet.id,
      convoyeur_id: convoyeurId,
      prix_propose: prix,
      prix_suggere_snapshot: trajet.prix_suggere,
      type_offre: "contre_proposition",
      statut: "en_attente",
      message: contreMessage || null,
    } as never);
    notifyAdmin(trajet, prix, "contre_proposition", contreMessage || undefined);
    setSubmitting(false);
    setContrePrix("");
    setContreMessage("");
    setOpenTrajetId(null);
    fetchData();
  };

  const retirerOffre = async (offreId: string) => {
    await supabase
      .from("mission_offres" as never)
      .update({ statut: "retiree" } as never)
      .eq("id" as never, offreId as never);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-emerald-600" size={28} />
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8">
      <style>{`
        @keyframes ligneo-sweep { 0% { transform: translateX(-120%); } 100% { transform: translateX(220%); } }
        @keyframes ligneo-pulse-ring { 0%, 100% { opacity: .55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.06); } }
        @keyframes ligneo-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes ligneo-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes ligneo-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); } 50% { box-shadow: 0 0 24px 2px rgba(59,130,246,0.35); } }
        .ligneo-neon-card { position: relative; background: linear-gradient(180deg, rgba(15,26,64,0.55) 0%, rgba(8,14,36,0.75) 100%); border: 1px solid rgba(96,165,250,0.18); border-radius: 22px; backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); box-shadow: 0 20px 50px -24px rgba(59,130,246,0.35), inset 0 1px 0 rgba(255,255,255,0.05); transition: transform .35s ease, box-shadow .35s ease, border-color .35s ease; }
        .ligneo-neon-card:hover { transform: translateY(-2px); border-color: rgba(96,165,250,0.35); box-shadow: 0 30px 70px -24px rgba(59,130,246,0.55), 0 0 0 1px rgba(96,165,250,0.15) inset; }
        .ligneo-neon-card::before { content: ""; position: absolute; inset: 0; border-radius: 22px; padding: 1px; background: linear-gradient(135deg, rgba(96,165,250,0.45), rgba(37,99,235,0) 40%, rgba(96,165,250,0) 60%, rgba(147,197,253,0.35)); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; opacity: .8; }
        .ligneo-badge-neon { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; background: rgba(59,130,246,0.12); border: 1px solid rgba(96,165,250,0.4); color: #bfdbfe; text-shadow: 0 0 8px rgba(96,165,250,0.5); }
        .ligneo-badge-neon--amber { background: rgba(245,158,11,0.10); border-color: rgba(251,191,36,0.45); color: #fcd34d; text-shadow: 0 0 8px rgba(251,191,36,0.4); }
        .ligneo-badge-neon--indigo { background: rgba(99,102,241,0.12); border-color: rgba(129,140,248,0.45); color: #c7d2fe; text-shadow: 0 0 8px rgba(129,140,248,0.4); }
        .ligneo-badge-neon--emerald { background: rgba(16,185,129,0.10); border-color: rgba(52,211,153,0.45); color: #6ee7b7; text-shadow: 0 0 8px rgba(52,211,153,0.4); }
        .ligneo-btn-neon { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 16px; border-radius: 14px; font-size: 13px; font-weight: 700; letter-spacing: .04em; color: #fff; background: linear-gradient(135deg, #2563eb 0%, #3b82f6 55%, #1d4ed8 100%); box-shadow: 0 14px 30px -10px rgba(59,130,246,0.65), inset 0 1px 0 rgba(255,255,255,0.2); transition: transform .2s ease, box-shadow .3s ease; overflow: hidden; }
        .ligneo-btn-neon:hover { box-shadow: 0 20px 40px -10px rgba(59,130,246,0.85), 0 0 0 1px rgba(147,197,253,0.4) inset; }
        .ligneo-btn-neon:active { transform: scale(.97); }
        .ligneo-btn-neon:disabled { opacity: .45; cursor: not-allowed; }
        .ligneo-btn-ghost { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 16px; border-radius: 14px; font-size: 13px; font-weight: 600; color: #bfdbfe; background: rgba(59,130,246,0.06); border: 1px solid rgba(96,165,250,0.3); transition: background .2s ease, border-color .2s ease, transform .2s ease; }
        .ligneo-btn-ghost:hover:not(:disabled) { background: rgba(59,130,246,0.14); border-color: rgba(96,165,250,0.55); }
        .ligneo-btn-ghost:active { transform: scale(.97); }
        .ligneo-btn-ghost:disabled { opacity: .45; cursor: not-allowed; }
        .ligneo-icon-orb { position: relative; width: 40px; height: 40px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; background: radial-gradient(circle at 30% 30%, rgba(96,165,250,0.28), rgba(8,14,36,0.6) 70%); border: 1px solid rgba(96,165,250,0.35); color: #bfdbfe; box-shadow: inset 0 0 12px rgba(59,130,246,0.35), 0 0 18px -6px rgba(59,130,246,0.4); }
        .ligneo-dot-live { width: 8px; height: 8px; border-radius: 999px; background: #60a5fa; box-shadow: 0 0 0 4px rgba(96,165,250,0.18), 0 0 12px rgba(96,165,250,0.9); animation: ligneo-pulse-ring 1.8s ease-in-out infinite; }
        .ligneo-flash-shell { position: relative; overflow: hidden; border-radius: 26px; background: linear-gradient(135deg, rgba(37,99,235,0.32) 0%, rgba(10,22,56,0.85) 55%, rgba(5,11,29,0.95) 100%); border: 1px solid rgba(96,165,250,0.3); box-shadow: 0 30px 80px -30px rgba(59,130,246,0.55), inset 0 0 0 1px rgba(147,197,253,0.08); }
        .ligneo-flash-shell::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.14) 50%, transparent 70%); background-size: 220% 100%; animation: ligneo-shimmer 5s linear infinite; pointer-events: none; }
        .ligneo-flash-line { position: absolute; height: 1px; background: linear-gradient(90deg, transparent, rgba(147,197,253,0.9), transparent); opacity: .8; animation: ligneo-sweep 4.5s ease-in-out infinite; }
        .ligneo-particle { position: absolute; width: 3px; height: 3px; border-radius: 999px; background: #93c5fd; box-shadow: 0 0 8px #60a5fa, 0 0 16px #3b82f6; animation: ligneo-float 4s ease-in-out infinite; }
        .ligneo-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-size: 11px; font-weight: 600; color: #cbd5f5; background: rgba(15,26,64,0.6); border: 1px solid rgba(96,165,250,0.2); }
        .ligneo-price-orb { position: relative; padding: 10px 16px; border-radius: 16px; background: linear-gradient(135deg, rgba(59,130,246,0.16), rgba(29,78,216,0.08)); border: 1px solid rgba(96,165,250,0.45); color: #dbeafe; box-shadow: inset 0 0 14px rgba(59,130,246,0.35), 0 8px 22px -8px rgba(59,130,246,0.5); }
        .ligneo-route-node { width: 12px; height: 12px; border-radius: 999px; background: #60a5fa; box-shadow: 0 0 0 3px rgba(96,165,250,0.18), 0 0 12px rgba(96,165,250,0.9); }
        .ligneo-route-node--end { background: #34d399; box-shadow: 0 0 0 3px rgba(52,211,153,0.18), 0 0 12px rgba(52,211,153,0.9); }
        .ligneo-route-line { width: 2px; flex: 1; background: linear-gradient(180deg, rgba(96,165,250,0.9), rgba(52,211,153,0.9)); border-radius: 2px; opacity: .55; }
        .ligneo-input-neon { width: 100%; padding: 12px 14px; border-radius: 14px; background: rgba(8,14,36,0.6); border: 1px solid rgba(96,165,250,0.28); color: #e0e7ff; font-size: 14px; outline: none; transition: border-color .2s ease, box-shadow .2s ease; }
        .ligneo-input-neon:focus { border-color: rgba(147,197,253,0.65); box-shadow: 0 0 0 3px rgba(59,130,246,0.25); }
      `}</style>

      <div
        className="relative min-h-[calc(100vh-2rem)] px-4 sm:px-6 lg:px-8 pt-6 pb-24 text-white overflow-hidden"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, #0b1a44 0%, #060e28 55%, #030814 100%)",
        }}
      >
        {/* halos ambiants */}
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 w-[360px] h-[360px] rounded-full blur-[120px] opacity-60"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.45) 0%, transparent 70%)" }} />
        <div aria-hidden className="pointer-events-none absolute top-1/3 -left-24 w-[300px] h-[300px] rounded-full blur-[110px] opacity-40"
          style={{ background: "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 70%)" }} />

        <div className="relative z-10 space-y-6 max-w-4xl mx-auto">
          {/* === TITRE === */}
          <div className="flex items-start gap-3">
            <span className="ligneo-icon-orb shrink-0" aria-hidden>
              <Radar size={20} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] tracking-[0.32em] uppercase text-[#60a5fa] font-bold">
                Convoyage · Missions
              </p>
              <h1 className="mt-1 text-[26px] sm:text-[30px] font-black leading-tight tracking-tight text-white">
                Missions <span className="text-[#3b82f6]">disponibles</span>
                <span className="text-[#60a5fa]">.</span>
              </h1>
              <p className="text-white/60 text-sm mt-1.5 flex items-center gap-2">
                <span className="ligneo-dot-live" aria-hidden />
                {trajets.length === 0
                  ? "Aucune mission ouverte pour le moment."
                  : `${trajets.length} mission${trajets.length > 1 ? "s" : ""} ouverte${trajets.length > 1 ? "s" : ""} aux propositions.`}
              </p>
            </div>
          </div>

          {/* === Alerts (préservées, restylées) === */}
          {!isValidated && (
            <div className="ligneo-neon-card p-4 flex items-start gap-3">
              <span className="ligneo-icon-orb shrink-0" aria-hidden>
                <ClipboardCheck size={18} />
              </span>
              <div>
                <p className="font-bold text-white">Validation des documents requise</p>
                <p className="text-white/65 text-sm mt-0.5">
                  Vous pourrez accepter des missions dès que vos documents seront validés par notre équipe.
                </p>
              </div>
            </div>
          )}

          {isValidated && !hasTraining && (
            <a href="/convoyeur/formation" className="ligneo-neon-card p-4 flex items-start gap-3 block hover:no-underline">
              <span className="ligneo-icon-orb shrink-0" aria-hidden>
                <Sparkles size={18} />
              </span>
              <div>
                <p className="font-bold text-white">Formation obligatoire</p>
                <p className="text-white/65 text-sm mt-0.5">
                  Terminez la formation avant d'accepter une mission ou de proposer un prix.
                </p>
              </div>
              <ArrowRight size={16} className="ml-auto self-center text-[#60a5fa]" />
            </a>
          )}

          {/* === BANDEAU NOTIFICATION (push in-app) === */}
          <NotificationBanner />


          {/* === MES ENCHÈRES EN COURS === */}
          {(() => {
            const offresList = Object.values(myOffres).filter(
              (o) => o.statut === "en_attente" || o.statut === "acceptee",
            );
            if (offresList.length === 0) return null;
            return (
              <div className="ligneo-neon-card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="ligneo-icon-orb shrink-0" aria-hidden>
                    <Euro size={18} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] tracking-[0.28em] uppercase text-[#60a5fa] font-bold">
                      Mes enchères
                    </p>
                    <h3 className="text-white font-bold text-[15px]">
                      {offresList.length} offre{offresList.length > 1 ? "s" : ""} en cours
                    </h3>
                  </div>
                </div>
                <ul className="space-y-2">
                  {offresList.map((o) => {
                    const t = trajets.find((x) => x.id === o.trajet_id);
                    return (
                      <li
                        key={o.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03]"
                      >
                        <div className="min-w-0">
                          <p className="text-white text-[13px] font-semibold truncate">
                            {t ? `${t.depart} → ${t.arrivee}` : "Mission"}
                          </p>
                          <p className="text-white/60 text-[11.5px] mt-0.5 tabular-nums">
                            {o.prix_propose} € · {offreStatutLabel[o.statut]}
                          </p>
                        </div>
                        <span
                          className={`ligneo-badge-neon ${o.statut === "acceptee" ? "ligneo-badge-neon--emerald" : "ligneo-badge-neon--amber"}`}
                        >
                          {o.statut === "acceptee" ? "Acceptée" : "En attente"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}

          {/* === LISTE === */}
          {trajets.length === 0 ? (
            <div className="ligneo-neon-card p-10 text-center">
              <span className="ligneo-icon-orb mx-auto mb-3" aria-hidden>
                <Radar size={20} />
              </span>
              <p className="text-white/70">Revenez plus tard, de nouvelles missions sont publiées régulièrement.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {trajets.map((t) => {
                const offre = myOffres[t.id];
                const open = openTrajetId === t.id;
                const prixAffiche = prixDriverEffectif(t);
                const isFixe = t.pricing_mode === "fixe";
                return (
                  <article key={t.id} className="ligneo-neon-card p-5">
                    {/* Header : badges + date */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className={`ligneo-badge-neon ${isFixe ? "" : "ligneo-badge-neon--amber"}`}>
                          {isFixe ? "Prix fixe" : "Enchère"}
                        </span>
                        {(t.leg_type === "aller" || t.leg_type === "retour") && (
                          <span className={`ligneo-badge-neon ${t.leg_type === "aller" ? "" : "ligneo-badge-neon--indigo"}`}>
                            {t.leg_type === "aller" ? "Aller" : "Retour"}
                          </span>
                        )}
                        {(t.marque || t.modele) && (
                          <span className="ligneo-badge-neon ligneo-badge-neon--emerald inline-flex items-center gap-1.5">
                            <CarFront size={11} strokeWidth={1.75} />
                            {[t.marque, t.modele].filter(Boolean).join(" ")}
                          </span>
                        )}
                      </div>
                      {t.date_trajet && (
                        <span className="ligneo-chip shrink-0">
                          <Calendar size={12} strokeWidth={1.75} className="text-[#93c5fd]" />
                          <span className="tabular-nums">
                            {new Date(t.date_trajet).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                            {t.heure_trajet && ` · ${t.heure_trajet}`}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Trajet illustré */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center pt-1.5">
                        <span className="ligneo-route-node" aria-hidden />
                        <span className="ligneo-route-line my-1" style={{ minHeight: 30 }} aria-hidden />
                        <span className="ligneo-route-node ligneo-route-node--end" aria-hidden />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <p className="text-[9.5px] tracking-[0.22em] uppercase font-bold text-[#60a5fa]/85">Départ</p>
                          <p className="text-white font-semibold text-[15px] truncate mt-0.5">{t.depart}</p>
                        </div>
                        <div>
                          <p className="text-[9.5px] tracking-[0.22em] uppercase font-bold text-[#6ee7b7]/85">Arrivée</p>
                          <p className="text-white font-semibold text-[15px] truncate mt-0.5">{t.arrivee}</p>
                        </div>
                      </div>

                      {prixAffiche != null && (
                        <div className="ligneo-price-orb text-right shrink-0 self-start">
                          <p className="text-[9px] tracking-[0.22em] uppercase text-[#93c5fd] font-bold">
                            {isFixe ? "Prix fixe" : "Dès"}
                          </p>
                          <p className="text-white text-[20px] font-black leading-tight tabular-nums mt-0.5">
                            {prixAffiche} €
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Statut de mon offre */}
                    {offre && (
                      <div
                        className="mt-4 flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-[12.5px] border"
                        style={
                          offre.statut === "acceptee"
                            ? { background: "rgba(16,185,129,0.10)", borderColor: "rgba(52,211,153,0.4)", color: "#6ee7b7" }
                            : offre.statut === "refusee"
                            ? { background: "rgba(239,68,68,0.10)", borderColor: "rgba(248,113,113,0.4)", color: "#fca5a5" }
                            : offre.statut === "retiree"
                            ? { background: "rgba(148,163,184,0.10)", borderColor: "rgba(148,163,184,0.35)", color: "#cbd5f5" }
                            : { background: "rgba(245,158,11,0.10)", borderColor: "rgba(251,191,36,0.4)", color: "#fcd34d" }
                        }
                      >
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          {offre.statut === "acceptee" ? <CheckCircle2 size={14} /> :
                            offre.statut === "refusee" ? <XCircle size={14} /> : <Clock size={14} />}
                          Votre offre : <strong className="tabular-nums">{offre.prix_propose} €</strong> · {offreStatutLabel[offre.statut]}
                        </span>
                        {offre.statut === "en_attente" && (
                          <button
                            onClick={() => retirerOffre(offre.id)}
                            className="text-[#fca5a5] hover:text-white font-semibold underline underline-offset-2"
                          >
                            Retirer
                          </button>
                        )}
                      </div>
                    )}

                    {offre?.admin_counter_offer != null && offre.statut === "en_attente" && (
                      <div
                        className="mt-3 rounded-xl border p-3.5 text-sm"
                        style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(251,191,36,0.4)", color: "#fde68a" }}
                      >
                        <p className="font-semibold">
                          Contre-proposition admin : <strong className="tabular-nums text-white">{offre.admin_counter_offer} €</strong>
                        </p>
                        {offre.admin_counter_at && (
                          <p className="text-xs opacity-80 mt-0.5">
                            Reçue le {new Date(offre.admin_counter_at).toLocaleString("fr-FR")}
                          </p>
                        )}
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={async () => {
                              const { error } = await supabase
                                .from("mission_offres" as never)
                                .update({
                                  prix_propose: offre.admin_counter_offer,
                                  admin_counter_offer: null,
                                  admin_counter_at: null,
                                } as never)
                                .eq("id" as never, offre.id as never);
                              if (error) toast.error("Impossible d'accepter la contre-proposition.");
                              else {
                                toast.success("Contre-proposition acceptée.");
                                fetchData();
                              }
                            }}
                            className="ligneo-btn-neon !py-2 !px-3 text-xs"
                          >
                            <CheckCircle2 size={13} />
                            Accepter {offre.admin_counter_offer} €
                          </button>
                          <button
                            onClick={async () => {
                              await supabase
                                .from("mission_offres" as never)
                                .update({ admin_counter_offer: null, admin_counter_at: null } as never)
                                .eq("id" as never, offre.id as never);
                              toast.info("Contre-proposition refusée, votre prix initial est maintenu.");
                              fetchData();
                            }}
                            className="ligneo-btn-ghost !py-2 !px-3 text-xs"
                          >
                            Refuser
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {!offre || offre.statut === "retiree" || offre.statut === "refusee" ? (
                      !open ? (
                        <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
                          {prixAffiche != null && (
                            <button
                              onClick={() => accepterPrixSuggere(t)}
                              disabled={submitting || !isValidated || !hasTraining}
                              title={!isValidated ? "Documents en attente de validation" : !hasTraining ? "Formation obligatoire" : undefined}
                              className="ligneo-btn-neon flex-1"
                            >
                              <KeyRound size={15} strokeWidth={2} />
                              Accepter à {prixAffiche} €
                            </button>
                          )}
                          {!isFixe && (
                            <button
                              onClick={() => {
                                if (!isValidated || !hasTraining) return;
                                setOpenTrajetId(t.id);
                                setContrePrix(prixAffiche?.toString() ?? "");
                                setContreMessage("");
                              }}
                              disabled={!isValidated || !hasTraining}
                              title={!isValidated ? "Documents en attente de validation" : !hasTraining ? "Formation obligatoire" : undefined}
                              className="ligneo-btn-ghost flex-1"
                            >
                              <Euro size={15} strokeWidth={2} />
                              {t.prix_convoyeur_min != null || t.prix_convoyeur_max != null
                                ? `Proposer (${t.prix_convoyeur_min ?? "—"}–${t.prix_convoyeur_max ?? "—"} €)`
                                : "Proposer mon prix"}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="mt-4 space-y-2.5 pt-4 border-t border-white/[0.08]">
                          <label className="block text-[11px] font-bold tracking-[0.18em] uppercase text-[#60a5fa]">
                            Votre prix (€)
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={contrePrix}
                            onChange={(e) => setContrePrix(e.target.value)}
                            placeholder="ex: 250"
                            className="ligneo-input-neon"
                          />
                          <label className="block text-[11px] font-bold tracking-[0.18em] uppercase text-[#60a5fa] pt-1">
                            Message (optionnel)
                          </label>
                          <textarea
                            value={contreMessage}
                            onChange={(e) => setContreMessage(e.target.value)}
                            rows={2}
                            placeholder="Justification, conditions, disponibilité..."
                            className="ligneo-input-neon resize-none"
                          />
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => setOpenTrajetId(null)}
                              className="ligneo-btn-ghost flex-1"
                            >
                              Annuler
                            </button>
                            <button
                              onClick={() => envoyerContreProposition(t)}
                              disabled={submitting || !contrePrix}
                              className="ligneo-btn-neon flex-1"
                            >
                              <Send size={14} />
                              Envoyer
                            </button>
                          </div>
                        </div>
                      )
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Utilitaire visuel : icône chevron discrète pour navigation
function _NavArrow() { return <Navigation size={14} />; }

