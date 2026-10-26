import { useEffect, useRef, useState, type ReactNode } from "react";
import PlacesInput from "@/components/PlacesInput";
import { GoogleG } from "@/components/mobile/MobileIcons";
import { GOOGLE_RATING } from "@/lib/google-reviews";
import { BlockHint } from "@/components/devis/BlockHint";

/**
 * Estimateur « La ligne » (accueil, variante flat-mini).
 * Aucune logique métier ici : tout l'état et le calcul du prix restent dans DevisGenerator,
 * ce composant ne fait que l'afficher (même `priceTTC`, mêmes setters, même CTA).
 */

type Option = "aller-simple" | "aller-retour" | "express";
type Pop = "veh" | "dt" | "tm" | null;

export interface EstimatorLineProps {
  inputId: string;
  /** Titre (par défaut « Calculez votre prix en 30 secondes »). */
  title?: ReactNode;
  departure: string; setDeparture: (v: string) => void;
  arrival: string; setArrival: (v: string) => void;
  vehicleType: string; setVehicleType: (v: string) => void;
  vehicleTypes: { value: string; label: string }[];
  date: string; setDate: (v: string) => void;
  heure: string; setHeure: (v: string) => void;
  option: Option; setOption: (o: Option) => void;
  priceTTC: number;
  priceHT: number;
  microRegime: boolean;
  hasPrice: boolean;
  distance: number | null;
  distanceLoading: boolean;
  offHours: boolean;
  canContinue: boolean;
  /** Pourquoi « Continuer » est grisé (champ manquant, délai < 12 h…). */
  blockReason?: string;
  onContinue: () => void;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDate = (v: string) => {
  if (!v) return "";
  const d = new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
};
const fmtTime = (v: string) => {
  if (!v) return "";
  const [h, m] = v.split(":");
  const hh = parseInt(h ?? "", 10);
  if (Number.isNaN(hh)) return v;
  return `${hh}h${m && m !== "00" ? m : ""}`;
};

/** Compteur animé du prix (purement visuel : la valeur finale est toujours `target`). */
function useCountUp(target: number, active: boolean) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!active) { from.current = 0; setShown(0); return; }
    const start = from.current;
    let raf = 0; let t0 = 0;
    const step = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / 800);
      const e = 1 - Math.pow(1 - p, 3);
      const v = Math.round(start + (target - start) * e);
      from.current = v; setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return shown;
}

export default function EstimatorLine(p: EstimatorLineProps) {
  const [open, setOpen] = useState<Pop>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const today = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, []);

  const on = p.hasPrice;
  const shown = useCountUp(p.priceTTC, on);
  const toggle = (k: Exclude<Pop, null>) => setOpen((o) => (o === k ? null : k));
  const next = (k: Exclude<Pop, null>) => { setOpen(null); window.setTimeout(() => setOpen(k), 120); };

  const vehLabel = p.vehicleTypes.find((v) => v.value === p.vehicleType)?.label ?? "";
  const eur = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
  const sub = on
    ? <>{eur(p.priceHT)} € HT · <b>{eur(p.priceTTC)} € TTC</b></>
    : p.distanceLoading
      ? "Calcul de la distance…"
      : p.departure && p.arrival && p.distance === null
        ? "Tarif confirmé après étude de votre trajet"
        : "Saisissez votre trajet · tarif tout de suite";

  const pillProps = (k: Exclude<Pop, null>, cls: string, set: boolean) => ({
    className: `zx-pill ${cls}${set ? " set" : ""}${open === k ? " open" : ""}`,
    role: "button" as const,
    tabIndex: 0,
    "aria-haspopup": "dialog" as const,
    "aria-expanded": open === k,
    onClick: () => toggle(k),
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(k); } },
  });
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  // calendrier
  const first = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7;
  const nbDays = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();

  return (
    <div ref={rootRef} className={`zx${on ? " on" : ""}${on && p.offHours ? " off" : ""}`}>
      {open && <div className="zx-back" aria-hidden="true" onClick={() => setOpen(null)} />}
      <div className="zx-top">
        <h2 className="zx-title"><span className="zx-eye"><i />Prix immédiat</span>{p.title ?? <>Calculez votre prix en <b>30 secondes</b></>}</h2>
        <div className="zx-seg">
          <button type="button" className={p.option !== "aller-retour" ? "on" : ""} onClick={() => p.setOption("aller-simple")}>Livraison simple</button>
          <button type="button" className={p.option === "aller-retour" ? "on" : ""} onClick={() => p.setOption("aller-retour")}>Restitution et livraison</button>
        </div>
      </div>

      <div className="zx-line">
        <div className="zx-pt a">
          <span onClick={() => document.getElementById(`${p.inputId}-departure`)?.focus()}>Départ</span>
          <PlacesInput
            inputId={`${p.inputId}-departure`}
            value={p.departure}
            onChange={p.setDeparture}
            placeholder="Adresse de départ complète"
            dropdownClassName="tln-places-menu absolute z-[70] left-0 right-0 top-full mt-2 rounded-xl max-h-72 overflow-y-auto"
          />
        </div>
        <div className="zx-route"><i />{p.distance != null && p.distance > 0 && <em className="zx-km">{p.distance} km</em>}</div>
        <div className="zx-pt b">
          <span onClick={() => document.getElementById(`${p.inputId}-arrival`)?.focus()}>Arrivée</span>
          <PlacesInput
            inputId={`${p.inputId}-arrival`}
            value={p.arrival}
            onChange={p.setArrival}
            placeholder="Adresse d'arrivée complète"
            dropdownClassName="tln-places-menu absolute z-[70] left-0 right-0 top-full mt-2 rounded-xl max-h-72 overflow-y-auto"
          />
        </div>
      </div>

      <div className="zx-bot">
        {/* Véhicule */}
        <div {...pillProps("veh", "veh", !!p.vehicleType)}>
          <span>Véhicule</span>
          <b className={`zx-val${vehLabel ? "" : " ph"}`}>{vehLabel || "Choisir"}</b>
          <div className="zx-pop" onClick={stop} onKeyDown={stop}>
            <button type="button" className="zx-x" aria-label="Fermer" onClick={() => setOpen(null)}>×</button>
            <h4>Type de véhicule</h4>
            <div className="zx-grid zx-vg">
              {p.vehicleTypes.map((v) => (
                <button key={v.value} type="button" className={`zx-opt${p.vehicleType === v.value ? " sel" : ""}`}
                  onClick={() => { p.setVehicleType(v.value); next("dt"); }}>{v.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Date de livraison */}
        <div {...pillProps("dt", "dt", !!p.date)}>
          <span>Date de livraison</span>
          <b className={`zx-val${p.date ? "" : " ph"}`}>{fmtDate(p.date) || "Choisir"}</b>
          <div className="zx-pop" onClick={stop} onKeyDown={stop}>
            <button type="button" className="zx-x" aria-label="Fermer" onClick={() => setOpen(null)}>×</button>
            <h4>Date de livraison souhaitée</h4>
            <div className="zx-qd">
              {([["Aujourd’hui", 0], ["Demain", 1], ["Après-demain", 2]] as const).map(([l, n]) => {
                const d = new Date(today); d.setDate(d.getDate() + n);
                return <button key={l} type="button" className={`zx-opt${p.date === iso(d) ? " sel" : ""}`}
                  onClick={() => { p.setDate(iso(d)); next("tm"); }}>{l}</button>;
              })}
            </div>
            <div className="zx-cal">
              <div className="zx-cal-h">
                <button type="button" aria-label="Mois précédent" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>‹</button>
                <span>{view.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span>
                <button type="button" aria-label="Mois suivant" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>›</button>
              </div>
              <div className="zx-cal-g">
                {["L", "M", "M", "J", "V", "S", "D"].map((x, i) => <i key={i}>{x}</i>)}
                {Array.from({ length: first }).map((_, i) => <span key={`e${i}`} />)}
                {Array.from({ length: nbDays }).map((_, i) => {
                  const d = new Date(view.getFullYear(), view.getMonth(), i + 1);
                  const v = iso(d);
                  return <button key={v} type="button" disabled={d < today}
                    className={`zx-opt${v === iso(today) ? " today" : ""}${p.date === v ? " sel" : ""}`}
                    onClick={() => { p.setDate(v); next("tm"); }}>{i + 1}</button>;
                })}
              </div>
            </div>
            <p className="zx-note">Week-end : <b>+30 %</b> déjà inclus dans le prix.</p>
          </div>
        </div>

        {/* Heure de livraison */}
        <div {...pillProps("tm", "tm", !!p.heure)}>
          <span>Heure de livraison</span>
          <b className={`zx-val${p.heure ? "" : " ph"}`}>{fmtTime(p.heure) || "Choisir"}</b>
          <div className="zx-pop" onClick={stop} onKeyDown={stop}>
            <button type="button" className="zx-x" aria-label="Fermer" onClick={() => setOpen(null)}>×</button>
            <h4>Heure de livraison souhaitée</h4>
            <div className="zx-grid zx-tg">
              {Array.from({ length: 27 }).map((_, i) => {
                const m = 7 * 60 + i * 30; const hh = Math.floor(m / 60); const mm = m % 60;
                const v = `${pad(hh)}:${pad(mm)}`;
                return (
                  <button key={v} type="button" className={`zx-opt${p.heure === v ? " sel" : ""}`}
                    onClick={() => { p.setHeure(v); setOpen(null); }}>
                    {hh}h{mm ? pad(mm) : ""}
                    {(hh < 8 || hh >= 19) && <span className="pl">+30%</span>}
                  </button>
                );
              })}
            </div>
            <p className="zx-note">Avant 8h et après 19h : <b>+30 %</b> déjà inclus dans le prix.</p>
          </div>
        </div>

        <div className="zx-sp" />

        <div className="zx-price" aria-live="polite">
          {p.blockReason && !p.canContinue && <BlockHint text={p.blockReason} />}
          <span>Votre estimation</span>
          <strong><b style={{ font: "inherit" }}>{on ? shown : "—"}</b><small>€</small></strong>
          <em>{sub}</em>
          {on && <em className="zx-incl">péages, carburant, assurance inclus</em>}
        </div>
        <button type="button" className="zx-go" disabled={!p.canContinue} onClick={p.onContinue} aria-label="Continuer vers mon devis">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
        </button>
      </div>

      <div className="zx-foot">
        <a className="zx-gr" href="https://www.google.com/maps/search/?api=1&query=Transports%20Ligneo%20Tours" target="_blank" rel="noopener noreferrer" aria-label={`Note Google : ${String(GOOGLE_RATING).replace(".", ",")} sur 5, voir les avis`}>
          <GoogleG size={22} />
          <b>{String(GOOGLE_RATING).replace(".", ",")}<small>/5</small></b>
          <svg className="zx-gr-st" viewBox="0 0 90 16" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <path key={i} transform={`translate(${i * 18} 0)`} fill="#FBBC04" d="M8 .8l2.2 4.7 5.1.6-3.8 3.5 1 5.1L8 12.2 3.5 14.7l1-5.1L.7 6.1l5.1-.6z" />
            ))}
          </svg>
          <em>Avis Google</em>
        </a>
        <span>Assurance, carburant &amp; péages inclus</span>
        <span>Disponible 7j/7</span>
        <span>Aucun frais caché</span>
        <span>Réponse immédiate</span>
        <b className="zx-tag">+30 % hors horaires inclus</b>
      </div>
    </div>
  );
}
