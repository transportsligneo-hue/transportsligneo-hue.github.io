import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type React from "react";
import { Link } from "@tanstack/react-router";
import { VroomyAvatar } from "@/components/VroomyAvatar";
import { supabase } from "@/integrations/supabase/client";
import logoDriver from "@/assets/logo-driver.png.asset.json";

type Theme = "blue" | "green" | "violet" | "cyan" | "orange" | "pink";
type ArtKind = "driver" | "gps" | "shield" | "quote" | "vroomy" | "invoice" | "plate" | "code" | "linkedin" | "wheel" | "google" | "photo" | "verified" | "card";
type Msg = {
  art: ArtKind;
  tag?: string;
  theme: Theme;
  title: string;
  sub: string;
  cta: string;
  to?: "/comment-ca-marche" | "/tarifs" | "/services" | "/devenir-convoyeur";
  href?: string;
  action?: "vroomy";
};

const WIDE: ArtKind[] = ["plate", "code", "google"];

// Repli : fiche Google Maps (le lien « laisser un avis » exact vient des Paramètres admin quand il est lisible)
const GOOGLE_FALLBACK = "https://www.google.com/maps/search/?api=1&query=Transports%20Ligneo%20Tours";

const MESSAGES: Msg[] = [
  { art: "driver", theme: "green", title: "Appli Convoyeur", sub: "En phase de test", cta: "play", to: "/devenir-convoyeur" },
  { art: "gps", theme: "blue", title: "Suivi GPS en direct", sub: "Votre véhicule, du départ à l'arrivée", cta: "Voir", to: "/comment-ca-marche" },
  { art: "shield", theme: "cyan", title: "Assurance incluse", sub: "Chaque trajet est couvert", cta: "", to: "/comment-ca-marche" },
  { art: "plate", theme: "blue", title: "Saisissez la plaque", sub: "Le véhicule se remplit seul", cta: "Essayer", to: "/tarifs" },
  { art: "code", theme: "violet", title: "Livraison par code", sub: "Remise sécurisée du véhicule", cta: "", to: "/comment-ca-marche" },
  { art: "quote", theme: "violet", title: "Devis en 30 secondes", sub: "Péages et carburant inclus", cta: "Calculer", to: "/tarifs" },
  { art: "photo", theme: "pink", title: "État des lieux photo", sub: "Photos horodatées, 360°", cta: "Voir", to: "/comment-ca-marche" },
  { art: "vroomy", theme: "pink", tag: "Nouveau", title: "Vroomy", sub: "Votre assistant, en direct", cta: "Essayer", to: "/comment-ca-marche", action: "vroomy" },
  { art: "google", theme: "orange", title: "4,8/5 sur Google", sub: "Laissez-nous un avis", cta: "Mon avis", href: "GOOGLE_REVIEW" },
  { art: "linkedin", theme: "blue", title: "Retrouvez-nous", sub: "Transports Ligneo sur LinkedIn", cta: "Suivre", href: "https://www.linkedin.com/company/transports-ligneo/" },
  { art: "wheel", theme: "green", title: "Devenez convoyeur", sub: "Rejoignez notre réseau", cta: "Postuler", to: "/devenir-convoyeur" },
  { art: "verified", theme: "green", title: "Convoyeurs vérifiés", sub: "Identifiés, formés et assurés", cta: "", to: "/comment-ca-marche" },
  { art: "card", theme: "cyan", title: "Paiement par carte", sub: "Simple, sécurisé, immédiat", cta: "Découvrir", to: "/tarifs" },
  { art: "invoice", theme: "orange", title: "Facture à 30 jours", sub: "Flottes et grands comptes", cta: "Pour les pros", to: "/services" },
];

function Art({ kind }: { kind: ArtKind }) {
  const p = { width: 46, height: 46, viewBox: "0 0 46 46", "aria-hidden": true } as const;
  if (kind === "driver")
    return <img className="tln-art-driver" src={logoDriver.url} alt="" draggable={false} />;
  if (kind === "gps")
    return (
      <svg {...p}>
        <path d="M0 33 L46 14 M0 8 L46 40 M20 0 L26 46" stroke="rgba(255,255,255,.25)" strokeWidth="2" fill="none" />
        <path className="tln-art-route" d="M7 36 C16 36 14 20 24 22 S34 12 39 10" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="3 4" fill="none" />
        <circle cx="7" cy="36" r="3.4" fill="#fff" />
        <g className="tln-art-pin"><path d="M39 3c-4 0-7 3-7 7 0 5 7 11 7 11s7-6 7-11c0-4-3-7-7-7z" fill="#ff5d73" /><circle cx="39" cy="10" r="2.6" fill="#fff" /></g>
      </svg>
    );
  if (kind === "shield")
    return (
      <svg {...p}>
        <path d="M23 5 38 10v11c0 9-6 16-15 20C14 37 8 30 8 21V10z" fill="#fff" fillOpacity=".95" />
        <path d="M23 9 34 13v8c0 7-4 12-11 15" fill="none" stroke="#06b6d4" strokeOpacity=".25" strokeWidth="2" />
        <path d="m15.5 22.5 5 5 10-11" stroke="#0891b2" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  if (kind === "quote")
    return (
      <svg {...p}>
        <rect x="9" y="5" width="28" height="36" rx="5" fill="#fff" />
        <rect x="14" y="11" width="12" height="3" rx="1.5" fill="#8b5cf6" />
        <rect x="14" y="18" width="18" height="2.5" rx="1.2" fill="#c4b5fd" />
        <rect x="14" y="24" width="15" height="2.5" rx="1.2" fill="#c4b5fd" />
        <rect x="14" y="31" width="18" height="6" rx="3" fill="#d946ef" />
        <text x="23" y="36" textAnchor="middle" fontSize="5.4" fontWeight="800" fill="#fff" fontFamily="Poppins,sans-serif">30 s</text>
      </svg>
    );
  if (kind === "plate")
    return (
      <svg width="66" height="46" viewBox="0 0 66 46" aria-hidden="true">
        <rect x="2" y="9" width="62" height="24" rx="5" fill="#fff" stroke="#cbd5e1" strokeWidth="1" />
        <path d="M2 14a5 5 0 0 1 5-5h4v24H7a5 5 0 0 1-5-5z" fill="#1d4ed8" />
        <text x="6.5" y="24" textAnchor="middle" fontSize="6" fontWeight="800" fill="#fde047" fontFamily="Poppins,sans-serif">F</text>
        <text className="tln-art-plate-text" x="38.5" y="26" textAnchor="middle" fontSize="11" fontWeight="800" fill="#0f172a" fontFamily="'IBM Plex Mono',monospace" textLength="46" lengthAdjust="spacingAndGlyphs">AB-123-CD</text>
        <g className="tln-art-lens"><circle cx="50" cy="29" r="8.5" fill="rgba(255,255,255,.28)" stroke="#fff" strokeWidth="3.2" /><path d="m56 35 7 7" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" /></g>
      </svg>
    );
  if (kind === "code")
    return (
      <svg width="66" height="46" viewBox="0 0 66 46" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={3 + i * 15.5} y="8" width="13" height="20" rx="3.5" fill="#fff" />
            <text className={`tln-art-digit tln-art-digit--${i}`} x={9.5 + i * 15.5} y="23" textAnchor="middle" fontSize="13" fontWeight="800" fill="#7c3aed" fontFamily="'IBM Plex Mono',monospace">{["4", "7", "2", "9"][i]}</text>
          </g>
        ))}
        <rect x="3" y="33" width="60" height="8" rx="4" fill="#22c55e" />
        <path d="m25 37 3 2.6 6-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <text x="46" y="39.4" textAnchor="middle" fontSize="5.4" fontWeight="800" fill="#fff" fontFamily="Poppins,sans-serif">OK</text>
      </svg>
    );
  if (kind === "photo")
    return (
      <svg {...p}>
        <path d="M15 12 17.5 8h11L31 12h6a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z" fill="#fff" />
        <circle cx="23" cy="25" r="8.5" fill="#ec4899" /><circle cx="23" cy="25" r="5" fill="#fbcfe8" /><circle cx="21" cy="23" r="1.6" fill="#fff" />
        <circle className="tln-art-flash" cx="35" cy="17" r="2.2" fill="#fde047" />
      </svg>
    );
  if (kind === "verified")
    return (
      <svg {...p}>
        <rect x="8" y="7" width="30" height="33" rx="5" fill="#fff" />
        <rect x="16" y="10" width="14" height="4" rx="2" fill="#a7f3d0" />
        <circle cx="23" cy="23" r="5" fill="#10b981" /><path d="M14 36c1-5 4.5-7.5 9-7.5S31 31 32 36z" fill="#10b981" />
        <circle className="tln-art-tick" cx="35" cy="34" r="7.5" fill="#22c55e" stroke="#fff" strokeWidth="2" />
        <path d="m31.4 34 2.5 2.5 4.3-5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  if (kind === "card")
    return (
      <svg {...p}>
        <g className="tln-art-card">
          <rect x="4" y="10" width="38" height="26" rx="5" fill="#fff" />
          <rect x="4" y="16" width="38" height="6" fill="#0891b2" />
          <rect x="9" y="27" width="10" height="3" rx="1.5" fill="#94a3b8" />
          <rect x="30" y="26.5" width="7" height="5" rx="1.5" fill="#fbbf24" />
        </g>
      </svg>
    );
  if (kind === "google")
    return (
      <svg width="66" height="46" viewBox="0 0 66 46" aria-hidden="true">
        <rect x="1" y="3" width="64" height="40" rx="9" fill="#fff" />
        <g transform="translate(6 7) scale(.52)">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </g>
        <text x="48" y="22" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0f172a" fontFamily="Poppins,sans-serif">4,8</text>
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} className={`tln-art-star tln-art-star--${i}`} d="m0-4.2 1.2 2.6 2.8.3-2.1 1.9.6 2.8L0 1.9-2.5 3.4l.6-2.8L-4-1.3l2.8-.3z" transform={`translate(${21 + i * 7.6} 36.5) scale(1.2)`} fill="#fbbc04" />
        ))}
      </svg>
    );
  if (kind === "linkedin")
    return (
      <svg {...p}>
        <rect x="5" y="5" width="36" height="36" rx="8" fill="#0a66c2" stroke="#fff" strokeWidth="2.2" />
        <circle cx="15.5" cy="15.5" r="3.2" fill="#fff" />
        <rect x="12.4" y="21" width="6.2" height="14" rx="1" fill="#fff" />
        <path d="M22 21h5.8v2c1-1.6 2.8-2.4 5-2.4 4.3 0 5.2 2.8 5.2 6.5V35h-6.2v-7.2c0-1.6-.3-2.8-1.9-2.8s-2.4 1.1-2.4 2.8V35H22z" fill="#fff" />
      </svg>
    );
  if (kind === "wheel")
    return (
      <svg {...p}>
        <g className="tln-art-wheel">
          <circle cx="23" cy="23" r="16" fill="none" stroke="#fff" strokeWidth="5" />
          <circle cx="23" cy="23" r="4.5" fill="#fff" />
          <path d="M23 27.5V39M18.8 21.3 8 18.5M27.2 21.3 38 18.5" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
        </g>
      </svg>
    );
  if (kind === "vroomy")
    return (
      <span className="tln-art-vroomy-pop" aria-hidden="true">
        <VroomyAvatar size={84} />
      </span>
    );
  if (kind === "invoice")
    return (
      <svg {...p}>
        <path d="M10 5h26v36l-4.3-3-4.3 3-4.4-3-4.4 3-4.3-3L10 41z" fill="#fff" />
        <rect x="15" y="11" width="16" height="3" rx="1.5" fill="#f59e0b" />
        <rect x="15" y="18" width="16" height="2.4" rx="1.2" fill="#fcd34d" />
        <rect x="15" y="23" width="11" height="2.4" rx="1.2" fill="#fcd34d" />
        <circle cx="31" cy="31" r="6.5" fill="#ef4444" /><text x="31" y="34" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#fff" fontFamily="Poppins,sans-serif">30j</text>
      </svg>
    );
  return (
    <svg {...p}>
      <circle cx="20" cy="20" r="11" fill="none" stroke="#fff" strokeWidth="4" />
      <path d="m28.5 28.5 10 10" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <rect x="13.5" y="17" width="13" height="6.5" rx="2" fill="#fff" fillOpacity=".95" />
      <text x="20" y="22" textAnchor="middle" fontSize="4.6" fontWeight="800" fill="#2563eb" fontFamily="Poppins,sans-serif">AB-123</text>
    </svg>
  );
}

const INTERVAL = 3200;

/** Petit écran défilant de la barre du haut : met en avant les fonctionnalités, ordre mélangé. */
export default function NavTicker() {
  const [order, setOrder] = useState<number[]>(() => MESSAGES.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reviewUrl, setReviewUrl] = useState(GOOGLE_FALLBACK);
  const boxRef = useRef<HTMLDivElement>(null);

  // Netteté : recale la pub sur un pixel entier (le centrage automatique peut tomber sur un demi-pixel => texte flou)
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const snap = () => {
      el.style.translate = "0 0";
      const r = el.getBoundingClientRect();
      const fx = r.left - Math.round(r.left);
      const fy = r.top - Math.round(r.top);
      el.style.translate = `${-fx}px ${-fy}px`;
    };
    snap();
    window.addEventListener("resize", snap);
    const t = window.setTimeout(snap, 600);
    return () => { window.removeEventListener("resize", snap); window.clearTimeout(t); };
  }, []);

  // Lien « laisser un avis » enregistré dans les Paramètres admin (si lisible), sinon fiche Google Maps
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

  // Ordre aléatoire côté navigateur uniquement (évite un écart serveur/navigateur)
  useEffect(() => {
    const arr = MESSAGES.map((_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setOrder(arr);
  }, []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setPos((p) => (p + 1) % MESSAGES.length), INTERVAL);
    return () => clearInterval(t);
  }, [paused]);

  const N = MESSAGES.length;
  const cur = ((pos % N) + N) % N;
  const m0 = MESSAGES[order[cur]];
  const m = m0.href === "GOOGLE_REVIEW" ? { ...m0, href: reviewUrl } : m0;
  const go = (n: number) => setPos(((n % N) + N) % N);
  const stop = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <div
      ref={boxRef}
      className={`tln-ticker tln-ticker--${m.theme}${m.art === "vroomy" ? " tln-ticker--pop" : ""}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { (e.currentTarget as HTMLElement).dataset.x = String(e.touches[0].clientX); }}
      onTouchEnd={(e) => {
        const x0 = Number((e.currentTarget as HTMLElement).dataset.x);
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 30) go(cur + (dx < 0 ? 1 : -1));
      }}
    >
      {m.href ? (
        <a href={m.href} target="_blank" rel="noopener noreferrer" className="tln-ticker-link">
        <span key={`i${pos}`} className={`tln-ticker-ic tln-ticker-ic--${m.art}${WIDE.includes(m.art) ? " is-wide" : ""}`}>
          <Art kind={m.art} />
        </span>
        <span key={pos} className="tln-ticker-txt">
          <span className="tln-ticker-title">{m.tag && <em className="tln-ticker-tag">{m.tag}</em>}{m.title}</span>
          <span className="tln-ticker-sub">{m.sub}</span>
        </span>
        {m.cta === "play" ? <span className="tln-ticker-cta tln-ticker-cta--play">
            <svg width="20" height="20" viewBox="0 0 30 30" aria-hidden="true">
              <path d="M5 2.5v25l14-12.5z" fill="#00d3ff" />
              <path d="M5 2.5 19 15l4.6-4.6L8.4 2C6.7 1.2 5 1.4 5 2.5z" fill="#34e07a" />
              <path d="M5 27.5 19 15l4.6 4.6L8.4 28c-1.7.8-3.4.6-3.4-.5z" fill="#ff3a44" />
              <path d="M23.6 10.4 28 13c1.3.8 1.3 2.2 0 3l-4.4 2.6L19 15z" fill="#ffd400" />
            </svg>
            <span><small>Bientôt sur</small><b>Google Play</b></span>
          </span> : m.cta ? <span className="tln-ticker-cta">{m.cta}</span> : null}
        </a>
      ) : (
        <Link
          to={m.to ?? "/"}
          className="tln-ticker-link"
          aria-live="polite"
          onClick={(e) => {
            if (m.action === "vroomy") {
              e.preventDefault();
              window.dispatchEvent(new Event("ligneo:assistant-open"));
            }
          }}
        >
        <span key={`i${pos}`} className={`tln-ticker-ic tln-ticker-ic--${m.art}${WIDE.includes(m.art) ? " is-wide" : ""}`}>
          <Art kind={m.art} />
        </span>
        <span key={pos} className="tln-ticker-txt">
          <span className="tln-ticker-title">{m.tag && <em className="tln-ticker-tag">{m.tag}</em>}{m.title}</span>
          <span className="tln-ticker-sub">{m.sub}</span>
        </span>
        {m.cta === "play" ? <span className="tln-ticker-cta tln-ticker-cta--play">
            <svg width="20" height="20" viewBox="0 0 30 30" aria-hidden="true">
              <path d="M5 2.5v25l14-12.5z" fill="#00d3ff" />
              <path d="M5 2.5 19 15l4.6-4.6L8.4 2C6.7 1.2 5 1.4 5 2.5z" fill="#34e07a" />
              <path d="M5 27.5 19 15l4.6 4.6L8.4 28c-1.7.8-3.4.6-3.4-.5z" fill="#ff3a44" />
              <path d="M23.6 10.4 28 13c1.3.8 1.3 2.2 0 3l-4.4 2.6L19 15z" fill="#ffd400" />
            </svg>
            <span><small>Bientôt sur</small><b>Google Play</b></span>
          </span> : m.cta ? <span className="tln-ticker-cta">{m.cta}</span> : null}
        </Link>
      )}
      <button type="button" className="tln-ticker-nav tln-ticker-nav--prev" aria-label="Pub précédente" onClick={(e) => { stop(e); go(cur - 1); }}>‹</button>
      <button type="button" className="tln-ticker-nav tln-ticker-nav--next" aria-label="Pub suivante" onClick={(e) => { stop(e); go(cur + 1); }}>›</button>
      <span className="tln-ticker-dots">
        {MESSAGES.map((_, i) => (
          <button key={i} type="button" aria-label={`Pub ${i + 1}`} className={i === cur ? "on" : ""} onClick={(e) => { stop(e); go(i); }} />
        ))}
      </span>
    </div>
  );
}
