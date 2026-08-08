/**
 * Panneau "Avis Google" de la fiche mission admin.
 * - Statut par destinataire (client / contact livraison)
 * - Envoi manuel indépendant
 * - Saisie de l'email du contact livraison s'il manque
 */
import { useCallback, useEffect, useState } from "react";
import { Star, Send, Loader2, CheckCircle2, AlertTriangle, Save } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, Button } from "@/components/admin/AdminUI";
import { sendGoogleReviewRequest } from "@/lib/google-review.functions";

type RecipientType = "client" | "contact_livraison";

interface ReviewRow {
  recipient_type: string;
  recipient_email: string;
  status: string;
  sent_at: string;
}

export function MissionAvisGooglePanel({
  attributionId,
  trajetId,
  clientEmail,
  clientNom,
  contactNom,
  contactEmail,
}: {
  attributionId: string;
  trajetId: string;
  clientEmail: string | null;
  clientNom: string | null;
  contactNom: string | null;
  contactEmail: string | null;
}) {
  const send = useServerFn(sendGoogleReviewRequest);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState<RecipientType | null>(null);
  const [reviewUrl, setReviewUrl] = useState<string>("");
  const [email, setEmail] = useState(contactEmail ?? "");
  const [savingEmail, setSavingEmail] = useState(false);

  const load = useCallback(async () => {
    const [{ data: reqs }, { data: setting }] = await Promise.all([
      supabase
        .from("mission_review_requests")
        .select("recipient_type, recipient_email, status, sent_at")
        .eq("attribution_id", attributionId),
      supabase.from("app_settings").select("value").eq("key", "google_review").maybeSingle(),
    ]);
    setRows((reqs as ReviewRow[] | null) ?? []);
    const v = (setting as { value?: { url?: string } } | null)?.value;
    setReviewUrl(v?.url ?? "");
  }, [attributionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setEmail(contactEmail ?? "");
  }, [contactEmail]);

  const rowFor = (t: RecipientType) => rows.find((r) => r.recipient_type === t);

  const handleSend = async (recipientType: RecipientType) => {
    setLoading(recipientType);
    try {
      const res = await send({ data: { attributionId, recipientType } });
      if (res.ok) {
        toast.success("Demande d'avis envoyée", { description: res.recipientEmail });
        await load();
      } else {
        toast.error("Envoi impossible", { description: res.error });
      }
    } catch (err) {
      toast.error("Erreur", { description: err instanceof Error ? err.message : "" });
    } finally {
      setLoading(null);
    }
  };

  const saveContactEmail = async () => {
    setSavingEmail(true);
    const { error } = await supabase
      .from("trajets")
      .update({ arrivee_contact_email: email.trim() || null } as never)
      .eq("id", trajetId);
    setSavingEmail(false);
    if (error) toast.error("Enregistrement impossible", { description: error.message });
    else toast.success("Email du contact livraison enregistré");
  };

  const renderStatus = (t: RecipientType) => {
    const r = rowFor(t);
    if (!r) return <span className="text-[11px] text-pro-muted">Non envoyé</span>;
    if (r.status === "review_left")
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
          <CheckCircle2 size={12} /> Avis laissé
        </span>
      );
    if (r.status === "failed")
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
          <AlertTriangle size={12} /> Échec d'envoi
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
        <CheckCircle2 size={12} /> Envoyé le {new Date(r.sent_at).toLocaleDateString("fr-FR")} à{" "}
        {new Date(r.sent_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  };

  const contactHasEmail = !!(contactEmail && contactEmail.includes("@"));

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Star size={15} className="text-amber-500" />
        <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">Avis Google</h3>
      </div>

      {!reviewUrl && (
        <p className="mb-3 rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          Aucun lien d'avis Google n'est configuré. Renseigne-le dans <strong>Admin &gt; Paramètres &gt; Avis Google</strong>.
        </p>
      )}

      <div className="space-y-3">
        {/* Client */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-pro-border px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-pro-text">Client</p>
            <p className="truncate text-[11px] text-pro-muted">
              {clientNom || "—"} {clientEmail ? `· ${clientEmail}` : "· email manquant"}
            </p>
            <div className="mt-0.5">{renderStatus("client")}</div>
          </div>
          <Button
            icon={loading === "client" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            onClick={() => handleSend("client")}
            disabled={loading !== null || !clientEmail || !reviewUrl}
          >
            {rowFor("client") ? "Renvoyer" : "Envoyer au client"}
          </Button>
        </div>

        {/* Contact livraison */}
        <div className="rounded-lg border border-pro-border px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-pro-text">Contact livraison</p>
              <p className="truncate text-[11px] text-pro-muted">
                {contactNom || "—"} {contactHasEmail ? `· ${contactEmail}` : "· email manquant"}
              </p>
              <div className="mt-0.5">{renderStatus("contact_livraison")}</div>
            </div>
            <Button
              icon={
                loading === "contact_livraison" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />
              }
              onClick={() => handleSend("contact_livraison")}
              disabled={loading !== null || !contactHasEmail || !reviewUrl}
            >
              {rowFor("contact_livraison") ? "Renvoyer" : "Envoyer au contact"}
            </Button>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email du contact livraison"
              className="flex-1 rounded-md border border-pro-border bg-transparent px-2 py-1.5 text-xs text-pro-text outline-none focus:border-pro-accent"
            />
            <Button icon={<Save size={13} />} onClick={saveContactEmail} disabled={savingEmail}>
              {savingEmail ? "…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-pro-muted">
        L'envoi automatique (X heures après le passage en « Terminée ») se paramètre dans Admin &gt; Paramètres.
        Aucun envoi automatique n'est fait au contact livraison sans email valide.
      </p>
    </Card>
  );
}
