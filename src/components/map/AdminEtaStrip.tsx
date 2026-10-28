import { useState } from "react";
import { ChevronUp, Gauge, Clock, Activity, Coffee, Flag } from "lucide-react";
import { PlateBadge } from "@/components/plate/PlateBadge";
import { formatDureeMinutes, formatEta } from "@/lib/format-duration";
import { formatMinutesShort, formatDelta } from "@/lib/mission-live-metrics";
import type { LiveMetricsSnapshot } from "./types";

type Done = { arrivalTime: string; departTime: string | null; durMin: number; avg: number | null } | null;

/** Barre d'avancement « traits » : les traits parcourus s'allument en bleu néon, le trait courant pulse. */
export function EtaSegBar({ progress, left, right, mid }: { progress: number; left?: string; right?: string; mid?: string }) {
  const N = 44;
  const f = Math.max(0, Math.min(N, Math.round((progress / 100) * N)));
  return (
    <div className="ets-sg">
      <div className="ets-sg-t">
        <span className="ets-sg-b">
          {Array.from({ length: N }).map((_, i) => (
            <u key={i} className={i < f ? "on" : i === f ? "hd" : ""} style={{ ["--d" as string]: i < f ? f - i : 0 }} />
          ))}
        </span>
      </div>
      {(left || right) && (
        <div className="ets-sg-l">
          <span className="sd">{left}</span>
          {mid ? <span className="m">{mid}</span> : null}
          <span className="sa">{right}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Bandeau ETA admin posé en bas de la carte Mapbox (la carte elle-même n'est pas modifiée).
 * Données 100 % issues du suivi GPS réel (métriques calculées par la carte).
 */
export function AdminEtaStrip({
  metrics,
  etaDeltaMin,
  plate,
  origin,
  destination,
  departTime,
  completed,
  done,
  distanceKm,
  signalLost,
  milestone,
  waiting,
}: {
  metrics: Omit<LiveMetricsSnapshot, "nextMilestone"> | null;
  etaDeltaMin: number | null;
  plate?: string | null;
  origin?: string | null;
  destination?: string | null;
  departTime?: string | null;
  completed: boolean;
  done: Done;
  distanceKm: number;
  signalLost: boolean;
  milestone?: { label: string; inMinutes?: number | null; kind: string } | null;
  waiting?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const short = (s?: string | null) => (s ? s.split(",")[0].trim() : "");
  const km = (n: number) => (n < 10 ? n.toFixed(1) : String(Math.round(n)));

  let progress = 0;
  let arrival = "—";
  let remaining = "—";
  let third = { label: "Avancement", value: "0", unit: "%" };
  if (completed) {
    progress = 100;
    arrival = done?.arrivalTime ?? "—";
    remaining = "0";
    third = { label: "Durée", value: done && done.durMin > 0 ? formatDureeMinutes(done.durMin) : "—", unit: "" };
  } else if (metrics) {
    progress = metrics.progress;
    arrival = formatEta(metrics.etaAt);
    remaining = km(metrics.remainingKm);
    third = { label: "Avancement", value: String(metrics.progress), unit: "%" };
  }
  const delta = formatDelta(etaDeltaMin);
  const late = (etaDeltaMin ?? 0) > 15;

  return (
    <div className={`ets ${open ? "open" : ""}`}>
      <div className="ets-top">
        <div className="ets-id">
          {plate ? <PlateBadge plate={plate} size="sm" /> : null}
          {completed ? (
            <span className="ets-chip ok">Livrée</span>
          ) : waiting ? (
            <span className="ets-chip">En attente du signal GPS</span>
          ) : metrics ? (
            <span className={`ets-chip ${late ? "warn" : "ok"}`}>
              <i />
              {delta ? delta : "À l'heure"}
            </span>
          ) : null}
        </div>
        <div className="ets-road">
          <EtaSegBar
            progress={progress}
            left={[short(origin), departTime].filter(Boolean).join(" · ")}
            right={[short(destination), arrival !== "—" ? arrival : ""].filter(Boolean).join(" · ")}
            mid={!completed && metrics ? `${remaining} km restants` : undefined}
          />
        </div>
        <div className="ets-kpis">
          <div>
            <small>{completed ? "Arrivée" : "Arrivée estimée"}</small>
            <b className="neon">{arrival}</b>
          </div>
          <div>
            <small>Restant</small>
            <b className="neon">
              {remaining}
              <u>km</u>
            </b>
          </div>
          <div>
            <small>{third.label}</small>
            <b className="neon">
              {third.value}
              <u>{third.unit}</u>
            </b>
          </div>
        </div>
        {!waiting && (metrics || completed) ? (
          <button type="button" className="ets-tg" onClick={() => setOpen((o) => !o)} title="Afficher / masquer les détails">
            <ChevronUp size={15} />
          </button>
        ) : null}
      </div>

      {open && (metrics || completed) ? (
        <div className="ets-b">
          <Tile icon={<Clock size={12} />} label="Durée restante" value={metrics && !completed ? formatDureeMinutes(metrics.etaMin) : completed && done ? formatDureeMinutes(done.durMin) : "—"} />
          <Tile
            icon={<Gauge size={12} />}
            label={completed ? "Vitesse moyenne" : "Vitesse"}
            value={completed ? (done?.avg ? `${done.avg} km/h` : "—") : metrics && metrics.speedKmh > 1 ? `${Math.round(metrics.speedKmh)} km/h` : "—"}
          />
          <Tile icon={<Activity size={12} />} label="Distance" value={distanceKm >= 1 ? `${distanceKm >= 100 ? Math.round(distanceKm) : distanceKm.toFixed(1)} km` : "—"} />
          <Tile
            icon={<Coffee size={12} />}
            label="Arrêts"
            value={metrics && metrics.stoppedMin > 0 ? formatMinutesShort(metrics.stoppedMin) : "0 min"}
          />
          <Tile
            icon={<Activity size={12} />}
            label="Signal GPS"
            value={!metrics || completed ? "—" : metrics.signalAgeMin != null ? `il y a ${formatMinutesShort(metrics.signalAgeMin)}` : "—"}
            warn={signalLost && !completed}
          />
          <Tile
            icon={<Flag size={12} />}
            label="Prochaine étape"
            value={!completed && milestone ? milestone.label : "—"}
          />
        </div>
      ) : null}
    </div>
  );
}

function Tile({ icon, label, value, warn }: { icon: React.ReactNode; label: string; value: string; warn?: boolean }) {
  return (
    <div className={`ets-tile ${warn ? "warn" : ""}`}>
      <small>
        {icon}
        {label}
      </small>
      <b>{value}</b>
    </div>
  );
}

export default AdminEtaStrip;
