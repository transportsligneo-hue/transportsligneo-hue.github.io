import { useEffect, useState } from "react";
import {
  X,
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
  Loader2,
  FileCheck2,
  ExternalLink,
  Info,
} from "lucide-react";
import { ReturnTripHelper } from "./ReturnTripHelper";
import type { CatalogTrajet } from "./CatalogueMissionCard";
import {
  inferMissionLevel,
  missionLevelStyle,
} from "@/lib/mission-level";

interface Props {
  trajet: CatalogTrajet;
  onClose: () => void;
  onSubmit: (price: number, message: string) => Promise<void> | void;
  canApply: boolean;
  submitting: boolean;
  distanceFromMe?: number | null;
}

function formatDuration(min?: number | null) {
  if (!min || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m.toString().padStart(2, "0")}`;
}

export function MissionDetailSheet({
  trajet: t,
  onClose,
  onSubmit,
  canApply,
  submitting,
  distanceFromMe,
}: Props) {
  const suggested =
    t.prix_convoyeur_fixe ?? t.prix_convoyeur ?? t.prix_suggere ?? 0;
  const [price, setPrice] = useState<string>(String(suggested || ""));
  const [msg, setMsg] = useState("");

  const isAR = !!t.leg_type && t.leg_type !== "simple";
  const urgent = t.urgence === "immediat" || t.urgence === "urgent";
  const level = inferMissionLevel({
    distanceKm: t.distance_km,
    urgence: t.urgence,
  });
  const isElectric =
    (t.type_carburant ?? "").toLowerCase().includes("électr") ||
    (t.type_carburant ?? "").toLowerCase().includes("electr");

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    t.depart,
  )}&destination=${encodeURIComponent(t.arrivee)}`;

  const submit = () => {
    const val = price ? Number(price) : suggested;
    if (!Number.isFinite(val) || val <= 0) return;
    void onSubmit(val, msg);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-white/10 bg-gradient-to-b from-[#0b1a44] via-[#060e28] to-[#030814] text-white shadow-[0_0_80px_rgba(0,0,0,0.6)] sm:animate-slide-in-right"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-gradient-to-b from-[#0b1a44]/95 to-[#0b1a44]/70 p-4 backdrop-blur-xl">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
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
                {isAR ? "Aller-retour" : "Aller simple"}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${missionLevelStyle(
                  level,
                )}`}
              >
                Niveau {level}
              </span>
              {isElectric && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/60 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                  ⚡ Électrique
                </span>
              )}
            </div>
            <h2
              className="mt-2 truncate text-lg font-bold"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {t.depart} → {t.arrivee}
            </h2>
            <div className="mt-0.5 text-[11px] text-white/60">
              Mission #{t.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 transition-colors hover:bg-white/10"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
          {/* Prix */}
          <div className="rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-300/10 to-transparent p-4">
            <div className="text-[10px] uppercase tracking-wider text-amber-200/80">
              Rémunération convoyeur
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span
                className="text-4xl font-black leading-none"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {suggested.toFixed(0)}
              </span>
              <Euro className="text-amber-300" size={22} />
              <span className="ml-2 text-[11px] text-white/60">
                {t.allow_counter_offer
                  ? "Contre-offre autorisée"
                  : "Tarif ferme"}
              </span>
            </div>
          </div>

          {/* Trajet */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/70">
              Trajet
            </h3>
            <div className="flex items-stretch gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className="h-3 w-3 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20" />
                <span className="my-1 w-px flex-1 bg-gradient-to-b from-emerald-400/60 to-amber-300/60" />
                <span className="h-3 w-3 rounded-full bg-amber-300 ring-4 ring-amber-300/20" />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/50">
                    Départ
                  </div>
                  <div className="text-sm font-semibold">{t.depart}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/50">
                    Arrivée
                  </div>
                  <div className="text-sm font-semibold">{t.arrivee}</div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
              {t.date_trajet && (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                  <div className="flex items-center gap-1.5 text-white/60">
                    <Calendar size={12} /> Date
                  </div>
                  <div className="mt-0.5 font-semibold">
                    {new Date(t.date_trajet).toLocaleDateString("fr-FR")}
                  </div>
                </div>
              )}
              {t.heure_trajet && (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                  <div className="flex items-center gap-1.5 text-white/60">
                    <Clock size={12} /> Heure
                  </div>
                  <div className="mt-0.5 font-semibold">{t.heure_trajet}</div>
                </div>
              )}
              {typeof t.distance_km === "number" && (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                  <div className="flex items-center gap-1.5 text-white/60">
                    <MapPin size={12} /> Distance
                  </div>
                  <div className="mt-0.5 font-semibold">
                    {Math.round(t.distance_km)} km
                  </div>
                </div>
              )}
              {formatDuration(t.duree_estimee_min) && (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                  <div className="flex items-center gap-1.5 text-white/60">
                    <Timer size={12} /> Durée
                  </div>
                  <div className="mt-0.5 font-semibold">
                    {formatDuration(t.duree_estimee_min)}
                  </div>
                </div>
              )}
              {distanceFromMe != null && (
                <div className="rounded-lg border border-sky-400/30 bg-sky-500/10 p-2 col-span-2">
                  <div className="flex items-center gap-1.5 text-sky-200/90">
                    <Navigation size={12} /> Depuis votre position
                  </div>
                  <div className="mt-0.5 font-semibold text-sky-100">
                    ~ {Math.round(distanceFromMe)} km
                  </div>
                </div>
              )}
            </div>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              <ExternalLink size={14} /> Ouvrir le trajet dans Google Maps
            </a>
          </section>

          {/* Véhicule */}
          {(t.marque || t.modele || t.kilometrage_estime || t.type_carburant) && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/70">
                Véhicule
              </h3>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-amber-300">
                  <Car size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">
                    {[t.marque, t.modele].filter(Boolean).join(" ") ||
                      "Véhicule à confirmer"}
                  </div>
                  <div className="mt-0.5 text-[11px] text-white/60">
                    {t.type_carburant ?? "Carburant non renseigné"}
                    {typeof t.kilometrage_estime === "number"
                      ? ` · ${t.kilometrage_estime.toLocaleString("fr-FR")} km`
                      : ""}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Docs / infos utiles */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/70">
              <FileCheck2 size={14} className="text-amber-300" />
              Documents & informations utiles
            </h3>
            <ul className="space-y-1.5 text-[12px] text-white/80">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-300" />
                Permis B en cours de validité
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-300" />
                Pièce d'identité originale
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-300" />
                Téléphone chargé (état des lieux photo + signature)
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-300" />
                Application Ligneo à jour pour scanner clés & documents
              </li>
              <li className="flex items-start gap-2">
                <Info size={12} className="mt-1 text-sky-300" />
                Respect strict du protocole d'inspection au départ et à l'arrivée.
              </li>
            </ul>
          </section>

          {/* Aide retour (aller simple uniquement) */}
          {!isAR && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <ReturnTripHelper depart={t.depart} arrivee={t.arrivee} />
            </section>
          )}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 border-t border-white/10 bg-gradient-to-t from-[#030814] to-[#030814]/85 p-4 backdrop-blur-xl">
          {canApply ? (
            <>
              <div className="mb-3 flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
                    {t.allow_counter_offer ? "Votre tarif (€)" : "Tarif imposé (€)"}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={price}
                    disabled={!t.allow_counter_offer}
                    onChange={(e) => setPrice(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-lg font-bold text-white outline-none focus:border-amber-300/60 disabled:opacity-70"
                  />
                </div>
                {t.allow_counter_offer && (
                  <div className="grid grid-cols-2 gap-1">
                    {[0, 10].map((inc) => (
                      <button
                        key={inc}
                        onClick={() => setPrice(String(suggested + inc))}
                        className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/10"
                      >
                        {inc === 0 ? "Tarif" : `+${inc}€`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {t.allow_counter_offer && (
                <textarea
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  rows={2}
                  placeholder="Message pour l'admin (facultatif)…"
                  className="mb-3 w-full resize-none rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs text-white outline-none placeholder:text-white/40 focus:border-amber-300/60"
                />
              )}
              <button
                onClick={submit}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/60 bg-gradient-to-b from-amber-300/25 to-amber-500/15 py-3 text-sm font-bold uppercase tracking-wider text-amber-50 shadow-[0_10px_30px_-12px_rgba(212,175,55,0.8)] transition-all hover:from-amber-300/35 hover:to-amber-500/25 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {t.allow_counter_offer && Number(price) !== suggested
                  ? "Envoyer ma contre-offre"
                  : "Accepter la mission"}
              </button>
            </>
          ) : (
            <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 text-center text-xs text-amber-100">
              Terminez votre formation et faites valider vos documents pour
              candidater à cette mission.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
