import { useEffect } from "react";

const MEDIA = "video, audio, img, canvas, svg, .vf, [data-protect]";

/**
 * Dissuade le téléchargement des médias du site : retire le bouton
 * « Télécharger » des lecteurs, bloque le clic droit « Enregistrer sous… »
 * et le glisser-déposer des images. Les champs de saisie et les liens de
 * téléchargement volontaires (brochures PDF) ne sont pas touchés.
 */
export default function MediaProtection() {
  useEffect(() => {
    const harden = (root: ParentNode) => {
      root.querySelectorAll<HTMLMediaElement>("video, audio").forEach((m) => {
        m.setAttribute("controlsList", "nodownload noremoteplayback");
        m.setAttribute("disableRemotePlayback", "");
        if (m instanceof HTMLVideoElement) m.disablePictureInPicture = true;
      });
    };
    harden(document);
    const mo = new MutationObserver((list) => {
      for (const r of list) r.addedNodes.forEach((n) => {
        if (n instanceof Element) { if (n.matches("video, audio")) harden(n.parentNode ?? document); else harden(n); }
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    const onCtx = (e: Event) => {
      const t = e.target;
      if (t instanceof Element && !t.closest("input, textarea, [contenteditable]") && t.closest(MEDIA)) e.preventDefault();
    };
    const onDrag = (e: Event) => {
      if (e.target instanceof Element && e.target.closest("img, video")) e.preventDefault();
    };
    document.addEventListener("contextmenu", onCtx);
    document.addEventListener("dragstart", onDrag);

    const style = document.createElement("style");
    style.textContent = "img,video{-webkit-user-drag:none;-webkit-touch-callout:none}";
    document.head.appendChild(style);
    return () => {
      mo.disconnect();
      document.removeEventListener("contextmenu", onCtx);
      document.removeEventListener("dragstart", onDrag);
      style.remove();
    };
  }, []);
  return null;
}
