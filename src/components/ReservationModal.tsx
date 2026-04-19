import { useEffect } from "react";
import { X } from "lucide-react";
import TunnelReservation from "./TunnelReservation";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ReservationModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-gradient-to-b from-navy to-navy-light border border-primary/30 sm:rounded-lg shadow-2xl shadow-black/50 my-0 sm:my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-navy/60 border border-primary/20 text-cream/70 hover:text-primary hover:border-primary/60 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="p-6 sm:p-10">
          <div className="text-center mb-6">
            <p className="text-xs uppercase tracking-[0.3em] text-primary/80 mb-2">Réservation</p>
            <h2 className="font-heading text-3xl sm:text-4xl gold-gradient-text">
              Votre convoyage premium
            </h2>
            <div className="gold-divider-short mt-3" />
          </div>
          <TunnelReservation onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
