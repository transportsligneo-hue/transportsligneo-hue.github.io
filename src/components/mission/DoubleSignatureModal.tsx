/**
 * DoubleSignatureModal · workflow signature obligatoire.
 *
 * Deux modes :
 *   - "start" : signature départ (driver_start puis client_start)
 *   - "end"   : signature arrivée (driver_end puis client_end)
 *
 * Ordre strict : driver d'abord, client ensuite.
 * Stocke les signatures dans mission_signatures (signature_data = data URL).
 */
import { useState } from "react";
import { X, User, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { SignatureCanvas } from "@/components/inspection/SignatureCanvas";
import {
  saveMissionSignature,
  toastSignatureError,
  toastSignatureSuccess,
} from "@/lib/signature-upload";

type Phase = "driver" | "client" | "done";

interface Props {
  attributionId: string;
  userId: string;
  mode: "start" | "end";
  driverName: string;
  defaultClientName?: string;
  alreadyDriver: boolean;
  alreadyClient: boolean;
  onComplete: () => void;
  onClose: () => void;
}

export function DoubleSignatureModal({
  attributionId, userId, mode, driverName, defaultClientName,
  alreadyDriver, alreadyClient, onComplete, onClose,
}: Props) {
  const driverKind = mode === "start" ? "driver_start" : "driver_end";
  const clientKind = mode === "start" ? "client_start" : "client_end";

  const initialPhase: Phase = alreadyDriver ? (alreadyClient ? "done" : "client") : "driver";
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [clientName, setClientName] = useState(defaultClientName ?? "");
  const [saving, setSaving] = useState(false);

  const saveSignature = async (kind: string, signerName: string, file: File) => {
    setSaving(true);
    try {
      await saveMissionSignature({
        attributionId,
        kind,
        signerName,
        file,
        signedByUserId: userId,
      });
      toastSignatureSuccess(`Signature ${signerName} enregistrée`);
    } catch (err) {
      toastSignatureError(err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleDriver = async (file: File) => {
    try {
      await saveSignature(driverKind, driverName, file);
      setPhase("client");
    } catch { /* keep phase */ }
  };

  const handleClient = async (file: File) => {
    if (!clientName.trim()) {
      toast.error("Nom du client requis", { id: "signature-save" });
      return;
    }
    try {
      await saveSignature(clientKind, clientName.trim(), file);
      setPhase("done");
      setTimeout(() => { onComplete(); onClose(); }, 600);
    } catch { /* keep phase */ }
  };

  const title = mode === "start" ? "Signatures départ" : "Signatures arrivée";

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#0b1026] text-white px-4 py-3 flex items-center justify-between sm:rounded-t-2xl">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#d4af37]">{title}</p>
            <p className="text-sm font-semibold">
              {phase === "driver" && "1/2 · Signature convoyeur"}
              {phase === "client" && "2/2 · Signature client"}
              {phase === "done" && "Signatures complètes"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg"><X size={18}/></button>
        </div>

        <div className="p-4 space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {phase === "driver" && (
            <>
              <div className="flex items-center gap-2 p-3 bg-pro-bg-soft rounded-xl">
                <User size={16} className="text-pro-muted"/>
                <div className="text-sm">
                  <p className="text-pro-muted text-[10px] uppercase">Convoyeur</p>
                  <p className="font-semibold text-pro-text">{driverName}</p>
                </div>
              </div>
              <SignatureCanvas key="driver" onValidate={handleDriver} disabled={saving}/>
            </>
          )}

          {phase === "client" && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-pro-muted font-medium">Nom du client signataire</label>
                <input
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="Prénom NOM"
                  className="w-full px-3 py-2.5 border border-pro-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                />
              </div>
              <SignatureCanvas key="client" onValidate={handleClient} disabled={saving || !clientName.trim()}/>
            </>
          )}

          {phase === "done" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                {saving ? <Loader2 className="animate-spin text-emerald-600" size={28}/> : <Check className="text-emerald-600" size={28}/>}
              </div>
              <p className="font-semibold text-pro-text">Les deux signatures sont enregistrées</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
