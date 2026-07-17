/**
 * Overlay canvas simple : dessine des bounding boxes normalisées sur une image.
 * Rendu 100% CSS/absolute — pas de canvas natif (évite les problèmes de resize).
 */
import type { BBox } from "@/lib/ai/types";

export function BoundingBoxOverlay({
  boxes,
}: {
  boxes: Array<{ bbox: BBox; label: string; confidence: number; color?: string }>;
}) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {boxes.map((b, i) => {
        const style = {
          left: `${Math.max(0, b.bbox.x) * 100}%`,
          top: `${Math.max(0, b.bbox.y) * 100}%`,
          width: `${Math.min(1, b.bbox.w) * 100}%`,
          height: `${Math.min(1, b.bbox.h) * 100}%`,
          borderColor: b.color ?? "#e94560",
          boxShadow: `0 0 0 1px rgba(0,0,0,0.35), 0 4px 12px rgba(233,69,96,0.35)`,
        };
        return (
          <div key={i} className="absolute border-2 rounded-md" style={style}>
            <span
              className="absolute -top-6 left-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
              style={{ backgroundColor: b.color ?? "#e94560" }}
            >
              {b.label} · {Math.round(b.confidence * 100)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
