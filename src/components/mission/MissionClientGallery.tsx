/**
 * MissionClientGallery — affiche côté client toutes les preuves visuelles d'une mission :
 * - Photos d'inspection (départ / arrivée) avec signed URLs
 * - Signatures (départ / arrivée)
 * - Carte grise (recto / verso)
 * - Documents partagés (PV livraison, contrat, autres)
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, FileText, CarFront, Download, Eye, Loader2, X } from "lucide-react";

interface Props {
  attributionId: string;
  trajetId?: string | null;
  onProofsAvailable?: (has: boolean) => void;
}


interface PhotoItem { id: string; vue_type: string; url: string; type: "depart" | "arrivee" }
interface SignatureItem { kind: string; url: string }
interface DocItem { id: string; nom: string; type: string; created_at: string; signedUrl: string | null }

const vueLabel = (k: string) => {
  const map: Record<string, string> = {
    trois_quart_avant_gauche: "3/4 avant gauche",
    trois_quart_avant_droite: "3/4 avant droit",
    trois_quart_arriere_gauche: "3/4 arrière gauche",
    trois_quart_arriere_droite: "3/4 arrière droit",
    arriere: "Arrière",
    coffre_ouvert: "Coffre",
    siege_avant: "Sièges avant",
    siege_arriere: "Sièges arrière",
    compteur: "Compteur",
    photos_cles: "Clés du véhicule",
    kit_securite: "Kit sécurité",
    roue_secours: "Roue de secours",
    jante_avant_gauche: "Jante avant gauche",
    jante_avant_droite: "Jante avant droite",
    jante_arriere_gauche: "Jante arrière gauche",
    jante_arriere_droite: "Jante arrière droite",
    carte_grise: "Carte grise",
    pv_livraison: "PV livraison",
    signature: "Signature",
  };
  const m = k.match(/^([a-z_]+?)(?:_\d{10,})?$/);
  return map[k] ?? (m ? map[m[1]] : null) ?? k;
};

const docLabel = (t: string) =>
  ({
    pv_livraison: "PV de livraison",
    contrat: "Contrat",
    carte_grise: "Carte grise",
    pv_signature: "Signature PV",
    autre: "Autre",
  }[t] ?? t);

export function MissionClientGallery({ attributionId, trajetId, onProofsAvailable }: Props) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [signatures, setSignatures] = useState<SignatureItem[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [cg, setCg] = useState<{ recto: string | null; verso: string | null }>({ recto: null, verso: null });
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Lancer TOUTES les requêtes racine en parallèle (au lieu de séquentiel)
      const [inspsRes, sigsRes, docsRes, trajetRes] = await Promise.all([
        supabase.from("inspections").select("id, type").eq("attribution_id", attributionId),
        supabase.from("mission_signatures").select("kind, signature_data").eq("attribution_id", attributionId),
        supabase
          .from("mission_documents")
          .select("id, type_document, nom_fichier, url_fichier, created_at")
          .eq("attribution_id", attributionId)
          .order("created_at", { ascending: false }),
        trajetId
          ? supabase.from("trajets").select("carte_grise_recto_url, carte_grise_verso_url").eq("id", trajetId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const insps = (inspsRes.data as { id: string; type: string }[] | null) ?? [];
      const inspTypeById = new Map(insps.map(i => [i.id, i.type]));

      // Photos : UNE requête .in() au lieu de N requêtes
      const photosRes = insps.length
        ? await supabase
            .from("inspection_photos")
            .select("id, inspection_id, vue_type, url_photo")
            .in("inspection_id", insps.map(i => i.id))
        : { data: [] as { id: string; inspection_id: string; vue_type: string; url_photo: string }[] };

      const rawPhotos = (photosRes.data as { id: string; inspection_id: string; vue_type: string; url_photo: string }[] | null) ?? [];

      // Signed URLs en lot pour inspection-photos
      const photoPathsToSign: string[] = [];
      const photoPathIndex = new Map<string, number>();
      rawPhotos.forEach((p) => {
        if (!/^https?:\/\//.test(p.url_photo) && !photoPathIndex.has(p.url_photo)) {
          photoPathIndex.set(p.url_photo, photoPathsToSign.length);
          photoPathsToSign.push(p.url_photo);
        }
      });
      const signedPhotoMap = new Map<string, string>();
      if (photoPathsToSign.length) {
        const { data: signed } = await supabase.storage.from("inspection-photos").createSignedUrls(photoPathsToSign, 3600);
        (signed ?? []).forEach((s, idx) => {
          if (s?.signedUrl) signedPhotoMap.set(photoPathsToSign[idx], s.signedUrl);
        });
      }

      const allPhotos: PhotoItem[] = [];
      for (const p of rawPhotos) {
        const url = /^https?:\/\//.test(p.url_photo) ? p.url_photo : (signedPhotoMap.get(p.url_photo) ?? "");
        if (!url) continue;
        const t = inspTypeById.get(p.inspection_id) === "arrivee" ? "arrivee" : "depart";
        allPhotos.push({ id: p.id, vue_type: p.vue_type, url, type: t });
      }

      // Signatures
      const sigList: SignatureItem[] = ((sigsRes.data as { kind: string; signature_data: string | null }[] | null) ?? [])
        .filter(s => s.signature_data)
        .map(s => ({ kind: s.kind, url: s.signature_data! }));

      // Documents : signed URLs en lot
      const dRaw = (docsRes.data as { id: string; type_document: string; nom_fichier: string; url_fichier: string; created_at: string }[] | null) ?? [];
      const docPaths = dRaw.map(d => d.url_fichier);
      const signedDocMap = new Map<string, string>();
      if (docPaths.length) {
        const { data: signed } = await supabase.storage.from("mission-documents").createSignedUrls(docPaths, 3600);
        (signed ?? []).forEach((s, idx) => {
          if (s?.signedUrl) signedDocMap.set(docPaths[idx], s.signedUrl);
        });
      }
      const dList: DocItem[] = dRaw.map(d => ({
        id: d.id,
        nom: d.nom_fichier,
        type: d.type_document,
        created_at: d.created_at,
        signedUrl: signedDocMap.get(d.url_fichier) ?? null,
      }));

      // Carte grise : signer en parallèle
      let cgState = { recto: null as string | null, verso: null as string | null };
      const tr = trajetRes.data as { carte_grise_recto_url: string | null; carte_grise_verso_url: string | null } | null;
      if (tr) {
        const sign = async (p: string | null | undefined) => {
          if (!p) return null;
          if (/^https?:\/\//.test(p)) return p;
          const { data } = await supabase.storage.from("cartes-grises").createSignedUrl(p, 3600);
          return data?.signedUrl ?? null;
        };
        const [recto, verso] = await Promise.all([sign(tr.carte_grise_recto_url), sign(tr.carte_grise_verso_url)]);
        cgState = { recto, verso };
      }

      if (cancelled) return;
      setPhotos(allPhotos);
      setSignatures(sigList);
      setDocs(dList);
      setCg(cgState);
      setLoading(false);
      const hasAnyProofs =
        allPhotos.length > 0 || sigList.length > 0 || dList.length > 0 || !!cgState.recto || !!cgState.verso;
      onProofsAvailable?.(hasAnyProofs);
    })();
    return () => { cancelled = true; };
  }, [attributionId, trajetId, onProofsAvailable]);


  if (loading) {
    return (
      <div className="card-premium p-5 rounded flex items-center justify-center gap-2 text-cream/60 text-xs">
        <Loader2 size={14} className="animate-spin" /> Chargement des pièces…
      </div>
    );
  }

  const photosDep = photos.filter(p => p.type === "depart");
  const photosArr = photos.filter(p => p.type === "arrivee");
  const hasAny = photos.length > 0 || signatures.length > 0 || docs.length > 0 || cg.recto || cg.verso;

  if (!hasAny) {
    return (
      <div className="card-premium p-5 rounded text-center">
        <p className="text-cream/50 text-xs">
          Les preuves de mission (photos, signatures, documents) apparaîtront ici dès qu'elles seront ajoutées par le convoyeur.
        </p>
      </div>
    );
  }

  return (
    <>
      {(cg.recto || cg.verso) && (
        <Section title="Carte grise" icon={<CarFront size={16} />}>
          <div className="grid grid-cols-2 gap-3">
            {cg.recto && <ImgTile url={cg.recto} label="Recto" onClick={() => setLightbox(cg.recto!)} />}
            {cg.verso && <ImgTile url={cg.verso} label="Verso" onClick={() => setLightbox(cg.verso!)} />}
          </div>
        </Section>
      )}

      {photosDep.length > 0 && (
        <Section title={`Photos de prise en charge (${photosDep.length})`} icon={<Camera size={16} />}>
          <Grid items={photosDep} onOpen={setLightbox} />
        </Section>
      )}

      {photosArr.length > 0 && (
        <Section title={`Photos de livraison (${photosArr.length})`} icon={<Camera size={16} />}>
          <Grid items={photosArr} onOpen={setLightbox} />
        </Section>
      )}

      {/* Signatures : section gérée par MissionTraceability — pas de doublon ici */}


      {docs.length > 0 && (
        <Section title={`Documents (${docs.length})`} icon={<FileText size={16} />}>
          <div className="grid gap-2">
            {docs.map(d => (
              <div key={d.id} className="flex items-center justify-between gap-3 bg-navy/40 border border-primary/10 rounded px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-cream/85 text-sm truncate">{d.nom}</p>
                  <p className="text-cream/40 text-[10px] uppercase tracking-wider mt-0.5">
                    {docLabel(d.type)} · {new Date(d.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                {d.signedUrl && (
                  <a
                    href={d.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-navy font-heading text-[10px] tracking-[0.15em] uppercase rounded hover:bg-gold-light transition-colors"
                  >
                    <Download size={11} /> Voir
                  </a>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-cream/80 hover:text-cream" aria-label="Fermer">
            <X size={28} />
          </button>
          <img src={lightbox} alt="Aperçu" className="max-h-full max-w-full object-contain rounded shadow-2xl" />
        </div>
      )}
    </>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card-premium p-5 rounded">
      <h2 className="font-heading text-sm text-primary tracking-[0.15em] uppercase flex items-center gap-2 mb-4">
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}

function Grid({ items, onOpen }: { items: PhotoItem[]; onOpen: (url: string) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {items.map(p => (
        <ImgTile key={p.id} url={p.url} label={vueLabel(p.vue_type)} onClick={() => onOpen(p.url)} />
      ))}
    </div>
  );
}

function ImgTile({ url, label, onClick }: { url: string; label: string; onClick: () => void }) {
  const filename = `${label.replace(/[^a-z0-9]+/gi, "_").toLowerCase() || "piece"}.${
    url.startsWith("data:image/png") ? "png" : url.startsWith("data:") ? "jpg" : (url.split("?")[0].split(".").pop() || "jpg")
  }`;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      let blobUrl = url;
      let revoke = false;
      if (url.startsWith("data:")) {
        const res = await fetch(url);
        const blob = await res.blob();
        blobUrl = URL.createObjectURL(blob);
        revoke = true;
      } else {
        // Pour les URLs distantes (signed), passer par un blob garantit le download cross-origin
        try {
          const res = await fetch(url);
          if (res.ok) {
            const blob = await res.blob();
            blobUrl = URL.createObjectURL(blob);
            revoke = true;
          }
        } catch {
          /* fallback à l'URL d'origine */
        }
      }
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (revoke) setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="group relative aspect-square overflow-hidden rounded border border-primary/15 bg-navy/40 hover:border-primary/40 transition-colors">
      <button
        type="button"
        onClick={onClick}
        className="absolute inset-0 w-full h-full"
        aria-label={`Agrandir ${label}`}
      >
        <img src={url} alt={label} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy via-navy/70 to-transparent p-2">
          <p className="text-cream text-[10px] uppercase tracking-wider truncate text-left">{label}</p>
        </div>
        <Eye size={14} className="absolute top-2 left-2 text-cream/80 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <button
        type="button"
        onClick={handleDownload}
        className="absolute top-1.5 right-1.5 z-10 bg-navy/80 hover:bg-primary hover:text-navy text-cream rounded p-1.5 transition-colors"
        aria-label={`Télécharger ${label}`}
        title="Télécharger"
      >
        <Download size={12} />
      </button>
    </div>
  );
}

