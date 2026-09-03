/**
 * NavigationChoiceSheet · feuille de choix du GPS (Waze / Google Maps)
 * ouverte au démarrage du trajet de livraison, pré-remplie avec l'adresse
 * de destination de la mission.
 */
import { X, Copy, Check, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GoogleMapsLogo, WazeLogo } from "./BrandLogoIcons";

interface Props {
  destination: string;
  title?: string;
  onClose: () => void;
}

export function NavigationChoiceSheet({ destination, title = "Lancer la navigation", onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const q = encodeURIComponent(destination);
  const wazeHref = `https://waze.com/ul?q=${q}&navigate=yes`;
  const gmapsHref = `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(destination);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Impossible de copier l'adresse");
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-[#041B52]/75 backdrop-blur-md" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[75] safe-bottom animate-sheet-up">
        <div className="rounded-t-3xl border-t border-[rgba(140,170,255,0.28)] bg-[rgba(6,18,56,0.97)] backdrop-blur-2xl p-4 pb-6">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="mt-1 flex items-start gap-1.5 text-xs leading-snug text-[#A8C2FF]">
                <MapPin size={13} className="mt-0.5 shrink-0" />
                <span className="break-words">{destination}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[rgba(140,170,255,0.28)] bg-white/[0.06] text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={wazeHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[rgba(51,204,255,0.45)] bg-[rgba(51,204,255,0.14)] p-4 text-white active:scale-[0.98] transition"
            >
<WazeLogo size={22} />
              <span className="text-[13px] font-semibold">Waze</span>
            </a>
            <a
              href={gmapsHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[rgba(110,231,183,0.45)] bg-[rgba(110,231,183,0.14)] p-4 text-white active:scale-[0.98] transition"
            >
<GoogleMapsLogo size={22} />
              <span className="text-[13px] font-semibold">Google Maps</span>
            </a>
          </div>

          <button
            onClick={copy}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-[rgba(140,170,255,0.20)] bg-white/[0.05] px-4 py-3 text-xs font-semibold text-[#D6E4FF] active:scale-[0.98] transition"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Adresse copiée" : "Copier l'adresse"}
          </button>

          <button onClick={onClose} className="mt-2 w-full py-2.5 text-xs text-[#8fa3d8]">
            Plus tard
          </button>
        </div>
      </div>
    </>
  );
}
