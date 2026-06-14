/**
 * MissionClientGallery — affiche côté client toutes les preuves visuelles d'une mission :
 * - Photos d'inspection (départ / arrivée) avec signed URLs
 * - Signatures (départ / arrivée)
 * - Carte grise (recto / verso)
 * - Documents partagés (PV livraison, contrat, autres)
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, FileText, PenTool, CarFront, Download, Eye, Loader2, X } from "lucide-react";

interface Props {
  attributionId: string;
  trajetId?: string | null;
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

export function MissionClientGallery({ attributionId, trajetId }: Props) {
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
      // Inspections + photos
      const { data: insps } = await supabase
        .from("inspections")
        .select("id, type")
        .eq("attribution_id", attributionId);

      const allPhotos: PhotoItem[] = [];
      for (const i of (insps as { id: string; type: string }[] | null) ?? []) {
        const { data: ph } = await supabase
          .from("inspection_photos")
          .select("id, vue_type, url_photo")
          .eq("inspection_id", i.id);
        for (const p of (ph as { id: string; vue_type: string; url_photo: string }[] | null) ?? []) {
          const isUrl = /^https?:\/\//.test(p.url_photo);
          let url = p.url_photo;
          if (!isUrl) {
            const { data: signed } = await supabase.storage.from("inspection-photos").createSignedUrl(p.url_photo, 3600);
            url = signed?.signedUrl ?? "";
          }
          if (url) allPhotos.push({ id: p.id, vue_type: p.vue_type, url, type: (i.type === "arrivee" ? "arrivee" : "depart") });
        }
      }

      // Signatures (data URL base64 dans signature_data)
      const { data: sigs } = await supabase
        .from("mission_signatures")
        .select("kind, signature_data")
        .eq("attribution_id", attributionId);
      const sigList: SignatureItem[] = ((sigs as { kind: string; signature_data: string | null }[] | null) ?? [])
        .filter(s => s.signature_data)
        .map(s => ({ kind: s.kind, url: s.signature_data! }));

      // Documents partagés (visible_client)
      const { data: dRaw } = await supabase
        .from("mission_documents")
        .select("id, type_document, nom_fichier, url_fichier, created_at")
        .eq("attribution_id", attributionId)
        .order("created_at", { ascending: false });
      const dList: DocItem[] = [];
      for (const d of (dRaw as { id: string; type_document: string; nom_fichier: string; url_fichier: string; created_at: string }[] | null) ?? []) {
        const { data: signed } = await supabase.storage.from("mission-documents").createSignedUrl(d.url_fichier, 3600);
        dList.push({ id: d.id, nom: d.nom_fichier, type: d.type_document, created_at: d.created_at, signedUrl: signed?.signedUrl ?? null });
      }

      // Carte grise depuis trajet
      let cgState = { recto: null as string | null, verso: null as string | null };
      if (trajetId) {
        const { data: tr } = await supabase
          .from("trajets")
          .select("carte_grise_recto_url, carte_grise_verso_url")
          .eq("id", trajetId)
          .maybeSingle();
        const sign = async (p: string | null | undefined) => {
          if (!p) return null;
          if (/^https?:\/\//.test(p)) return p;
          const { data } = await supabase.storage.from("cartes-grises").createSignedUrl(p, 3600);
          return data?.signedUrl ?? null;
        };
        cgState = {
          recto: await sign(tr?.carte_grise_recto_url),
          verso: await sign(tr?.carte_grise_verso_url),
        };
      }

      if (cancelled) return;
      setPhotos(allPhotos);
      setSignatures(sigList);
      setDocs(dList);
      setCg(cgState);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [attributionId, trajetId]);

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

      {signatures.length > 0 && (
        <Section title="Signatures" icon={<PenTool size={16} />}>
          <div className="grid grid-cols-2 gap-3">
            {signatures.map((s, i) => (
              <ImgTile key={i} url={s.url} label={s.kind.replace(/_/g, " ")} onClick={() => setLightbox(s.url)} />
            ))}
          </div>
        </Section>
      )}

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
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded border border-primary/15 bg-navy/40 hover:border-primary/40 transition-colors"
    >
      <img src={url} alt={label} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy via-navy/70 to-transparent p-2">
        <p className="text-cream text-[10px] uppercase tracking-wider truncate">{label}</p>
      </div>
      <Eye size={14} className="absolute top-2 right-2 text-cream/80 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
