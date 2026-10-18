import { useEffect, useRef } from "react";
import "./VroomyAvatar.css";

type Props = { size?: number; talking?: boolean; className?: string; effects?: boolean };

/** Mascotte Vroomy animée : regard qui suit le pointeur sans re-render React. */
export function VroomyAvatar({ size = 76, talking = false, className, effects = true }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const irisL = useRef<HTMLImageElement>(null);
  const irisR = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let raf = 0;
    const tick = () => {
      cur.x += (target.x - cur.x) * 0.2;
      cur.y += (target.y - cur.y) * 0.2;
      const s = (carRef.current?.offsetWidth ?? 940) / 940;
      const t = `translate(${cur.x * 9 * s}px, ${cur.y * 10 * s}px)`;
      if (irisL.current) irisL.current.style.transform = t;
      if (irisR.current) irisR.current.style.transform = t;
      if (Math.abs(target.x - cur.x) > 0.002 || Math.abs(target.y - cur.y) > 0.002) {
        raf = requestAnimationFrame(tick);
      } else raf = 0;
    };
    const aim = (px: number, py: number) => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = px - (r.left + r.width / 2);
      const dy = py - (r.top + r.height * 0.42);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 220);
      target.x = (dx / d) * k;
      target.y = (dy / d) * k;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onPointer = (e: PointerEvent) => aim(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) aim(t.clientX, t.clientY);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("touchmove", onTouch);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`vroomy-avatar${talking ? " vroomy-talking" : ""}${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {effects && (
        <>
          <div className="vroomy-halo" />
          <div className="vroomy-ring" />
          <div className="vroomy-ring r2" />
        </>
      )}
      <div className="vroomy-disc">
        <div className="vroomy-in">
          <div className="vroomy-carwrap">
            <div className="vroomy-car" ref={carRef}>
              <img className="base" src="/vroomy/vroomy-base.webp" alt="" draggable={false} />
              <div className="eye eyeL">
                <img ref={irisL} src="/vroomy/vroomy-iris-left.png" alt="" style={{ left: "36.06%", top: "23.99%", width: "8.09%", height: "13.41%" }} />
                <div className="lid" />
              </div>
              <div className="eye eyeR">
                <img ref={irisR} src="/vroomy/vroomy-iris-right.png" alt="" style={{ left: "48.40%", top: "24.14%", width: "8.72%", height: "13.71%" }} />
                <div className="lid" />
              </div>
              <div className="lamp" style={{ left: "-0.96%", top: "39.64%" }} />
              <div className="lamp l2" style={{ left: "39.26%", top: "42.03%", width: "23%" }} />
              <div className="sheen" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VroomyAvatar;
