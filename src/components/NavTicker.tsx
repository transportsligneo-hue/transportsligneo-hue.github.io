import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type React from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { VroomyAvatar } from "@/components/VroomyAvatar";
import { Scene, isScene } from "@/components/NavScenes";
import logoDriver from "@/assets/logo-driver.png.asset.json";

type Theme = "blue" | "green" | "violet" | "cyan" | "orange" | "pink";
type ArtKind = "driver" | "gps" | "shield" | "quote" | "vroomy" | "invoice" | "plate" | "code" | "linkedin" | "wheel" | "google" | "photo" | "verified" | "card" | "api";
type Msg = {
  art: ArtKind;
  kick: string;
  theme: Theme;
  title: string;
  sub: string;
  cta: string;
  to?: "/comment-ca-marche" | "/tarifs" | "/services" | "/devenir-convoyeur" | "/developpeurs";
  href?: string;
  action?: "vroomy";
};

const WIDE: ArtKind[] = ["card"];
const RAW: ArtKind[] = ["vroomy", "driver", "wheel", "plate", "code", "google", "card", "invoice"];

// Repli : fiche Google Maps (le lien « laisser un avis » exact vient des Paramètres admin quand il est lisible)
const GOOGLE_FALLBACK = "https://www.google.com/maps/search/?api=1&query=Transports%20Ligneo%20Tours";

const MESSAGES: Msg[] = [
  { art: "driver", theme: "green", kick: "Application", title: "Appli Convoyeur", sub: "En phase de test", cta: "play", to: "/devenir-convoyeur" },
  { art: "gps", theme: "blue", kick: "Suivi", title: "Suivi GPS en direct", sub: "Du départ à l'arrivée, en direct", cta: "Voir", to: "/comment-ca-marche" },
  { art: "shield", theme: "cyan", kick: "Sécurité", title: "Assurance incluse", sub: "Chaque trajet est couvert", cta: "En savoir plus", to: "/comment-ca-marche" },
  { art: "plate", theme: "blue", kick: "Astuce", title: "Recherche par plaque", sub: "Infos véhicule remplies seules", cta: "Essayer", to: "/tarifs" },
  { art: "code", theme: "violet", kick: "Sécurité", title: "Livraison par code", sub: "Remise sécurisée du véhicule", cta: "Voir", to: "/comment-ca-marche" },
  { art: "quote", theme: "violet", kick: "Devis", title: "Devis en 2 minutes", sub: "Péages et carburant inclus", cta: "Calculer", to: "/tarifs" },
  { art: "photo", theme: "pink", kick: "État des lieux", title: "État des lieux photo", sub: "Photos horodatées, 360°", cta: "Voir", to: "/comment-ca-marche" },
  { art: "vroomy", theme: "pink", kick: "Nouveau", title: "Vroomy", sub: "Votre assistant, en direct", cta: "Essayer", to: "/comment-ca-marche", action: "vroomy" },
  { art: "google", theme: "orange", kick: "Avis", title: "4,8/5 sur Google", sub: "Laissez-nous un avis", cta: "Mon avis", href: "GOOGLE_REVIEW" },
  { art: "linkedin", theme: "blue", kick: "Réseau", title: "Retrouvez-nous", sub: "Transports Ligneo sur LinkedIn", cta: "Suivre", href: "https://www.linkedin.com/company/transports-ligneo/" },
  { art: "wheel", theme: "green", kick: "Recrutement", title: "Devenez convoyeur", sub: "Rejoignez notre réseau", cta: "Postuler", to: "/devenir-convoyeur" },
  { art: "verified", theme: "green", kick: "Confiance", title: "Convoyeurs vérifiés", sub: "Identifiés, formés et assurés", cta: "Voir", to: "/comment-ca-marche" },
  { art: "card", theme: "cyan", kick: "Paiement", title: "Paiement par carte", sub: "Simple, sécurisé, immédiat", cta: "Découvrir", to: "/tarifs" },
  { art: "api", theme: "violet", kick: "Développeurs", title: "API Développeur", sub: "Connectez vos outils à Ligneo", cta: "Découvrir", to: "/developpeurs" },
  { art: "invoice", theme: "orange", kick: "Pros", title: "Facture à 30 jours", sub: "Flottes & grands comptes", cta: "Voir", to: "/services" },
];

function Art({ kind }: { kind: ArtKind }) {
  if (isScene(kind)) return <Scene kind={kind} />;
  const p = { width: 46, height: 46, viewBox: "0 0 46 46", "aria-hidden": true } as const;
  if (kind === "gps")
    return (
      <svg {...p}>
        <path d="M0 33 L46 14 M0 8 L46 40 M20 0 L26 46" stroke="rgba(255,255,255,.25)" strokeWidth="2" fill="none" />
        <path className="tln-art-route" d="M7 36 C16 36 14 20 24 22 S34 12 39 10" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="3 4" fill="none" />
        <circle cx="7" cy="36" r="3.4" fill="#fff" />
        <g className="tln-art-pin"><path d="M39 3c-4 0-7 3-7 7 0 5 7 11 7 11s7-6 7-11c0-4-3-7-7-7z" fill="#ff5d73" /><circle cx="39" cy="10" r="2.6" fill="#fff" /></g>
      </svg>
    );
  if (kind === "vroomy")
    return (
      <span className="tln-art-vroomy-pop" aria-hidden="true">
        <span className="tln-art-vroomy-hd"><VroomyAvatar size={184} /></span>
      </span>
    );
  if (kind === "card")
    return (
      <svg width="66" height="46" viewBox="0 0 66 46" aria-hidden="true">
        <defs>
          <linearGradient id="tlnCardBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1e3a8a" /><stop offset=".55" stopColor="#2563eb" /><stop offset="1" stopColor="#7c3aed" /></linearGradient>
        </defs>
        <g className="tln-art-card">
          <rect x="3" y="5" width="60" height="38" rx="6" fill="url(#tlnCardBg)" stroke="rgba(255,255,255,.55)" strokeWidth="1" />
          <path d="M3 30c14-9 30-9 60-2v9a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6z" fill="rgba(255,255,255,.08)" />
          <rect x="9" y="13" width="11" height="8.5" rx="2" fill="#fbbf24" />
          <path d="M9 17.2h11M14.5 13v8.5" stroke="#b45309" strokeWidth=".7" />
          <path d="M26 14.5a5 5 0 0 1 0 5M29 12.5a8 8 0 0 1 0 9" stroke="#fff" strokeOpacity=".85" strokeWidth="1.3" strokeLinecap="round" fill="none" />
          <text x="9" y="31" fontSize="5.6" fontWeight="700" fill="#fff" fontFamily="'IBM Plex Mono',monospace" letterSpacing=".6">4242 4242 4242</text>
          <text x="9" y="38.5" fontSize="3.8" fontWeight="600" fill="#cfe0ff" fontFamily="Poppins,sans-serif" letterSpacing=".4">TRANSPORTS LIGNEO</text>
          <circle cx="50" cy="36" r="5" fill="#ef4444" fillOpacity=".95" />
          <circle cx="55.5" cy="36" r="5" fill="#f59e0b" fillOpacity=".95" />
        </g>
      </svg>
    );
  if (kind === "invoice")
    return (
      <svg width="46" height="50" viewBox="0 0 46 50" aria-hidden="true">
        <path d="M7 3h28l6 6v38l-4-2.6-4 2.6-4-2.6-4 2.6-4-2.6-4 2.6-4-2.6-4 2.6z" fill="#fff" />
        <path d="M35 3v6h6z" fill="#e2e8f0" />
        <rect x="11" y="8" width="13" height="5" rx="1.4" fill="#0b1a4d" />
        <text x="17.5" y="11.9" textAnchor="middle" fontSize="3.4" fontWeight="800" fill="#fff" fontFamily="Poppins,sans-serif" letterSpacing=".3">LIGNEO</text>
        <text x="30" y="12" textAnchor="middle" fontSize="3.3" fontWeight="700" fill="#64748b" fontFamily="Poppins,sans-serif">FACTURE</text>
        <rect x="11" y="17" width="24" height="1.8" rx=".9" fill="#cbd5e1" />
        <rect x="11" y="21" width="24" height="1.8" rx=".9" fill="#e2e8f0" />
        <rect x="11" y="25" width="17" height="1.8" rx=".9" fill="#e2e8f0" />
        <rect x="11" y="30" width="24" height="7.5" rx="2" fill="#eff6ff" />
        <text x="14" y="35.4" fontSize="4" fontWeight="700" fill="#475569" fontFamily="Poppins,sans-serif">TOTAL</text>
        <text x="33" y="35.4" textAnchor="end" fontSize="4.6" fontWeight="800" fill="#0b1a4d" fontFamily="'IBM Plex Mono',monospace">144,00 €</text>
        <circle cx="33" cy="40.5" r="5.4" fill="#22c55e" stroke="#fff" strokeWidth="1.4" />
        <text x="33" y="42" textAnchor="middle" fontSize="4" fontWeight="800" fill="#fff" fontFamily="Poppins,sans-serif">30j</text>
      </svg>
    );
  if (kind === "driver" || kind === "wheel")
    return <img className="tln-art-driver" src={logoDriver.url} alt="" draggable={false} />;
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
      <svg width="40" height="40" viewBox="0 0 46 46" aria-hidden="true">
        <rect x="5" y="5" width="36" height="36" rx="8" fill="#0a66c2" stroke="#fff" strokeWidth="2.2" />
        <circle cx="15.5" cy="15.5" r="3.2" fill="#fff" />
        <rect x="12.4" y="21" width="6.2" height="14" rx="1" fill="#fff" />
        <path d="M22 21h5.8v2c1-1.6 2.8-2.4 5-2.4 4.3 0 5.2 2.8 5.2 6.5V35h-6.2v-7.2c0-1.6-.3-2.8-1.9-2.8s-2.4 1.1-2.4 2.8V35H22z" fill="#fff" />
      </svg>
    );
  const body: Record<Exclude<ArtKind, "linkedin" | "gps" | "vroomy" | "plate" | "code" | "google" | "card" | "invoice" | "driver" | "wheel">, React.ReactNode> = {
    shield: <><path d="M12 3l7 3v5c0 4.6-3 8.2-7 10-4-1.8-7-5.4-7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
    quote: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
    photo: <><path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></>,
    api: <><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" /></>,
    verified: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="m16 11 2 2 4-4" /></>,
  };
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {body[kind as Exclude<ArtKind, "linkedin" | "gps" | "vroomy" | "plate" | "code" | "google" | "card" | "invoice" | "driver" | "wheel">]}
    </svg>
  );
}

const INTERVAL = 3000;

/** Texte entier toujours lisible : s'il dépasse, il défile doucement jusqu'à sa fin. */
function Marq({ cls, text }: { cls: string; text: string }) {
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    const o = outer.current, i = inner.current;
    if (!o || !i) return;
    setShift(Math.max(0, Math.ceil(i.scrollWidth - o.clientWidth)));
  }, [text]);
  return (
    <span ref={outer} className={`${cls} tln-mq`}>
      <span ref={inner} className={shift ? "tln-mq-in is-moving" : "tln-mq-in"} style={shift ? ({ ["--mq" as string]: `-${shift + 4}px` }) : undefined}>{text}</span>
    </span>
  );
}

const ARROW = (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M2 6h8M6.5 2.5 10 6 6.5 9.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CAR = (
  <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true">
    <path d="M2 8.5V6.2c0-.7.4-1.3 1-1.5l3-1.2C7 3 7.8 2 9 2h4c1.2 0 2 .6 2.7 1.5L18 5l2 .6c.6.2 1 .7 1 1.4v1.5c0 .5-.4 1-1 1H2.8c-.4 0-.8-.4-.8-.8z" fill="#fff" />
    <circle cx="6" cy="9.4" r="1.9" fill="#0b1a4d" stroke="#fff" strokeWidth="1.2" />
    <circle cx="16" cy="9.4" r="1.9" fill="#0b1a4d" stroke="#fff" strokeWidth="1.2" />
  </svg>
);
const PLAY = (
  <svg width="14" height="14" viewBox="0 0 30 30" aria-hidden="true">
    <path d="M5 2.5v25l14-12.5z" fill="#00d3ff" />
    <path d="M5 2.5 19 15l4.6-4.6L8.4 2C6.7 1.2 5 1.4 5 2.5z" fill="#34e07a" />
    <path d="M5 27.5 19 15l4.6 4.6L8.4 28c-1.7.8-3.4.6-3.4-.5z" fill="#ff3a44" />
    <path d="M23.6 10.4 28 13c1.3.8 1.3 2.2 0 3l-4.4 2.6L19 15z" fill="#ffd400" />
  </svg>
);

/** Petit écran « HD » de la barre du haut : une actualité à la fois, une voiture qui roule le temps de l'affichage. */
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

  const inner = (
    <>
      <span key={`i${pos}`} className={`tln-hd-ic${WIDE.includes(m.art) ? " is-wide" : ""}${RAW.includes(m.art) ? " is-raw" : ""}${m.art === "driver" || m.art === "wheel" ? " is-logo" : ""}${m.art === "vroomy" ? " is-vroomy" : ""}${isScene(m.art) ? " is-scene" : ""}`}><Art kind={m.art} /></span>
      <span key={`t${pos}`} className="tln-hd-txt">
        <span className="tln-hd-kick"><i />{m.kick}</span>
        <Marq cls="tln-hd-title" text={m.title} />
        <Marq cls="tln-hd-sub" text={m.sub} />
      </span>
      <span className="tln-hd-count"><b>{String(cur + 1).padStart(2, "0")}</b> / {N}</span>
      {m.cta === "play" ? (
        <span className="tln-hd-go tln-hd-go--play">{PLAY}Bientôt</span>
      ) : m.cta ? (
        <span className="tln-hd-go">{m.cta}{ARROW}</span>
      ) : null}
    </>
  );

  return (
    <div
      ref={boxRef}
      className={`tln-hd tln-hd--${m.theme}`}
      style={{ ["--d" as string]: `${INTERVAL}ms` }}
      data-paused={paused ? "1" : undefined}
      role="region"
      aria-label="Actualité"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { (e.currentTarget as HTMLElement).dataset.x = String(e.touches[0].clientX); }}
      onTouchEnd={(e) => {
        const x0 = Number((e.currentTarget as HTMLElement).dataset.x);
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 30) go(cur + (dx < 0 ? 1 : -1));
      }}
    >
      <span className="tln-hd-glare" aria-hidden="true" />
      {m.href ? (
        <a href={m.href} target="_blank" rel="noopener noreferrer" className="tln-hd-link">{inner}</a>
      ) : (
        <Link
          to={m.to ?? "/"}
          className="tln-hd-link"
          aria-live="polite"
          onClick={(e) => {
            if (m.action === "vroomy") {
              e.preventDefault();
              window.dispatchEvent(new Event("ligneo:assistant-open"));
            }
          }}
        >
          {inner}
        </Link>
      )}
      <span className="tln-hd-road" aria-hidden="true">
        <i key={`r${pos}`} className="tln-hd-trail" />
        <s key={`c${pos}`} className="tln-hd-car">{CAR}</s>
        <b className="tln-hd-pin" />
      </span>
      <button type="button" className="tln-hd-nav tln-hd-nav--prev" aria-label="Actualité précédente" onClick={(e) => { stop(e); go(cur - 1); }}>‹</button>
      <button type="button" className="tln-hd-nav tln-hd-nav--next" aria-label="Actualité suivante" onClick={(e) => { stop(e); go(cur + 1); }}>›</button>
    </div>
  );
}
