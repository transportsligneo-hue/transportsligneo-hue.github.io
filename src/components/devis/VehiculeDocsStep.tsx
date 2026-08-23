/**
 * VehiculeDocsStep · étape obligatoire avant paiement d'un devis.
 *
 * - Saisie VIN (validation 17 caractères, pas de I/O/Q)
 * - Upload carte grise recto (obligatoire)
 * - Upload verso (optionnel)
 * - Compression côté client + caméra mobile
 * - Sauvegarde sur la table devis + flag vehicule_docs_completed
 */
import { useState } from "react";
import { Upload, Loader2, CheckCircle2, AlertTriangle, Camera, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  devisId: string;
  initialVin?: string | null;
  initialRectoUrl?: string | null;
  initialVersoUrl?: string | null;
  onCompleted: () => void;
}

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

export function VehiculeDocsStep({
  devisId,
  initialVin,
  initialRectoUrl,
  initialVersoUrl,
  onCompleted,
}: Props) {
  const { user } = useAuth();
  const [vin, setVin] = useState(initialVin ?? "");
  const [rectoUrl, setRectoUrl] = useState<string | null>(initialRectoUrl ?? null);
  const [versoUrl, setVersoUrl] = useState<string | null>(initialVersoUrl ?? null);
  const [uploading, setUploading] = useState<"recto" | "verso" | null>(null);
  const [saving, setSaving] = useState(false);

  const vinValid = VIN_REGEX.test(vin.trim());
  const canSave = vinValid && !!rectoUrl && !saving;

  const upload = async (file: File, kind: "recto" | "verso") => {
    if (!user) {
      toast.error("Connexion requise");
      return;
    }
    setUploading(kind);
    try {
      const compressed = await compressImage(file);
      const path = `${user.id}/${devisId}/carte-grise-${kind}-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("cartes-grises")
        .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      if (kind === "recto") setRectoUrl(path);
      else setVersoUrl(path);
      toast.success(`Carte grise ${kind} envoyée`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur upload";
      toast.error(msg);
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const { error } = await supabase
      .from("devis")
      .update({
        vin: vin.trim().toUpperCase(),
        carte_grise_recto_url: rectoUrl,
        carte_grise_verso_url: versoUrl,
        vehicule_docs_completed: true,
      })
      .eq("id", devisId);
    setSaving(false);
    if (error) {
      toast.error("Sauvegarde échouée");
      return;
    }
    toast.success("Documents véhicule enregistrés");
    onCompleted();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
        <AlertTriangle className="text-amber-300 shrink-0 mt-0.5" size={18} />
        <div className="text-sm text-amber-100">
          <p className="font-semibold">Documents véhicule requis avant paiement</p>
          <p className="text-amber-200/80 text-xs mt-1">
            Renseignez le VIN et envoyez la carte grise pour finaliser votre commande.
          </p>
        </div>
      </div>

      {/* VIN */}
      <div>
        <label className="text-cream/70 text-xs uppercase tracking-wider mb-2 block">
          Numéro VIN (17 caractères)
        </label>
        <input
          type="text"
          value={vin}
          onChange={(e) => setVin(e.target.value.toUpperCase().slice(0, 17))}
          placeholder="VF1RFA00567890123"
          maxLength={17}
          className="w-full px-3 py-2.5 rounded-lg bg-navy-dark border border-cream/20 text-cream font-mono text-sm focus:border-primary outline-none uppercase"
        />
        <div className="mt-1.5 flex items-center gap-2 text-[11px]">
          {vin.length === 0 ? (
            <span className="text-cream/40">Inscrit sur la carte grise (champ E)</span>
          ) : vinValid ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={12} /> Format valide
            </span>
          ) : (
            <span className="text-red-400 flex items-center gap-1">
              <AlertTriangle size={12} /> Format invalide ({vin.length}/17)
            </span>
          )}
        </div>
      </div>

      {/* Recto */}
      <UploadCard
        label="Carte grise · Recto"
        required
        currentPath={rectoUrl}
        uploading={uploading === "recto"}
        onFile={(f) => upload(f, "recto")}
      />

      {/* Verso */}
      <UploadCard
        label="Carte grise · Verso (optionnel)"
        currentPath={versoUrl}
        uploading={uploading === "verso"}
        onFile={(f) => upload(f, "verso")}
      />

      {/* Checklist */}
      <div className="rounded-lg border border-cream/10 bg-cream/5 p-3 text-xs space-y-1.5">
        <ChecklistItem ok={vinValid} label="VIN renseigné" />
        <ChecklistItem ok={!!rectoUrl} label="Carte grise recto envoyée" />
        <ChecklistItem ok={canSave} label="Prêt pour le paiement" />
      </div>

      <button
        onClick={save}
        disabled={!canSave}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary text-navy font-heading text-sm tracking-[0.15em] uppercase rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gold-light transition-colors"
      >
        {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
        Valider et continuer vers le paiement
      </button>
    </div>
  );
}

function UploadCard({
  label,
  required,
  currentPath,
  uploading,
  onFile,
}: {
  label: string;
  required?: boolean;
  currentPath: string | null;
  uploading: boolean;
  onFile: (file: File) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Génère URL signée pour preview
  const loadPreview = async (path: string) => {
    const { data } = await supabase.storage
      .from("cartes-grises")
      .createSignedUrl(path, 600);
    if (data?.signedUrl) setPreviewUrl(data.signedUrl);
  };

  if (currentPath && !previewUrl) {
    loadPreview(currentPath);
  }

  return (
    <div>
      <label className="text-cream/70 text-xs uppercase tracking-wider mb-2 block">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="rounded-lg border-2 border-dashed border-cream/20 bg-navy-dark/50 p-4">
        {currentPath ? (
          <div className="flex items-center gap-3">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={label}
                className="w-20 h-20 object-cover rounded border border-cream/10"
              />
            ) : (
              <div className="w-20 h-20 bg-cream/5 rounded flex items-center justify-center">
                <FileText className="text-cream/30" size={24} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-emerald-400 text-xs flex items-center gap-1">
                <CheckCircle2 size={12} /> Envoyé
              </p>
              <label className="inline-block mt-2 text-cream/60 text-xs underline cursor-pointer hover:text-cream">
                Remplacer
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setPreviewUrl(null);
                      onFile(f);
                    }
                  }}
                />
              </label>
            </div>
          </div>
        ) : (
          <label className="block cursor-pointer">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
            <div className="flex flex-col items-center justify-center py-6 text-cream/50 hover:text-cream/80 transition-colors">
              {uploading ? (
                <Loader2 className="animate-spin mb-2" size={24} />
              ) : (
                <>
                  <div className="flex gap-2 mb-2">
                    <Camera size={20} />
                    <Upload size={20} />
                  </div>
                  <p className="text-xs">Photo ou fichier</p>
                  <p className="text-[10px] text-cream/30 mt-1">JPG / PNG · max 10 Mo</p>
                </>
              )}
            </div>
          </label>
        )}
        <div className="mt-3 flex justify-center">
          <DocScanButton
            label={`Scanner ${label.toLowerCase()}`}
            maxPages={2}
            filenameBase="carte-grise"
            onFiles={(files) => {
              if (files[0]) {
                setPreviewUrl(null);
                onFile(files[0]);
              }
            }}
          />
        </div>
      </div>

    </div>
  );
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 ${ok ? "text-emerald-300" : "text-cream/50"}`}>
      <CheckCircle2 size={12} className={ok ? "" : "opacity-30"} />
      <span>{label}</span>
    </div>
  );
}
