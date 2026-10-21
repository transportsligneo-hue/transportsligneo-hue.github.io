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
import { PlateInput } from "@/components/plate/PlateInput";

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

  const stage: "idle" | "busy" | "match" | "mismatch" = busy ? "busy" : isMatch ? "match" : isMismatch ? "mismatch" : "idle";

  return (
    <div className="drv2">
      <div className="edl-shell fixed inset-x-0 top-0 z-[112] flex flex-col pg" style={{ height: "100dvh", maxHeight: "100dvh" }}>
        <header className="pg-hdr">
          <button type="button" onClick={onClose} aria-label="Quitter" className="pg-x"><X size={18} /></button>
          <div className="pg-ht">
            <small>Étape 1 · {phase === "depart" ? "Prise en charge" : "Restitution"}</small>
            <b>Scanner la plaque</b>
          </div>
          {numeroMission ? <span className="pg-num">{numeroMission}</span> : null}
        </header>

        <main className="pg-main">
          <div className="pg-exp">
            <small>Plaque attendue</small>
            <span className="pg-plate"><i><u>F</u></i><b>{expectedDisplay}</b></span>
          </div>

          <button
            type="button"
            className={`pg-vf is-${stage}`}
            onClick={() => !busy && fileRef.current?.click()}
            aria-label="Photographier la plaque"
          >
            {preview ? <img src={preview} alt="Plaque scannée" /> : <span className="pg-ghost"><i /><b>AA-123-AA</b></span>}
            <span className="pg-c tl" /><span className="pg-c tr" /><span className="pg-c bl" /><span className="pg-c br" />
            {stage === "busy" && <span className="pg-scan" />}
            <span className="pg-cap">
              {stage === "busy" ? <><Loader2 size={14} className="animate-spin" /> Lecture de la plaque…</>
                : stage === "match" ? <><Check size={14} strokeWidth={3} /> Plaque reconnue</>
                : stage === "mismatch" ? <><AlertTriangle size={14} /> Plaque différente</>
                : <><Camera size={14} /> Touchez pour photographier la plaque</>}
            </span>
          </button>

          {stage === "idle" && (
            <ul className="pg-tips">
              <li><ScanLine size={15} /> Placez-vous devant ou derrière le véhicule</li>
              <li><Check size={15} /> Plaque entière dans le cadre, bien lisible</li>
              <li><RefreshCw size={15} /> Évitez les reflets et le contre-jour</li>
            </ul>
          )}

          {isMatch && (
            <div className="pg-ok">
              <span><Check size={18} strokeWidth={3} /></span>
              <div>
                <b>Véhicule confirmé · {result?.scanned}</b>
                <p>La plaque correspond au dossier de mission.</p>
              </div>
            </div>
          )}

          {isMismatch && (
            <div className="pg-ko">
              <p>
                <AlertTriangle size={17} />
                {result?.status === "no_reference"
                  ? "Aucune plaque enregistrée dans le dossier mission"
                  : "Cette plaque ne correspond pas au véhicule de la mission"}
              </p>
              <div className="pg-cmp">
                <div><small>Attendue</small><b>{expectedDisplay}</b></div>
                <div className="bad"><small>Scannée</small><b>{result?.scanned ?? "—"}</b></div>
              </div>
              <div className="pg-acts">
                <button type="button" onClick={() => { setResult(null); fileRef.current?.click(); }}><RefreshCw size={15} /> Rescanner</button>
                <button type="button" className="red" onClick={() => setIncident(true)}><ShieldAlert size={15} /> Signaler</button>
              </div>
              <button type="button" className="pg-any" onClick={continueAnyway}>
                Continuer malgré tout (l'écart sera tracé dans le dossier)
              </button>
            </div>
          )}

          {(manualOpen || result?.status === "low_confidence" || result?.status === "no_plate") && !isMatch && (
            <div className="pg-man">
              <p><Keyboard size={16} /> Plaque illisible ? Saisie manuelle</p>
              <PlateInput value={manual} onChange={setManual} label="Plaque du véhicule" tone="blue" />
              <button type="button" onClick={runManual} disabled={busy || !manual.trim()} className="pg-cta">
                <Check size={16} /> Vérifier cette plaque
              </button>
            </div>
          )}

          {stage === "idle" && !manualOpen && (
            <button type="button" className="pg-link" onClick={() => setManualOpen(true)}>
              <Keyboard size={14} /> Saisir la plaque à la main
            </button>
          )}
        </main>

        <footer className="pg-ftr" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <input
            ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void runScan(f); }}
          />
          {isMatch ? (
            <button type="button" onClick={onValidated} className="pg-cta">Continuer vers les photos <ArrowRight size={18} /></button>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="pg-cta">
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
    </div>
  );
}
