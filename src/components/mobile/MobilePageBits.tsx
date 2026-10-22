import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import "@/styles/mobile-home-v2.css";
import "@/styles/mobile-pages-v2.css";

/** En-tête de page mobile (kicker + titre + texte), même style que Tarifs. */
export function PageHero({ kicker, title, text }: { kicker: string; title: ReactNode; text?: ReactNode }) {
  return (
    <section className="mh2-thero">
      <div className="mh2-h2">{kicker}</div>
      <h1>{title}</h1>
      {text ? <p>{text}</p> : null}
    </section>
  );
}

/** Carte d'appel à l'action navy. */
export function PageCta({ title, text, to, label }: { title: ReactNode; text: string; to: string; label: string }) {
  return (
    <section className="mp-cta">
      <div className="mh2-cta2">
        <h3>{title}</h3>
        <p>{text}</p>
        <Link to={to} className="mh2-cbtn">
          {label} <ChevronRight size={16} strokeWidth={2.4} />
        </Link>
      </div>
    </section>
  );
}

/** Fait apparaître les étapes `.mp-ts` une à une quand elles entrent à l'écran. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(".mp-ts"));
    if (typeof IntersectionObserver === "undefined") {
      items.forEach((i) => i.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.35 },
    );
    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, []);
  return ref;
}
