import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Curseur de validation Transports Ligneo : on glisse le logo jusqu'au bout.
 * Fluide (transform + requestAnimationFrame), écoute sur la fenêtre pour ne jamais « décrocher »,
 * aucun rond qui tourne.
 */
export function LigneoSlideConfirm({
  onConfirm,
  disabled = false,
  label = "GLISSEZ POUR ACCEPTER LE DEVIS",
  doneLabel = "DEVIS ACCEPTÉ",
  hint,
}: {
  onConfirm: () => void;
  disabled?: boolean;
  label?: string;
  doneLabel?: string;
  hint?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const txt = useRef<HTMLDivElement>(null);
  const st = useRef({ active: false, start: 0, x: 0, max: 0, raf: 0, pid: -1 });
  const [done, setDone] = useState(false);

  const paint = useCallback((x: number, animate = false) => {
    const k = knob.current, f = fill.current, t = txt.current;
    if (!k || !f || !t) return;
    const tr = animate ? "transform .28s cubic-bezier(.2,.8,.2,1)" : "none";
    k.style.transition = tr; f.style.transition = tr;
    k.style.transform = `translate3d(${x}px,0,0)`;
    f.style.transform = `translate3d(${x + 56}px,0,0)`;
    const m = st.current.max || 1;
    t.style.opacity = String(Math.max(0, 1 - (x / m) * 1.6));
  }, []);

  const reset = useCallback(() => {
    st.current.x = 0;
    paint(0, true);
    setDone(false);
    if (txt.current) txt.current.style.opacity = "1";
  }, [paint]);

  useEffect(() => { if (disabled && !done) paint(0, true); }, [disabled, done, paint]);

  const onDown = (e: React.PointerEvent) => {
    if (disabled || done || !track.current) return;
    e.preventDefault();
    const s = st.current;
    s.active = true;
    s.max = track.current.clientWidth - 56;
    s.start = e.clientX - s.x;
    s.pid = e.pointerId;

    const move = (ev: PointerEvent) => {
      if (!s.active || ev.pointerId !== s.pid) return;
      s.x = Math.max(0, Math.min(s.max, ev.clientX - s.start));
      if (!s.raf) s.raf = requestAnimationFrame(() => { s.raf = 0; paint(s.x); });
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== s.pid) return;
      s.active = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (s.raf) { cancelAnimationFrame(s.raf); s.raf = 0; }
      if (s.x >= s.max - 6) {
        s.x = s.max; paint(s.max, true); setDone(true);
        setTimeout(onConfirm, 350);
        setTimeout(reset, 2600);
      } else {
        s.x = 0; paint(0, true);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <div>
      <div
        ref={track}
        className={`lg-slide ${disabled ? "is-disabled" : ""} ${done ? "is-done" : ""}`}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={done ? 100 : 0}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled || done) return;
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDone(true); setTimeout(onConfirm, 250); setTimeout(reset, 2600); }
        }}
      >
        <div ref={fill} className="lg-slide-fill" />
        <div ref={txt} className="lg-slide-txt">{label}</div>
        {done && <div className="lg-slide-done">{doneLabel} ✓</div>}
        <div ref={knob} className="lg-slide-knob" onPointerDown={onDown}>
          <img src="/logo-ligneo.png" alt="" draggable={false} />
        </div>
      </div>
      {hint && <p className="lg-slide-hint">{disabled ? hint : "Glissez le logo jusqu'au bout"}</p>}
    </div>
  );
}
