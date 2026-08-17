import { useEffect, useMemo, useRef, useState } from "react";
import { FileCheck2, ShieldCheck, X, ArrowLeft, Mail, KeyRound, XCircle, CheckCircle2, RotateCw, PenLine } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  requestDevisOtp,
  verifyDevisOtp,
  attachSignedDevisPdf,
  refuseDevis,
} from "@/lib/devis-signature-otp.functions";
import { acceptDevis } from "@/lib/devis-acceptation.functions";
import { SignatureCanvas } from "@/components/inspection/SignatureCanvas";
import { useCurrentOrgAccountType } from "@/hooks/useCurrentOrgAccountType";
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

const CGV_TEXT = `Article 1 · Objet
Les présentes Conditions Générales de Vente régissent les prestations de convoyage automobile fournies par Transports Ligneo.

Article 2 · Acceptation du devis
Le devis devient ferme et définitif après acceptation expresse par le client (case à cocher et validation par code de signature unique reçu par e-mail). Le montant accepté est ferme et ne peut être modifié sans nouvelle acceptation.

Article 3 · Prix
Les prix indiqués sont en euros TTC, péages et carburant inclus, sauf mention contraire.

Article 4 · Paiement
Le paiement est dû à l'acceptation du devis, sauf accord écrit contraire.

Article 5 · Annulation
Toute annulation à moins de 48h du convoyage entraîne la facturation de 50% du montant.

Article 6 · Responsabilité
Transports Ligneo souscrit une assurance professionnelle couvrant le véhicule pendant le trajet.

Article 7 · Données personnelles
Les données sont traitées conformément à notre politique de confidentialité. La preuve de signature (horodatage, adresse IP, code OTP vérifié) est conservée à des fins légales.

Article 8 · Litiges
Tout litige relève des tribunaux compétents de Tours.`;

async function sha256HexOfBlob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Phase =
  | "consent"
  | "sign"
  | "otp"
  | "processing"
  | "refuse"
  | "refused"
  | "success";


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
  const [phase, setPhase] = useState<Phase>("consent");
  const [showCgv, setShowCgv] = useState(false);

  // OTP state
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [maskedEmail, setMaskedEmail] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [resendAt, setResendAt] = useState<number>(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [refusMotif, setRefusMotif] = useState("");
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const requestOtp = useServerFn(requestDevisOtp);
  const verifyOtp = useServerFn(verifyDevisOtp);
  const attachPdf = useServerFn(attachSignedDevisPdf);
  const refuse = useServerFn(refuseDevis);
  const acceptDevisFn = useServerFn(acceptDevis);
  const [signing, setSigning] = useState(false);
  const { data: orgInfo } = useCurrentOrgAccountType();
  const isFlotte = orgInfo?.accountType === "flotte";


  // Ticker pour compte à rebours
  useEffect(() => {
    if (phase !== "otp") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const secondsLeft = useMemo(() => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.floor((expiresAt - now) / 1000));
  }, [expiresAt, now]);
  const canResend = phase === "otp" && !sending && now >= resendAt;

  const focusIndex = (idx: number) => {
    const el = inputsRef.current[idx];
    if (el) el.focus();
  };

  const handleDigit = (idx: number, raw: string) => {
    const v = raw.replace(/\D/g, "");
    if (!v) {
      const next = [...digits];
      next[idx] = "";
      setDigits(next);
      return;
    }
    // Collage 6 chiffres d'un coup
    if (v.length >= 6) {
      const arr = v.slice(0, 6).split("");
      setDigits(arr);
      focusIndex(5);
      return;
    }
    const next = [...digits];
    next[idx] = v[0];
    setDigits(next);
    if (idx < 5) focusIndex(idx + 1);
  };

  const handleKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      focusIndex(idx - 1);
    } else if (e.key === "ArrowLeft" && idx > 0) {
      focusIndex(idx - 1);
    } else if (e.key === "ArrowRight" && idx < 5) {
      focusIndex(idx + 1);
    }
  };

  const sendCode = async (isResend = false) => {
    setSending(true);
    try {
      const res = await requestOtp({ data: { devisId } });
      setMaskedEmail(res.maskedEmail);
      setExpiresAt(new Date(res.expiresAt).getTime());
      setResendAt(Date.now() + 60_000); // 60 s avant renvoi
      setDigits(["", "", "", "", "", ""]);
      setPhase("otp");
      toast.success(isResend ? "Nouveau code envoyé" : "Code envoyé par e-mail", {
        description: `Un code à 6 chiffres a été envoyé à ${res.maskedEmail}.`,
      });
      setTimeout(() => focusIndex(0), 60);
    } catch (e) {
      toast.error("Envoi du code impossible", { description: (e as Error).message });
    } finally {
      setSending(false);
    }
  };

  const submitCode = async () => {
    const code = digits.join("");
    if (code.length !== 6) {
      toast.error("Code incomplet", { description: "Saisissez les 6 chiffres reçus." });
      return;
    }
    setVerifying(true);
    setPhase("processing");
    try {
      // 1. Vérifie l'OTP + signe côté serveur
      const res = await verifyOtp({ data: { devisId, code } });

      // 2. Charge le devis complet pour générer le PDF
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Session expirée");

      const { data: devisRow, error: dErr } = await supabase
        .from("devis").select("*").eq("id", devisId).single();
      if (dErr || !devisRow) throw new Error("Devis introuvable");
      const version = (devisRow as { version?: number }).version ?? 1;
      const acceptedAtDate = res.acceptedAt ? new Date(res.acceptedAt) : new Date();
      const acceptedAtLabel = `${acceptedAtDate.toLocaleDateString("fr-FR")} à ${acceptedAtDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;

      // 3. Hash du PDF non signé (pour empreinte)
      const rawPdf = await generateDevisPdf({
        ...(devisRow as unknown as DevisData),
        version,
      });
      const pdfHash = await sha256HexOfBlob(rawPdf);

      // 4. PDF signé (cartouche OTP)
      const email = (devisRow as { email?: string }).email ?? userData.user?.email ?? "";
      const signedPdf = await generateDevisPdf({
        ...(devisRow as unknown as DevisData),
        version,
        acceptedAtLabel,
        otpProof: {
          email,
          method: "Code de validation par e-mail (OTP 6 chiffres)",
          acceptedAtLabel,
          ipAddress: (res as any).ipAddress ?? null,
          userAgent: (res as any).userAgent ?? null,
          cgvVersion: "v1-2026-01",
          pdfHash,
        },
      });

      // 5. Upload + attach
      const pdfPath = `${uid}/${devisId}/v${version}-devis-signe.pdf`;
      const up = await supabase.storage.from("devis-acceptes")
        .upload(pdfPath, signedPdf, { upsert: true, contentType: "application/pdf" });
      if (up.error) throw new Error(`Archivage du PDF impossible : ${up.error.message}`);
      await attachPdf({ data: { devisId, pdfPath } });

      // 6. E-mails confirmation client + admin (best-effort)
      try {
        const prenom = (devisRow as { prenom?: string }).prenom ?? "";
        const nom = (devisRow as { nom?: string }).nom ?? "";
        const sends: Promise<unknown>[] = [
          sendTransactionalEmail({
            templateName: "devis-accepte-admin",
            idempotencyKey: `admin-devis-accepte-${devisId}-v${version}`,
            templateData: { prenom, nom, email, numero, depart, arrivee, date: acceptedAtLabel, prix: prixTtc },
          }),
        ];
        if (email) {
          sends.unshift(sendTransactionalEmail({
            templateName: "devis-accepte",
            recipientEmail: email,
            idempotencyKey: `devis-accepte-${devisId}-v${version}`,
            templateData: { prenom, numero, depart, arrivee, montant: `${prixTtc.toFixed(2)} €`, dateAcceptation: acceptedAtLabel, version: String(version) },
          }));
        }
        await Promise.allSettled(sends);
      } catch { /* best-effort */ }

      setPhase("success");
      toast.success("Devis signé", { description: "Signature validée et archivée." });
      setTimeout(() => onAccepted(), 900);
    } catch (e) {
      toast.error("Signature impossible", { description: (e as Error).message });
      setPhase("otp");
    } finally {
      setVerifying(false);
    }
  };

  const submitRefus = async () => {
    setPhase("processing");
    try {
      await refuse({ data: { devisId, motif: refusMotif.trim() || undefined } });
      setPhase("refused");
      toast.success("Devis refusé", { description: "Nous avons enregistré votre refus." });
    } catch (e) {
      toast.error("Refus impossible", { description: (e as Error).message });
      setPhase("refuse");
    }
  };

  /* -------- Signature manuscrite rapide (canvas) -------- */
  const handleQuickSign = async (signatureFile: File) => {
    setSigning(true);
    setPhase("processing");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Session expirée");

      // 1. Charge le devis + version
      const { data: devisRow, error: dErr } = await supabase
        .from("devis").select("*").eq("id", devisId).single();
      if (dErr || !devisRow) throw new Error("Devis introuvable");
      const version = (devisRow as { version?: number }).version ?? 1;

      // 2. Upload signature PNG
      const sigPath = `${uid}/${devisId}/v${version}-signature.png`;
      const upSig = await supabase.storage.from("devis-acceptes")
        .upload(sigPath, signatureFile, { upsert: true, contentType: "image/png" });
      if (upSig.error) throw new Error(`Signature non enregistrée : ${upSig.error.message}`);

      // 3. Génère PDF signé (avec cartouche + signature)
      const acceptedAtDate = new Date();
      const acceptedAtLabel = `${acceptedAtDate.toLocaleDateString("fr-FR")} à ${acceptedAtDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
      const rawPdf = await generateDevisPdf({
        ...(devisRow as unknown as DevisData),
        version,
      });
      const pdfHash = await sha256HexOfBlob(rawPdf);
      const email = (devisRow as { email?: string }).email ?? userData.user?.email ?? "";
      const signedPdf = await generateDevisPdf({
        ...(devisRow as unknown as DevisData),
        version,
        acceptedAtLabel,
        otpProof: {
          email,
          method: "Signature manuscrite en ligne",
          acceptedAtLabel,
          ipAddress: null,
          userAgent: null,
          cgvVersion: "v1-2026-01",
          pdfHash,
        },
      });
      const pdfPath = `${uid}/${devisId}/v${version}-devis-signe.pdf`;
      const upPdf = await supabase.storage.from("devis-acceptes")
        .upload(pdfPath, signedPdf, { upsert: true, contentType: "application/pdf" });
      if (upPdf.error) throw new Error(`Archivage du PDF impossible : ${upPdf.error.message}`);

      // 4. Enregistre l'acceptation (signature + PDF)
      await acceptDevisFn({ data: { devisId, signaturePath: sigPath, pdfPath } });

      // 5. E-mails best-effort
      try {
        const prenom = (devisRow as { prenom?: string }).prenom ?? "";
        const nom = (devisRow as { nom?: string }).nom ?? "";
        const sends: Promise<unknown>[] = [
          sendTransactionalEmail({
            templateName: "devis-accepte-admin",
            idempotencyKey: `admin-devis-accepte-${devisId}-v${version}`,
            templateData: { prenom, nom, email, numero, depart, arrivee, date: acceptedAtLabel, prix: prixTtc },
          }),
        ];
        if (email) {
          sends.unshift(sendTransactionalEmail({
            templateName: "devis-accepte",
            recipientEmail: email,
            idempotencyKey: `devis-accepte-${devisId}-v${version}`,
            templateData: { prenom, numero, depart, arrivee, montant: `${prixTtc.toFixed(2)} €`, dateAcceptation: acceptedAtLabel, version: String(version) },
          }));
        }
        await Promise.allSettled(sends);
      } catch { /* best-effort */ }

      setPhase("success");
      toast.success("Devis signé", { description: "Signature enregistrée et archivée." });
      setTimeout(() => onAccepted(), 900);
    } catch (e) {
      toast.error("Signature impossible", { description: (e as Error).message });
      setPhase("sign");
    } finally {
      setSigning(false);
    }
  };


  // Téléchargement du PDF signé depuis storage
  const downloadSignedPdf = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Session expirée");
      const { data: devisRow } = await supabase.from("devis").select("version").eq("id", devisId).single();
      const version = (devisRow as { version?: number } | null)?.version ?? 1;
      const path = `${uid}/${devisId}/v${version}-devis-signe.pdf`;
      const { data, error } = await supabase.storage.from("devis-acceptes").createSignedUrl(path, 3600);
      if (error || !data) throw new Error("Téléchargement indisponible");
      window.open(data.signedUrl, "_blank", "noopener");
    } catch (e) {
      toast.error("Téléchargement impossible", { description: (e as Error).message });
    }
  };

  /* ------------------------------ RENDER ---------------------------------- */

  if (phase === "processing") {
    return (
      <div className="py-10">
        <LogoLoader label={verifying ? "Vérification du code…" : "Enregistrement en cours…"} />
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="space-y-4 text-center py-6">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle2 className="text-emerald-400" size={30} />
        </div>
        <div>
          <p className="font-heading text-lg text-cream">Devis {numero} signé</p>
          <p className="text-xs text-cream/70 mt-1">Un PDF signé a été archivé dans votre espace.</p>
        </div>
        <button
          onClick={downloadSignedPdf}
          className="inline-flex items-center gap-2 px-4 py-2 rounded border border-primary/40 text-primary text-xs uppercase tracking-wider hover:bg-primary/10"
        >
          <FileCheck2 size={14} /> Télécharger le devis signé
        </button>
      </div>
    );
  }

  if (phase === "refused") {
    return (
      <div className="space-y-4 text-center py-6">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center">
          <XCircle className="text-red-400" size={30} />
        </div>
        <div>
          <p className="font-heading text-lg text-cream">Devis refusé</p>
          <p className="text-xs text-cream/70 mt-1">
            Merci pour votre retour. Nous restons à votre disposition si vous souhaitez un nouveau devis.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded border border-cream/20 text-cream/80 text-xs uppercase tracking-wider hover:text-cream"
        >
          Retour
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-[#0a1638] to-[#132a6b] rounded-xl p-5">
        <h2 className="font-heading text-lg text-white tracking-wide">
          Acceptation du <span className="text-[#4f8cff]">devis</span> — {numero}
        </h2>
        <p className="text-[#aab4d4] text-sm mt-1">
          {depart} → {arrivee} · <span className="text-white font-semibold">{prixTtc.toFixed(2)} €</span>
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-[rgba(47,95,255,0.08)] border border-[rgba(79,140,255,0.25)]">
        <div className="w-[30px] h-[30px] rounded-full bg-[rgba(79,140,255,0.15)] flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck className="text-[#4f8cff]" size={18} />
        </div>
        <div className="text-sm">
          <p className="font-semibold text-[#0a1638]">Signature électronique par code e-mail</p>
          <p className="text-[#667085] mt-1 text-xs leading-relaxed">
            Vérifiez le récapitulatif, acceptez les CGV puis validez votre devis avec un
            code à 6 chiffres reçu par e-mail. Horodatage, adresse IP et vérification du
            code sont archivés comme preuve légale.
          </p>
        </div>
      </div>

      {/* Récapitulatif */}
      <div className="bg-[#fafbfd] border border-[#e4e7ec] rounded-xl p-5 space-y-4 text-[#101828]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9.5px] uppercase tracking-[0.06em] text-[#667085] font-bold">Devis</p>
            <p className="font-heading text-sm text-[#0a1638] font-bold">{numero}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[9.5px] uppercase tracking-[0.06em] text-[#667085] font-bold">Trajet</p>
            <p className="text-[#101828] font-medium">{depart} → {arrivee}</p>
          </div>
          {dateSouhaitee && (
            <div>
              <p className="text-[9.5px] uppercase tracking-[0.06em] text-[#667085] font-bold">Date souhaitée</p>
              <p className="text-[#101828] font-medium">{new Date(dateSouhaitee).toLocaleDateString("fr-FR")}</p>
            </div>
          )}
          {vehicule && (
            <div className="sm:col-span-2">
              <p className="text-[9.5px] uppercase tracking-[0.06em] text-[#667085] font-bold">Véhicule</p>
              <p className="text-[#101828] font-medium">{vehicule}</p>
            </div>
          )}
        </div>
        <div className="border-t border-[#e4e7ec] pt-4 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.06em] text-[#667085] font-bold">Montant total TTC</span>
          <span className="font-heading text-[22px] text-[#2f5fff] font-extrabold">{prixTtc.toFixed(2)} €</span>
        </div>
      </div>

      {phase === "consent" && (
        <>
          <label className="flex items-start gap-3 p-3 rounded-xl bg-[#fafbfd] border border-[#e4e7ec] cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#2f5fff] cursor-pointer shrink-0"
            />
            <span className="text-xs text-[#667085] leading-relaxed">
              Je reconnais avoir pris connaissance du devis et des{" "}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setShowCgv(true); }}
                className="underline text-[#2f5fff] hover:text-[#4f8cff] font-semibold"
              >
                Conditions Générales de Vente
              </button>{" "}
              et les accepter.
            </span>
          </label>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:flex-wrap sm:justify-end">
            <button
              onClick={() => setPhase("refuse")}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/40 text-red-500 hover:bg-red-500/10 text-xs uppercase tracking-wider"
            >
              <XCircle size={14} /> Refuser
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2.5 text-xs uppercase tracking-wider text-[#667085] hover:text-[#101828] rounded-lg border border-[#e4e7ec]"
            >
              Annuler
            </button>
            <button
              onClick={() => checked && sendCode(false)}
              disabled={!checked || sending}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#2f5fff] to-[#4f8cff] text-white font-heading text-xs tracking-[0.12em] uppercase rounded-lg font-bold shadow-[0_6px_20px_rgba(47,95,255,0.4)] transition-all hover:shadow-[0_8px_24px_rgba(47,95,255,0.5)] hover:from-[#284ee6] hover:to-[#4f8cff] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Mail size={14} />
              {sending ? "Envoi…" : "Signer par e-mail"}
            </button>
            {!isFlotte && (
              <button
                onClick={() => checked && setPhase("sign")}
                disabled={!checked}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#2f5fff] to-[#4f8cff] text-white font-heading text-xs tracking-[0.12em] uppercase rounded-lg font-bold shadow-[0_6px_20px_rgba(47,95,255,0.4)] transition-all hover:shadow-[0_8px_24px_rgba(47,95,255,0.5)] hover:from-[#284ee6] hover:to-[#4f8cff] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <PenLine size={14} /> Signer maintenant
              </button>
            )}
          </div>
          <p className="text-[10px] text-[#667085]/80 leading-relaxed text-right">
            {isFlotte
              ? "Signature Flotte · validation par code de signature unique reçu par e-mail (obligatoire)."
              : "Signature manuscrite instantanée · aucun code à attendre."}
          </p>
        </>
      )}

      {phase === "sign" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#667085] uppercase tracking-wider flex items-center gap-2">
              <PenLine size={13} className="text-[#2f5fff]" /> Signez pour valider
            </p>
            <button
              onClick={() => setPhase("consent")}
              className="text-[#667085] hover:text-[#101828] text-xs inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} /> Retour
            </button>
          </div>
          <p className="text-xs text-[#667085]">
            Signez ci-dessous puis validez. La signature, l'horodatage et votre adresse IP
            sont archivés comme preuve légale.
          </p>
          <SignatureCanvas onValidate={handleQuickSign} disabled={signing} />
        </div>
      )}


      {phase === "otp" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#667085] uppercase tracking-wider flex items-center gap-2">
              <KeyRound size={13} className="text-[#2f5fff]" /> Saisissez le code reçu
            </p>
            <button
              onClick={() => setPhase("consent")}
              className="text-[#667085] hover:text-[#101828] text-xs inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} /> Retour
            </button>
          </div>
          <p className="text-xs text-[#667085]">
            Un code à 6 chiffres vient d'être envoyé à <span className="text-[#0a1638] font-medium">{maskedEmail}</span>.
            Valable {Math.floor(secondsLeft / 60)} min {String(secondsLeft % 60).padStart(2, "0")}s.
          </p>

          <div className="flex justify-center gap-2 sm:gap-3">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputsRef.current[i] = el; }}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={6}
                value={d}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKey(i, e)}
                onFocus={(e) => e.target.select()}
                className="w-11 h-14 sm:w-12 sm:h-16 text-center font-heading text-2xl bg-white border border-[#e4e7ec] rounded-lg text-[#101828] focus:outline-none focus:border-[#2f5fff] focus:ring-2 focus:ring-[#2f5fff]/30"
              />
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-[#667085]">
            <button
              onClick={() => sendCode(true)}
              disabled={!canResend}
              className="inline-flex items-center gap-1 text-[#2f5fff] hover:text-[#4f8cff] disabled:text-[#667085]/40 disabled:cursor-not-allowed"
            >
              <RotateCw size={12} />
              {canResend
                ? "Renvoyer le code"
                : `Renvoyer dans ${Math.max(0, Math.ceil((resendAt - now) / 1000))}s`}
            </button>
            <span className="text-[#667085]/70">Le code expire dans {secondsLeft}s</span>
          </div>

          <button
            onClick={submitCode}
            disabled={digits.join("").length !== 6}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-[#2f5fff] to-[#4f8cff] text-white font-heading text-xs tracking-[0.12em] uppercase rounded-lg font-bold shadow-[0_6px_20px_rgba(47,95,255,0.4)] transition-all hover:shadow-[0_8px_24px_rgba(47,95,255,0.5)] hover:from-[#284ee6] hover:to-[#4f8cff] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            <ShieldCheck size={14} /> Valider et signer le devis
          </button>

          <p className="text-[10px] text-[#667085]/80 leading-relaxed flex items-start gap-1.5">
            <FileCheck2 size={12} className="text-[#2f5fff] shrink-0 mt-0.5" />
            En validant, le devis {numero} sera définitivement accepté pour un montant de {prixTtc.toFixed(2)} € TTC.
            Adresse IP, date/heure et code OTP vérifié seront archivés comme preuve.
          </p>
        </div>
      )}

      {phase === "refuse" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-cream/85 uppercase tracking-wider flex items-center gap-2">
              <XCircle size={13} className="text-red-400" /> Refuser le devis
            </p>
            <button
              onClick={() => setPhase("consent")}
              className="text-cream/60 hover:text-cream text-xs inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} /> Retour
            </button>
          </div>
          <label className="block text-xs text-cream/70">
            Motif (facultatif, 500 caractères max)
            <textarea
              value={refusMotif}
              maxLength={500}
              onChange={(e) => setRefusMotif(e.target.value)}
              rows={3}
              placeholder="Ex : prix, délai, choix d'un autre prestataire…"
              className="mt-1 w-full rounded border border-cream/20 bg-navy-dark/60 text-cream text-sm p-2 focus:outline-none focus:border-primary"
            />
          </label>
          <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end">
            <button
              onClick={() => setPhase("consent")}
              className="px-4 py-2 rounded border border-cream/20 text-cream/70 hover:text-cream text-xs uppercase tracking-wider"
            >
              Annuler
            </button>
            <button
              onClick={submitRefus}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-red-500/90 text-white text-xs uppercase tracking-wider hover:bg-red-500"
            >
              <XCircle size={14} /> Confirmer le refus
            </button>
          </div>
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
