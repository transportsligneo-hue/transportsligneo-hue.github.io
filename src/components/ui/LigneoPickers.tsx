import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "@/styles-ligneo-pickers.css";

/**
 * Sélecteurs unifiés (date, heure, type de véhicule) — même rendu que l'estimateur de l'accueil.
 *
 * Fonctionne par interception : tout <input type="date|time"> et tout <select> « type de véhicule »
 * du site ouvre ce panneau à la place du sélecteur natif, puis réécrit la valeur de façon compatible React.
 * Aucune modification des formulaires : le state, les validations et les envois restent identiques.
 * Exclusions : app chauffeur (body.is-driver-app), éléments avec data-native-picker, champs désactivés.
 */

type Kind = "date" | "time" | "veh";
interface Target { el: HTMLInputElement | HTMLSelectElement; kind: Kind }

const VEH_RE = /^(citadine|berline|break|suv|monospace|coupe|cabriolet|utilitaire|luxe|autre)$/i;
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function kindOf(el: Element | null): Kind | null {
  if (!el) return null;
  if (el instanceof HTMLInputElement) {
    if (el.type === "date") return "date";
    if (el.type === "time") return "time";
    return null;
  }
  if (el instanceof HTMLSelectElement && !el.multiple) {
    const vals = Array.from(el.options).map((o) => o.value).filter(Boolean);
    if (vals.length >= 3 && vals.filter((v) => VEH_RE.test(v)).length >= 3) return "veh";
  }
  return null;
}

function eligible(el: Element | null): Target | null {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return null;
  if (typeof document === "undefined") return null;
  if (document.body.classList.contains("is-driver-app")) return null;
  if (el.disabled || (el as HTMLInputElement).readOnly) return null;
  if (el.closest("[data-native-picker], .lgpk")) return null;
  const kind = kindOf(el);
  return kind ? { el, kind } : null;
}

function setNative(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function LigneoPickers() {
  const [t, setT] = useState<Target | null>(null);

  useEffect(() => {
    const open = (e: Event) => {
      const target = eligible(e.target as Element);
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      (target.el as HTMLElement).blur?.();
      setT(target);
    };
    const swallow = (e: Event) => {
      if (eligible(e.target as Element)) { e.preventDefault(); }
    };
    const key = (e: KeyboardEvent) => {
      const tg = eligible(e.target as Element);
      if (tg && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) { e.preventDefault(); setT(tg); }
    };
    document.addEventListener("pointerdown", swallow, true);
    document.addEventListener("mousedown", swallow, true);
    document.addEventListener("click", open, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", swallow, true);
      document.removeEventListener("mousedown", swallow, true);
      document.removeEventListener("click", open, true);
      document.removeEventListener("keydown", key, true);
    };
  }, []);

  if (!t || typeof document === "undefined") return null;
  return createPortal(<Sheet target={t} onClose={() => setT(null)} />, document.body);
}

function Sheet({ target, onClose }: { target: Target; onClose: () => void }) {
  const { el, kind } = target;
  const [value, setValue] = useState(el.value);
  const commit = (v: string, close = true) => { setValue(v); setNative(el, v); if (close) onClose(); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);

  const labelEl = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : el.closest("label");
  const labelTxt = (labelEl?.textContent ?? "").replace(/\*/g, "").trim();

  return (
    <div className="lgpk" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lgpk-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="lgpk-grip" aria-hidden="true" />
        <button type="button" className="lgpk-x" onClick={onClose} aria-label="Fermer">×</button>
        {kind === "date" && <DatePane el={el as HTMLInputElement} value={value} commit={commit} title={labelTxt || "Date"} />}
        {kind === "time" && <TimePane el={el as HTMLInputElement} value={value} commit={commit} title={labelTxt || "Heure"} />}
        {kind === "veh" && <VehPane el={el as HTMLSelectElement} value={value} commit={commit} title={labelTxt || "Type de véhicule"} />}
      </div>
    </div>
  );
}

type PaneProps<E> = { el: E; value: string; commit: (v: string, close?: boolean) => void; title: string };

function DatePane({ el, value, commit, title }: PaneProps<HTMLInputElement>) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const base = value ? new Date(`${value}T12:00:00`) : today;
  const [view, setView] = useState(() => new Date(base.getFullYear(), base.getMonth(), 1));
  const min = el.min || "";
  const max = el.max || "";
  const ok = (v: string) => (!min || v >= min) && (!max || v <= max);
  const first = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7;
  const nb = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  return (
    <>
      <h4 className="lgpk-h">{title}</h4>
      <div className="lgpk-qd">
        {([["Aujourd’hui", 0], ["Demain", 1], ["Après-demain", 2]] as const).map(([l, n]) => {
          const d = new Date(today); d.setDate(d.getDate() + n); const v = iso(d);
          return <button key={l} type="button" disabled={!ok(v)} className={`lgpk-opt${value === v ? " sel" : ""}`} onClick={() => commit(v)}>{l}</button>;
        })}
      </div>
      <div className="lgpk-cal-h">
        <button type="button" aria-label="Mois précédent" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>‹</button>
        <span>{view.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span>
        <button type="button" aria-label="Mois suivant" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>›</button>
      </div>
      <div className="lgpk-cal">
        {["L", "M", "M", "J", "V", "S", "D"].map((x, i) => <i key={i}>{x}</i>)}
        {Array.from({ length: first }).map((_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: nb }).map((_, i) => {
          const v = iso(new Date(view.getFullYear(), view.getMonth(), i + 1));
          return <button key={v} type="button" disabled={!ok(v)} className={`lgpk-opt${v === iso(today) ? " today" : ""}${value === v ? " sel" : ""}`} onClick={() => commit(v)}>{i + 1}</button>;
        })}
      </div>
      <p className="lgpk-note">Week-end : <b>+30 %</b> déjà inclus dans le prix.</p>
      {value && !el.required && <button type="button" className="lgpk-clear" onClick={() => commit("")}>Effacer la date</button>}
    </>
  );
}

function TimePane({ el, value, commit, title }: PaneProps<HTMLInputElement>) {
  const slots = useMemo(() => Array.from({ length: 38 }, (_, i) => { const m = 5 * 60 + i * 30; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }), []);
  const free = useRef<HTMLInputElement>(null);
  return (
    <>
      <h4 className="lgpk-h">{title}</h4>
      <div className="lgpk-tg">
        {slots.map((v) => {
          const hh = parseInt(v, 10); const mm = v.slice(3);
          return (
            <button key={v} type="button" className={`lgpk-opt${value === v ? " sel" : ""}`} onClick={() => commit(v)}>
              {hh}h{mm === "00" ? "" : mm}
              {(hh < 8 || hh >= 19) && <span className="pl">+30%</span>}
            </button>
          );
        })}
      </div>
      <div className="lgpk-free" data-native-picker>
        <label>Autre heure</label>
        <input ref={free} type="text" inputMode="numeric" placeholder="ex. 14:45" defaultValue={value && !slots.includes(value) ? value : ""}
          onKeyDown={(e) => { if (e.key === "Enter") { const m = /^(\d{1,2})[:h]?(\d{2})?$/.exec(e.currentTarget.value.trim()); if (m && +m[1] < 24) commit(`${pad(+m[1])}:${m[2] ?? "00"}`); } }} />
        <button type="button" onClick={() => { const m = /^(\d{1,2})[:h]?(\d{2})?$/.exec((free.current?.value ?? "").trim()); if (m && +m[1] < 24 && +(m[2] ?? 0) < 60) commit(`${pad(+m[1])}:${m[2] ?? "00"}`); }}>OK</button>
      </div>
      <p className="lgpk-note">Avant 8h et après 19h : <b>+30 %</b> déjà inclus dans le prix.</p>
    </>
  );
}

function VehPane({ el, value, commit, title }: PaneProps<HTMLSelectElement>) {
  const opts = Array.from(el.options).filter((o) => o.value !== "");
  return (
    <>
      <h4 className="lgpk-h">{title}</h4>
      <div className="lgpk-vg">
        {opts.map((o) => (
          <button key={o.value} type="button" disabled={o.disabled} className={`lgpk-opt${value === o.value ? " sel" : ""}`} onClick={() => commit(o.value)}>{o.textContent}</button>
        ))}
      </div>
    </>
  );
}
