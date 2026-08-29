/**
 * ClientVehicleDocsCard · dépôt de documents véhicule par le client.
 *
 * Le client (particulier comme professionnel) peut scanner (app mobile) ou
 * importer (web) sa carte grise, son assurance ou tout justificatif véhicule.
 * Les fichiers sont rangés dans le bucket privé `cartes-grises` sous
 * `{user_id}/mes-documents/…` : seul le client (et l'admin) y a accès.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { DocScanButton } from "@/components/scanner/DocScanButton";
import { toast } from "sonner";
import { Upload, Loader2, FileText, Trash2, Eye, ImageIcon } from "lucide-react";

const BUCKET = "cartes-grises";
const FOLDER = "mes-documents";
const MAX_SIZE = 10 * 1024 * 1024;

interface StoredDoc {
  name: string;
  path: string;
  size: number;
  createdAt: string | null;
}

export default function ClientVehicleDocsCard({ userId }: { userId: string }) {
  const [docs, setDocs] = useState<StoredDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const prefix = `${userId}/${FOLDER}`;

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (error) {
      toast.error("Impossible de charger vos documents");
      setDocs([]);
    } else {
      setDocs(
        (data ?? [])
          .filter((f) => f.id !== null)
          .map((f) => ({
            name: f.name,
            path: `${prefix}/${f.name}`,
            size: (f.metadata as { size?: number } | null)?.size ?? 0,
            createdAt: f.created_at ?? null,
          })),
      );
    }
    setLoading(false);
  }, [prefix]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setBusy(true);
      try {
        for (const file of files) {
          if (file.size > MAX_SIZE) {
            toast.error(`${file.name} dépasse 10 Mo`);
            continue;
          }
          const isImage = file.type.startsWith("image/");
          const body = isImage ? await compressImage(file) : file;
          const ext = isImage ? "jpg" : (file.name.split(".").pop() || "pdf").toLowerCase();
          const safe = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 40) || "document";
          const path = `${prefix}/${safe}-${Date.now()}.${ext}`;
          const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
            upsert: false,
            contentType: isImage ? "image/jpeg" : file.type || "application/octet-stream",
          });
          if (error) throw error;
        }
        toast.success(files.length > 1 ? "Documents envoyés" : "Document envoyé");
        await load();
      } catch (e) {
        toast.error("Envoi impossible", { description: e instanceof Error ? e.message : undefined });
      } finally {
        setBusy(false);
      }
    },
    [prefix, load],
  );

  const open = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
    if (error || !data?.signedUrl) {
      toast.error("Aperçu indisponible");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const remove = async (path: string) => {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) {
      toast.error("Suppression impossible", { description: error.message });
      return;
    }
    toast.success("Document supprimé");
    await load();
  };

  return (
    <section className="card-premium p-5 rounded">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-cream/40 text-[10px] uppercase tracking-wider">Mes pièces véhicule</p>
          <h2 className="text-cream font-heading text-base mt-1">Carte grise & justificatifs</h2>
          <p className="text-cream/50 text-xs mt-1">
            Scannez ou importez votre carte grise, votre assurance ou tout document du véhicule
            (JPG, PNG ou PDF, 10 Mo max).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DocScanButton
            label="Scanner"
            maxPages={4}
            mergeToPdf
            filenameBase="carte-grise"
            onFiles={uploadFiles}
          />
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            Importer
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              disabled={busy}
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                void uploadFiles(files);
              }}
            />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-primary" size={20} />
        </div>
      ) : docs.length === 0 ? (
        <p className="rounded border border-dashed border-cream/15 px-4 py-6 text-center text-xs text-cream/40">
          Aucun document déposé pour le moment.
        </p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li
              key={d.path}
              className="flex items-center justify-between gap-3 rounded-lg border border-cream/10 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                {d.name.endsWith(".pdf") ? (
                  <FileText size={15} className="shrink-0 text-primary" />
                ) : (
                  <ImageIcon size={15} className="shrink-0 text-primary" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs text-cream">{d.name}</p>
                  <p className="text-[10px] text-cream/40">
                    {d.createdAt ? new Date(d.createdAt).toLocaleDateString("fr-FR") : ""}
                    {d.size ? ` · ${(d.size / 1024).toFixed(0)} Ko` : ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => void open(d.path)}
                  aria-label={`Ouvrir ${d.name}`}
                  className="rounded-md p-2 text-cream/60 hover:bg-cream/10"
                >
                  <Eye size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => void remove(d.path)}
                  aria-label={`Supprimer ${d.name}`}
                  className="rounded-md p-2 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
