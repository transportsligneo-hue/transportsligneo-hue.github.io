/**
 * Annotations photo d'état des lieux (rayure / bosse / impact / salissure).
 *
 * - Coordonnées stockées en fraction (0..1) de la photo → même rendu partout.
 * - Une seule version de la photo : les cercles sont superposés à l'affichage.
 * - Édition réservée au convoyeur pendant son EDL ; lecture seule ailleurs.
 */
import { useEffect, useRef, useState } from "react";
import { Slash, Circle, Zap, Droplets, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type AnnotationCategory = "rayure" | "bosse" | "impact" | "salissure";

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
  rayure: { label: "Rayure", color: "#e4504a", Icon: Slash },
  bosse: { label: "Bosse", color: "#d98a2b", Icon: Circle },
  impact: { label: "Impact", color: "#9b4de0", Icon: Zap },
  salissure: { label: "Salissure", color: "#5b83ff", Icon: Droplets },
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

/**
 * Éditeur convoyeur : 1 touche = position, 1 touche = catégorie.
 * Sauvegarde en arrière-plan (jamais bloquante), avec quelques réessais si
 * la ligne photo n'est pas encore créée par l'envoi en tâche de fond.
 */
export function PhotoAnnotationEditor({ src, inspectionId, vueType, authorName }: {
  src: string; inspectionId: string | null; vueType: string; authorName?: string;
}) {
  const [items, setItems] = useState<PhotoAnnotation[]>([]);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const userRef = useRef<string | null>(null);
  const saveSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => { userRef.current = data.user?.id ?? null; });
    if (!inspectionId) return;
    supabase.from("inspection_photos").select("annotations")
      .eq("inspection_id", inspectionId).eq("vue_type", vueType).maybeSingle()
      .then(({ data }) => { if (!cancelled && data) setItems((cur) => cur.length ? cur : parseAnnotations(data.annotations)); });
    return () => { cancelled = true; };
  }, [inspectionId, vueType]);

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

  const place = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPending({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  };

  const choose = (category: AnnotationCategory) => {
    if (!pending) return;
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
    const a: PhotoAnnotation = {
      id, ...pending, category, created_at: new Date().toISOString(),
      author_id: userRef.current, author_name: authorName ?? null,
    };
    setFresh((s) => new Set(s).add(id));
    setPending(null);
    update([...items, a]);
  };

  return (
    <div className="space-y-2">
      <p className="pa-hint">Touchez un défaut sur la photo pour le signaler</p>
      <div className="pa-editor-frame">
        <div className="pa-wrap pa-editable" onClick={pending ? () => setPending(null) : place}>
          <img src={src} alt="Votre prise" className="pa-img pa-img-edit" draggable={false} />
          {items.map((a, i) => (
            <Marker key={a.id} a={a} index={i} animate={fresh.has(a.id)} />
          ))}
          {pending && (
            <>
              <span className="pa-pending" style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%` }} />
              <div
                className="pa-menu"
                style={{
                  left: `${Math.min(Math.max(pending.x * 100, 22), 78)}%`,
                  top: pending.y > 0.6 ? undefined : `calc(${pending.y * 100}% + 22px)`,
                  bottom: pending.y > 0.6 ? `calc(${(1 - pending.y) * 100}% + 22px)` : undefined,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {(Object.keys(ANNOTATION_CATEGORIES) as AnnotationCategory[]).map((k) => {
                  const c = ANNOTATION_CATEGORIES[k];
                  return (
                    <button key={k} type="button" className="pa-menu-btn" onClick={() => choose(k)}>
                      <c.Icon size={16} color={c.color} strokeWidth={2.5} />
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
      {items.length > 0 && (
        <div className="pa-list">
          <p className="pa-list-title">Anomalies signalées ({items.length})</p>
          {items.map((a, i) => {
            const c = ANNOTATION_CATEGORIES[a.category];
            return (
              <div key={a.id} className="pa-list-row">
                <span className="pa-dot" style={{ background: c.color }} />
                <span className="flex-1">{c.label} · repère #{i + 1}</span>
                <button type="button" aria-label="Supprimer l'anomalie" className="pa-del"
                  onClick={() => update(items.filter((x) => x.id !== a.id))}>
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
