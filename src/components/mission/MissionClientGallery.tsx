/**
 * MissionClientGallery · affiche côté client toutes les preuves visuelles d'une mission :
 * - Photos d'inspection (départ / arrivée) avec signed URLs
 * - Signatures (départ / arrivée)
 * - Carte grise (recto / verso)
 * - Documents partagés (PV livraison, contrat, autres)
 *
 * Chargement progressif :
 *   1. squelettes affichés immédiatement
 *   2. chaque section (carte grise, photos, docs) se remplit indépendamment
 *      dès que ses données arrivent · pas d'écran d'attente global
 *   3. pagination "Voir plus" au-delà de 12 photos par section pour garder
 *      un défilement fluide même sur mobile / grosses missions
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, FileText, CarFront, Download, Eye, X, ChevronDown } from "lucide-react";

interface Props {
  attributionId: string;
  trajetId?: string | null;
  onProofsAvailable?: (has: boolean) => void;
}


interface PhotoItem { id: string; vue_type: string; url: string; type: "depart" | "arrivee" }
interface DocItem { id: string; nom: string; type: string; created_at: string; signedUrl: string | null }

const PAGE_SIZE = 12;

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
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [cg, setCg] = useState<{ recto: string | null; verso: string | null }>({ recto: null, verso: null });

  // Chargement indépendant par section · pas de "grand spinner" bloquant
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingCg, setLoadingCg] = useState(!!trajetId);

  const [lightbox, setLightbox] = useState<string | null>(null);
  const [visibleDep, setVisibleDep] = useState(PAGE_SIZE);
  const [visibleArr, setVisibleArr] = useState(PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    let hasAny = false;
    const flagProofs = () => {
      if (!hasAny) { hasAny = true; onProofsAvailable?.(true); }
    };

    // 1) Photos d'inspection · pipeline indépendant
    (async () => {
      setLoadingPhotos(true);
      const { data: insps } = await supabase
        .from("inspections")
        .select("id, type")
        .eq("attribution_id", attributionId);
      const inspList = (insps as { id: string; type: string }[] | null) ?? [];
      if (!inspList.length) {
        if (!cancelled) { setPhotos([]); setLoadingPhotos(false); }
        return;
      }
      const inspTypeById = new Map(inspList.map(i => [i.id, i.type]));
      const { data: rawRes } = await supabase
        .from("inspection_photos")
        .select("id, inspection_id, vue_type, url_photo")
        .in("inspection_id", inspList.map(i => i.id));
      const raw = (rawRes as { id: string; inspection_id: string; vue_type: string; url_photo: string }[] | null) ?? [];

      const pathsToSign = Array.from(new Set(raw.filter(p => !/^https?:\/\//.test(p.url_photo)).map(p => p.url_photo)));
      const signedMap = new Map<string, string>();
      if (pathsToSign.length) {
        const { data: signed } = await supabase.storage.from("inspection-photos").createSignedUrls(pathsToSign, 3600);
        (signed ?? []).forEach((s, idx) => { if (s?.signedUrl) signedMap.set(pathsToSign[idx], s.signedUrl); });
      }

      const built: PhotoItem[] = [];
      for (const p of raw) {
        const url = /^https?:\/\//.test(p.url_photo) ? p.url_photo : (signedMap.get(p.url_photo) ?? "");
        if (!url) continue;
        built.push({
          id: p.id,
          vue_type: p.vue_type,
          url,
          type: inspTypeById.get(p.inspection_id) === "arrivee" ? "arrivee" : "depart",
        });
      }
      if (cancelled) return;
      setPhotos(built);
      setLoadingPhotos(false);
      if (built.length) flagProofs();
    })();

    // 2) Documents partagés · pipeline indépendant
    (async () => {
      setLoadingDocs(true);
      const { data: dRes } = await supabase
        .from("mission_documents")
        .select("id, type_document, nom_fichier, url_fichier, created_at")
        .eq("attribution_id", attributionId)
        .order("created_at", { ascending: false });
      const dRaw = (dRes as { id: string; type_document: string; nom_fichier: string; url_fichier: string; created_at: string }[] | null) ?? [];
      const paths = dRaw.map(d => d.url_fichier);
      const signedDocMap = new Map<string, string>();
      if (paths.length) {
        const { data: signed } = await supabase.storage.from("mission-documents").createSignedUrls(paths, 3600);
        (signed ?? []).forEach((s, idx) => { if (s?.signedUrl) signedDocMap.set(paths[idx], s.signedUrl); });
      }
      const dList: DocItem[] = dRaw.map(d => ({
        id: d.id,
        nom: d.nom_fichier,
        type: d.type_document,
        created_at: d.created_at,
        signedUrl: signedDocMap.get(d.url_fichier) ?? null,
      }));
      if (cancelled) return;
      setDocs(dList);
      setLoadingDocs(false);
      if (dList.length) flagProofs();
    })();

    // 3) Carte grise · pipeline indépendant
    if (trajetId) {
      (async () => {
        setLoadingCg(true);
        const { data: tr } = await supabase
          .from("trajets_client_safe")
          .select("carte_grise_recto_url, carte_grise_verso_url")
          .eq("id", trajetId)
          .maybeSingle();
        const sign = async (p: string | null | undefined) => {
          if (!p) return null;
          if (/^https?:\/\//.test(p)) return p;
          const { data } = await supabase.storage.from("cartes-grises").createSignedUrl(p, 3600);
          return data?.signedUrl ?? null;
        };
        const [recto, verso] = await Promise.all([
          sign(tr?.carte_grise_recto_url),
          sign(tr?.carte_grise_verso_url),
        ]);
        if (cancelled) return;
        setCg({ recto, verso });
        setLoadingCg(false);
        if (recto || verso) flagProofs();
      })();
    } else {
      setLoadingCg(false);
    }

    return () => { cancelled = true; };
  }, [attributionId, trajetId, onProofsAvailable]);

  const photosDep = photos.filter(p => p.type === "depart");
  const photosArr = photos.filter(p => p.type === "arrivee");
  const allDone = !loadingPhotos && !loadingDocs && !loadingCg;
  const hasAny = photos.length > 0 || docs.length > 0 || cg.recto || cg.verso;

  // Rien à afficher du tout après chargement complet
  if (allDone && !hasAny) {
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
      {/* Carte grise */}
      {loadingCg ? (
        <SkeletonSection title="Carte grise" icon={<CarFront size={16} />} count={2} cols={2} />
      ) : (cg.recto || cg.verso) ? (
        <Section title="Carte grise" icon={<CarFront size={16} />}>
          <div className="grid grid-cols-2 gap-3">
            {cg.recto && <ImgTile url={cg.recto} label="Recto" onClick={() => setLightbox(cg.recto!)} />}
            {cg.verso && <ImgTile url={cg.verso} label="Verso" onClick={() => setLightbox(cg.verso!)} />}
          </div>
        </Section>
      ) : null}

      {/* Photos */}
      {loadingPhotos ? (
        <SkeletonSection title="Photos d'inspection" icon={<Camera size={16} />} count={6} cols={3} />
      ) : (
        <>
          {photosDep.length > 0 && (
            <Section title={`Photos de prise en charge (${photosDep.length})`} icon={<Camera size={16} />}>
              <Grid items={photosDep.slice(0, visibleDep)} onOpen={setLightbox} />
              {photosDep.length > visibleDep && (
                <LoadMore onClick={() => setVisibleDep(v => v + PAGE_SIZE)} remaining={photosDep.length - visibleDep} />
              )}
            </Section>
          )}

          {photosArr.length > 0 && (
            <Section title={`Photos de livraison (${photosArr.length})`} icon={<Camera size={16} />}>
              <Grid items={photosArr.slice(0, visibleArr)} onOpen={setLightbox} />
              {photosArr.length > visibleArr && (
                <LoadMore onClick={() => setVisibleArr(v => v + PAGE_SIZE)} remaining={photosArr.length - visibleArr} />
              )}
            </Section>
          )}
        </>
      )}

      {/* Documents */}
      {loadingDocs ? (
        <SkeletonSection title="Documents" icon={<FileText size={16} />} count={3} cols={1} />
      ) : (
        docs.length > 0 && (
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
        )
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
    <div className="card-premium p-5 rounded animate-in fade-in duration-300">
      <h2 className="font-heading text-sm text-primary tracking-[0.15em] uppercase flex items-center gap-2 mb-4">
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}

function SkeletonSection({ title, icon, count, cols }: { title: string; icon: React.ReactNode; count: number; cols: number }) {
  const gridClass =
    cols === 1
      ? "grid gap-2"
      : cols === 2
        ? "grid grid-cols-2 gap-3"
        : "grid grid-cols-2 sm:grid-cols-3 gap-2";
  return (
    <div className="card-premium p-5 rounded">
      <h2 className="font-heading text-sm text-primary/60 tracking-[0.15em] uppercase flex items-center gap-2 mb-4">
        {icon} {title}
      </h2>
      <div className={gridClass}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={cols === 1 ? "h-12 rounded bg-navy/40 border border-primary/10 animate-pulse" : "aspect-square rounded border border-primary/10 bg-navy/40 animate-pulse"}
          />
        ))}
      </div>
    </div>
  );
}

function LoadMore({ onClick, remaining }: { onClick: () => void; remaining: number }) {
  return (
    <button
      onClick={onClick}
      className="mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded border border-primary/25 bg-navy/40 text-primary text-[11px] uppercase tracking-[0.15em] hover:bg-primary/10 hover:border-primary/50 transition-colors"
    >
      <ChevronDown size={13} /> Afficher {Math.min(remaining, PAGE_SIZE)} photos supplémentaires
      <span className="text-cream/40 normal-case tracking-normal">({remaining} restantes)</span>
    </button>
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
        <img src={url} alt={label} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105" />
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
