import { useEffect, useState } from "react";
import {
  MapPin,
  Calendar,
  Clock,
  Car,
  Euro,
  Zap,
  ArrowLeftRight,
  ArrowRight,
  Timer,
  Navigation,
  Send,
  FileCheck2,
} from "lucide-react";
import { MissionStatusBadge } from "@/components/admin/MissionStatusBadge";
import { inferMissionLevel, missionLevelStyle } from "@/lib/mission-level";

export interface CatalogTrajet {
  id: string;
  depart: string;
  arrivee: string;
  date_trajet: string | null;
  heure_trajet: string | null;
  marque: string | null;
  modele: string | null;
  distance_km?: number | null;
  duree_estimee_min?: number | null;
  kilometrage_estime?: number | null;
  type_carburant?: string | null;
  prix_convoyeur_fixe: number | null;
  prix_convoyeur: number | null;
  prix_suggere: number | null;
  attribution_mode: string;
  allow_counter_offer: boolean;
  proposal_expires_at: string | null;
  urgence?: string | null;
  leg_type: string | null;
  mission_group_id: string | null;
  statut_publication?: string | null;
  created_at: string;
  published_at: string | null;
  depart_lat?: number | null;
  depart_lng?: number | null;
  groupedLegs?: CatalogTrajet[];
  isGroupedAr?: boolean;
}

interface Props {
  trajet: CatalogTrajet;
  distanceFromMe?: number | null;
  myOfferStatus?: string | null;
  myOfferPrice?: number | null;
  canApply: boolean;
  onOpen: () => void;
  onQuickApply: () => void;
}

function formatDuration(min?: number | null) {
  if (!min || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m.toString().padStart(2, "0")}`;
}

function useCountdown(iso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [iso]);
  if (!iso) return null;
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return "Expirée";
  const h = Math.floor(diff / 3600_000);
  const m = Math.floor((diff % 3600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)} j restants`;
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")} restants`;
  return `${m} min restantes`;
}

export function CatalogueMissionCard({
  trajet: t,
  distanceFromMe,
  myOfferStatus,
  myOfferPrice,
  canApply,
  onOpen,
  onQuickApply,
}: Props) {
  const price = t.prix_convoyeur_fixe ?? t.prix_convoyeur ?? t.prix_suggere ?? 0;
  const isAR = Boolean(t.isGroupedAr || (!!t.leg_type && t.leg_type !== "simple"));
  const urgent = t.urgence === "immediat" || t.urgence === "urgent";
  const fresh = t.published_at
    ? Date.now() - new Date(t.published_at).getTime() < 24 * 3600_000
    : false;
  const countdown = useCountdown(t.proposal_expires_at);
  const level = inferMissionLevel({
    distanceKm: t.distance_km,
    urgence: t.urgence,
  });
  const isElectric = isElectricEnergie(t.type_carburant)
    || guessElectricFromModel(t.marque, t.modele);

  return (
    <div
      onClick={onOpen}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-300/40 hover:shadow-[0_20px_50px_-24px_rgba(212,175,55,0.45)]"
    >
      {/* Halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-70"
        style={{
          background:
            "radial-gradient(circle, rgba(212,175,55,0.35) 0%, transparent 70%)",
        }}
      />

      {/* Top badges */}
      <div className="relative flex flex-wrap items-center gap-1.5">
        {urgent && (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-400/60 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-200">
            <Zap size={10} /> Urgent
          </span>
        )}
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            isAR
              ? "border-indigo-400/60 bg-indigo-500/15 text-indigo-200"
              : "border-white/20 bg-white/5 text-white/80"
          }`}
        >
          {isAR ? <ArrowLeftRight size={10} /> : <ArrowRight size={10} />}
          {isAR ? "Livraison + Restitution" : "Livraison simple"}
        </span>
        {isAR && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-100">
            <FileCheck2 size={10} /> 2 états des lieux
          </span>
        )}
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${missionLevelStyle(
            level,
          )}`}
        >
          {level}
        </span>
        {isElectric && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/60 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
            ⚡ Électrique
          </span>
        )}
        {fresh && (
          <span className="ml-auto inline-flex items-center rounded-full border border-emerald-400/60 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-100">
            Nouveau
          </span>
        )}
      </div>

      {/* Route */}
      {(() => {
        const retourLeg = (t.groupedLegs ?? []).find((l) => l.leg_type === "retour");
        const steps = [
          { k: "Prise en charge du véhicule", v: t.depart, c: "bg-emerald-400 ring-emerald-400/20" },
          { k: "Livraison du véhicule", v: t.arrivee, c: "bg-sky-400 ring-sky-400/20" },
          ...(isAR
            ? [
                {
                  k: "Restitution du véhicule",
                  v: retourLeg?.arrivee ?? t.depart,
                  c: "bg-amber-300 ring-amber-300/20",
                },
              ]
            : []),
        ];
        return (
          <div className="relative mt-3 flex items-stretch gap-3">
            <div className="flex flex-col items-center pt-1">
              {steps.map((s, i) => (
                <div key={s.k} className="flex flex-1 flex-col items-center">
                  {i > 0 && (
                    <span className="my-1 w-px flex-1 bg-gradient-to-b from-emerald-400/50 to-amber-300/50" />
                  )}
                  <span className={`h-3 w-3 rounded-full ring-4 ${s.c}`} />
                </div>
              ))}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {steps.map((s) => (
                <div key={s.k}>
                  <div className="text-[10px] uppercase tracking-wider text-white/50">
                    {s.k}
                  </div>
                  <div className="truncate text-sm font-semibold text-white">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}


      {/* Meta row */}
      <div className="relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-white/70">
        {t.date_trajet && (
          <span className="inline-flex items-center gap-1">
            <Calendar size={11} className="text-amber-300/80" />
            {new Date(t.date_trajet).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
            })}
          </span>
        )}
        {t.heure_trajet && (
          <span className="inline-flex items-center gap-1">
            <Clock size={11} className="text-amber-300/80" />
            {t.heure_trajet}
          </span>
        )}
        {typeof t.distance_km === "number" && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={11} className="text-amber-300/80" />
            {Math.round(t.distance_km)} km
          </span>
        )}
        {formatDuration(t.duree_estimee_min) && (
          <span className="inline-flex items-center gap-1">
            <Timer size={11} className="text-amber-300/80" />
            {formatDuration(t.duree_estimee_min)}
          </span>
        )}
        {(t.marque || t.modele) && (
          <span className="inline-flex items-center gap-1 truncate">
            <Car size={11} className="text-amber-300/80" />
            {[t.marque, t.modele].filter(Boolean).join(" ")}
          </span>
        )}
        {typeof t.kilometrage_estime === "number" && (
          <span className="text-white/50">
            · {t.kilometrage_estime.toLocaleString("fr-FR")} km au compteur
          </span>
        )}
      </div>

      {/* Distance from me + countdown */}
      {(distanceFromMe != null || countdown) && (
        <div className="relative mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          {distanceFromMe != null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/40 bg-sky-500/10 px-2 py-0.5 font-semibold text-sky-100">
              <Navigation size={10} />à {Math.round(distanceFromMe)} km de vous
            </span>
          )}
          {countdown && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${
                countdown === "Expirée"
                  ? "border-red-400/40 bg-red-500/15 text-red-200"
                  : "border-amber-300/40 bg-amber-500/10 text-amber-100"
              }`}
            >
              <Timer size={10} /> {countdown}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="relative mt-4 flex items-end justify-between border-t border-white/10 pt-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/50">
            Rémunération
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className="text-2xl font-black leading-none text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {price.toFixed(0)}
            </span>
            <Euro size={16} className="text-amber-300" />
          </div>
          {isAR && (
            <div className="mt-1 text-[10px] font-semibold text-amber-100/75">
              Mission complète · livraison + restitution
            </div>
          )}
        </div>

        {myOfferStatus ? (
          <div className="text-right">
            <MissionStatusBadge
              status={
                myOfferStatus === "contre_offre_admin" ? "propose" : myOfferStatus
              }
              short
            />
            {typeof myOfferPrice === "number" && (
              <div className="mt-1 text-[10px] text-white/60">
                {myOfferPrice.toFixed(0)} €
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (canApply) onQuickApply();
              }}
              disabled={!canApply}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/50 bg-gradient-to-b from-amber-300/20 to-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-100 shadow-[0_10px_25px_-12px_rgba(212,175,55,0.6)] transition-all hover:from-amber-300/30 hover:to-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={12} /> Postuler
            </button>
            <span className="text-[10px] text-white/50">ou voir détails →</span>
          </div>
        )}
      </div>
    </div>
  );
}
