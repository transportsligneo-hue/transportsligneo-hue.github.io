import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { REPLAY_HELP_EVENT } from "@/components/dashboard-pro/HelpTip";

export interface TourStep {
  /** Sélecteur CSS de l'élément ciblé. Étape ignorée s'il est absent. */
  target: string;
  title: string;
  body: string;
}

const KEY = "ligneo-tour-done:";

/**
 * Visite guidée légère : spotlight néon + bulle, mémorisée par navigateur.
 * Rejouée par le bouton rond « Revoir les conseils » (REPLAY_HELP_EVENT).
 */
export function GuidedTour({ id, steps, delay = 900 }: { id: string; steps: TourStep[]; delay?: number }) {
  const [active, setActive] = useState<TourStep[] | null>(null);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bubbleHeight, setBubbleHeight] = useState(240);
  useLayoutEffect(() => {
    const el = bubbleRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setBubbleHeight(el.getBoundingClientRect().height));
    observer.observe(el);
    setBubbleHeight(el.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [active, i, rect]);

  const start = useCallback(() => {
    const avail = steps.filter((s) => document.querySelector(s.target));
    if (avail.length) { setActive(avail); setI(0); }
  }, [steps]);

  useEffect(() => {
    let done = false;
    try { done = !!localStorage.getItem(KEY + id); } catch { /* ignore */ }
    const t = done ? undefined : setTimeout(start, delay);
    const replay = () => setTimeout(start, 150);
    window.addEventListener(REPLAY_HELP_EVENT, replay);
    return () => { if (t) clearTimeout(t); window.removeEventListener(REPLAY_HELP_EVENT, replay); };
  }, [id, delay, start]);

  const step = active?.[i];

  useEffect(() => {
    if (!step) return;
    const el = document.querySelector(step.target);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const upd = () => setRect(el.getBoundingClientRect());
    const t = setTimeout(upd, 350);
    upd();
    window.addEventListener("resize", upd);
    window.addEventListener("scroll", upd, true);
    return () => { clearTimeout(t); window.removeEventListener("resize", upd); window.removeEventListener("scroll", upd, true); };
  }, [step]);

  const close = useCallback(() => {
    try { localStorage.setItem(KEY + id, "1"); } catch { /* ignore */ }
    setActive(null); setRect(null);
  }, [id]);

  const next = useCallback(() => {
    if (!active) return;
    if (i + 1 >= active.length) close(); else setI(i + 1);
  }, [active, i, close]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, next, close]);

  if (!active || !step || !rect || typeof document === "undefined") return null;

  const pad = 8;
  const vw = window.innerWidth, vh = window.innerHeight;
  const mobile = vw < 640;
  const below = rect.bottom + bubbleHeight + pad + 26 < vh;
  const left = Math.min(Math.max(12, rect.left), vw - 372);
  const top = below ? rect.bottom + pad + 14 : rect.top - pad - 14 - bubbleHeight;
  const bubbleStyle: React.CSSProperties = mobile
    ? { left: 12, right: 12, bottom: 12, maxHeight: vh - 24, overflowY: "auto" }
    : { left, top: Math.max(12, Math.min(top, vh - bubbleHeight - 12)), width: 360, maxHeight: vh - 24, overflowY: "auto" };

  return createPortal(
    <div className="gt-root" role="dialog" aria-modal="true" aria-label={step.title}>
      <div className="gt-backdrop" onClick={close} />
      <div
        className="gt-spot"
        style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
      >
        <span className="gt-pulse" />
      </div>
      <div ref={bubbleRef} className="gt-bubble" style={bubbleStyle}>
        <div className="gt-progress">
          {active.map((_, k) => <span key={k} className={k <= i ? "on" : ""} />)}
        </div>
        <p className="gt-step">ÉTAPE {String(i + 1).padStart(2, "0")} / {String(active.length).padStart(2, "0")}</p>
        <p className="gt-title">{step.title}</p>
        <p className="gt-body">{step.body}</p>
        <div className="gt-actions">
          <button type="button" onClick={close} className="gt-skip">Passer</button>
          <div className="flex gap-2">
            {i > 0 && <button type="button" onClick={() => setI(i - 1)} className="gt-skip">Retour</button>}
            <button type="button" onClick={next} className="gt-next">{i + 1 >= active.length ? "Terminer" : "Suivant"}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export const MISSIONS_LIST_TOUR: TourStep[] = [
  {
    target: '[data-tour="missions-list"] a[href*="/missions/"]',
    title: "Ouvrir une mission",
    body: "Cliquez sur une mission pour accéder à son suivi complet : carte GPS, photos, documents et facture.",
  },
  {
    target: '[data-tour="new-mission"]',
    title: "Nouvelle demande",
    body: "Créez une mission simple ou groupée. En groupé, mixez livraisons simples, restitution et livraison, et recharges électriques.",
  },
];

export const MISSION_DETAIL_TOUR: TourStep[] = [
  { target: '[data-tour="mission-gps"]', title: "Suivi GPS en direct", body: "Suivez le convoyeur en temps réel sur la carte, du départ jusqu'à la remise des clés." },
  { target: '[data-tour="mission-photos"]', title: "Photos et état des lieux", body: "Comparez les photos prises au départ et à l'arrivée, avec les anomalies signalées." },
  { target: '[data-tour="mission-report"]', title: "Rapport de mission", body: "Téléchargez en un PDF toutes les preuves : photos, signatures et état des lieux." },
  { target: '[data-tour="mission-pv"]', title: "PV de livraison et de restitution", body: "Vos procès-verbaux officiels, remplis automatiquement et prêts à télécharger." },
  { target: '[data-tour="mission-invoice"]', title: "Votre facture", body: "La facture est générée automatiquement en fin de mission. Téléchargez son PDF en un clic." },
  { target: '[data-tour="mission-vehicle"]', title: "Véhicule", body: "Modèle, plaque et VIN du véhicule transporté, toujours à portée de main." },
];

export const PRO_DASHBOARD_TOUR: TourStep[] = [
  { target: '[data-tour="side-nav"]', title: "Votre menu", body: "Sur le côté, retrouvez tout votre espace : tableau de bord, missions, documents, adresses favorites et votre parc." },
  { target: '[data-tour="new-simple"]', title: "Demande de mission simple", body: "Un seul véhicule, un trajet : livraison simple, restitution et livraison, ou recharge électrique." },
  { target: '[data-tour="new-grouped"]', title: "Demande de mission groupée", body: "Plusieurs véhicules en une seule demande. Mixez librement livraisons simples, restitution et livraison, et recharges électriques, véhicule par véhicule." },
  { target: '[data-tour="dash-kpis"]', title: "Vos chiffres clés", body: "Véhicules en mission, disponibles ou immobilisés, mis à jour en temps réel." },
  { target: '[data-tour="dash-map"]', title: "Suivi GPS en direct", body: "Suivez sur la carte chaque véhicule en cours de convoyage." },
  { target: '[data-tour="side-missions"]', title: "Vos missions", body: "Ouvrez une mission pour voir les photos, le GPS, les PV et télécharger la facture." },
  { target: '[data-tour="help-round"]', title: "Revoir les conseils", body: "Ce petit bouton rond relance la visite à tout moment." },
];

export const MISSION_CHOICE_TOUR: TourStep[] = [
  { target: '[data-tour="choice-simple"]', title: "Mission simple", body: "Un véhicule, un trajet de A à B. Vous choisissez livraison simple, restitution et livraison, ou recharge." },
  { target: '[data-tour="choice-grouped"]', title: "Mission groupée", body: "Un lot de véhicules : un enlèvement commun, puis une prestation différente par véhicule si besoin. Les documents de chaque mission sont créés automatiquement." },
];

export const CLIENT_DASHBOARD_TOUR: TourStep[] = [
  { target: '[data-tour="side-nav"]', title: "Votre menu", body: "Sur le côté : réservations, missions, factures et devis, adresses favorites et documents." },
  { target: '[data-tour="new-mission"]', title: "Réserver un convoyage", body: "Faites votre demande en quelques étapes simples : adresses, véhicule, date." },
  { target: '[data-tour="dash-kpis"]', title: "Vos convoyages", body: "Demandes en attente, planifiées, en cours et terminées d'un coup d'œil." },
  { target: '[data-tour="dash-map"]', title: "Suivi GPS en direct", body: "Suivez votre véhicule en temps réel pendant le convoyage." },
  { target: '[data-tour="side-missions"]', title: "Vos missions", body: "Ouvrez une mission pour voir les photos, les PV et télécharger la facture." },
  { target: '[data-tour="help-round"]', title: "Revoir les conseils", body: "Ce petit bouton rond relance la visite à tout moment." },
];
