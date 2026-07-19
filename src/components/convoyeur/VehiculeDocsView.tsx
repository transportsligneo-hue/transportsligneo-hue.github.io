import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Car, Copy, Check, FileText } from "lucide-react";

interface Props {
  vin: string | null;
  rectoPath: string | null;
  versoPath: string | null;
}

async function sign(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { data } = await supabase.storage.from("cartes-grises").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function VehiculeDocsView({ vin, rectoPath, versoPath }: Props) {
  const [recto, setRecto] = useState<string | null>(null);
  const [verso, setVerso] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    sign(rectoPath).then(setRecto);
    sign(versoPath).then(setVerso);
  }, [rectoPath, versoPath]);

  const copyVin = () => {
    if (!vin) return;
    navigator.clipboard.writeText(vin);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-2xl border border-pro-border bg-white p-4 space-y-3">
      <div className="flex items-center gap-2 text-pro-text font-semibold text-sm">
        <Car size={16} className="text-[var(--gold)]" />
        Documents véhicule
      </div>

      {vin && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-pro-bg-soft/50 border border-pro-border">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-pro-muted">VIN</p>
            <p className="font-mono text-sm text-pro-text truncate">{vin}</p>
          </div>
          <button
            onClick={copyVin}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border border-pro-border hover:bg-pro-bg-soft transition"
          >
            {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
            {copied ? "Copié" : "Copier"}
          </button>
        </div>
      )}

      {(recto || verso) && (
        <div className="grid grid-cols-2 gap-2">
          {recto && (
            <a href={recto} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-pro-border hover:border-[var(--gold)]/40 transition">
              <img src={recto} alt="Carte grise recto" className="w-full h-32 object-cover" />
              <p className="text-[10px] text-center text-pro-muted py-1.5 bg-pro-bg-soft/50">Carte grise · recto</p>
            </a>
          )}
          {verso && (
            <a href={verso} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-pro-border hover:border-[var(--gold)]/40 transition">
              <img src={verso} alt="Carte grise verso" className="w-full h-32 object-cover" />
              <p className="text-[10px] text-center text-pro-muted py-1.5 bg-pro-bg-soft/50">Carte grise · verso</p>
            </a>
          )}
        </div>
      )}

      {!vin && !recto && !verso && (
        <p className="text-xs text-pro-muted flex items-center gap-1.5">
          <FileText size={12} /> Documents non fournis
        </p>
      )}
    </div>
  );
}
