/**
 * Étape conditionnelle « État des lieux client » (outil externe du donneur d'ordre).
 * S'intercale entre l'état des lieux Ligneo et la signature du client.
 */
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ExternalLink, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_OUTIL_LOGO,
  ouvrirOutilExterne,
  resolveLogoUrl,
  tracerFinOutil,
  tracerOuvertureOutil,
  type OutilExterne,
} from "@/lib/outils-externes";

interface Props {
  attributionId: string;
  type: "depart" | "arrivee";
  clientNom: string | null;
  outil: OutilExterne | null;
  onDone: () => void;
}

export function EdlExterneGate({ attributionId, type, clientNom, outil, onDone }: Props) {
  const [logo, setLogo] = useState<string>(DEFAULT_OUTIL_LOGO);
  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);

  const nomClient = outil?.nom ?? clientNom ?? "client";

  useEffect(() => {
    let alive = true;
    resolveLogoUrl(outil?.logo_url).then(url => { if (alive) setLogo(url); });
    return () => { alive = false; };
  }, [outil?.logo_url]);

  const handleOpen = () => {
    if (!outil) {
      toast.error("Aucun outil externe configuré pour ce client. Contactez l'exploitation.");
      return;
    }
    setOpened(true);
    void tracerOuvertureOutil(attributionId, type, outil);
    ouvrirOutilExterne(outil);
  };

  const handleDone = async () => {
    setSaving(true);
    try {
      await tracerFinOutil(attributionId, type, outil);
      toast.success("État des lieux externe enregistré");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  const isApp = outil?.type === "app";

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-center bg-gradient-to-b from-slate-50 to-white py-7 px-6">
            <img
              src={logo}
              alt={`Logo ${nomClient}`}
              className="h-24 w-auto max-w-[70%] object-contain rounded-2xl"
              loading="lazy"
            />
          </div>

          <div className="px-5 pb-6 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              <ShieldCheck size={12} /> Étape obligatoire
            </span>
            <h2 className="mt-3 text-xl font-bold text-slate-900">
              État des lieux {nomClient} requis
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Ce client demande également un état des lieux via son propre outil.
              Merci de le compléter avant de faire signer le client.
            </p>
            {outil?.instructions && (
              <p className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[12.5px] text-slate-600">
                {outil.instructions}
              </p>
            )}

            <button
              onClick={handleOpen}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-blue-700 active:scale-[0.98]"
            >
              {isApp ? <Smartphone size={18} /> : <ExternalLink size={18} />}
              {isApp ? `Ouvrir l'application ${nomClient}` : `Ouvrir l'outil ${nomClient}`}
            </button>
            <p className="mt-2 text-[11px] text-slate-400">
              {isApp
                ? "L'application s'ouvre si elle est installée, sinon la page de téléchargement s'affiche."
                : "L'outil s'ouvre dans le navigateur de votre téléphone."}
            </p>

            <button
              onClick={handleDone}
              disabled={saving}
              className={`mt-5 w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition active:scale-[0.98] disabled:opacity-60 ${
                opened
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              J'ai terminé l'état des lieux externe
              {!saving && <ArrowRight size={16} />}
            </button>
            <p className="mt-2 text-[11px] text-slate-400">
              L'horodatage est conservé au dossier de mission comme preuve de passage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
