/**
 * Carte admin : contrat de partenariat convoyeur, signé avec la signature
 * électronique Ligneo (Yousign n'est plus utilisé). L'envoi est bloqué tant que
 * le convoyeur n'a pas déposé ses pièces obligatoires.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CheckCircle2, FileSignature } from "lucide-react";
import { generateContratConvoyeurPdf } from "@/lib/documents-officiels";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import EsignPanel from "@/components/admin/EsignPanel";
import { esignConvoyeurDocsStatus, esignConvoyeurKbisInfo } from "@/lib/esign.functions";

interface Props {
  convoyeurId: string;
  nomComplet: string;
  email?: string | null;
  telephone?: string | null;
  siret?: string | null;
  adresse?: string | null;
  permisNumero?: string | null;
}

export default function ContratYousignCard(props: Props) {
  const { data: company } = useCompanyInfo();
  const docsStatus = useServerFn(esignConvoyeurDocsStatus);
  const [missing, setMissing] = useState<string[] | null>(null);
  const [siret, setSiret] = useState(props.siret ?? "");
  const [adresse, setAdresse] = useState(props.adresse ?? "");
  const [permis, setPermis] = useState(props.permisNumero ?? "");
  const kbisInfo = useServerFn(esignConvoyeurKbisInfo);
  const [kbisState, setKbisState] = useState<"idle" | "loading" | "done" | "none">("idle");
  const [denomination, setDenomination] = useState("");

  // SIRET + adresse repris automatiquement du Kbis déposé à l'inscription.
  useEffect(() => {
    if (props.siret && props.adresse) return;
    let dead = false;
    setKbisState("loading");
    void kbisInfo({ data: { convoyeurId: props.convoyeurId } })
      .then((r) => {
        if (dead) return;
        if (r.siret) setSiret((v) => v || r.siret!);
        if (r.adresse) setAdresse((v) => v || r.adresse!);
        if (r.denomination) setDenomination(r.denomination);
        setKbisState(r.ok ? "done" : "none");
      })
      .catch(() => { if (!dead) setKbisState("none"); });
    return () => { dead = true; };
  }, [kbisInfo, props.convoyeurId, props.siret, props.adresse]);

  useEffect(() => {
    void docsStatus({ data: { convoyeurId: props.convoyeurId } }).then((r) => setMissing(r.missing)).catch(() => setMissing(null));
  }, [docsStatus, props.convoyeurId]);

  const input = "mt-1 w-full px-3 py-2 border border-pro-border rounded-lg text-sm text-pro-text";
  return (
    <div className="rounded-2xl border border-pro-border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-pro-text"><FileSignature size={18} className="text-[#2F5FFF]" /> Contrat de partenariat</div>
      {missing && missing.length > 0 ? (
        <p className="mt-2 text-sm text-amber-700 flex gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0" />Envoi bloqué : le convoyeur doit d'abord déposer {missing.join(", ")}.</p>
      ) : missing ? (
        <p className="mt-2 text-sm text-emerald-700 flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0" />Toutes les pièces obligatoires sont déposées : le contrat peut être envoyé.</p>
      ) : null}
      {kbisState === "loading" && <p className="mt-3 text-xs text-pro-text-soft">Lecture du Kbis pour remplir le SIRET et l'adresse…</p>}
      {kbisState === "done" && <p className="mt-3 text-xs text-emerald-700">SIRET et adresse repris automatiquement du Kbis{denomination ? ` (${denomination})` : ""}. Vous pouvez les corriger.</p>}
      {kbisState === "none" && !siret && <p className="mt-3 text-xs text-pro-text-soft">Kbis non lisible : saisissez le SIRET et l'adresse à la main.</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-pro-text-soft">SIRET<input value={siret} onChange={(e) => setSiret(e.target.value)} className={input} placeholder="000 000 000 00000" /></label>
        <label className="text-xs text-pro-text-soft">Adresse<input value={adresse} onChange={(e) => setAdresse(e.target.value)} className={input} placeholder="Adresse complète" /></label>
        <label className="text-xs text-pro-text-soft">N° de permis<input value={permis} onChange={(e) => setPermis(e.target.value)} className={input} placeholder="12AB34567" /></label>
      </div>
      <div className="mt-4">
        <EsignPanel
          kind="contrat_convoyeur"
          refType="convoyeur"
          refId={props.convoyeurId}
          title="Envoyer le contrat pour signature"
          defaults={{ title: `Contrat de partenariat - ${props.nomComplet}`, name: props.nomComplet, email: props.email ?? "", phone: props.telephone ?? "", company: denomination }}
          getPdf={() => generateContratConvoyeurPdf(
            { nom_complet: props.nomComplet, siret: siret || null, adresse: adresse || null, permis_numero: permis || null },
            company,
          )}
        />
      </div>
    </div>
  );
}
