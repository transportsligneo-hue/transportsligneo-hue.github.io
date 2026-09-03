/**
 * PlateCheckGate · Vérification de la plaque AVANT la prise de photos de l'EDL.
 *
 * 1. Le convoyeur photographie la plaque.
 * 2. La photo est uploadée (traçabilité) puis lue par Plate Recognizer côté serveur.
 * 3. Le backend compare avec la plaque du dossier mission (normalisation espaces/tirets/casse).
 *    - match      → confirmation verte, on continue
 *    - mismatch   → alerte rouge, plaques côte à côte, rescan / incident / continuer quand même
 *    - confiance faible ou plaque illisible → saisie manuelle en secours
 */
import { useRef, useState } from "react";
import {
  Camera, Check, Loader2, X, RefreshCw, ShieldAlert, ScanLine, Keyboard, AlertTriangle, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { useServerFn } from "@tanstack/react-start";
import { verifyMissionPlate, recordPlateOverride, type PlateCheckResult } from "@/lib/plate-check.functions";
import { IncidentReportSheet } from "@/components/mission/IncidentReportSheet";

interface Props {
  attributionId: string;
  userId: string;
  phase: "depart" | "arrivee";
  /** Plaque affichée en référence (dossier mission). */
  expectedPlate?: string | null;
  driverName?: string;
  numeroMission?: string | null;
  onValidated: () => void;
  onClose: () => void;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]+,/, ""));
    reader.onerror = () => reject(new Error("Lecture image impossible"));
    reader.readAsDataURL(blob);
  });
}

export function PlateCheckGate({
  attributionId, userId, phase, expectedPlate, numeroMission, onValidated, onClose,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<PlateCheckResult | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState("");
  const [incident, setIncident] = useState(false);
  const photoPathRef = useRef<string | null>(null);

  const verify = useServerFn(verifyMissionPlate);
  const override = useServerFn(recordPlateOverride);

  const runScan = async (file: File) => {
    setBusy(true);
    setResult(null);
    try {
      const compressed = await compressImage(file).catch(() => file);
      setPreview(URL.createObjectURL(compressed));
      const path = `${userId}/plate-checks/${attributionId}_${Date.now()}.jpg`;
      try {
        await supabase.storage.from("inspection-photos").upload(path, compressed, {
          upsert: true, contentType: "image/jpeg",
        });
        photoPathRef.current = path;
      } catch { photoPathRef.current = null; }

      const imageBase64 = await blobToBase64(compressed);
      const res = await verify({
        data: { attributionId, imageBase64, photoPath: photoPathRef.current ?? undefined, method: "scan", phase },
      });
      if (!res.ok) { toast.error(res.error ?? "Lecture impossible"); setManualOpen(true); }
      setResult(res);
      if (res.status === "low_confidence" || res.status === "no_plate") setManualOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan impossible");
    } finally {
      setBusy(false);
    }
  };

  const runManual = async () => {
    if (!manual.trim()) return;
    setBusy(true);
    try {
      const res = await verify({
        data: { attributionId, manualPlate: manual, photoPath: photoPathRef.current ?? undefined, method: "manual", phase },
      });
      if (!res.ok) toast.error(res.error ?? "Vérification impossible");
      setResult(res);
      setManualOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Vérification impossible");
    } finally {
      setBusy(false);
    }
  };

  const continueAnyway = async () => {
    try {
      await override({
        data: {
          attributionId, phase,
          expected: result?.expected ?? expectedPlate ?? null,
          scanned: result?.scanned ?? null,
        },
      });
    } catch { /* trace non bloquante */ }
    onValidated();
  };

  const expectedDisplay = (result?.expected ?? expectedPlate ?? "").toUpperCase() || "—";
  const isMatch = result?.ok && result.status === "match";
  const isMismatch = result?.ok && (result.status === "mismatch" || result.status === "no_reference");

  return (
    <div className="edl-shell fixed inset-x-0 top-0 z-[112] flex flex-col" style={{ height: "100dvh", maxHeight: "100dvh" }}>
      <header className="edl-glass-strong rounded-none border-x-0 border-t-0 px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          type="button" onClick={onClose} aria-label="Quitter"
          className="w-10 h-10 rounded-xl edl-glass flex items-center justify-center hover:scale-95 transition"
        >
          <X size={18} className="text-white" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--edl-cyan)] font-bold">
            Étape préalable
          </p>
          <p className="text-sm font-semibold text-white truncate">
            Vérification du véhicule · {phase === "depart" ? "prise en charge" : "restitution"}
          </p>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="edl-glass p-4 flex items-start gap-3">
            <ScanLine size={18} className="text-[var(--edl-cyan)] mt-0.5 shrink-0" />
            <p className="text-[13px] leading-relaxed text-[var(--edl-text-soft)]">
              Scannez la plaque d'immatriculation du véhicule pour confirmer qu'il s'agit
              bien du véhicule de la mission avant de démarrer les photos.
            </p>
          </div>

          <div className="edl-glass p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--edl-text-soft)] font-bold mb-1">
              Plaque attendue {numeroMission ? `· ${numeroMission}` : ""}
            </p>
            <p className="text-2xl font-black text-white tracking-[0.14em]">{expectedDisplay}</p>
          </div>

          {preview && (
            <div className="rounded-2xl overflow-hidden border border-[rgba(120,180,255,0.18)]">
              <img src={preview} alt="Plaque scannée" className="w-full object-cover max-h-48" />
            </div>
          )}

          {busy && (
            <div className="edl-glass p-4 flex items-center gap-3 text-[13px] text-white">
              <Loader2 size={16} className="animate-spin text-[var(--edl-cyan)]" />
              Lecture de la plaque en cours…
            </div>
          )}

          {isMatch && (
            <div
              className="rounded-2xl p-4 flex items-start gap-3"
              style={{ border: "1px solid rgba(52,232,176,0.45)", background: "rgba(52,232,176,0.10)" }}
            >
              <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "#34E8B0", color: "#06231A" }}>
                <Check size={18} strokeWidth={3} />
              </span>
              <div>
                <p className="text-[15px] font-bold text-white">Véhicule confirmé : {result?.scanned}</p>
                <p className="text-[12px] text-[var(--edl-text-soft)] mt-1">
                  La plaque scannée correspond au dossier de mission.
                </p>
              </div>
            </div>
          )}

          {isMismatch && (
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{ border: "1px solid rgba(255,79,94,0.5)", background: "rgba(255,79,94,0.10)" }}
            >
              <p className="flex items-center gap-2 text-[14px] font-bold text-white">
                <AlertTriangle size={18} className="text-[#ff4f5e]" />
                {result?.status === "no_reference"
                  ? "Aucune plaque enregistrée dans le dossier mission"
                  : "Attention, la plaque scannée ne correspond pas au véhicule attendu pour cette mission"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3" style={{ background: "rgba(20,32,72,0.6)" }}>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--edl-text-soft)] font-bold">Attendue</p>
                  <p className="text-lg font-black text-white tracking-[0.12em]">{expectedDisplay}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: "rgba(255,79,94,0.14)" }}>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#ffb3ba] font-bold">Scannée</p>
                  <p className="text-lg font-black text-white tracking-[0.12em]">{result?.scanned ?? "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button" onClick={() => { setResult(null); fileRef.current?.click(); }}
                  className="h-12 rounded-xl flex items-center justify-center gap-2 text-[13px] font-semibold text-white"
                  style={{ border: "1px solid rgba(120,180,255,0.35)", background: "rgba(20,32,72,0.6)" }}
                >
                  <RefreshCw size={15} /> Rescanner
                </button>
                <button
                  type="button" onClick={() => setIncident(true)}
                  className="h-12 rounded-xl flex items-center justify-center gap-2 text-[13px] font-semibold text-white"
                  style={{ border: "1px solid rgba(255,79,94,0.5)", background: "rgba(255,79,94,0.18)" }}
                >
                  <ShieldAlert size={15} /> Signaler un problème
                </button>
              </div>
              <button
                type="button" onClick={continueAnyway}
                className="w-full h-11 rounded-xl text-[12px] font-semibold text-[var(--edl-text-soft)] underline underline-offset-4"
              >
                Continuer malgré tout (l'écart sera tracé dans le dossier)
              </button>
            </div>
          )}

          {(manualOpen || result?.status === "low_confidence" || result?.status === "no_plate") && !isMatch && (
            <div className="edl-glass p-4 space-y-3">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-white">
                <Keyboard size={16} className="text-[var(--edl-cyan)]" />
                Plaque illisible ? Saisie manuelle en secours
              </p>
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value.toUpperCase())}
                placeholder="AA-123-BB"
                inputMode="text"
                autoCapitalize="characters"
                className="w-full h-12 rounded-xl px-3 text-white text-lg font-bold tracking-[0.12em] outline-none"
                style={{ background: "rgba(20,32,72,0.7)", border: "1px solid rgba(120,180,255,0.3)" }}
              />
              <button
                type="button" onClick={runManual} disabled={busy || !manual.trim()}
                className="edl-cta w-full h-12 flex items-center justify-center gap-2 text-[14px] disabled:opacity-40 disabled:pointer-events-none"
              >
                <Check size={16} /> Vérifier cette plaque
              </button>
            </div>
          )}
        </div>
      </main>

      <footer
        className="edl-glass-strong rounded-none border-x-0 border-b-0 shrink-0 px-4 pt-3 safe-bottom space-y-2"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <input
          ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void runScan(f); }}
        />
        {isMatch ? (
          <button
            type="button" onClick={onValidated}
            className="edl-cta w-full h-14 flex items-center justify-center gap-2 text-base"
          >
            Continuer vers les photos <ArrowRight size={18} />
          </button>
        ) : (
          <button
            type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            className="edl-cta w-full h-14 flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:pointer-events-none"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            {result ? "Rescanner la plaque" : "Scanner la plaque"}
          </button>
        )}
      </footer>

      {incident && (
        <IncidentReportSheet
          attributionId={attributionId}
          userId={userId}
          numeroMission={numeroMission ?? undefined}
          onClose={() => setIncident(false)}
          onReported={() => setIncident(false)}
        />
      )}
    </div>
  );
}
