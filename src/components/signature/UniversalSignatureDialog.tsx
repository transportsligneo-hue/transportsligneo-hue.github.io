/**
 * UniversalSignatureDialog · module de signature commun à tous les documents.
 *
 * - Un emplacement de signature par document (registre `signature-slots`).
 * - Signature directe (souris / doigt) ou depuis le téléphone via QR code :
 *   la signature faite sur le mobile remonte en direct sur l'ordinateur.
 * - Position GPS + horodatage enregistrés comme preuve.
 * - La signature est stockée dans `mission_signatures` avec la clé
 *   `<document>:<emplacement>` : impossible de la placer sur un autre document.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, QrCode, Smartphone, X, Check } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SignatureCanvas } from "@/components/inspection/SignatureCanvas";
import {
  SIGNATURE_DOCS,
  signatureKind,
  type SignatureDocType,
} from "@/lib/signature-slots";

interface Props {
  open: boolean;
  attributionId: string;
  docType: SignatureDocType;
  /** Emplacement à signer (par défaut : le premier du document). */
  slot?: string;
  defaultSignerName?: string | null;
  onClose: () => void;
  onSigned?: () => void;
}

const SESSION_TTL_MIN = 30;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newShortCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(new Error("Lecture de la signature impossible"));
    r.readAsDataURL(file);
  });
}

function getPosition(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    const timer = setTimeout(() => resolve(null), 6000);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(timer); resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }); },
      () => { clearTimeout(timer); resolve(null); },
      { enableHighAccuracy: true, timeout: 5000 },
    );
  });
}

export function UniversalSignatureDialog({
  open, attributionId, docType, slot, defaultSignerName, onClose, onSigned,
}: Props) {
  const def = SIGNATURE_DOCS[docType];
  const [activeSlot, setActiveSlot] = useState(slot ?? def.slots[0]?.slot ?? "client");
  const [signer, setSigner] = useState(defaultSignerName ?? "");
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [shortCode, setShortCode] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const sessionId = useRef<string | null>(null);

  useEffect(() => { if (slot) setActiveSlot(slot); }, [slot]);
  useEffect(() => { if (open) { setQr(null); setShortCode(null); sessionId.current = null; } }, [open, docType]);

  /** Enregistre la signature sur le bon document et le bon emplacement. */
  const persist = useCallback(
    async (
      dataUrl: string,
      pos: { latitude: number; longitude: number } | null,
      signerName: string,
      source: "pc" | "telephone" = "pc",
    ) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("mission_signatures").upsert(
        {
          attribution_id: attributionId,
          kind: signatureKind(docType, activeSlot),
          signer_name: signerName || null,
          source,
          signature_data: dataUrl,
          signed_by_user_id: auth.user?.id ?? null,
          latitude: pos?.latitude ?? null,
          longitude: pos?.longitude ?? null,
          signed_at: new Date().toISOString(),
        } as never,
        { onConflict: "attribution_id,kind" },
      );
      if (error) throw error;
    },
    [activeSlot, attributionId, docType],
  );

  const handleLocal = useCallback(async (file: File) => {
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const pos = await getPosition();
      await persist(dataUrl, pos, signer.trim());
      toast.success("Signature enregistrée");
      onSigned?.();
      onClose();
    } catch (e) {
      toast.error("Signature non enregistrée", {
        description: e instanceof Error ? e.message : "Réessayez dans quelques secondes.",
      });
    } finally {
      setBusy(false);
    }
  }, [onClose, onSigned, persist, signer]);

  /** Ouvre une session de signature mobile et affiche le QR code. */
  const startPhone = useCallback(async () => {
    setQrBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const token = newToken();
      const code = newShortCode();
      const { data, error } = await supabase
        .from("signature_handoff_sessions")
        .insert({
          token,
          short_code: code,
          attribution_id: attributionId,
          doc_type: docType,
          slot: activeSlot,
          doc_label: `${def.label} — ${def.slots.find((s) => s.slot === activeSlot)?.label ?? activeSlot}`,
          signer_name: signer.trim() || null,
          created_by: auth.user?.id ?? null,
          expires_at: new Date(Date.now() + SESSION_TTL_MIN * 60_000).toISOString(),
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      sessionId.current = (data as { id: string }).id;
      setShortCode(code);
      const url = `${window.location.origin}/signer/${token}`;
      setQr(await QRCode.toDataURL(url, { width: 320, margin: 1 }));
    } catch {
      toast.error("Impossible de préparer la signature mobile");
    } finally {
      setQrBusy(false);
    }
  }, [activeSlot, attributionId, def, docType, signer]);

  /* Remontée temps réel de la signature faite sur le téléphone */
  useEffect(() => {
    if (!qr || !sessionId.current) return;
    const id = sessionId.current;
    const channel = supabase
      .channel(`sign-handoff-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "signature_handoff_sessions", filter: `id=eq.${id}` },
        (payload) => {
          const row = payload.new as {
            status: string; signature_data: string | null; latitude: number | null;
            longitude: number | null; signer_name: string | null;
          };
          if (row.status !== "signed" || !row.signature_data) return;
          void (async () => {
            try {
              await persist(
                row.signature_data as string,
                row.latitude != null && row.longitude != null
                  ? { latitude: row.latitude, longitude: row.longitude }
                  : null,
                row.signer_name ?? signer.trim(),
                "telephone",
              );
              toast.success("Signature reçue du téléphone");
              onSigned?.();
              onClose();
            } catch {
              toast.error("Signature reçue mais non enregistrée");
            }
          })();
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [onClose, onSigned, persist, qr, signer]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="admin-drawer-body flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-white p-5 text-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Signer — {def.label}</p>
            <p className="text-xs text-slate-500">Signature horodatée et géolocalisée</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
            <X size={16} />
          </button>
        </div>

        {def.slots.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {def.slots.map((s) => (
              <button
                key={s.slot}
                type="button"
                onClick={() => { setActiveSlot(s.slot); setQr(null); }}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  activeSlot === s.slot
                    ? "border-[#2F5FFF] bg-[#2F5FFF] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="sig-signer">
            Nom du signataire
          </label>
          <input
            id="sig-signer"
            value={signer}
            onChange={(e) => setSigner(e.target.value)}
            placeholder="Prénom Nom"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#2F5FFF]"
          />
        </div>

        {qr ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
            <img src={qr} alt="QR code de signature mobile" className="h-44 w-44 rounded-lg bg-white p-2" />
            <p className="text-sm font-medium text-slate-700">Scannez ce code avec le téléphone du signataire</p>
            {shortCode && (
              <div className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Ou rendez-vous sur {typeof window !== "undefined" ? window.location.host : ""}/signer et saisissez le code
                </p>
                <p className="text-2xl font-bold tracking-[0.3em] text-slate-900">{shortCode}</p>
              </div>
            )}
            <p className="text-xs text-slate-500">
              Lien valable {SESSION_TTL_MIN} minutes, à usage unique. La signature apparaîtra ici automatiquement.
            </p>
            <button type="button" onClick={() => { setQr(null); setShortCode(null); }} className="text-xs font-semibold text-[#2F5FFF] underline">
              Signer plutôt sur cet écran
            </button>
          </div>
        ) : (
          <>
            <div className="h-44 rounded-xl border border-slate-200 bg-white">
              <SignatureCanvas onValidate={(file) => void handleLocal(file)} disabled={busy} />
            </div>
            <button
              type="button"
              onClick={() => void startPhone()}
              disabled={qrBusy}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {qrBusy ? <Loader2 className="animate-spin" size={16} /> : <QrCode size={16} />}
              Signer depuis un téléphone
            </button>
          </>
        )}

        {busy && (
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="animate-spin" size={14} /> Enregistrement…
          </p>
        )}
        <p className="flex items-center gap-2 text-[11px] text-slate-400">
          <Smartphone size={12} /> La signature est rattachée au document « {def.label} » uniquement.
        </p>
      </div>
    </div>
  );
}

export const SignatureCheckIcon = Check;
