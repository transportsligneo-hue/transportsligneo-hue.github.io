/**
 * InspectionPreuvesBlock — bloc unique "Inspection & preuves" pour les drawers admin.
 *
 * Charge en parallèle pour une attribution donnée :
 *  - selfie convoyeur (mission_selfies)
 *  - photos d'inspection (inspection_photos via inspections)
 *  - signatures (mission_signatures)
 *  - documents mission (mission_documents)
 *  - carte grise (depuis trajet/devis lié)
 *
 * Génère des signed URLs pour les buckets privés et propose preview HD + zoom + téléchargement.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DrawerSection } from "@/components/admin/AdminDetailDrawer";
import { RechargePreuvesBlock } from "@/components/admin/RechargePreuvesBlock";

import {
  Camera, PenLine, FileImage, FileText, ZoomIn, Download, Loader2, X, Image as ImgIcon, ShieldCheck,
} from "lucide-react";

interface Selfie { id: string; storage_path: string; taken_at: string; }
interface Signature { id: string; kind: string; signer_name: string; signed_at: string; signature_data: string | null; }
interface InspectionPhoto { id: string; vue_type: string; url_photo: string; created_at: string; inspection_type: string; notes: string | null; }
interface MissionDoc { id: string; nom_fichier: string; type_document: string; url_fichier: string; created_at: string; }

interface SignedAsset {
  key: string;
  url: string;
  label: string;
  sublabel?: string;
  bucket: string;
  storagePath: string;
  isImage: boolean;
}

const BUCKETS = {
  selfies: "mission-selfies",
  inspection: "inspection-photos",
  documents: "mission-documents",
  carteGrise: "cartes-grises",
} as const;

async function sign(bucket: string, path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  // Si déjà une URL complète (legacy), retourne tel quel
  if (/^https?:\/\//i.test(path)) return path;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

function isImagePath(p: string) {
  return /\.(jpe?g|png|gif|webp|heic|avif)$/i.test(p);
}

export function InspectionPreuvesBlock({
  attributionId,
  fallbackCarteGriseRecto,
  fallbackCarteGriseVerso,
  fallbackVin,
}: {
  attributionId: string | null;
  fallbackCarteGriseRecto?: string | null;
  fallbackCarteGriseVerso?: string | null;
  fallbackVin?: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [selfies, setSelfies] = useState<SignedAsset[]>([]);
  const [photosDepart, setPhotosDepart] = useState<SignedAsset[]>([]);
  const [photosArrivee, setPhotosArrivee] = useState<SignedAsset[]>([]);
  const [signatures, setSignatures] = useState<SignedAsset[]>([]);
  const [docs, setDocs] = useState<SignedAsset[]>([]);
  const [carteGrise, setCarteGrise] = useState<SignedAsset[]>([]);
  const [zoom, setZoom] = useState<SignedAsset | null>(null);

  const SIG_LABELS: Record<string, string> = {
    driver_start: "Convoyeur — Départ",
    client_start: "Client — Départ",
    driver_end: "Convoyeur — Arrivée",
    client_end: "Client — Arrivée",
  };

  const load = useCallback(async () => {
    if (!attributionId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [sR, igR, sigR, dR] = await Promise.all([
      supabase.from("mission_selfies" as never).select("id,storage_path,taken_at").eq("attribution_id" as never, attributionId as never).order("taken_at", { ascending: false }),
      supabase.from("inspections").select("id,type,inspection_photos(id,vue_type,url_photo,created_at,notes)").eq("attribution_id", attributionId),
      supabase.from("mission_signatures" as never).select("id,kind,signer_name,signed_at,signature_data").eq("attribution_id" as never, attributionId as never),
      supabase.from("mission_documents").select("id,nom_fichier,type_document,url_fichier,created_at").eq("attribution_id", attributionId).order("created_at", { ascending: false }),
    ]);

    // Selfies
    const selfieRows = ((sR.data ?? []) as unknown as Selfie[]);
    const selfiesSigned = await Promise.all(selfieRows.map(async (r) => {
      const url = await sign(BUCKETS.selfies, r.storage_path);
      return url ? {
        key: `selfie-${r.id}`, url, label: "Selfie convoyeur",
        sublabel: new Date(r.taken_at).toLocaleString("fr-FR"),
        bucket: BUCKETS.selfies, storagePath: r.storage_path, isImage: true,
      } : null;
    }));
    setSelfies(selfiesSigned.filter(Boolean) as SignedAsset[]);

    // Inspection photos
    const photos: { vue_type: string; row: InspectionPhoto; type: string }[] = [];
    type InspRow = { id: string; type: string; inspection_photos: InspectionPhoto[] | null };
    ((igR.data ?? []) as unknown as InspRow[]).forEach((insp) => {
      (insp.inspection_photos ?? []).forEach((p) => photos.push({ vue_type: p.vue_type, row: p, type: insp.type }));
    });
    const photosSigned = await Promise.all(photos.map(async (p) => {
      const url = await sign(BUCKETS.inspection, p.row.url_photo);
      if (!url) return null;
      const asset: SignedAsset = {
        key: `photo-${p.row.id}`, url,
        label: p.vue_type || "Photo véhicule",
        sublabel: new Date(p.row.created_at).toLocaleString("fr-FR"),
        bucket: BUCKETS.inspection, storagePath: p.row.url_photo, isImage: true,
      };
      return { ...asset, _type: p.type };
    }));
    const valid = photosSigned.filter(Boolean) as (SignedAsset & { _type: string })[];
    setPhotosDepart(valid.filter(p => p._type === "depart"));
    setPhotosArrivee(valid.filter(p => p._type === "arrivee"));

    // Signatures (signature_data = data URL base64 généré côté SignaturePad)
    const sigRows = ((sigR.data ?? []) as unknown as Signature[]);
    const sigsAssets: SignedAsset[] = sigRows.map((r) => ({
      key: `sig-${r.id}`,
      url: r.signature_data || "",
      label: SIG_LABELS[r.kind] ?? r.kind,
      sublabel: `${r.signer_name} · ${new Date(r.signed_at).toLocaleString("fr-FR")}`,
      bucket: BUCKETS.documents,
      storagePath: "",
      isImage: !!r.signature_data,
    }));
    setSignatures(sigsAssets);

    // Mission documents (PV, autres)
    const docRows = ((dR.data ?? []) as unknown as MissionDoc[]);
    const docsSigned = await Promise.all(docRows.map(async (r) => {
      const url = await sign(BUCKETS.documents, r.url_fichier);
      return url ? {
        key: `doc-${r.id}`, url, label: r.type_document || r.nom_fichier,
        sublabel: `${r.nom_fichier} · ${new Date(r.created_at).toLocaleDateString("fr-FR")}`,
        bucket: BUCKETS.documents, storagePath: r.url_fichier, isImage: isImagePath(r.nom_fichier),
      } : null;
    }));
    setDocs(docsSigned.filter(Boolean) as SignedAsset[]);

    // Carte grise (depuis fallback fourni par parent)
    const cg: SignedAsset[] = [];
    if (fallbackCarteGriseRecto) {
      const url = await sign(BUCKETS.carteGrise, fallbackCarteGriseRecto);
      if (url) cg.push({ key: "cg-recto", url, label: "Carte grise — Recto", bucket: BUCKETS.carteGrise, storagePath: fallbackCarteGriseRecto, isImage: true });
    }
    if (fallbackCarteGriseVerso) {
      const url = await sign(BUCKETS.carteGrise, fallbackCarteGriseVerso);
      if (url) cg.push({ key: "cg-verso", url, label: "Carte grise — Verso", bucket: BUCKETS.carteGrise, storagePath: fallbackCarteGriseVerso, isImage: true });
    }
    setCarteGrise(cg);

    setLoading(false);
  }, [attributionId, fallbackCarteGriseRecto, fallbackCarteGriseVerso]);

  useEffect(() => { load(); }, [load]);

  const download = async (a: SignedAsset) => {
    const { data } = await supabase.storage.from(a.bucket).createSignedUrl(a.storagePath, 60, { download: true });
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const Tile = ({ a }: { a: SignedAsset }) => (
    <div className="group relative rounded-lg overflow-hidden border border-white/10 bg-black/30">
      {a.isImage && a.url ? (
        <button onClick={() => setZoom(a)} className="block w-full aspect-square">
          <img src={a.url} alt={a.label} className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy" />
        </button>
      ) : (
        <div className="w-full aspect-square flex flex-col items-center justify-center text-white/50 gap-1">
          <FileText size={28} />
          <span className="text-[10px] px-2 text-center break-words">{a.label}</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
        <p className="text-[10px] text-white font-medium truncate">{a.label}</p>
        {a.sublabel && <p className="text-[9px] text-white/60 truncate">{a.sublabel}</p>}
      </div>
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
        {a.isImage && (
          <button onClick={() => setZoom(a)} className="p-1 rounded bg-black/60 hover:bg-black text-white">
            <ZoomIn size={12} />
          </button>
        )}
        <button onClick={() => download(a)} className={`p-1 rounded bg-black/60 hover:bg-black text-white ${!a.storagePath ? "hidden" : ""}`}>
          <Download size={12} />
        </button>
      </div>
    </div>
  );

  const Group = ({ title, icon, items, empty }: { title: string; icon: React.ReactNode; items: SignedAsset[]; empty: string }) => (
    <div>
      <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold text-blue-200/90">
        {icon}<span>{title}</span>
        <span className="ml-auto text-white/40 text-[10px]">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-white/35 italic px-1">{empty}</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
          {items.map(a => <Tile key={a.key} a={a} />)}
        </div>
      )}
    </div>
  );

  if (!attributionId && !fallbackCarteGriseRecto && !fallbackCarteGriseVerso) {
    return null;
  }

  return (
    <>
      <DrawerSection title="Inspection & preuves" icon={<ShieldCheck size={12} />}>
        {loading ? (
          <div className="flex items-center gap-2 text-white/60 text-xs py-4 justify-center">
            <Loader2 size={14} className="animate-spin" /> Chargement des preuves…
          </div>
        ) : (
          <div className="space-y-4">
            {fallbackVin && (
              <div className="text-[11px] text-white/70">
                <span className="text-white/40 uppercase tracking-wider mr-2">VIN</span>
                <span className="font-mono text-blue-200">{fallbackVin}</span>
              </div>
            )}
            <Group title="Selfie convoyeur" icon={<Camera size={12} />} items={selfies} empty="Aucun selfie pris." />
            <Group title="Photos départ" icon={<FileImage size={12} />} items={photosDepart} empty="Aucune photo de départ." />
            <Group title="Photos arrivée" icon={<FileImage size={12} />} items={photosArrivee} empty="Aucune photo d'arrivée." />
            <RechargePreuvesBlock attributionId={attributionId} variant="dark" />

            <Group title="Signatures" icon={<PenLine size={12} />} items={signatures} empty="Aucune signature enregistrée." />
            <Group title="Carte grise" icon={<ImgIcon size={12} />} items={carteGrise} empty="Carte grise non fournie." />
            <Group title="Documents (PV, autres)" icon={<FileText size={12} />} items={docs} empty="Aucun document mission." />
          </div>
        )}
      </DrawerSection>

      {/* Zoom lightbox */}
      {zoom && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setZoom(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            onClick={() => setZoom(null)}
          >
            <X size={18} />
          </button>
          <div className="absolute top-4 left-4 text-white">
            <p className="text-sm font-semibold">{zoom.label}</p>
            {zoom.sublabel && <p className="text-xs text-white/60">{zoom.sublabel}</p>}
          </div>
          <img
            src={zoom.url}
            alt={zoom.label}
            className="max-w-full max-h-full object-contain rounded"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => { e.stopPropagation(); download(zoom); }}
            className="absolute bottom-4 right-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm flex items-center gap-2"
          >
            <Download size={14} /> Télécharger
          </button>
        </div>
      )}
    </>
  );
}
