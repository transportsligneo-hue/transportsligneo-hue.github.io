import { useState } from "react";
import { Loader2, Send, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendTransactionalEmail } from "@/lib/email/send";

type Kind = "devis" | "facture";

interface Props {
  kind: Kind;
  /** Numéro du document (DEV-… / FAC-…) — utilisé pour le nom de fichier. */
  numero: string;
  /** Identifiant du document (idempotence). */
  documentId: string;
  /** Email prérempli (client). */
  defaultEmail?: string | null;
  /** Génère le PDF à joindre (lien de téléchargement signé). */
  buildPdf: () => Promise<Blob>;
  /** Données additionnelles passées au template email. */
  templateData?: Record<string, unknown>;
  /** Message personnalisé prérempli (éditable). */
  defaultMessage?: string | null;
  /** Rendu clair (cartes admin) ou sombre (tiroirs). */
  variant?: "light" | "dark";
  onSent?: (email: string) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SendDocumentByEmail({
  kind,
  numero,
  documentId,
  defaultEmail,
  defaultMessage,
  buildPdf,
  templateData,
  variant = "light",
  onSent,
}: Props) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [message, setMessage] = useState(defaultMessage ?? "");
  const [sending, setSending] = useState(false);
  const dark = variant === "dark";

  const handleSend = async () => {
    const to = email.trim();
    if (!EMAIL_RE.test(to)) {
      toast.error("Adresse email invalide");
      return;
    }
    setSending(true);
    try {
      let pdfUrl: string | undefined;
      try {
        const blob = await buildPdf();
        const path = `${kind === "devis" ? "devis" : "factures"}/${kind}-${numero}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("devis-acceptes")
          .upload(path, blob, { contentType: "application/pdf", upsert: true });
        if (upErr) console.error("[send-doc] upload", upErr.message);
        const { data: signed } = await supabase.storage
          .from("devis-acceptes")
          .createSignedUrl(path, 60 * 60 * 24 * 30, { download: `${kind}-${numero}.pdf` });
        pdfUrl = signed?.signedUrl;
      } catch (e) {
        console.error("[send-doc] pdf", e);
      }

      await sendTransactionalEmail({
        templateName: kind === "devis" ? "devis-client" : "facture-disponible",
        recipientEmail: to,
        idempotencyKey: `${kind}-admin-${documentId}-${Date.now()}`,
        templateData: {
          numero,
          ...(templateData ?? {}),
          ...(message.trim() ? { message: message.trim() } : {}),
          ...(pdfUrl ? { pdfUrl } : {}),
        },
      });

      if (kind === "devis") {
        await supabase
          .from("devis")
          .update({ email_envoye: true, sent_at: new Date().toISOString() } as never)
          .eq("id", documentId);
      }

      toast.success(pdfUrl ? `Envoyé à ${to} avec le PDF` : `Envoyé à ${to}`);
      onSent?.(to);
    } catch (e) {
      toast.error("Échec de l'envoi", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={dark ? "space-y-2" : "space-y-2"}>
      <p
        className={`text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5 ${
          dark ? "text-white/50" : "text-pro-muted"
        }`}
      >
        <Mail size={11} /> Envoyer par email
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !sending) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="destinataire@email.com"
          className={
            dark
              ? "flex-1 min-w-0 rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
              : "flex-1 min-w-0 rounded-lg border border-pro-border bg-white px-3 py-2 text-xs text-pro-text focus:border-pro-accent focus:outline-none focus:ring-2 focus:ring-pro-accent/20"
          }
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          className={
            dark
              ? "inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-400 disabled:opacity-50"
              : "inline-flex items-center gap-1.5 rounded-lg bg-pro-accent px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          }
        >
          {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          Envoyer
        </button>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        placeholder="Message personnalisé pour le client (facultatif) — affiché dans l'email avant le récapitulatif."
        className={
          dark
            ? "w-full rounded-md border border-white/15 bg-white/5 px-2.5 py-2 text-xs leading-relaxed text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none"
            : "w-full rounded-lg border border-pro-border bg-white px-3 py-2 text-xs leading-relaxed text-pro-text placeholder:text-pro-muted focus:border-pro-accent focus:outline-none focus:ring-2 focus:ring-pro-accent/20"
        }
      />
      <p className={`text-[10px] ${dark ? "text-white/40" : "text-pro-muted"}`}>
        Template Ligneo + bouton de téléchargement du PDF (lien valable 30 jours).
      </p>
    </div>
  );
}
