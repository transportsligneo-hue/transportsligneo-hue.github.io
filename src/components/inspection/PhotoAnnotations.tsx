/**
 * Annotations photo d'état des lieux (rayure / bosse / impact / salissure).
 *
 * - Coordonnées stockées en fraction (0..1) de la photo → même rendu partout.
 * - Une seule version de la photo : les cercles sont superposés à l'affichage.
 * - Édition réservée au convoyeur pendant son EDL ; lecture seule ailleurs.
 */
import { useEffect, useRef, useState } from "react";
import { Slash, Circle, Zap, Droplets, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { analyzePhotoDamage } from "@/lib/ai/analyze-photo.functions";

export type AnnotationCategory = "rayure" | "bosse" | "eclat" | "impact" | "salissure";

export interface PhotoAnnotation {
  id: string;
  x: number; // 0..1 de la largeur
  y: number; // 0..1 de la hauteur
  category: AnnotationCategory;
  created_at: string;
  author_id?: string | null;
  author_name?: string | null;
}

export const ANNOTATION_CATEGORIES: Record<AnnotationCategory, { label: string; color: string; Icon: typeof Slash }> = {
  bosse: { label: "Bosse", color: "#f08a24", Icon: Circle },
  eclat: { label: "Éclat", color: "#8b5cf6", Icon: Sparkles },
  rayure: { label: "Rayure", color: "#ef4444", Icon: Slash },
  impact: { label: "Impact", color: "#ec4899", Icon: Zap },
  salissure: { label: "Salissure", color: "#2f8bff", Icon: Droplets },
};

export function parseAnnotations(raw: unknown): PhotoAnnotation[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a): a is PhotoAnnotation =>
      !!a && typeof a === "object" && typeof (a as PhotoAnnotation).x === "number" &&
      typeof (a as PhotoAnnotation).y === "number" && (a as PhotoAnnotation).category in ANNOTATION_CATEGORIES,
  );
}

/** Rayon ≈ 26px sur une photo de 390px → 13,3 % de la largeur affichée. */
const CIRCLE_WIDTH_PCT = 13.3;

function Marker({ a, index, compact, showMeta, animate }: {
  a: PhotoAnnotation; index: number; compact?: boolean; showMeta?: boolean; animate?: boolean;
}) {
  const cat = ANNOTATION_CATEGORIES[a.category];
  const [open, setOpen] = useState(false);
  const meta = showMeta
    ? `${cat.label} #${index + 1} · ${a.author_name || "Convoyeur"} · ${new Date(a.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`
    : undefined;
  return (
    <div
      className={`pa-marker${animate ? " pa-animate" : ""}`}
      style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${CIRCLE_WIDTH_PCT}%`, pointerEvents: showMeta ? "auto" : "none" }}
      title={meta}
      onClick={showMeta ? (e) => { e.stopPropagation(); setOpen((o) => !o); } : undefined}
    >
      <svg viewBox="0 0 60 60" aria-hidden>
        <circle cx="30" cy="30" r="26" pathLength={100} stroke={cat.color} />
      </svg>
      {!compact && (
        <span className="pa-chip" style={{ background: cat.color }}>
          {cat.label}{showMeta ? ` #${index + 1}` : ""}
        </span>
      )}
      {open && meta && <span className="pa-meta">{meta}</span>}
    </div>
  );
}

/** Affichage lecture seule d'une photo annotée. */
export function AnnotatedPhoto({ src, alt, annotations, compact, showMeta, className, imgClassName }: {
  src: string; alt: string; annotations: PhotoAnnotation[]; compact?: boolean; showMeta?: boolean;
  className?: string; imgClassName?: string;
}) {
  return (
    <div className={`pa-wrap ${className ?? ""}`}>
      <img src={src} alt={alt} loading="lazy" className={`pa-img ${imgClassName ?? ""}`} />
      {annotations.map((a, i) => (
        <Marker key={a.id ?? i} a={a} index={i} compact={compact} showMeta={showMeta} animate />
      ))}
    </div>
  );
}

type Suggestion = { x: number; y: number };
const LABEL_TO_CAT: Record<string, AnnotationCategory> = {
  rayure: "rayure", bosse: "bosse", impact: "impact", eclat_peinture: "eclat",
};

/** Réduit la photo (≈1024 px) avant l'analyse IA pour rester léger. */
async function toSmallDataUrl(src: string): Promise<string | null> {
  try {
    const blob = await (await fetch(src)).blob();
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  } catch { return null; }
}

/**
 * Éditeur convoyeur (même fonctionnement que la maquette) :
 * - la photo est analysée automatiquement : un défaut possible est entouré, le convoyeur choisit le type ou dit « ce n'est pas un défaut » ;
 * - 1 touche sur la photo = position, 1 touche sur un type = défaut noté ;
 * - sauvegarde en arrière-plan (jamais bloquante), avec quelques réessais.
 */
export function PhotoAnnotationEditor({ src, inspectionId, vueType, authorName }: {
  src: string; inspectionId: string | null; vueType: string; authorName?: string;
}) {
  const [items, setItems] = useState<PhotoAnnotation[]>([]);
  const [pending, setPending] = useState<{ x: number; y: number; auto?: boolean } | null>(null);
  const [queue, setQueue] = useState<Suggestion[]>([]);
  const [scan, setScan] = useState<"idle" | "scan" | "done">("idle");
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const userRef = useRef<string | null>(null);
  const saveSeq = useRef(0);
  const scanned = useRef(false);
  const runDamage = useServerFn(analyzePhotoDamage);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => { userRef.current = data.user?.id ?? null; });
    if (!inspectionId) return;
    supabase.from("inspection_photos").select("annotations")
      .eq("inspection_id", inspectionId).eq("vue_type", vueType).maybeSingle()
      .then(({ data }) => { if (!cancelled && data) setItems((cur) => cur.length ? cur : parseAnnotations(data.annotations)); });
    return () => { cancelled = true; };
  }, [inspectionId, vueType]);

  // Détection automatique des défauts (une seule fois par photo)
  useEffect(() => {
    if (scanned.current) return;
    scanned.current = true;
    let cancelled = false;
    setScan("scan");
    (async () => {
      const url = await toSmallDataUrl(src);
      if (!url || cancelled) { if (!cancelled) setScan("done"); return; }
      try {
        const r = await runDamage({ data: { image_data_url: url, zone_hint: vueType } });
        if (cancelled) return;
        if (r.ok) {
          const sug = (r.analysis.detections ?? [])
            .filter((d) => (d.confidence ?? 0) >= 0.6 && d.bbox)
            .slice(0, 3)
            .map((d) => ({ x: Math.min(0.95, Math.max(0.05, d.bbox.x + d.bbox.w / 2)), y: Math.min(0.95, Math.max(0.05, d.bbox.y + d.bbox.h / 2)) }));
          if (sug.length) { setPending({ ...sug[0], auto: true }); setQueue(sug.slice(1)); }
        }
      } catch { /* l'analyse est facultative : on n'affiche rien */ }
      if (!cancelled) setScan("done");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (next: PhotoAnnotation[]) => {
    if (!inspectionId) return;
    const seq = ++saveSeq.current;
    const attempt = async (n: number) => {
      if (seq !== saveSeq.current) return;
      const { data, error } = await supabase.from("inspection_photos")
        .update({ annotations: next as never })
        .eq("inspection_id", inspectionId).eq("vue_type", vueType).select("id");
      if ((error || !data?.length) && n < 6) setTimeout(() => attempt(n + 1), 1500);
    };
    void attempt(0);
  };

  const update = (next: PhotoAnnotation[]) => { setItems(next); persist(next); };

  const nextSuggestion = () => {
    setPending(queue.length ? { ...queue[0], auto: true } : null);
    setQueue((q) => q.slice(1));
  };

  const place = (e: React.MouseEvent<HTMLDivElement>) => {
    if (pending || scan === "scan") return;
    const r = e.currentTarget.getBoundingClientRect();
    setPending({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  };

  const choose = (category: AnnotationCategory) => {
    if (!pending) return;
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
    const a: PhotoAnnotation = {
      id, x: pending.x, y: pending.y, category, created_at: new Date().toISOString(),
      author_id: userRef.current, author_name: authorName ?? null,
    };
    setFresh((st) => new Set(st).add(id));
    update([...items, a]);
    if (pending.auto) nextSuggestion(); else setPending(null);
  };

  const cancel = () => { if (pending?.auto) nextSuggestion(); else setPending(null); };

  const cats = Object.keys(ANNOTATION_CATEGORIES) as AnnotationCategory[];

  return (
    <div className="space-y-2">
      <div className="pa-editor-frame">
        <div className="pa-wrap pa-editable" onClick={place}>
          <img src={src} alt="Votre prise" className="pa-img pa-img-edit" draggable={false} />
          {items.map((a, i) => (
            <Marker key={a.id} a={a} index={i} animate={fresh.has(a.id)} />
          ))}
          {pending && (
            <span className={`pa-pend${pending.auto ? " pa-pend-auto" : ""}`}
              style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%`, width: `${CIRCLE_WIDTH_PCT}%` }}>
              <svg viewBox="0 0 60 60" aria-hidden><circle cx="30" cy="30" r="26" /></svg>
            </span>
          )}
        </div>
      </div>

      {scan === "scan" ? (
        <div className="pa-box pa-box-scan">
          <span className="pa-shimmer" />
          <div><b>Analyse de la photo…</b><small>Recherche automatique de bosses, éclats et rayures</small></div>
        </div>
      ) : pending ? (
        <div className="pa-box pa-box-ask">
          <b>{pending.auto ? "Défaut possible détecté — de quel type ?" : "Quel type de défaut ?"}</b>
          <div className="pa-chips">
            {cats.map((k) => {
              const c = ANNOTATION_CATEGORIES[k];
              return <button key={k} type="button" style={{ ["--c" as string]: c.color }} onClick={() => choose(k)}>{c.label}</button>;
            })}
          </div>
          <button type="button" className="pa-x" onClick={cancel}>{pending.auto ? "Ce n'est pas un défaut" : "Annuler"}</button>
        </div>
      ) : (
        <div className="pa-box">
          {items.length ? (
            <>
              <b>{items.length} défaut{items.length > 1 ? "s" : ""} noté{items.length > 1 ? "s" : ""}</b>
              <div className="pa-chiplist">
                {items.map((a, i) => {
                  const c = ANNOTATION_CATEGORIES[a.category];
                  return (
                    <span key={a.id} style={{ ["--c" as string]: c.color }}>
                      {c.label} {i + 1}
                      <button type="button" aria-label="Supprimer" onClick={() => update(items.filter((x) => x.id !== a.id))}>×</button>
                    </span>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <b>Aucun défaut ?</b>
              <small>Si vous en voyez un, touchez la photo pour l'entourer.</small>
            </>
          )}
        </div>
      )}
    </div>
  );
}
