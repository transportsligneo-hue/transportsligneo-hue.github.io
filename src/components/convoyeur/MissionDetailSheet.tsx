import { useEffect, useState } from "react";
import {
  X, User, Calendar, Clock, Car, Lock, ShieldCheck,
  Minus, Plus, ChevronDown, Check, Coins, Info, Zap,
  FileCheck2, ArrowLeftRight,
} from "lucide-react";
import { ReturnTripHelper } from "./ReturnTripHelper";
import type { CatalogTrajet } from "./CatalogueMissionCard";
import { inferMissionLevel } from "@/lib/mission-level";
import { toast } from "sonner";
import { ElectricBadge } from "@/components/mission/ElectricBadge";
import { isElectricEnergie, guessElectricFromModel } from "@/lib/vehicule-electrique";
import { MissionPublisherChip } from "./MissionPublisherChip";


interface Props {
  trajet: CatalogTrajet;
  livraisonLabel?: string | null;
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
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export function MissionDetailSheet({
  trajet: t,
  livraisonLabel,
  onClose,
  onSubmit,
  canApply,
  submitting,
}: Props) {
  const suggested =
    t.prix_convoyeur_fixe ?? t.prix_convoyeur ?? t.prix_suggere ?? 0;
  const isAR = Boolean(t.isGroupedAr || (!!t.leg_type && t.leg_type !== "simple"));
  const arLegs = t.groupedLegs ?? (isAR ? [t] : []);
  const urgent = t.urgence === "immediat" || t.urgence === "urgent";
  const level = inferMissionLevel({
    distanceKm: t.distance_km,
    urgence: t.urgence,
  });
  const allowBid = !!t.allow_counter_offer;

  const [bidOpen, setBidOpen] = useState(false);
  const [bidPrice, setBidPrice] = useState<number>(suggested);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const submit = () => {
    const raw = bidOpen && allowBid ? bidPrice : suggested;
    const price = Number.isFinite(raw) && raw > 0 ? raw : suggested;
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Rémunération indisponible pour cette mission, contactez l'admin.");
      return;
    }
    void onSubmit(price, msg);
  };


  const delta = bidPrice - suggested;
  const deltaLabel =
    delta === 0 ? "au tarif" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)} €`;
  const dur = formatDuration(t.duree_estimee_min);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <style>{`
        @keyframes cat-payBorder{0%{background-position:0% 50%}100%{background-position:280% 50%}}
        @keyframes cat-pulseD{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes cat-secureScan{0%{left:-60%}50%{left:130%}100%{left:130%}}
        @keyframes cat-lockPulse{0%,100%{box-shadow:0 0 0 rgba(63,123,255,0)}50%{box-shadow:0 0 12px rgba(63,123,255,.5)}}
        @keyframes cat-ghostShine{0%{left:-70%}50%{left:130%}100%{left:130%}}
        @keyframes cat-borderDrift{0%,100%{background-position:0 0,0% 50%}50%{background-position:0 0,100% 50%}}
        @keyframes cat-shine{0%{left:-60%}45%{left:130%}100%{left:130%}}

        .cat-frame{background:linear-gradient(180deg,#e9f7f0 0%,#f4fbf7 45%,#f7fcf9 100%);color:#08243f}
        .cat-card{background:#fff;border:1px solid rgba(8,90,60,.14);border-radius:22px;padding:18px;margin-bottom:14px;box-shadow:0 10px 26px -16px rgba(8,90,60,.3)}
        .cat-pay{position:relative;background:#fff;padding:0;overflow:hidden}
                .cat-pay-inner{position:relative;padding:18px;border-radius:22px;background:linear-gradient(135deg,rgba(20,184,102,.07),rgba(255,255,255,0))}
        .cat-pulseD{animation:cat-pulseD 1.6s ease-in-out infinite}

        .cat-tl-line{position:absolute;left:5.5px;top:12px;bottom:12px;width:2px;
          background:repeating-linear-gradient(180deg,rgba(20,184,102,.45) 0 4px,transparent 4px 8px)}

        .cat-secure{position:relative;overflow:hidden;background:#f1f8f4;
          border:1px solid rgba(8,90,60,.14);border-radius:12px;padding:11px 12px}
        .cat-secure::after{content:'';position:absolute;top:0;left:-60%;width:45%;height:100%;
          background:linear-gradient(120deg,transparent,rgba(20,184,102,.35),transparent);
          transform:skewX(-20deg);animation:cat-secureScan 3.2s ease-in-out infinite}
        .cat-secure:nth-child(2)::after{animation-delay:.6s}
        .cat-secure-v{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:13.5px;font-weight:700;
          letter-spacing:2.5px;color:#3a5a58;filter:blur(3.2px);user-select:none}
        .cat-lock-ic{animation:cat-lockPulse 2.2s ease-in-out infinite}

        .cat-bid-toggle{position:relative;overflow:hidden;width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:13px 16px;border-radius:16px;font-size:14px;font-weight:700;color:#0b7a45;background:#fff;border:1.5px solid rgba(20,184,102,.45);transition:transform .2s}
        .cat-bid-toggle:active{transform:scale(.98)}
        
        .cat-confirm{position:relative;overflow:hidden;width:100%;text-align:center;padding:15px 26px;
          border-radius:16px;font-weight:800;font-size:16px;color:#04261a;
          background:linear-gradient(135deg,#14B866,#4FE8A0);
          box-shadow:0 12px 26px -10px rgba(20,184,102,.6);
          display:flex;align-items:center;justify-content:center;gap:9px;transition:transform .2s}
        .cat-confirm:active{transform:scale(.98)}
        .cat-confirm:disabled{opacity:.55;cursor:not-allowed}
        .cat-confirm::after{content:'';position:absolute;top:0;left:-60%;width:40%;height:100%;
          background:linear-gradient(120deg,transparent,rgba(255,255,255,.35),transparent);
          transform:skewX(-20deg);animation:cat-shine 3.4s ease-in-out infinite}
        .cat-chip{font-size:11.5px;font-weight:700;color:#0b7a45;background:rgba(20,184,102,.1);
          border:1px solid rgba(20,184,102,.35);padding:7px 14px;border-radius:999px;transition:transform .15s}
        .cat-chip:active{transform:scale(.94)}
        .cat-step{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;
          background:rgba(20,184,102,.1);border:1.4px solid rgba(20,184,102,.4);color:#0b7a45;transition:all .15s}
        .cat-step:active{transform:scale(.9);background:rgba(20,184,102,.22)}
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-[100dvh] max-h-[100dvh] w-full max-w-[440px] flex-col overflow-hidden text-[#08243f] shadow-[0_0_80px_rgba(0,0,0,.35)] sm:animate-slide-in-right cat-frame"
        style={{ fontFamily: "'Inter',sans-serif" }}
      >
        {/* Scrollable content */}
        <div
          className="min-h-0 flex-1 overflow-y-auto"
          style={{ paddingBottom: "calc(120px + env(safe-area-inset-bottom))" }}
        >

          {/* Topbar */}
          <div className="flex items-center justify-between px-[18px] pt-4 pb-1.5">
            <div className="flex gap-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider"
                style={{
                  background: "rgba(20,184,102,.1)",
                  border: "1px solid rgba(20,184,102,.35)",
                  color: "#3a5a58",
                }}
              >
                → {isAR ? "restitution et livraison" : "Livraison simple"}
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider"
                style={{
                  background: "rgba(20,184,102,.1)",
                  border: "1px solid rgba(20,184,102,.4)",
                  color: "#14B866",
                }}
              >
                Niveau {level}
              </span>
              {urgent && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-wider"
                  style={{
                    background: "rgba(239,68,68,.1)",
                    border: "1px solid rgba(239,68,68,.4)",
                    color: "#b42318",
                  }}
                >
                  <Zap size={11} /> Urgent
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="flex h-[38px] w-[38px] items-center justify-center rounded-xl text-[#08243f]"
              style={{
                background: "#fff",
                border: "1px solid rgba(20,184,102,.2)",
              }}
            >
              <X size={16} strokeWidth={2.4} />
            </button>
          </div>

          {/* Title */}
          <div className="px-5 pt-3.5 pb-4">
            <div
              className="text-[24px] leading-tight font-extrabold"
              style={{ fontFamily: "'Poppins',sans-serif" }}
            >
              {t.depart}
              <span style={{ color: "#0b7a45", margin: "0 6px" }}>
                {isAR ? "↔" : "→"}
              </span>
              {t.arrivee}
            </div>
            <div className="mt-1.5 text-[12.5px]" style={{ color: "#6a867e" }}>
              Mission #{t.id.slice(0, 8).toUpperCase()}
            </div>
            <div className="mt-3.5">
              <MissionPublisherChip
                nom={t.publisher_nom}
                logoUrl={t.publisher_logo_url}
                verifie={t.publisher_verifie}
              />
            </div>
          </div>

          <div className="px-[18px]">
            {/* Rémunération */}
            <div className="cat-card cat-pay">
              <div className="cat-pay-inner">
                <div
                  className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.1em]"
                  style={{ color: "#0b7a45", position: "relative" }}
                >
                  Rémunération convoyeur
                </div>
                <div className="flex items-baseline gap-2.5 relative">
                  <span
                    className="text-[44px] font-extrabold text-[#08243f] leading-none"
                    style={{
                      fontFamily: "'Poppins',sans-serif",
                      
                    }}
                  >
                    {suggested.toFixed(0)}
                  </span>
                  <span className="text-[12.5px]" style={{ color: "#6a867e" }}>
                    €
                  </span>
                </div>
                {allowBid && (
                  <div
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold"
                    style={{
                      color: "#0b7a45",
                      background: "rgba(20,184,102,.12)",
                      border: "1px solid rgba(20,184,102,.35)",
                    }}
                  >
                    <span
                      className="cat-pulseD"
                      style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: "#0b7a45", display: "inline-block",
                      }}
                    />
                    Contre-offre autorisée
                  </div>
                )}
              </div>
            </div>

            {/* Trajet */}
            <div className="cat-card">
              <div
                className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em]"
                style={{ color: "#6a867e" }}
              >
                Trajet
              </div>

              <div className="relative pl-1.5">
                <div className="cat-tl-line" />
                {(() => {
                  const retourLeg = (t.groupedLegs ?? []).find(
                    (l) => l.leg_type === "retour",
                  );
                  const fmt = (d?: string | null, h?: string | null) =>
                    [
                      d ? new Date(d).toLocaleDateString("fr-FR") : null,
                      h,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                  const steps = [
                    {
                      key: "Prise en charge du véhicule",
                      value: t.depart,
                      when: fmt(t.date_trajet, t.heure_trajet),
                      dot: "#14B866",
                    },
                    {
                      key: "Livraison du véhicule",
                      value: t.arrivee,
                      when: livraisonLabel ?? "",
                      dot: "#4f8cff",
                    },
                    ...(isAR
                      ? [
                          {
                            key: "Restitution du véhicule",
                            value: retourLeg?.arrivee ?? t.depart,
                            when: fmt(
                              retourLeg?.date_trajet,
                              retourLeg?.heure_trajet,
                            ),
                            dot: "#0b7a45",
                          },
                        ]
                      : []),
                  ];
                  return steps.map((row, i) => (
                  <div
                    key={row.key}
                    className={`relative flex gap-4 items-start ${i === steps.length - 1 ? "" : "mb-[18px]"}`}
                  >
                    <div
                      className="mt-[3px] flex-shrink-0 relative z-[1]"
                      style={{
                        width: 12, height: 12, borderRadius: "50%",
                        background: row.dot,
                        boxShadow: `0 0 10px ${row.dot}`,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className="mb-0.5 text-[10.5px] uppercase tracking-wider"
                        style={{ color: "#6a867e" }}
                      >
                        {row.key}
                      </div>
                      <div
                        className="text-[15.5px] font-bold leading-tight"
                        style={{ fontFamily: "'Space Grotesk',sans-serif" }}
                      >
                        {row.value}
                      </div>
                      {row.when && (
                        <div
                          className="mt-1 text-[11.5px] font-semibold"
                          style={{ color: "#0b7a45" }}
                        >
                          {row.when}
                        </div>
                      )}
                      <div
                        className="mt-1.5 flex items-center gap-1.5 text-[11.5px]"
                        style={{ color: "#6a867e" }}
                      >
                        <User size={12} style={{ color: "#4f8cff" }} />
                        Contact sur place communiqué à l'acceptation
                      </div>
                    </div>
                  </div>
                  ));
                })()}
              </div>


              {/* Stats trip */}
              {(typeof t.distance_km === "number" || dur || t.heure_trajet) && (
                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  {typeof t.distance_km === "number" && (
                    <TripStat k="Distance" v={`${Math.round(t.distance_km)} km`} />
                  )}
                  {dur && <TripStat k="Durée est." v={dur} />}
                  {t.heure_trajet && <TripStat k="Créneau" v={t.heure_trajet} />}
                </div>
              )}

              {/* Date / Heure */}
              {(t.date_trajet || t.heure_trajet) && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {t.date_trajet && (
                    <DtField
                      icon={<Calendar size={16} />}
                      k="Date"
                      v={new Date(t.date_trajet).toLocaleDateString("fr-FR")}
                    />
                  )}
                  {t.heure_trajet && (
                    <DtField
                      icon={<Clock size={16} />}
                      k="Heure prévue"
                      v={t.heure_trajet}
                    />
                  )}
                </div>
              )}
            </div>

            {isAR && (
              <div className="cat-card">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div
                    className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em]"
                    style={{ color: "#0b7a45" }}
                  >
                    <ArrowLeftRight size={15} /> Mission liée
                  </div>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      background: "rgba(20,184,102,.13)",
                      border: "1px solid rgba(20,184,102,.36)",
                      color: "#0b7a45",
                    }}
                  >
                    <FileCheck2 size={11} /> 2 EDL
                  </span>
                </div>
                <div className="space-y-2.5">
                  {(arLegs.length > 0 ? arLegs : [t]).map((leg, index) => {
                    const label = leg.leg_type === "retour" ? "Restitution" : "Livraison";
                    const amount = leg.prix_convoyeur_fixe ?? leg.prix_convoyeur ?? leg.prix_suggere;
                    return (
                      <div
                        key={`${leg.id}-${index}`}
                        className="rounded-2xl px-3.5 py-3"
                        style={{
                          background: "#f1f8f4",
                          border: "1px solid rgba(8,90,60,.12)",
                        }}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#3a5a58" }}>
                            {label}
                          </span>
                          {typeof amount === "number" && (
                            <span className="text-[11px] font-bold" style={{ color: "#0b7a45" }}>
                              {amount.toFixed(0)} €
                            </span>
                          )}
                        </div>
                        <div className="text-[13px] font-semibold leading-snug" style={{ color: "#08243f" }}>
                          {leg.depart} <span style={{ color: "#0b7a45" }}>→</span> {leg.arrivee}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-start gap-2 text-[12px]" style={{ color: "#6a867e" }}>
                  <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#4f8cff" }} />
                  Une seule candidature pour la mission complète ; deux états des lieux seront réalisés séparément.
                </div>
              </div>
            )}

            {/* Véhicule */}
            <div className="cat-card">
              <div
                className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em]"
                style={{ color: "#6a867e" }}
              >
                Véhicule
              </div>
              <div className="flex items-center gap-3.5">
                <span
                  className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg,rgba(20,184,102,.18),rgba(20,184,102,.05))",
                    border: "1px solid rgba(20,184,102,.35)",
                  }}
                >
                  <Car size={24} style={{ color: "#0b7a45" }} />
                </span>
                <div>
                  <div
                    className="text-[16px] font-bold flex items-center gap-2 flex-wrap"
                    style={{ fontFamily: "'Space Grotesk',sans-serif" }}
                  >
                    {[t.marque, t.modele].filter(Boolean).join(" ") ||
                      "Véhicule à confirmer"}
                    <ElectricBadge
                      force={isElectricEnergie(t.type_carburant) || guessElectricFromModel(t.marque, t.modele)}
                    />
                  </div>
                  <div className="mt-0.5 text-[12px]" style={{ color: "#6a867e" }}>
                    {t.type_carburant ?? "Détails communiqués à l'acceptation"}
                  </div>
                </div>
              </div>

              {/* Identification sécurisée */}
              <div
                className="mt-3.5 pt-3.5"
                style={{ borderTop: "1px solid rgba(8,90,60,.12)" }}
              >
                <div
                  className="mb-3 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider"
                  style={{ color: "#4f8cff" }}
                >
                  <Lock size={13} />
                  Identification véhicule
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="cat-secure">
                    <div
                      className="mb-1.5 text-[9px] uppercase tracking-wider"
                      style={{ color: "#6a867e" }}
                    >
                      Plaque
                    </div>
                    <div className="cat-secure-v">AB–123–CD</div>
                  </div>
                  <div className="cat-secure">
                    <div
                      className="mb-1.5 text-[9px] uppercase tracking-wider"
                      style={{ color: "#6a867e" }}
                    >
                      N° VIN
                    </div>
                    <div className="cat-secure-v">VF7•••••••912</div>
                  </div>
                </div>
                <div
                  className="mt-3 flex items-center gap-2 text-[10.3px]"
                  style={{ color: "#4f8cff" }}
                >
                  <span
                    className="cat-lock-ic flex h-[22px] w-[22px] items-center justify-center rounded-full flex-shrink-0"
                    style={{
                      background: "rgba(63,123,255,.16)",
                      border: "1px solid rgba(20,184,102,.4)",
                    }}
                  >
                    <ShieldCheck size={11} />
                  </span>
                  Visibles dès l'acceptation de la mission
                </div>
              </div>
            </div>

            {/* Documents */}
            <div className="cat-card">
              <div
                className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em]"
                style={{ color: "#6a867e" }}
              >
                Documents &amp; informations utiles
              </div>
              {[
                "Permis B en cours de validité",
                "Pièce d'identité originale",
                "Gilet jaune obligatoire pour la récupération sur parc auto",
                "Tenue correcte exigée (survêtement proscrit)",
                "Housse de protection pour trottinette (éviter de salir le coffre du véhicule)",
                "Téléphone chargé (état des lieux photo + signature)",
                "Application Ligneo à jour pour scanner clés & documents",
              ].map((line) => (
                <div key={line} className="mb-3 flex items-start gap-2.5 text-[13px] leading-snug" style={{ color: "#08243f" }}>
                  <span
                    className="mt-1.5 flex-shrink-0"
                    style={{ width: 7, height: 7, borderRadius: "50%", background: "#0b7a45" }}
                  />
                  {line}
                </div>
              ))}
              <div className="flex items-start gap-2.5 text-[12px] italic" style={{ color: "#6a867e" }}>
                <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#4f8cff" }} />
                Respect strict du protocole d'inspection au départ et à l'arrivée.
              </div>
            </div>

            {/* Retour (aller simple uniquement) */}
            {!isAR && (
              <div className="cat-card">
                <ReturnTripHelper livraison={t.arrivee} vehicule={[t.marque, t.modele].filter(Boolean).join(" ")} electrique={isElectricEnergie(t.type_carburant) || guessElectricFromModel(t.marque, t.modele)} />
              </div>
            )}
          </div>
        </div>

        {/* Bottom sticky panel */}
        <div
          className="relative z-20 shrink-0 max-h-[70dvh] overflow-y-auto px-[18px] pt-4"
          style={{
            background: "rgba(255,255,255,.97)",
            backdropFilter: "blur(18px)",
            borderTop: "1px solid rgba(8,90,60,.14)",
            boxShadow: "0 -10px 30px rgba(8,90,60,.12)",
            paddingBottom: "calc(18px + env(safe-area-inset-bottom))",
          }}
        >

          {canApply ? (
            <>
              {/* Toggle contre-offre — visible SEULEMENT si allow_counter_offer */}
              {allowBid && (
                <button
                  type="button"
                  onClick={() => setBidOpen((v) => !v)}
                  className="cat-bid-toggle mb-3"
                >
                  <Coins
                    size={15}
                    style={{
                      color: "#0b7a45",
                      
                    }}
                  />
                  Faire une contre-offre
                  <ChevronDown
                    size={13}
                    strokeWidth={2.6}
                    style={{
                      transform: bidOpen ? "rotate(180deg)" : "none",
                      transition: "transform .3s",
                    }}
                  />
                </button>
              )}

              {/* Bid panel accordéon */}
              {allowBid && (
                <div
                  style={{
                    maxHeight: bidOpen ? 420 : 0,
                    opacity: bidOpen ? 1 : 0,
                    overflow: "hidden",
                    transition: "max-height .4s cubic-bezier(.4,0,.2,1),opacity .3s",
                    marginBottom: bidOpen ? 14 : 0,
                  }}
                >
                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: "#f1f8f4",
                      border: "1px solid rgba(20,184,102,.25)",
                    }}
                  >
                    <div className="mb-3.5 flex items-center justify-between">
                      <span
                        className="text-[10.5px] font-bold uppercase tracking-wider"
                        style={{ color: "#6a867e" }}
                      >
                        Votre contre-offre
                      </span>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9.5px] font-bold"
                        style={{
                          color: "#0b7a45",
                          background: "rgba(20,184,102,.14)",
                          border: "1px solid rgba(20,184,102,.35)",
                        }}
                      >
                        <span
                          className="cat-pulseD"
                          style={{
                            width: 5, height: 5, borderRadius: "50%",
                            background: "#0b7a45", display: "inline-block",
                          }}
                        />
                        Enchère activée
                      </span>
                    </div>

                    <div className="mb-2.5 flex items-center justify-center gap-[18px]">
                      <button
                        type="button"
                        className="cat-step"
                        onClick={() => setBidPrice((p) => Math.max(1, p - 5))}
                      >
                        <Minus size={18} strokeWidth={2.6} />
                      </button>
                      <div className="text-center">
                        <div
                          className="text-[32px] font-extrabold leading-none text-[#08243f]"
                          style={{
                            fontFamily: "'Poppins',sans-serif",
                            
                          }}
                        >
                          {bidPrice}
                          <span
                            className="ml-1 text-[19px]"
                            style={{ color: "#0b7a45" }}
                          >
                            €
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="cat-step"
                        onClick={() => setBidPrice((p) => p + 5)}
                      >
                        <Plus size={18} strokeWidth={2.6} />
                      </button>
                    </div>

                    <div
                      className="mb-3.5 text-center text-[11px]"
                      style={{ color: "#6a867e" }}
                    >
                      Tarif de base <b>{suggested} €</b> · votre offre{" "}
                      <span
                        style={{
                          color: delta === 0 ? "#6a867e" : delta > 0 ? "#14B866" : "#b42318",
                          fontWeight: 700,
                        }}
                      >
                        {deltaLabel}
                      </span>
                    </div>

                    <div className="flex justify-center gap-2">
                      {[5, 10, 20].map((inc) => (
                        <button
                          key={inc}
                          type="button"
                          className="cat-chip"
                          onClick={() => setBidPrice((p) => p + inc)}
                        >
                          +{inc} €
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Message admin (facultatif) */}
              <input
                type="text"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="Message pour l'admin (facultatif)…"
                className="mb-3 w-full rounded-2xl px-3.5 py-[11px] text-[12.5px] italic outline-none"
                style={{
                  background: "#f1f8f4",
                  border: "1px solid rgba(20,184,102,.22)",
                  color: "#08243f",
                }}
              />

              {/* Confirmer la mission */}
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="cat-confirm"
              >
                {!submitting && <Check size={17} strokeWidth={2.6} />}
                {submitting ? "Envoi en cours…" : bidOpen && allowBid ? "Envoyer ma contre-offre" : "Accepter la mission"}
              </button>
              <div
                className="mt-2 text-center text-[10.5px]"
                style={{ color: "#6a867e" }}
              >
                Vous serez notifié dès validation par l'admin
              </div>
            </>
          ) : (
            <div
              className="rounded-2xl p-3.5 text-center text-[12px]"
              style={{
                background: "rgba(20,184,102,.1)",
                border: "1px solid rgba(20,184,102,.35)",
                color: "#0b7a45",
              }}
            >
              Terminez votre formation et faites valider vos documents pour
              candidater à cette mission.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TripStat({ k, v }: { k: string; v: string }) {
  return (
    <div
      className="rounded-xl text-center px-2 py-2.5"
      style={{
        background: "#f1f8f4",
        border: "1px solid rgba(8,90,60,.12)",
      }}
    >
      <div
        className="mb-1 text-[9px] uppercase tracking-wider"
        style={{ color: "#6a867e" }}
      >
        {k}
      </div>
      <div
        className="text-[14px] font-bold"
        style={{ fontFamily: "'Space Grotesk',sans-serif" }}
      >
        {v}
      </div>
    </div>
  );
}

function DtField({
  icon, k, v,
}: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-2xl px-3.5 py-3"
      style={{
        background: "#f1f8f4",
        border: "1px solid rgba(8,90,60,.12)",
      }}
    >
      <span style={{ color: "#4f8cff" }} className="flex-shrink-0">
        {icon}
      </span>
      <div>
        <div
          className="text-[10px] uppercase tracking-wider"
          style={{ color: "#6a867e" }}
        >
          {k}
        </div>
        <div className="text-[13.5px] font-bold">{v}</div>
      </div>
    </div>
  );
}
