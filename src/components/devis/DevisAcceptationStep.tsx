import { useState } from "react";
import { FileCheck2, ShieldCheck, X, PenLine, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { acceptDevis } from "@/lib/devis-acceptation.functions";
import { SignatureCanvas } from "@/components/inspection/SignatureCanvas";
import { LogoLoader } from "@/components/brand/LogoLoader";
import { generateDevisPdf, type DevisData } from "@/lib/devis-pdf";
import { sendTransactionalEmail } from "@/lib/email/send";

interface Props {
  devisId: string;
  numero: string;
  depart: string;
  arrivee: string;
  prixTtc: number;
  vehicule?: string | null;
  dateSouhaitee?: string | null;
  onAccepted: () => void;
  onCancel: () => void;
}

const CGV_TEXT = `Article 1 — Objet
Les présentes Conditions Générales de Vente régissent les prestations de convoyage automobile fournies par Transports Ligneo.

Article 2 — Acceptation du devis
Le devis devient ferme et définitif après acceptation expresse par le client (case à cocher et signature électronique). Le montant accepté est ferme et ne peut être modifié sans nouvelle acceptation.

Article 3 — Prix
Les prix indiqués sont en euros TTC, péages et carburant inclus, sauf mention contraire.

Article 4 — Paiement
Le paiement est dû à l'acceptation du devis, sauf accord écrit contraire.

Article 5 — Annulation
Toute annulation à moins de 48h du convoyage entraîne la facturation de 50% du montant.

Article 6 — Responsabilité
Transports Ligneo souscrit une assurance professionnelle couvrant le véhicule pendant le trajet.

Article 7 — Données personnelles
Les données sont traitées conformément à notre politique de confidentialité. La preuve d'acceptation (horodatage, adresse IP, signature) est conservée à des fins légales.

Article 8 — Litiges
Tout litige relève des tribunaux compétents de Tours.`;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Lecture de la signature impossible"));
    r.readAsDataURL(file);
  });
}

export function DevisAcceptationStep({
  devisId,
  numero,
  depart,
  arrivee,
  prixTtc,
  vehicule,
  dateSouhaitee,
  onAccepted,
  onCancel,
}: Props) {
  const [checked, setChecked] = useState(false);
  const [phase, setPhase] = useState<"consent" | "signature" | "processing">("consent");
  const [showCgv, setShowCgv] = useState(false);
  const accept = useServerFn(acceptDevis);

  const handleSign = async (file: File) => {
    setPhase("processing");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Session expirée — reconnectez-vous.");

      // 1. Données complètes du devis pour le PDF figé
      const { data: devisRow, error: dErr } = await supabase
        .from("devis")
        .select("*")
        .eq("id", devisId)
        .single();
      if (dErr || !devisRow) throw new Error("Devis introuvable");

      const version = (devisRow as { version?: number }).version ?? 1;
      const signatureDataUrl = await fileToDataUrl(file);
      const now = new Date();
      const acceptedAtLabel = `${now.toLocaleDateString("fr-FR")} à ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;

      // 2. PDF figé incluant la signature manuscrite
      const pdfBlob = await generateDevisPdf({
        ...(devisRow as unknown as DevisData),
        version,
        clientSignatureDataUrl: signatureDataUrl,
        acceptedAtLabel,
      });

      // 3. Upload signature + PDF dans le bucket sécurisé
      const basePath = `${uid}/${devisId}`;
      const signaturePath = `${basePath}/v${version}-signature.png`;
      const pdfPath = `${basePath}/v${version}-devis-signe.pdf`;

      const [sigUp, pdfUp] = await Promise.all([
        supabase.storage.from("devis-acceptes").upload(signaturePath, file, { upsert: true, contentType: "image/png" }),
        supabase.storage.from("devis-acceptes").upload(pdfPath, pdfBlob, { upsert: true, contentType: "application/pdf" }),
      ]);
      if (sigUp.error) throw new Error(`Envoi de la signature impossible : ${sigUp.error.message}`);
      if (pdfUp.error) throw new Error(`Archivage du PDF impossible : ${pdfUp.error.message}`);

      // 4. Preuve d'acceptation côté serveur (IP, user-agent, verrouillage)
      await accept({ data: { devisId, signaturePath, pdfPath } });

      // 5. Email de confirmation (best-effort)
      try {
        const email = (devisRow as { email?: string }).email ?? userData.user?.email;
        if (email) {
          await sendTransactionalEmail({
            templateName: "devis-accepte",
            recipientEmail: email,
            idempotencyKey: `devis-accepte-${devisId}-v${version}`,
            templateData: {
              prenom: (devisRow as { prenom?: string }).prenom ?? "",
              numero,
              depart,
              arrivee,
              montant: `${prixTtc.toFixed(2)} €`,
              dateAcceptation: acceptedAtLabel,
              version: String(version),
            },
          });
        }
      } catch {
        // l'email ne doit jamais bloquer l'acceptation
      }

      toast.success("Devis signé et accepté", {
        description: "Le PDF signé est archivé dans votre espace. Vous pouvez poursuivre.",
      });
      onAccepted();
    } catch (e) {
      toast.error("Acceptation impossible", { description: (e as Error).message });
      setPhase("signature");
    }
  };

  if (phase === "processing") {
    return (
      <div className="py-10">
        <LogoLoader label="Signature en cours d'enregistrement…" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded border border-primary/30 bg-primary/5">
        <ShieldCheck className="text-primary shrink-0 mt-0.5" size={20} />
        <div className="text-sm text-cream">
          <p className="font-semibold text-cream">Acceptation et signature du devis</p>
          <p className="text-cream/85 mt-1 text-xs leading-relaxed">
            Vérifiez le récapitulatif, acceptez les Conditions Générales de Vente puis signez
            électroniquement. Une preuve d'acceptation horodatée (IP, signature, montant) sera
            conservée et un PDF figé sera archivé.
          </p>
        </div>
      </div>

      <div className="card-premium-light rounded p-4 space-y-3 text-navy">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-navy/70 font-medium">Devis</p>
            <p className="font-heading text-base text-navy">{numero}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-navy/70 font-medium">Trajet</p>
            <p className="text-navy font-medium">{depart} → {arrivee}</p>
          </div>
          {dateSouhaitee && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-navy/70 font-medium">Date souhaitée</p>
              <p className="text-navy font-medium">{new Date(dateSouhaitee).toLocaleDateString("fr-FR")}</p>
            </div>
          )}
          {vehicule && (
            <div className="sm:col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-navy/70 font-medium">Véhicule</p>
              <p className="text-navy font-medium">{vehicule}</p>
            </div>
          )}
        </div>
        <div className="border-t border-navy/15 pt-3 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-navy/70 font-medium">Montant total TTC</span>
          <span className="font-heading text-2xl text-navy font-semibold">{prixTtc.toFixed(2)} €</span>
        </div>
      </div>

      {phase === "consent" && (
        <>
          <label className="flex items-start gap-3 p-3 rounded border border-cream/15 bg-navy-dark/40 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-primary cursor-pointer shrink-0"
            />
            <span className="text-xs text-cream leading-relaxed">
              Je reconnais avoir pris connaissance du devis et des{" "}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setShowCgv(true); }}
                className="underline text-primary hover:text-gold-light"
              >
                Conditions Générales de Vente
              </button>{" "}
              et les accepter.
            </span>
          </label>

          <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2.5 text-xs uppercase tracking-wider text-cream/70 hover:text-cream rounded border border-cream/20"
            >
              Annuler
            </button>
            <button
              onClick={() => checked && setPhase("signature")}
              disabled={!checked}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-navy font-heading text-xs tracking-[0.15em] uppercase rounded hover:bg-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PenLine size={14} />
              Continuer vers la signature
            </button>
          </div>
        </>
      )}

      {phase === "signature" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-cream/85 uppercase tracking-wider flex items-center gap-2">
              <PenLine size={13} className="text-primary" /> Signez dans le cadre ci-dessous
            </p>
            <button
              onClick={() => setPhase("consent")}
              className="text-cream/60 hover:text-cream text-xs inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} /> Retour
            </button>
          </div>
          <div className="h-44 rounded overflow-hidden border border-primary/30 bg-white">
            <SignatureCanvas onValidate={handleSign} />
          </div>
          <p className="text-[10px] text-cream/60 leading-relaxed flex items-start gap-1.5">
            <FileCheck2 size={12} className="text-primary shrink-0 mt-0.5" />
            En validant votre signature, le devis {numero} sera définitivement accepté pour un montant
            de {prixTtc.toFixed(2)} € TTC. Date, heure, adresse IP et signature seront archivées comme preuve.
          </p>
        </div>
      )}

      {showCgv && (
        <div className="fixed inset-0 z-[60] bg-navy/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-dark border border-primary/30 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-cream/10">
              <h3 className="font-heading text-lg text-primary tracking-wider">Conditions Générales de Vente</h3>
              <button onClick={() => setShowCgv(false)} className="text-cream/60 hover:text-cream">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-5 text-sm text-cream/90 whitespace-pre-line leading-relaxed">
              {CGV_TEXT}
            </div>
            <div className="p-4 border-t border-cream/10 flex justify-end">
              <button
                onClick={() => setShowCgv(false)}
                className="px-4 py-2 bg-primary text-navy text-xs uppercase tracking-wider rounded hover:bg-gold-light"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
