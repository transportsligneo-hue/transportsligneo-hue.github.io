import { useEffect, useRef } from "react";

/**
 * Global cursor spotlight · premium blue halo following the mouse.
 * - pointer-events: none (does not block clicks)
 * - requestAnimationFrame throttling
 * - disabled on touch devices / coarse pointers
 */
export default function CursorSpotlight() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // disable on touch / coarse pointers
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    if (isCoarse) return;

    const el = ref.current;
    if (!el) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x;
    let ty = y;
    let raf = 0;
    let visible = false;

    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!visible) {
        visible = true;
        el.style.opacity = "1";
      }
    };
    const onLeave = () => {
      visible = false;
      el.style.opacity = "0";
    };

    const tick = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      el.style.transform = `translate3d(${x - 300}px, ${y - 300}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden
      ref={ref}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 600,
        height: 600,
        pointerEvents: "none",
        zIndex: 9999,
        opacity: 0,
        transition: "opacity 300ms ease",
        background:
          "radial-gradient(circle at center, rgba(95,182,255,0.18) 0%, rgba(95,182,255,0.10) 25%, rgba(231,199,106,0.05) 45%, rgba(0,0,0,0) 70%)",
        mixBlendMode: "screen",
        willChange: "transform, opacity",
      }}
    />
  );
}
