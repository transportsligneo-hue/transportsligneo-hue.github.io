/**
 * Panneau "Avis Google" de la fiche mission admin.
 * - Statut par destinataire (client / contact livraison)
 * - Envoi manuel indépendant, canal configurable (email / sms / email+sms)
 * - Saisie de l'email et du téléphone du contact livraison s'il manque
 */
import { useCallback, useEffect, useState } from "react";
import { Star, Send, Loader2, CheckCircle2, AlertTriangle, Save, Smartphone, Mail } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, Button } from "@/components/admin/AdminUI";
import { sendGoogleReviewRequest } from "@/lib/google-review.functions";
import type { ReviewChannel } from "@/lib/google-review.server";

type RecipientType = "client" | "contact_livraison";

interface ReviewRow {
  recipient_type: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  channel: ReviewChannel;
  status: string;
  sent_at: string;
}

const CHANNEL_LABELS: Record<ReviewChannel, string> = {
  email: "Email",
  sms: "SMS",
  "email+sms": "Email + SMS",
};

export function MissionAvisGooglePanel({
  attributionId,
  trajetId,
  clientEmail,
  clientTelephone,
  clientNom,
  contactNom,
  contactEmail,
  contactTelephone,
}: {
  attributionId: string;
  trajetId: string;
  clientEmail: string | null;
  clientTelephone: string | null;
  clientNom: string | null;
  contactNom: string | null;
  contactEmail: string | null;
  contactTelephone: string | null;
}) {
  const send = useServerFn(sendGoogleReviewRequest);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState<RecipientType | null>(null);
  const [reviewUrl, setReviewUrl] = useState<string>("");
  const [defaultChannel, setDefaultChannel] = useState<ReviewChannel>("email");
  const [channel, setChannel] = useState<ReviewChannel>("email");
  const [email, setEmail] = useState(contactEmail ?? "");
  const [phone, setPhone] = useState(contactTelephone ?? "");
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);

  const load = useCallback(async () => {
    const [{ data: reqs }, { data: setting }] = await Promise.all([
      supabase
        .from("mission_review_requests")
        .select("recipient_type, recipient_email, recipient_phone, channel, status, sent_at")
        .eq("attribution_id", attributionId),
      supabase.from("app_settings").select("value").eq("key", "google_review").maybeSingle(),
    ]);
    setRows((reqs as ReviewRow[] | null) ?? []);
    const v = (setting as { value?: { url?: string; channel?: ReviewChannel } } | null)?.value;
    setReviewUrl(v?.url ?? "");
    const ch = v?.channel ?? "email";
    setDefaultChannel(ch);
    setChannel(ch);
  }, [attributionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setEmail(contactEmail ?? "");
    setPhone(contactTelephone ?? "");
  }, [contactEmail, contactTelephone]);

  const rowFor = (t: RecipientType, ch: ReviewChannel) =>
    rows.find((r) => r.recipient_type === t && r.channel === ch);

  const handleSend = async (recipientType: RecipientType) => {
    setLoading(recipientType);
    try {
      const res = await send({ data: { attributionId, recipientType, channel } });
      if (res.ok) {
        toast.success("Demande d'avis envoyée", {
          description: [res.recipientEmail, res.recipientPhone].filter(Boolean).join(" · ") || undefined,
        });
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

  const saveContactPhone = async () => {
    setSavingPhone(true);
    const { error } = await supabase
      .from("trajets")
      .update({ arrivee_contact_telephone: phone.trim() || null } as never)
      .eq("id", trajetId);
    setSavingPhone(false);
    if (error) toast.error("Enregistrement impossible", { description: error.message });
    else toast.success("Téléphone du contact livraison enregistré");
  };

  const renderStatus = (t: RecipientType, ch: ReviewChannel) => {
    const r = rowFor(t, ch);
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
  const contactHasPhone = !!(contactTelephone && contactTelephone.replace(/\D/g, "").length >= 10);

  const canSend = (t: RecipientType) => {
    if (channel === "email") return t === "client" ? !!clientEmail : contactHasEmail;
    if (channel === "sms") return t === "client" ? !!(clientTelephone && clientTelephone.replace(/\D/g, "").length >= 10) : contactHasPhone;
    return t === "client"
      ? !!clientEmail || !!(clientTelephone && clientTelephone.replace(/\D/g, "").length >= 10)
      : contactHasEmail || contactHasPhone;
  };

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

      <div className="mb-3 flex items-center gap-2">
        <label className="text-[11px] text-pro-muted">Canal d'envoi</label>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as ReviewChannel)}
          className="rounded-md border border-pro-border bg-transparent px-2 py-1 text-xs text-pro-text outline-none focus:border-pro-accent"
        >
          {(Object.keys(CHANNEL_LABELS) as ReviewChannel[]).map((ch) => (
            <option key={ch} value={ch}>
              {CHANNEL_LABELS[ch]} {ch === defaultChannel ? "(défaut)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {/* Client */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-pro-border px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-pro-text">Client</p>
            <p className="truncate text-[11px] text-pro-muted">
              {clientNom || "—"} {clientEmail ? `· ${clientEmail}` : "· email manquant"}{" "}
              {clientTelephone ? `· ${clientTelephone}` : "· téléphone manquant"}
            </p>
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
              {renderStatus("client", "email")}
              {renderStatus("client", "sms")}
            </div>
          </div>
          <Button
            icon={loading === "client" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            onClick={() => handleSend("client")}
            disabled={loading !== null || !canSend("client") || !reviewUrl}
          >
            {rowFor("client", channel) ? "Renvoyer" : "Envoyer au client"}
          </Button>
        </div>

        {/* Contact livraison */}
        <div className="rounded-lg border border-pro-border px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-pro-text">Contact livraison</p>
              <p className="truncate text-[11px] text-pro-muted">
                {contactNom || "—"} {contactHasEmail ? `· ${contactEmail}` : "· email manquant"}{" "}
                {contactHasPhone ? `· ${contactTelephone}` : "· téléphone manquant"}
              </p>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {renderStatus("contact_livraison", "email")}
                {renderStatus("contact_livraison", "sms")}
              </div>
            </div>
            <Button
              icon={
                loading === "contact_livraison" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />
              }
              onClick={() => handleSend("contact_livraison")}
              disabled={loading !== null || !canSend("contact_livraison") || !reviewUrl}
            >
              {rowFor("contact_livraison", channel) ? "Renvoyer" : "Envoyer au contact"}
            </Button>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Mail size={14} className="text-pro-muted" />
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
          <div className="mt-2 flex items-center gap-2">
            <Smartphone size={14} className="text-pro-muted" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="téléphone du contact livraison"
              className="flex-1 rounded-md border border-pro-border bg-transparent px-2 py-1.5 text-xs text-pro-text outline-none focus:border-pro-accent"
            />
            <Button icon={<Save size={13} />} onClick={saveContactPhone} disabled={savingPhone}>
              {savingPhone ? "…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-pro-muted">
        L'envoi automatique (X heures après le passage en « Terminée ») se paramètre dans Admin &gt; Paramètres.
        Le canal par défaut est <strong>{CHANNEL_LABELS[defaultChannel]}</strong>.
      </p>
    </Card>
  );
}
