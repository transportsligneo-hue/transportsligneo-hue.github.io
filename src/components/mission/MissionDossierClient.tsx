import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CarFront, Download, Eye, FileText, Loader2, PenLine, Receipt, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { HelpTip } from "@/components/ui/HelpTip";

interface Props {
  attributionId: string | null;
  trajetId: string | null;
  termine: boolean;
  facture: { numero: string; prix_ttc: number; statut: string } | null;
  onDownloadFacture: () => void;
  downloadingFact: boolean;
}

type Cg = { recto: string | null; verso: string | null };
type Note = { type: string; notes: string };
type Sig = { kind: string; signer_name: string | null; signed_at: string };

const SIG_LABEL: Record<string, string> = {
  convoyeur_start: "Convoyeur · enlèvement",
  client_start: "Client · enlèvement",
  convoyeur_end: "Convoyeur · livraison",
  client_end: "Client · livraison",
};

async function signedUrl(path: string | null | undefined, bucket: string) {
  if (!path) return null;
  if (/^(https?:\/\/|data:)/.test(path)) return path;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Dossier de fin de mission : tout ce que le client veut garder à portée de main. */
export function MissionDossierClient({ attributionId, trajetId, termine, facture, onDownloadFacture, downloadingFact }: Props) {
  const [cg, setCg] = useState<Cg>({ recto: null, verso: null });
  const [notes, setNotes] = useState<Note[]>([]);
  const [sigs, setSigs] = useState<Sig[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        if (trajetId) {
          const { data: tr } = await supabase.from("trajets_client_safe").select("carte_grise_recto_url, carte_grise_verso_url").eq("id", trajetId).maybeSingle();
          const t = tr as { carte_grise_recto_url?: string | null; carte_grise_verso_url?: string | null } | null;
          const [recto, verso] = await Promise.all([signedUrl(t?.carte_grise_recto_url, "cartes-grises"), signedUrl(t?.carte_grise_verso_url, "cartes-grises")]);
          if (!off) setCg({ recto, verso });
        }
      } catch { /* silencieux */ }
      try {
        if (attributionId) {
          const { data } = await supabase.from("inspections").select("type, notes").eq("attribution_id", attributionId);
          if (!off) setNotes(((data as Note[] | null) ?? []).filter((n) => n.notes && n.notes.trim()));
          const { data: s } = await supabase.from("mission_signatures" as never).select("kind, signer_name, signed_at").eq("attribution_id" as never, attributionId as never).order("signed_at" as never, { ascending: true } as never);
          if (!off) setSigs((s as unknown as Sig[] | null) ?? []);
        }
      } catch { /* silencieux */ }
    })();
    return () => { off = true; };
  }, [attributionId, trajetId]);

  const download = async (url: string, name: string, key: string) => {
    setBusy(key);
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error("Fichier indisponible");
      const blob = await r.blob();
      const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${name}.${ext}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.error("Téléchargement impossible", { description: (e as Error).message });
    } finally { setBusy(null); }
  };

  const hasCg = !!(cg.recto || cg.verso);
  const dateFr = (d: string) => new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mission-surface p-5" data-tour="mission-dossier">
      <h2 className="font-heading text-sm mission-accent tracking-[0.15em] uppercase flex items-center gap-2 mb-1">
        <FileText size={16} /> Votre dossier de mission
        <HelpTip title="Tout au même endroit" text="Facture, carte grise du véhicule en scan net et réserves notées à la signature : téléchargeables à tout moment, sans nous contacter." />
      </h2>
      <p className="mission-text-soft text-xs mb-4">
        {termine ? "Mission terminée : votre dossier est complet et téléchargeable." : "Ces éléments se complètent au fil de la mission."}
      </p>

      <div className="space-y-3">
        {/* Facture */}
        <div className="flex items-center gap-3 rounded-lg border mission-divider p-3">
          <Receipt size={18} className="mission-accent shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="mission-text text-sm font-medium">Facture</p>
            <p className="mission-text-muted text-xs truncate">{facture ? `${facture.numero} · ${Number(facture.prix_ttc).toFixed(2)} € TTC` : "Disponible dès la clôture de la mission"}</p>
          </div>
          <button type="button" disabled={!facture || downloadingFact} onClick={onDownloadFacture}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#00AEEF] text-white font-heading text-[11px] tracking-wider uppercase disabled:opacity-40">
            {downloadingFact ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF
          </button>
        </div>

        {/* Carte grise */}
        <div className="rounded-lg border mission-divider p-3">
          <div className="flex items-center gap-3">
            <CarFront size={18} className="mission-accent shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="mission-text text-sm font-medium">Carte grise du véhicule</p>
              <p className="mission-text-muted text-xs">{hasCg ? "Scan réalisé lors de l'état des lieux, en pleine qualité." : "Pas encore scannée par le convoyeur."}</p>
            </div>
          </div>
          {hasCg && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([["recto", cg.recto], ["verso", cg.verso]] as const).map(([face, url]) => url ? (
                <div key={face} className="rounded-md border mission-divider overflow-hidden">
                  <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Carte grise ${face}`} className="w-full h-28 object-contain bg-black/5" loading="lazy" /></a>
                  <div className="flex">
                    <a href={url} target="_blank" rel="noreferrer" className="flex-1 inline-flex items-center justify-center gap-1 py-2 text-[11px] mission-text-soft"><Eye size={12} /> Voir</a>
                    <button type="button" onClick={() => void download(url, `carte-grise-${face}`, face)} disabled={busy === face}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-2 text-[11px] font-semibold text-[#00AEEF]">
                      {busy === face ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} {face === "recto" ? "Recto" : "Verso"}
                    </button>
                  </div>
                </div>
              ) : null)}
            </div>
          )}
        </div>

        {/* Réserves et signatures */}
        <div className="rounded-lg border mission-divider p-3">
          <div className="flex items-center gap-3">
            <TriangleAlert size={18} className="mission-accent shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="mission-text text-sm font-medium">Réserves notées à la signature</p>
              <p className="mission-text-muted text-xs">{notes.length ? "Remarques consignées dans l'état des lieux." : "Aucune réserve consignée."}</p>
            </div>
          </div>
          {notes.length > 0 && (
            <ul className="mt-3 space-y-2">
              {notes.map((n, i) => (
                <li key={i} className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider mission-text-muted mb-1">{n.type === "depart" ? "À l'enlèvement" : "À la livraison"}</p>
                  <p className="mission-text text-sm whitespace-pre-wrap">{n.notes}</p>
                </li>
              ))}
            </ul>
          )}
          {sigs.length > 0 && (
            <div className="mt-3 border-t mission-divider pt-3 space-y-1.5">
              {sigs.map((s, i) => (
                <p key={i} className="flex items-center gap-2 text-xs mission-text-soft">
                  <PenLine size={12} className="mission-accent shrink-0" />
                  <span className="font-medium mission-text">{SIG_LABEL[s.kind] ?? s.kind}</span>
                  <span className="truncate">{s.signer_name ? `· ${s.signer_name}` : ""} · {dateFr(s.signed_at)}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
