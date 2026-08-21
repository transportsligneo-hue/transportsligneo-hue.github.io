import { useEffect, useMemo, useRef, useState } from "react";
import {
  BatteryCharging,
  Camera,
  Check,
  Gauge,
  KeyRound,
  Loader2,
  MapPin,
  Navigation,
  PenLine,
  PlugZap,
  RotateCcw,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { saveMissionSignature } from "@/lib/signature-upload";
import { SignatureCanvas } from "@/components/inspection/SignatureCanvas";
import { Button } from "@/components/ui/button";

type CompletionItem = { done: boolean; at?: string; photo_url?: string | null };
type CompletionMap = Record<string, CompletionItem>;

interface Props {
  attributionId: string;
  userId: string;
  driverName: string;
  currentEtape: string | null;
  statut: string;
  completions: CompletionMap;
  missionNumber?: string | null;
  plaque?: string | null;
  depart?: string | null;
  rechargePoint?: string | null;
  onMacroStatusChange: (newStatut: string) => Promise<boolean> | boolean;
  onUpdated: () => Promise<void> | void;
}

const FLOW = [
  { key: "recharge_depart", label: "Départ", icon: KeyRound },
  { key: "recharge_trajet_aller", label: "Trajet aller", icon: Navigation },
  { key: "recharge_branchee", label: "Mise en charge", icon: PlugZap },
  { key: "recharge_terminee", label: "Charge terminée", icon: BatteryCharging },
  { key: "recharge_trajet_retour", label: "Retour au site", icon: RotateCcw },
  { key: "recharge_restitution", label: "Restitution", icon: Gauge },
  { key: "recharge_signature", label: "Signature et envoi", icon: PenLine },
] as const;

function done(map: CompletionMap, key: string) {
  return map[key]?.done === true;
}

export function RechargeMissionCockpit({
  attributionId,
  userId,
  driverName,
  currentEtape: _currentEtape,
  statut,
  completions,
  missionNumber,
  plaque,
  depart,
  rechargePoint,
  onMacroStatusChange,
  onUpdated,
}: Props) {
  const [local, setLocal] = useState<CompletionMap>(completions ?? {});
  const [busy, setBusy] = useState(false);
  const [photoKey, setPhotoKey] = useState<"recharge_compteur_depart" | "recharge_branchee" | "recharge_compteur_retour" | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setLocal(completions ?? {}), [completions]);

  const currentIndex = useMemo(() => {
    if (!done(local, "recharge_cles_depart") || !done(local, "recharge_compteur_depart")) return 0;
    if (!done(local, "recharge_trajet_aller")) return 1;
    if (!done(local, "recharge_branchee")) return 2;
    if (!done(local, "recharge_terminee")) return 3;
    if (!done(local, "recharge_trajet_retour")) return 4;
    if (!done(local, "recharge_compteur_retour") || !done(local, "recharge_cles_retour")) return 5;
    return 6;
  }, [local]);

  const sent = statut === "en_attente_validation" || statut === "validee" || statut === "termine";

  async function saveCompletion(key: string, item: CompletionItem, etape?: string) {
    const next = { ...local, [key]: item };
    setLocal(next);
    const patch: Record<string, unknown> = { options_completion: next };
    if (etape) patch.etape_courante = etape;
    const { error } = await supabase.from("attributions").update(patch as never).eq("id", attributionId);
    if (error) {
      setLocal(local);
      throw error;
    }
    await Promise.resolve(onUpdated());
  }

  async function validateTask(key: string, etape?: string) {
    setBusy(true);
    try {
      await saveCompletion(key, { done: true, at: new Date().toISOString() }, etape);
      toast.success("Tâche validée");
    } catch (error) {
      toast.error("Validation impossible", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  function requestPhoto(key: typeof photoKey) {
    setPhotoKey(key);
    requestAnimationFrame(() => fileRef.current?.click());
  }

  async function handlePhoto(file?: File) {
    if (!file || !photoKey) return;
    const key = photoKey;
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      const path = `${userId}/${attributionId}/recharge/${key}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("inspection-photos")
        .upload(path, compressed, { contentType: compressed.type || "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;
      await saveCompletion(key, { done: true, at: new Date().toISOString(), photo_url: path });
      toast.success(key === "recharge_branchee" ? "Photo du véhicule en charge enregistrée" : "Photo du compteur enregistrée");
    } catch (error) {
      toast.error("Photo non enregistrée", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
      setPhotoKey(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function startOutbound() {
    setBusy(true);
    try {
      await saveCompletion("recharge_trajet_aller", { done: true, at: new Date().toISOString() }, "recharge_trajet_aller");
      await Promise.resolve(onMacroStatusChange("en_cours"));
      toast.success("Trajet aller démarré · GPS actif");
    } catch (error) {
      toast.error("Démarrage impossible", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function sign(file: File) {
    setBusy(true);
    try {
      await saveMissionSignature({
        attributionId,
        kind: "client_end",
        signerName: "Responsable du site",
        file,
        uploadToStorage: true,
      });
      await saveCompletion("recharge_signature", { done: true, at: new Date().toISOString() }, "recharge_signature");
      setSignatureOpen(false);
      toast.success("Signature enregistrée");
    } catch (error) {
      toast.error("Signature non enregistrée", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function sendToAdmin() {
    setBusy(true);
    try {
      await saveCompletion("recharge_envoyee", { done: true, at: new Date().toISOString() }, "en_attente_validation");
      await Promise.resolve(onMacroStatusChange("en_attente_validation"));
      toast.success("Dossier de rechargement envoyé à l’admin");
    } catch (error) {
      toast.error("Envoi impossible", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  const active = FLOW[Math.min(currentIndex, FLOW.length - 1)];
  const ActiveIcon = active.icon;

  return (
    <section className="mx-3 mb-5 overflow-hidden rounded-[1.75rem] border border-cyan-300/15 bg-[#07102b] text-slate-50 shadow-[0_24px_70px_rgba(0,0,0,0.42)]">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void handlePhoto(event.target.files?.[0])}
      />

      <header className="border-b border-cyan-300/10 bg-[#0b1537] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase text-cyan-300">Mission rechargement</p>
            <h2 className="mt-1 text-base font-bold">{missionNumber ?? "Recharge électrique"}</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[11px] font-bold text-amber-200">
            <PlugZap size={13} /> {plaque ?? "Véhicule"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px] text-slate-300">
          <span className="truncate">{depart ?? "Site de départ"}</span>
          <Navigation size={13} className="text-cyan-300" />
          <span className="truncate text-right">{rechargePoint ?? "Point de charge"}</span>
        </div>
      </header>

      <div className="flex gap-1.5 overflow-x-auto px-4 py-3">
        {FLOW.map((step, index) => {
          const Icon = step.icon;
          const completed = index < currentIndex || sent;
          const selected = index === currentIndex && !sent;
          return (
            <span
              key={step.key}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold transition-all duration-300 ${
                completed
                  ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                  : selected
                    ? "border-cyan-300/60 bg-cyan-300/20 text-cyan-100 shadow-[0_0_18px_-4px_rgba(103,232,249,0.7)] scale-[1.04]"
                    : "border-slate-600/40 text-slate-500"
              }`}
            >
              {completed ? <Check size={11} /> : <Icon size={11} />} {step.label}
            </span>
          );
        })}
      </div>

      <div className="px-4 pb-5">
        <div className="rounded-3xl border border-cyan-300/15 bg-slate-50/[0.04] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200">
              <ActiveIcon size={22} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase text-cyan-300">Étape {Math.min(currentIndex + 1, FLOW.length)} / {FLOW.length}</p>
              <h3 className="mt-1 text-base font-bold">{sent ? "Dossier envoyé à l’admin" : active.label}</h3>
            </div>
          </div>

          {!sent && currentIndex === 0 && (
            <div className="mt-4 grid gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy || done(local, "recharge_cles_depart")}
                onClick={() => void validateTask("recharge_cles_depart")}
                className="rch-cta-ghost h-14 justify-start gap-3 px-4 text-[15px] hover:text-slate-50"
              >
                {done(local, "recharge_cles_depart") ? <Check /> : <KeyRound />} Clés récupérées
              </Button>
              <Button
                type="button"
                disabled={busy || done(local, "recharge_compteur_depart")}
                onClick={() => requestPhoto("recharge_compteur_depart")}
                className="rch-cta h-14 justify-start gap-3 px-4 text-[15px]"
              >
                {busy && photoKey === "recharge_compteur_depart" ? <Loader2 className="animate-spin" /> : done(local, "recharge_compteur_depart") ? <Check /> : <Camera />}
                Photo du compteur au départ
              </Button>
            </div>
          )}

          {!sent && currentIndex === 1 && (
            <Button disabled={busy} onClick={() => void startOutbound()} className="rch-cta mt-4 h-14 w-full gap-3 text-[15px]">
              {busy ? <Loader2 className="animate-spin" /> : <Navigation />} Démarrer le trajet vers la borne
            </Button>
          )}

          {!sent && currentIndex === 2 && (
            <Button disabled={busy} onClick={() => requestPhoto("recharge_branchee")} className="rch-cta mt-4 h-14 w-full gap-3 text-[15px]">
              {busy ? <Loader2 className="animate-spin" /> : <Camera />} Photo du véhicule branché
            </Button>
          )}

          {!sent && currentIndex === 3 && (
            <Button disabled={busy} onClick={() => void validateTask("recharge_terminee", "recharge_terminee")} className="rch-cta mt-4 h-14 w-full gap-3 text-[15px]">
              {busy ? <Loader2 className="animate-spin" /> : <BatteryCharging />} Chargement terminé
            </Button>
          )}

          {!sent && currentIndex === 4 && (
            <Button disabled={busy} onClick={() => void validateTask("recharge_trajet_retour", "recharge_trajet_retour")} className="rch-cta mt-4 h-14 w-full gap-3 text-[15px]">
              {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />} Démarrer le retour au site de départ
            </Button>
          )}

          {!sent && currentIndex === 5 && (
            <div className="mt-4 grid gap-2">
              <Button
                variant="outline"
                disabled={busy || done(local, "recharge_cles_retour")}
                onClick={() => void validateTask("recharge_cles_retour")}
                className="rch-cta-ghost h-14 justify-start gap-3 px-4 text-[15px] hover:text-slate-50"
              >
                {done(local, "recharge_cles_retour") ? <Check /> : <KeyRound />} Clés restituées
              </Button>
              <Button
                disabled={busy || done(local, "recharge_compteur_retour")}
                onClick={() => requestPhoto("recharge_compteur_retour")}
                className="rch-cta h-14 justify-start gap-3 px-4 text-[15px]"
              >
                {busy ? <Loader2 className="animate-spin" /> : done(local, "recharge_compteur_retour") ? <Check /> : <Camera />}
                Photo du compteur au retour
              </Button>
            </div>
          )}

          {!sent && currentIndex === 6 && (
            <div className="mt-4 grid gap-2">
              {!done(local, "recharge_signature") ? (
                <Button disabled={busy} onClick={() => setSignatureOpen(true)} className="rch-cta h-14 w-full gap-3 text-[15px]">
                  <PenLine /> Faire signer le responsable
                </Button>
              ) : (
                <Button disabled={busy} onClick={() => void sendToAdmin()} className="rch-cta-gold h-14 w-full gap-3 text-[15px]">
                  {busy ? <Loader2 className="animate-spin" /> : <Send />} Signer et envoyer à l’admin
                </Button>
              )}
            </div>
          )}
        </div>

        {currentIndex >= 2 && currentIndex <= 3 && !sent && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-2.5 text-xs text-cyan-100">
            <MapPin size={14} /> Arrivée sur le point de chargement
          </div>
        )}
      </div>

      {signatureOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#020617]/80 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl bg-slate-50 p-4 text-slate-900 sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">Signature du responsable</p>
                <p className="text-xs text-slate-500">Restitution du véhicule après rechargement · convoyeur {driverName}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSignatureOpen(false)}>Fermer</Button>
            </div>
            <SignatureCanvas onValidate={(file) => void sign(file)} disabled={busy} />
          </div>
        </div>
      )}
    </section>
  );
}