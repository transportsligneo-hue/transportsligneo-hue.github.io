import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LIGNEO_BRAND_LOGO } from "@/lib/brand-assets";
import { StoryArt, type StoryArtKind } from "./StoryArt";
import "@/styles/stories-art.css";
import "@/styles/stories-mobile.css";

type Theme = "blue" | "green" | "violet" | "cyan" | "orange" | "pink" | "coral";
type Story = {
  art: StoryArtKind;
  theme: Theme;
  kick: string;
  title: string;
  sub: string;
  cta: string;
  to?: string;
  href?: string;
  action?: "vroomy";
  dur?: number;
};

const GOOGLE_FALLBACK = "https://www.google.com/maps/search/?api=1&query=Transports%20Ligneo%20Tours";
const SEEN_KEY = "ligneo_stories_seen_v1";
const DUR = 5500;

/** Mêmes annonces que le bandeau de la navbar PC (NavTicker), présentées en plein écran sur mobile. */
const STORIES: Story[] = [
  { art: "driver", theme: "green", kick: "Bientôt sur Google Play", title: "Appli Convoyeur", sub: "Missions, état des lieux et paiements dans votre poche. Disponible très bientôt.", cta: "Être prévenu du lancement", to: "/devenir-convoyeur" },
  { art: "gps", theme: "blue", kick: "Suivi", title: "Suivi GPS en direct", sub: "Du départ à l’arrivée, suivez votre véhicule en temps réel.", cta: "Voir comment ça marche", to: "/comment-ca-marche" },
  { art: "shield", theme: "cyan", kick: "Sécurité", title: "Assurance incluse", sub: "Chaque trajet est couvert, sans supplément.", cta: "En savoir plus", to: "/comment-ca-marche" },
  { art: "plate", theme: "blue", kick: "Astuce", title: "Recherche par plaque", sub: "Marque, modèle, VIN et motorisation remplis automatiquement.", cta: "Essayer", to: "/tarifs", dur: 9500 },
  { art: "code", theme: "violet", kick: "Sécurité", title: "Livraison par code", sub: "Le véhicule n’est remis qu’avec votre code à 4 chiffres.", cta: "Voir", to: "/comment-ca-marche" },
  { art: "quote", theme: "violet", kick: "Devis", title: "Devis en 2 minutes", sub: "Péages et carburant inclus. Aucun frais caché.", cta: "Calculer mon prix", to: "/tarifs" },
  { art: "photo", theme: "pink", kick: "État des lieux", title: "État des lieux photo", sub: "Photos horodatées et vue à 360° à chaque remise.", cta: "Voir", to: "/comment-ca-marche" },
  { art: "vroomy", theme: "pink", kick: "Nouveau", title: "Vroomy, votre assistant", sub: "Posez vos questions, il vous répond en direct.", cta: "Parler à Vroomy", action: "vroomy" },
  { art: "google", theme: "coral", kick: "Avis", title: "4,8/5 sur Google", sub: "Vos retours nous font avancer. Un avis nous aide beaucoup.", cta: "Laisser un avis", href: "GOOGLE_REVIEW" },
  { art: "linkedin", theme: "blue", kick: "Réseau", title: "Retrouvez-nous", sub: "Transports Ligneo sur LinkedIn : actualités et recrutement.", cta: "Nous suivre", href: "https://www.linkedin.com/company/transports-ligneo/" },
  { art: "wheel", theme: "green", kick: "Recrutement", title: "Devenez convoyeur", sub: "Rejoignez notre réseau de conducteurs professionnels.", cta: "Postuler", to: "/devenir-convoyeur" },
  { art: "verified", theme: "green", kick: "Confiance", title: "Convoyeurs vérifiés", sub: "Identifiés, formés et assurés avant chaque mission.", cta: "Voir", to: "/comment-ca-marche" },
  { art: "card", theme: "cyan", kick: "Paiement", title: "Paiement par carte", sub: "Simple, sécurisé, immédiat.", cta: "Découvrir", to: "/tarifs" },
  { art: "api", theme: "violet", kick: "Développeurs", title: "API Développeur", sub: "Connectez vos outils à Ligneo en quelques lignes.", cta: "Découvrir", to: "/developpeurs" },
  { art: "demo", theme: "blue", kick: "Professionnels · B2B", title: "Demandez votre démo", sub: "Flottes et entreprises : testez l’espace pro.", cta: "Demander une démo", to: "/demo" },
  { art: "invoice", theme: "coral", kick: "Pros", title: "Facture à 30 jours", sub: "Pour les flottes et grands comptes.", cta: "Voir", to: "/services" },
];

function readSeen(): string[] {
  try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function writeSeen(list: string[]) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(list)); } catch { /* stockage indisponible */ }
}

/** Bouton rond (barre mobile) + visionneuse plein écran façon stories. */
export default function StoriesButton() {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(0);
  const [seen, setSeen] = useState<string[]>([]);
  useEffect(() => { setSeen(readSeen()); }, [open]);
  const left = useMemo(() => STORIES.filter((s) => !seen.includes(s.title)).length, [seen]);

  return (
    <>
      <button
        type="button"
        className={`stv-ring md:hidden${left === 0 ? " seen" : ""}`}
        aria-label={`Annonces${left ? ` (${left} nouvelles)` : ""}`}
        onClick={() => {
          const first = STORIES.findIndex((s) => !seen.includes(s.title));
          setStart(first > 0 ? first : 0);
          setOpen(true);
        }}
      >
        <i>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1z" /><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" /></svg>
        </i>
        {left > 0 && <em>{left}</em>}
      </button>
      {open && typeof document !== "undefined" && createPortal(<Viewer start={start} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function Viewer({ start, onClose }: { start: number; onClose: () => void }) {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(start);
  const [paused, setPaused] = useState(false);
  const [reviewUrl, setReviewUrl] = useState(GOOGLE_FALLBACK);
  const pushed = useRef(false);
  const closing = useRef(false);
  const down = useRef({ t: 0, x: 0, y: 0 });
  const s = STORIES[idx];

  // Lien « laisser un avis » des Paramètres admin (sinon fiche Google Maps)
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const { data } = await supabase.from("app_settings").select("value").eq("key", "google_review").maybeSingle();
        const u = (data as { value?: { url?: string } } | null)?.value?.url;
        if (!off && u && /^https:\/\//.test(u)) setReviewUrl(u);
      } catch { /* repli */ }
    })();
    return () => { off = true; };
  }, []);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const finish = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (pushed.current) { pushed.current = false; history.back(); }
    closeRef.current();
  }, []);

  // Bouton retour du téléphone : ferme les stories
  useEffect(() => {
    history.pushState({ ligneoStories: true }, "");
    pushed.current = true;
    const onPop = () => { pushed.current = false; closing.current = true; closeRef.current(); };
    window.addEventListener("popstate", onPop);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [finish]);

  // Marque l'annonce comme vue
  useEffect(() => {
    const list = readSeen();
    if (!list.includes(s.title)) writeSeen([...list, s.title]);
  }, [s.title]);

  const go = useCallback((n: number) => {
    if (n < 0) return setIdx(0);
    if (n >= STORIES.length) return finish();
    setIdx(n);
  }, [finish]);

  const act = () => {
    const url = s.href === "GOOGLE_REVIEW" ? reviewUrl : s.href;
    finish();
    window.setTimeout(() => {
      if (s.action === "vroomy") window.dispatchEvent(new Event("ligneo:assistant-open"));
      else if (url) window.open(url, "_blank", "noopener,noreferrer");
      else if (s.to) navigate({ to: s.to as never });
    }, 80);
  };

  const dur = s.dur ?? DUR;
  const onDown = (e: React.PointerEvent) => { down.current = { t: Date.now(), x: e.clientX, y: e.clientY }; setPaused(true); };
  const onUp = (side: -1 | 1) => (e: React.PointerEvent) => {
    setPaused(false);
    if (Date.now() - down.current.t < 220 && Math.abs(e.clientX - down.current.x) < 12) go(idx + side);
  };
  const touch = useRef({ x: 0, y: 0 });

  return (
    <div
      className={`stv th-${s.theme}`}
      role="dialog"
      aria-modal="true"
      aria-label="Annonces Transports Ligneo"
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touch.current.x;
        const dy = e.changedTouches[0].clientY - touch.current.y;
        if (dy > 90 && Math.abs(dx) < 60) finish();
        else if (Math.abs(dx) > 70 && Math.abs(dy) < 60) go(idx + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="vbg" />
      <div className="prog" style={{ ["--dur" as string]: `${dur}ms` }}>
        {STORIES.map((x, k) => (
          <div key={x.title} className={k < idx ? "done" : ""}>
            {k === idx && (
              <i
                key={idx}
                className="run"
                style={{ animationDuration: `${dur}ms`, animationPlayState: paused ? "paused" : "running" }}
                onAnimationEnd={() => go(idx + 1)}
              />
            )}
          </div>
        ))}
      </div>
      <div className="vh">
        <img className="logo" src={LIGNEO_BRAND_LOGO} alt="" />
        <div><b>Transports Ligneo</b><small>{s.kick}</small></div>
        <span className="sp" />
        <button type="button" aria-label={paused ? "Reprendre" : "Pause"} onClick={() => setPaused((p) => !p)}>{paused ? "▶" : "❚❚"}</button>
        <button type="button" aria-label="Fermer" onClick={finish}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <div className="zl" onPointerDown={onDown} onPointerUp={onUp(-1)} onPointerCancel={() => setPaused(false)} />
      <div className="zr" onPointerDown={onDown} onPointerUp={onUp(1)} onPointerCancel={() => setPaused(false)} />
      <div className="body" key={`b${idx}`}>
        <div className="art"><StoryArt kind={s.art} /></div>
        <span className="kick">{s.kick}</span>
        <h2 className="t">{s.title}</h2>
        <p className="s">{s.sub}</p>
      </div>
      <button type="button" className="cta" onClick={act}>
        {s.cta}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </button>
    </div>
  );
}
