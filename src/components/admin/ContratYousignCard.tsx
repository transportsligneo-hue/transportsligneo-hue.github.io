/**
 * Carte admin : envoi et suivi du contrat de partenariat convoyeur via Yousign.
 * Le PDF pré-rempli n'est jamais téléchargeable par le candidat avant signature :
 * seul Yousign lui envoie le lien de signature sécurisé.
 */
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileSignature, Loader2, Send, BellRing, Download, ShieldCheck, Clock, XCircle } from "lucide-react";
import {
  getContratConvoyeur,
  sendContratYousign,
  relancerContratYousign,
  getContratSigneUrl,
} from "@/lib/yousign.functions";
import {
  generateContratConvoyeurPdf,
  getLastContratPageCount,
  generateCharteDiscretionPdf,
  getLastChartePageCount,
} from "@/lib/documents-officiels";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";

interface Props {
  convoyeurId: string;
  nomComplet: string;
  email?: string | null;
  telephone?: string | null;
  siret?: string | null;
  adresse?: string | null;
  permisNumero?: string | null;
}

interface ContratRow {
  id: string;
  statut: string;
  sent_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  expired_at: string | null;
  last_reminder_at: string | null;
  decline_reason: string | null;
  signed_pdf_path: string | null;
  charte_incluse: boolean | null;
  charte_signed_at: string | null;
  charte_signed_pdf_path: string | null;
  yousign_environment: string | null;
}

const STATUT_UI: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  envoye: { label: "En attente de signature", cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: Clock },
  signe: { label: "Contrat signé", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: ShieldCheck },
  refuse: { label: "Signature refusée", cls: "bg-red-50 text-red-700 border-red-200", Icon: XCircle },
  expire: { label: "Demande expirée", cls: "bg-slate-100 text-slate-600 border-slate-200", Icon: XCircle },
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du PDF impossible"));
    reader.onload = () => {
      const res = String(reader.result ?? "");
      resolve(res.slice(res.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

export default function ContratYousignCard(props: Props) {
  const { data: company } = useCompanyInfo();
  const fetchContrat = useServerFn(getContratConvoyeur);
  const sendContrat = useServerFn(sendContratYousign);
  const relancer = useServerFn(relancerContratYousign);
  const signedUrl = useServerFn(getContratSigneUrl);

  const [contrat, setContrat] = useState<ContratRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [siret, setSiret] = useState(props.siret ?? "");
  const [adresse, setAdresse] = useState(props.adresse ?? "");
  const [permis, setPermis] = useState(props.permisNumero ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchContrat({ data: { convoyeurId: props.convoyeurId } });
      setContrat((res.contrat as ContratRow | null) ?? null);
    } catch {
      setContrat(null);
    } finally {
      setLoading(false);
    }
  }, [fetchContrat, props.convoyeurId]);

  useEffect(() => { void load(); }, [load]);

  const envoyer = async () => {
    if (!props.email) { toast.error("Ce convoyeur n'a pas d'adresse email."); return; }
    setBusy(true);
    try {
      const blob = await generateContratConvoyeurPdf(
        {
          nom_complet: props.nomComplet,
          siret: siret || null,
          adresse: adresse || null,
          permis_numero: permis || null,
        },
        company,
      );
      const pdfBase64 = await blobToBase64(blob);
      const pageCount = getLastContratPageCount();
      const charteBlob = await generateCharteDiscretionPdf(
        { nom_complet: props.nomComplet, siret: siret || null, adresse: adresse || null },
        company,
      );
      const chartePdfBase64 = await blobToBase64(charteBlob);
      const res = await sendContrat({
        data: {
          convoyeurId: props.convoyeurId,
          pdfBase64,
          pageCount,
          chartePdfBase64,
          chartePageCount: getLastChartePageCount(),
          snapshot: { siret, adresse, permis_numero: permis },
        },
      });
      toast.success(
        res.otpSms
          ? "Contrat + charte envoyés pour signature (code SMS activé)."
          : "Contrat + charte envoyés pour signature par email.",
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  };

  const relance = async () => {
    if (!contrat) return;
    setBusy(true);
    try {
      await relancer({ data: { contratId: contrat.id } });
      toast.success("Relance envoyée au convoyeur.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Relance impossible.");
    } finally {
      setBusy(false);
    }
  };

  const telecharger = async (document: "contrat" | "charte" = "contrat") => {
    if (!contrat) return;
    setBusy(true);
    try {
      const { url } = await signedUrl({ data: { contratId: contrat.id, document } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Téléchargement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const ui = contrat ? STATUT_UI[contrat.statut] : null;
  const enAttente = contrat?.statut === "envoye";
  const peutEnvoyer = !contrat || contrat.statut === "refuse" || contrat.statut === "expire";

  return (
    <div className="bg-white border border-pro-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-lg bg-[#2F5FFF]/10 text-[#2F5FFF] flex items-center justify-center">
            <FileSignature size={17} />
          </span>
          <div>
            <p className="font-semibold text-pro-text">Contrat de partenariat</p>
            <p className="text-xs text-pro-text-soft">Contrat + charte de présentation et discrétion — Yousign (eIDAS)</p>
          </div>
        </div>
        {ui && (
          <span className={`text-[11px] font-medium px-2 py-1 rounded border ${ui.cls} whitespace-nowrap`}>
            <ui.Icon size={11} className="inline mr-1 -mt-0.5" />
            {ui.label}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#2F5FFF]" size={20} /></div>
      ) : (
        <>
          {contrat && (
            <div className="mt-4 text-xs text-pro-text-soft space-y-1">
              {contrat.sent_at && <p>Envoyé le {new Date(contrat.sent_at).toLocaleString("fr-FR")}</p>}
              {contrat.last_reminder_at && <p>Dernière relance le {new Date(contrat.last_reminder_at).toLocaleString("fr-FR")}</p>}
              {contrat.signed_at && <p>Contrat signé le {new Date(contrat.signed_at).toLocaleString("fr-FR")}</p>}
              {contrat.charte_incluse && (
                <p>
                  Charte de présentation et discrétion :{" "}
                  {contrat.charte_signed_at
                    ? `signée le ${new Date(contrat.charte_signed_at).toLocaleString("fr-FR")}`
                    : "en attente de signature"}
                </p>
              )}
              {contrat.decline_reason && <p>Motif du refus : {contrat.decline_reason}</p>}
              {contrat.yousign_environment === "sandbox" && (
                <p className="text-amber-700">Environnement de test Yousign (sandbox)</p>
              )}
            </div>
          )}

          {peutEnvoyer && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-pro-text-soft">
                SIRET
                <input value={siret} onChange={(e) => setSiret(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-pro-border rounded-lg text-sm text-pro-text" placeholder="000 000 000 00000" />
              </label>
              <label className="text-xs text-pro-text-soft">
                Adresse
                <input value={adresse} onChange={(e) => setAdresse(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-pro-border rounded-lg text-sm text-pro-text" placeholder="Adresse complète" />
              </label>
              <label className="text-xs text-pro-text-soft">
                N° de permis
                <input value={permis} onChange={(e) => setPermis(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-pro-border rounded-lg text-sm text-pro-text" placeholder="12AB34567" />
              </label>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {peutEnvoyer && (
              <button onClick={() => void envoyer()} disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2F5FFF] text-white text-sm font-medium disabled:opacity-60">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Envoyer le contrat pour signature
              </button>
            )}
            {enAttente && (
              <button onClick={() => void relance()} disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-pro-border text-sm font-medium text-pro-text disabled:opacity-60">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <BellRing size={15} />}
                Relancer le convoyeur
              </button>
            )}
            {contrat?.charte_signed_pdf_path && (
              <button onClick={() => void telecharger("charte")} disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-medium disabled:opacity-60">
                <Download size={15} />
                Télécharger la charte signée
              </button>
            )}
            {contrat?.signed_pdf_path && (
              <button onClick={() => void telecharger("contrat")} disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-medium disabled:opacity-60">
                <Download size={15} />
                Télécharger le contrat signé
              </button>
            )}
          </div>

          <p className="mt-3 text-[11px] text-pro-muted">
            Le contrat et la charte sont envoyés dans une seule demande de signature. Le dossier n'est jamais téléchargeable par le candidat avant signature : Yousign lui envoie
            directement le lien sécurisé, gère les relances et la piste d'audit.
          </p>
        </>
      )}
    </div>
  );
}
