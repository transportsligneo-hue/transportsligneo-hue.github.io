/**
 * EdlNonRoulantFlow · état des lieux SIMPLIFIÉ pour véhicule non roulant
 * (transport sur plateau).
 *
 * ⚠️ Parcours totalement séparé de l'EDL roulant (EdlPremiumFlow) : il ne
 * partage que la charte visuelle et le composant de signature.
 *
 * Étapes : arrimage → 4 photos extérieures annotables → observations →
 * signature convoyeur → signature remettant → PDF + email + rattachement
 * à la fiche mission.
 */
import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, Camera, Check, ChevronRight, Loader2, PenLine, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { sendTransactionalEmail } from "@/lib/email/send";
import { SignatureCanvas } from "@/components/inspection/SignatureCanvas";
import { PhotoDamageAnnotator } from "@/components/inspection/PhotoDamageAnnotator";
import {
  ARRIMAGE_ITEMS,
  NR_VIEWS,
  generateEdlNonRoulantPdf,
  type NrAnnotation,
  type NrViewId,
} from "@/lib/edl-non-roulant-pdf";

interface Props {
  attributionId: string;
  userId: string;
  driverName: string;
  numero: string;
  mission: {
    depart?: string | null;
    arrivee?: string | null;
    marque?: string | null;
    modele?: string | null;
    immatriculation?: string | null;
    vin?: string | null;
    date_trajet?: string | null;
  };
  onComplete: () => void;
  onClose: () => void;
}

type Step = "arrimage" | "photos" | "observations" | "sign_driver" | "sign_remettant" | "done";

interface PhotoState {
  dataUrl: string | null;
  annotations: NrAnnotation[];
  storagePath?: string | null;
}

interface SignState {
  nom: string;
  dataUrl: string | null;
  signedAt: string | null;
  latitude: number | null;
  longitude: number | null;
}

const emptySign = (nom = ""): SignState => ({ nom, dataUrl: null, signedAt: null, latitude: null, longitude: null });

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(new Error("Lecture de l'image impossible"));
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

export function EdlNonRoulantFlow({
  attributionId, userId, driverName, numero, mission, onComplete, onClose,
}: Props) {
  const [step, setStep] = useState<Step>("arrimage");
  const [arrimage, setArrimage] = useState<Record<string, boolean>>({});
  const [photos, setPhotos] = useState<Record<NrViewId, PhotoState>>(() =>
    Object.fromEntries(NR_VIEWS.map((v) => [v.id, { dataUrl: null, annotations: [] } as PhotoState])) as unknown as Record<NrViewId, PhotoState>,
  );
  const [annotating, setAnnotating] = useState<NrViewId | null>(null);
  const [observations, setObservations] = useState("");
  const [driverSign, setDriverSign] = useState<SignState>(() => emptySign(driverName));
  const [remettantSign, setRemettantSign] = useState<SignState>(() => emptySign(""));
  const [busy, setBusy] = useState(false);

  const arrimageOk = ARRIMAGE_ITEMS.every((i) => arrimage[i.id]);
  const photosOk = NR_VIEWS.every((v) => !!photos[v.id].dataUrl);

  const capture = useCallback(async (vue: NrViewId, file: File) => {
    try {
      const compressed = await compressImage(file, { maxDimension: 1400, quality: 0.72 });
      const dataUrl = await fileToDataUrl(compressed);
      const path = `${attributionId}/edl-non-roulant/${vue}_${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("mission-documents")
        .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
      if (error) console.warn("[EDL NR] upload photo", error.message);
      setPhotos((prev) => ({ ...prev, [vue]: { ...prev[vue], dataUrl, storagePath: error ? null : path } }));
    } catch (e) {
      toast.error("Photo non enregistrée", {
        description: e instanceof Error ? e.message : "Réessayez.",
      });
    }
  }, [attributionId]);

  const pdfData = useMemo(() => ({
    numero,
    date: mission.date_trajet ?? new Date().toISOString(),
    convoyeur_nom: driverSign.nom || driverName,
    remettant_nom: remettantSign.nom,
    lieu_prise_en_charge: mission.depart ?? null,
    destination: mission.arrivee ?? null,
    marque: mission.marque ?? null,
    modele: mission.modele ?? null,
    immatriculation: mission.immatriculation ?? null,
    vin: mission.vin ?? null,
    arrimage,
    observations,
    photos: NR_VIEWS.map((v) => ({
      vue: v.id,
      dataUrl: photos[v.id].dataUrl,
      annotations: photos[v.id].annotations,
    })),
    signature_convoyeur: {
      nom: driverSign.nom || driverName,
      dataUrl: driverSign.dataUrl,
      signedAt: driverSign.signedAt,
      latitude: driverSign.latitude,
      longitude: driverSign.longitude,
    },
    signature_remettant: {
      nom: remettantSign.nom,
      dataUrl: remettantSign.dataUrl,
      signedAt: remettantSign.signedAt,
      latitude: remettantSign.latitude,
      longitude: remettantSign.longitude,
    },
  }), [numero, mission, driverName, driverSign, remettantSign, arrimage, observations, photos]);

  const finalize = async (remettant: SignState) => {
    setBusy(true);
    try {
      const blob = await generateEdlNonRoulantPdf({ ...pdfData, remettant_nom: remettant.nom, signature_remettant: {
        nom: remettant.nom, dataUrl: remettant.dataUrl, signedAt: remettant.signedAt,
        latitude: remettant.latitude, longitude: remettant.longitude,
      } });
      const filename = `bon-prise-en-charge-${numero.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;
      const path = `${attributionId}/edl-non-roulant/${Date.now()}_${filename}`;
      const { error: upErr } = await supabase.storage
        .from("mission-documents")
        .upload(path, blob, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;

      const { error: rowErr } = await supabase.from("edl_non_roulant" as never).upsert({
        attribution_id: attributionId,
        arrimage,
        photos: NR_VIEWS.map((v) => ({
          vue: v.id,
          storage_path: photos[v.id].storagePath ?? null,
          annotations: photos[v.id].annotations,
        })),
        observations: observations || null,
        convoyeur_nom: driverSign.nom || driverName,
        convoyeur_signature: driverSign.dataUrl,
        convoyeur_signed_at: driverSign.signedAt,
        convoyeur_latitude: driverSign.latitude,
        convoyeur_longitude: driverSign.longitude,
        remettant_nom: remettant.nom,
        remettant_signature: remettant.dataUrl,
        remettant_signed_at: remettant.signedAt,
        remettant_latitude: remettant.latitude,
        remettant_longitude: remettant.longitude,
        pdf_url: path,
        statut: "signe",
        created_by: userId,
      } as never, { onConflict: "attribution_id" } as never);
      if (rowErr) throw rowErr;

      await supabase.from("mission_documents").insert({
        attribution_id: attributionId,
        nom_fichier: filename,
        url_fichier: path,
        type_document: "edl_non_roulant",
        uploaded_by: userId,
      } as never);

      sendTransactionalEmail({
        templateName: "document-mission-admin",
        recipientEmail: "contact@transportsligneo.fr",
        idempotencyKey: `edl-nr-${attributionId}`,
        templateData: {
          numero,
          type: "Bon de prise en charge — véhicule non roulant",
          convoyeur: driverSign.nom || driverName,
          commentaire: observations || "RAS",
          attributionId,
          documentName: filename,
          documentType: "Bon de prise en charge (non roulant)",
          uploadedAt: new Date().toLocaleString("fr-FR"),
        },
      }).catch((e) => console.warn("[EDL NR] email admin non bloquant", e));

      setStep("done");
      toast.success("Bon de prise en charge enregistré");
      setTimeout(() => { onComplete(); onClose(); }, 900);
    } catch (e) {
      toast.error("Enregistrement impossible", {
        description: e instanceof Error ? e.message : "Réessayez dans quelques secondes.",
      });
    } finally {
      setBusy(false);
    }
  };

  const stepIndex = ["arrimage", "photos", "observations", "sign_driver", "sign_remettant"].indexOf(step);

  const body = (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#050a1f] text-white">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-white/10" aria-label="Fermer">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#d4af37]">Véhicule non roulant · plateau</p>
          <p className="truncate text-sm font-semibold">Bon de prise en charge · {numero}</p>
        </div>
        <span className="text-xs text-white/50">{Math.max(stepIndex + 1, 1)}/5</span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {step === "arrimage" && (
          <section className="space-y-3">
            <div className="rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/5 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#d4af37]">
                <ShieldCheck size={16} /> Contrôle d'arrimage
              </p>
              <p className="mt-1 text-xs text-white/60">
                À vérifier avant les photos. Les quatre points sont obligatoires.
              </p>
            </div>
            {ARRIMAGE_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setArrimage((p) => ({ ...p, [item.id]: !p[item.id] }))}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition ${
                  arrimage[item.id]
                    ? "border-emerald-400/40 bg-emerald-500/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/70"
                }`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-md border ${
                  arrimage[item.id] ? "border-emerald-400 bg-emerald-500 text-white" : "border-white/25"
                }`}>
                  {arrimage[item.id] && <Check size={14} />}
                </span>
                {item.label}
              </button>
            ))}
            <button
              type="button"
              disabled={!arrimageOk}
              onClick={() => setStep("photos")}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4af37] py-3.5 text-sm font-semibold text-[#0b1026] disabled:opacity-40"
            >
              Continuer <ChevronRight size={16} />
            </button>
          </section>
        )}

        {step === "photos" && (
          <section className="space-y-3">
            <p className="text-xs text-white/60">
              Quatre photos extérieures. Touchez une photo prise pour marquer les dommages.
            </p>
            {NR_VIEWS.map((v) => {
              const p = photos[v.id];
              return (
                <div key={v.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{v.label}</p>
                    {p.dataUrl && (
                      <span className="text-[11px] text-emerald-300">
                        {p.annotations.length} dommage{p.annotations.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {p.dataUrl ? (
                    <div className="mt-2 space-y-2">
                      <img src={p.dataUrl} alt={v.label} className="w-full rounded-xl" />
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAnnotating(v.id)}
                          className="rounded-lg border border-[#d4af37]/40 py-2 text-xs font-semibold text-[#d4af37]"
                        >
                          Annoter les dommages
                        </button>
                        <label className="cursor-pointer rounded-lg border border-white/15 py-2 text-center text-xs text-white/70">
                          Reprendre
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) void capture(v.id, f); }}
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-6 text-sm text-white/60">
                      <Camera size={16} /> Prendre la photo
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void capture(v.id, f); }}
                      />
                    </label>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              disabled={!photosOk}
              onClick={() => setStep("observations")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4af37] py-3.5 text-sm font-semibold text-[#0b1026] disabled:opacity-40"
            >
              Continuer <ChevronRight size={16} />
            </button>
          </section>
        )}

        {step === "observations" && (
          <section className="space-y-3">
            <p className="text-sm font-semibold">Observations particulières</p>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={6}
              placeholder="Facultatif — précisions sur l'état du véhicule ou le chargement."
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
            />
            <button
              type="button"
              onClick={() => setStep("sign_driver")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4af37] py-3.5 text-sm font-semibold text-[#0b1026]"
            >
              <PenLine size={16} /> Passer aux signatures
            </button>
          </section>
        )}

        {step === "sign_driver" && (
          <section className="space-y-3">
            <p className="text-sm font-semibold">1/2 · Signature du convoyeur</p>
            <p className="text-xs text-white/55">{driverName}</p>
            <div className="rounded-2xl bg-white p-2">
              <SignatureCanvas
                key="nr-driver"
                disabled={busy}
                onValidate={async (file) => {
                  const dataUrl = await fileToDataUrl(file);
                  const geo = await getPosition();
                  setDriverSign({ nom: driverName, dataUrl, signedAt: new Date().toISOString(), ...geo });
                  setStep("sign_remettant");
                }}
              />
            </div>
          </section>
        )}

        {step === "sign_remettant" && (
          <section className="space-y-3">
            <p className="text-sm font-semibold">2/2 · Signature du remettant</p>
            <input
              value={remettantSign.nom}
              onChange={(e) => setRemettantSign((p) => ({ ...p, nom: e.target.value }))}
              placeholder="Prénom NOM du remettant"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
            />
            <div className="rounded-2xl bg-white p-2">
              <SignatureCanvas
                key="nr-remettant"
                disabled={busy || !remettantSign.nom.trim()}
                onValidate={async (file) => {
                  const dataUrl = await fileToDataUrl(file);
                  const geo = await getPosition();
                  const next: SignState = {
                    nom: remettantSign.nom.trim(),
                    dataUrl,
                    signedAt: new Date().toISOString(),
                    ...geo,
                  };
                  setRemettantSign(next);
                  await finalize(next);
                }}
              />
            </div>
            {!remettantSign.nom.trim() && (
              <p className="text-xs text-amber-300">Saisissez le nom du remettant pour activer la signature.</p>
            )}
            {busy && (
              <p className="flex items-center justify-center gap-2 text-xs text-white/60">
                <Loader2 className="animate-spin" size={14} /> Génération du bon de prise en charge…
              </p>
            )}
          </section>
        )}

        {step === "done" && (
          <div className="flex h-full flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
              <Check size={30} />
            </div>
            <p className="text-base font-semibold">Bon de prise en charge signé</p>
            <p className="mt-1 text-sm text-white/60">Il est rattaché à la mission et envoyé à l'exploitation.</p>
          </div>
        )}
      </div>

      {annotating && photos[annotating].dataUrl && (
        <PhotoDamageAnnotator
          photoUrl={photos[annotating].dataUrl as string}
          label={NR_VIEWS.find((v) => v.id === annotating)?.label ?? ""}
          annotations={photos[annotating].annotations}
          onChange={(next) =>
            setPhotos((prev) => ({ ...prev, [annotating]: { ...prev[annotating], annotations: next } }))
          }
          onClose={() => setAnnotating(null)}
        />
      )}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(body, document.body);
}
