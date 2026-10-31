/** Contrat de partenariat — signature électronique Ligneo, visible dans l'espace convoyeur. */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { esignMyContrat, esignMyLink, esignMyContratFiles } from "@/lib/esign.functions";
import { ContratCardView } from "@/components/convoyeur/DocumentsUI";

type State =
  | { exists: false }
  | { exists: true; id: string; status: string; title: string; signedAt: string | null; missing: string[]; version?: number; versionCourante?: number; outdated?: boolean };

/** Télécharge un fichier à partir d'un lien signé (fiable aussi dans l'appli : pas de fenêtre popup). */
async function saveFromUrl(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("download");
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href; a.download = filename; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  } catch {
    // repli : ouverture directe du lien (le fichier est servi en pièce jointe)
    window.location.assign(url);
  }
}

export default function MonContratCard({ showEmpty = false }: { showEmpty?: boolean }) {
  const fetchState = useServerFn(esignMyContrat);
  const getLink = useServerFn(esignMyLink);
  const getFiles = useServerFn(esignMyContratFiles);
  const [st, setSt] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchState({}).then((r) => { if (alive) setSt(r as State); }).catch(() => { if (alive) setSt({ exists: false }); });
    return () => { alive = false; };
  }, [fetchState]);

  if (!st) return null;
  if (!st.exists) {
    if (!showEmpty) return null;
    return (
      <div className="rounded-3xl border border-[#e3e8f2] bg-white p-5 shadow-[0_10px_30px_-22px_rgba(10,22,56,.45)]">
        <p className="text-[15px] font-semibold text-[#0a1638]">Contrat de partenariat</p>
        <p className="mt-1 text-sm leading-relaxed text-[#5a6788]">
          Votre contrat est préparé par l'équipe Ligneo dès que votre dossier est validé. Vous le recevrez par e-mail et il apparaîtra ici, prêt à être signé.
        </p>
      </div>
    );
  }
  const signed = st.status === "signed";
  const blocked = !signed && st.missing.length > 0;

  const sign = async () => {
    setBusy(true);
    try { const { link } = await getLink({}); window.location.href = link; }
    catch (e) { toast.error(e instanceof Error ? e.message.replace(/^.*Error:\s*/, "") : "Impossible d'ouvrir le contrat."); setBusy(false); }
  };

  const download = async (which: "signed" | "dossier") => {
    setBusy(true);
    try {
      const f = await getFiles({});
      const url = which === "signed" ? f.signed : f.dossier;
      if (!url) throw new Error("Fichier indisponible.");
      await saveFromUrl(url, which === "signed" ? "Contrat-de-partenariat-signe.pdf" : "Preuve-de-signature.pdf");
      toast.success(which === "signed" ? "Contrat signé téléchargé" : "Preuve de signature téléchargée");
    } catch (e) { toast.error(e instanceof Error ? e.message.replace(/^.*Error:\s*/, "") : "Téléchargement impossible."); }
    setBusy(false);
  };

  return (
    <ContratCardView outdated={!!st.outdated} version={st.version} versionCourante={st.versionCourante} signed={signed} signedAt={st.signedAt} blocked={blocked} expired={st.status === "expired"}
      missing={st.missing} busy={busy} onSign={() => void sign()} onDownload={(w) => void download(w)} />
  );
}
