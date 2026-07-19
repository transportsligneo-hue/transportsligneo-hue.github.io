/**
 * MissionGatesPanel · bloc visuel des étapes obligatoires de validation
 * (selfie identité + double signature départ + double signature arrivée).
 *
 * S'affiche au-dessus du workflow. Chaque "porte" peut être :
 *  - validée (verte)
 *  - en attente (CTA bouton)
 *  - bypassée par admin (badge gris)
 *
 * N'écrit rien tout seul · ouvre les modales contrôlées par le parent.
 */
import { useState } from "react";
import { Camera, PenLine, Check, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { useMissionGates } from "@/hooks/useMissionGates";
import { DriverSelfieCapture } from "./DriverSelfieCapture";
import { DoubleSignatureModal } from "./DoubleSignatureModal";

interface Props {
  attributionId: string;
  userId: string;
  driverName: string;
  clientName?: string;
  /** Affiche le bloc signatures arrivée (à activer une fois EDL arrivée faite). */
  showEndSignatures: boolean;
  onChange?: () => void;
}

export function MissionGatesPanel({
  attributionId, userId, driverName, clientName, showEndSignatures, onChange,
}: Props) {
  const { hasSelfie, hasSignature, isDisabled, loading, reload } = useMissionGates(attributionId);
  const [openSelfie, setOpenSelfie] = useState(false);
  const [openSig, setOpenSig] = useState<null | "start" | "end">(null);

  const refresh = () => { reload(); onChange?.(); };

  const selfieOK = hasSelfie || isDisabled("selfie");
  const startDriverOK = hasSignature("driver_start") || isDisabled("driver_start");
  const startClientOK = hasSignature("client_start") || isDisabled("client_start");
  const endDriverOK = hasSignature("driver_end") || isDisabled("driver_end");
  const endClientOK = hasSignature("client_end") || isDisabled("client_end");

  const Row = ({
    icon: Icon, label, ok, bypassed, cta, onClick,
  }: { icon: typeof Camera; label: string; ok: boolean; bypassed: boolean; cta: string; onClick: () => void }) => (
    <div className="flex items-center gap-3 py-2.5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
        ok ? "bg-emerald-100 text-emerald-700" : "bg-[#0b1026] text-[#d4af37]"
      }`}>
        {ok ? <Check size={16}/> : <Icon size={16}/>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-pro-text leading-tight">{label}</p>
        {bypassed && <p className="text-[10px] text-pro-muted flex items-center gap-1 mt-0.5"><ShieldAlert size={10}/>Bypass admin</p>}
      </div>
      {!ok && (
        <button onClick={onClick} className="px-3 py-1.5 bg-[#d4af37] text-[#0b1026] rounded-lg text-xs font-bold hover:bg-[#e7c76a]">
          {cta}
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-pro-border p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck size={16} className="text-[#d4af37]"/>
        <p className="text-sm font-bold text-[#0b1026]">Validations obligatoires</p>
        {loading && <Loader2 size={12} className="animate-spin text-pro-muted ml-auto"/>}
      </div>

      <Row
        icon={Camera}
        label="Selfie identité (Étape 0)"
        ok={selfieOK}
        bypassed={!hasSelfie && isDisabled("selfie")}
        cta="Prendre"
        onClick={() => setOpenSelfie(true)}
      />
      <div className="border-t border-pro-border/60"/>
      <Row
        icon={PenLine}
        label="Signature convoyeur · départ"
        ok={startDriverOK}
        bypassed={!hasSignature("driver_start") && isDisabled("driver_start")}
        cta="Signer"
        onClick={() => setOpenSig("start")}
      />
      <Row
        icon={PenLine}
        label="Signature client · départ"
        ok={startClientOK}
        bypassed={!hasSignature("client_start") && isDisabled("client_start")}
        cta="Signer"
        onClick={() => setOpenSig("start")}
      />

      {showEndSignatures && (
        <>
          <div className="border-t border-pro-border/60"/>
          <Row
            icon={PenLine}
            label="Signature convoyeur · arrivée"
            ok={endDriverOK}
            bypassed={!hasSignature("driver_end") && isDisabled("driver_end")}
            cta="Signer"
            onClick={() => setOpenSig("end")}
          />
          <Row
            icon={PenLine}
            label="Signature client · arrivée"
            ok={endClientOK}
            bypassed={!hasSignature("client_end") && isDisabled("client_end")}
            cta="Signer"
            onClick={() => setOpenSig("end")}
          />
        </>
      )}

      {openSelfie && (
        <DriverSelfieCapture
          attributionId={attributionId}
          userId={userId}
          onCaptured={refresh}
          onClose={() => setOpenSelfie(false)}
        />
      )}

      {openSig && (
        <DoubleSignatureModal
          attributionId={attributionId}
          userId={userId}
          mode={openSig}
          driverName={driverName}
          defaultClientName={clientName}
          alreadyDriver={openSig === "start" ? hasSignature("driver_start") : hasSignature("driver_end")}
          alreadyClient={openSig === "start" ? hasSignature("client_start") : hasSignature("client_end")}
          onComplete={refresh}
          onClose={() => setOpenSig(null)}
        />
      )}
    </div>
  );
}
