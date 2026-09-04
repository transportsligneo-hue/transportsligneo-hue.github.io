/**
 * PhotoDamageAnnotator · annotation tactile d'une photo extérieure.
 *
 * Utilisé UNIQUEMENT par le parcours EDL « véhicule non roulant ».
 * Tap sur la photo = pose d'un point ; on choisit ensuite la lettre du
 * dommage (R / C / E / M / T), comme sur le bon de prise en charge papier.
 */
import { useState } from "react";
import { X, Undo2, Check } from "lucide-react";
import { DAMAGE_CODES, type DamageCode, type NrAnnotation } from "@/lib/edl-non-roulant-pdf";

interface Props {
  photoUrl: string;
  label: string;
  annotations: NrAnnotation[];
  onChange: (next: NrAnnotation[]) => void;
  onClose: () => void;
}

export function PhotoDamageAnnotator({ photoUrl, label, annotations, onChange, onClose }: Props) {
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);

  const place = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPending({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  const confirm = (code: DamageCode) => {
    if (!pending) return;
    onChange([...annotations, { ...pending, code }]);
    setPending(null);
  };

  return (
    <div className="fixed inset-0 z-[130] flex flex-col bg-[#050a1f]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#d4af37]">Dommages</p>
          <p className="text-sm font-semibold text-white">{label}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(annotations.slice(0, -1))}
            disabled={!annotations.length}
            className="rounded-lg border border-white/10 p-2 text-white/70 disabled:opacity-30"
            aria-label="Annuler le dernier point"
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-2 text-white/70"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="relative mx-auto w-full max-w-2xl select-none overflow-hidden rounded-2xl border border-white/10" onClick={place}>
          <img src={photoUrl} alt={label} className="w-full" />
          {annotations.map((a, i) => (
            <span
              key={i}
              className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#d4af37] text-xs font-bold text-[#0b1026] ring-2 ring-white/80"
              style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}
            >
              {a.code}
            </span>
          ))}
          {pending && (
            <span
              className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-dashed border-white bg-white/20"
              style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%` }}
            />
          )}
        </div>
        <p className="mt-3 text-center text-xs text-white/50">
          Touchez la photo à l'endroit du dommage, puis choisissez le type.
        </p>
      </div>

      <div className="border-t border-white/10 bg-[#080e28] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {pending ? (
          <div className="grid grid-cols-5 gap-2">
            {DAMAGE_CODES.map((d) => (
              <button
                key={d.code}
                type="button"
                onClick={() => confirm(d.code)}
                className="rounded-xl border border-[#d4af37]/40 bg-[#d4af37]/10 py-3 text-white"
              >
                <span className="block text-base font-bold text-[#d4af37]">{d.code}</span>
                <span className="block text-[9px] leading-tight text-white/60">{d.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white"
          >
            <Check size={16} /> Terminer l'annotation ({annotations.length})
          </button>
        )}
      </div>
    </div>
  );
}
