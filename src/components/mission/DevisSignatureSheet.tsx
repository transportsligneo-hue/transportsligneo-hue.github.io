/**
 * DevisSignatureSheet · faire signer le devis de la mission à l'enlèvement.
 *
 * Deux modes, au choix du convoyeur :
 *  - « Sur papier » : impression / partage du PDF (espace de signature
 *    manuscrite en bas de page), puis import du document signé scanné.
 *  - « Sur l'app » : signature tactile superposée, horodatée et géolocalisée.
 *
 * Dans les deux cas, le devis signé est rattaché à la fiche mission
 * (mission_documents) et enregistré dans mission_devis_signatures.
 */
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Camera, Loader2, PenLine, Printer, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { generateDevisPdf, devisRowToPdfData, type DevisData } from "@/lib/devis-pdf";
import { SignatureCanvas } from "@/components/inspection/SignatureCanvas";

interface Props {
  attributionId: string;
  devisId: string;
  userId: string;
  numero: string;
  onSigned: () => void;
  onClose: () => void;
}

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(new Error("Lecture impossible"));
    r.readAsDataURL(file);
  });

const getPosition = () =>
  new Promise<{ latitude: number | null; longitude: number | null }>((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({ latitude: null, longitude: null });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => resolve({ latitude: null, longitude: null }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });

export function DevisSignatureSheet({ attributionId, devisId, userId, numero, onSigned, onClose }: Props) {
  const [data, setData] = useState<DevisData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<"apercu" | "app">("apercu");
  const [signerName, setSignerName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      const { data: row, error } = await supabase.from("devis").select("*").eq("id", devisId).maybeSingle();
      if (error || !row) {
        toast.error("Devis introuvable pour cette mission");
        return;
      }
      const d = devisRowToPdfData(row as unknown as Record<string, unknown>);
      if (cancelled) return;
      setData(d);
      const blob = await generateDevisPdf(d);
      if (cancelled) return;
      url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    })().catch((e) => toast.error("Aperçu du devis impossible", { description: e instanceof Error ? e.message : undefined }));
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [devisId]);

  const attach = useCallback(async (blob: Blob, filename: string, contentType: string, meta: {
    mode: "papier" | "app";
    signerName: string;
    signatureData?: string | null;
    latitude: number | null;
    longitude: number | null;
  }) => {
    const path = `${attributionId}/devis-signe/${Date.now()}_${filename}`;
    const { error: upErr } = await supabase.storage
      .from("mission-documents")
      .upload(path, blob, { contentType, upsert: true });
    if (upErr) throw upErr;

    const { error: rowErr } = await supabase.from("mission_devis_signatures" as never).upsert({
      attribution_id: attributionId,
      mode: meta.mode,
      signer_name: meta.signerName || null,
      signature_data: meta.signatureData ?? null,
      document_url: path,
      latitude: meta.latitude,
      longitude: meta.longitude,
      signed_at: new Date().toISOString(),
      created_by: userId,
    } as never, { onConflict: "attribution_id" } as never);
    if (rowErr) throw rowErr;

    await supabase.from("mission_documents").insert({
      attribution_id: attributionId,
      nom_fichier: filename,
      url_fichier: path,
      type_document: "devis_signe",
      uploaded_by: userId,
    } as never);
  }, [attributionId, userId]);

  const shareOrPrint = async () => {
    if (!previewUrl) return;
    const res = await fetch(previewUrl);
    const blob = await res.blob();
    const file = new File([blob], `devis-${numero}.pdf`, { type: "application/pdf" });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: `Devis ${numero}` });
        return;
      } catch { /* annulé */ }
    }
    window.open(previewUrl, "_blank");
  };

  const importSigned = async (file: File) => {
    setBusy(true);
    try {
      const isImg = file.type.startsWith("image/");
      const out = isImg ? await compressImage(file, { maxDimension: 1800, quality: 0.8 }) : file;
      const geo = await getPosition();
      await attach(out, `devis-signe-${numero}.${isImg ? "jpg" : "pdf"}`, out.type || "application/pdf", {
        mode: "papier",
        signerName: signerName.trim(),
        latitude: geo.latitude,
        longitude: geo.longitude,
      });
      toast.success("Devis signé rattaché à la mission");
      onSigned();
      onClose();
    } catch (e) {
      toast.error("Import impossible", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const signInApp = async (file: File) => {
    if (!data) return;
    if (!signerName.trim()) {
      toast.error("Nom du signataire requis");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const geo = await getPosition();
      const blob = await generateDevisPdf({ ...data, clientSignatureDataUrl: dataUrl });
      await attach(blob, `devis-signe-${numero}.pdf`, "application/pdf", {
        mode: "app",
        signerName: signerName.trim(),
        signatureData: dataUrl,
        latitude: geo.latitude,
        longitude: geo.longitude,
      });
      toast.success("Devis signé enregistré");
      onSigned();
      onClose();
    } catch (e) {
      toast.error("Signature non enregistrée", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#050a1f] text-white">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-white/10" aria-label="Fermer">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#d4af37]">Enlèvement</p>
          <p className="truncate text-sm font-semibold">Devis à faire signer · {numero}</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {mode === "apercu" ? (
          <div className="flex h-full flex-col">
            <div className="min-h-[45vh] flex-1 bg-[#0b1026]">
              {previewUrl ? (
                <iframe src={previewUrl} title="Devis" className="h-full min-h-[45vh] w-full" />
              ) : (
                <div className="flex h-full min-h-[45vh] items-center justify-center">
                  <Loader2 className="animate-spin text-[#d4af37]" size={24} />
                </div>
              )}
            </div>
            <div className="space-y-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Prénom NOM du signataire"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
              />
              <button
                type="button"
                onClick={() => void shareOrPrint()}
                disabled={!previewUrl}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 py-3 text-sm font-semibold text-white/80 disabled:opacity-40"
              >
                <Printer size={16} /> Imprimer / partager le devis
              </button>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 py-3 text-sm font-semibold text-white/80">
                <Camera size={16} /> Importer le devis signé (papier)
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void importSigned(f); }}
                />
              </label>
              <button
                type="button"
                onClick={() => setMode("app")}
                disabled={!data}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4af37] py-3.5 text-sm font-semibold text-[#0b1026] disabled:opacity-40"
              >
                <PenLine size={16} /> Faire signer sur l'app
              </button>
              {busy && (
                <p className="flex items-center justify-center gap-2 text-xs text-white/60">
                  <Loader2 className="animate-spin" size={14} /> Enregistrement…
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <p className="text-sm font-semibold">Signature du remettant</p>
            <input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Prénom NOM du signataire"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
            />
            <div className="rounded-2xl bg-white p-2">
              <SignatureCanvas
                key="devis-sign"
                disabled={busy || !signerName.trim()}
                onValidate={(file) => void signInApp(file)}
              />
            </div>
            <button
              type="button"
              onClick={() => setMode("apercu")}
              className="w-full rounded-xl border border-white/15 py-3 text-sm text-white/70"
            >
              Revenir à l'aperçu du devis
            </button>
            {busy && (
              <p className="flex items-center justify-center gap-2 text-xs text-white/60">
                <Loader2 className="animate-spin" size={14} /> Génération du devis signé…
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(body, document.body);
}

export const DevisSignatureDoneIcon = Check;
