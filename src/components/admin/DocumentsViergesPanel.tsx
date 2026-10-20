import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Send, FileText, Loader2, ChevronDown, ChevronUp, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, Button } from "@/components/admin/AdminUI";
import { DOCUMENTS_VIERGES, type DocumentVierge } from "@/lib/documents-vierges";
import { downloadBlob } from "@/lib/documents-officiels";
import { fetchCompanyInfo, type CompanyInfo } from "@/lib/doc-branding";
import { sendTransactionalEmail } from "@/lib/email/send";

interface Contact { label: string; email: string; kind: "Client" | "Convoyeur" | "Admin" }

export function DocumentsViergesPanel() {
  const [open, setOpen] = useState(true);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sendDoc, setSendDoc] = useState<DocumentVierge | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchCompanyInfo().then(setCompany).catch(() => {});
  }, []);

  // Carnet d'adresses (clients, convoyeurs, admins) chargé à la première ouverture de l'envoi.
  useEffect(() => {
    if (!sendDoc || contacts.length) return;
    (async () => {
      const [prof, conv, roles] = await Promise.all([
        supabase.from("profiles").select("email, prenom, nom, societe").not("email", "is", null).limit(1000),
        supabase.from("convoyeurs").select("email, prenom, nom").not("email", "is", null).limit(1000),
        supabase.from("user_roles").select("user_id, role").eq("role", "admin" as never),
      ]);
      const adminIds = new Set(((roles.data ?? []) as { user_id: string }[]).map((r) => r.user_id));
      const out: Contact[] = [];
      if (adminIds.size) {
        const { data: adm } = await supabase.from("profiles").select("email, prenom, nom, id" as never).in("id" as never, [...adminIds] as never);
        for (const p of (adm ?? []) as unknown as { email: string; prenom?: string; nom?: string }[])
          if (p.email) out.push({ kind: "Admin", email: p.email, label: `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() || p.email });
      }
      for (const c of (conv.data ?? []) as { email: string; prenom?: string; nom?: string }[])
        out.push({ kind: "Convoyeur", email: c.email, label: `${c.prenom ?? ""} ${c.nom ?? ""}`.trim() || c.email });
      for (const p of (prof.data ?? []) as { email: string; prenom?: string; nom?: string; societe?: string }[])
        out.push({ kind: "Client", email: p.email, label: p.societe || `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() || p.email });
      setContacts(out);
    })().catch(() => {});
  }, [sendDoc, contacts.length]);

  const download = async (d: DocumentVierge) => {
    setBusy(`dl-${d.key}`);
    try {
      await downloadBlob(await d.build(company), d.filename);
    } catch {
      toast.error("Génération impossible");
    } finally { setBusy(null); }
  };

  const send = async () => {
    if (!sendDoc) return;
    const to = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(to)) { toast.error("Adresse email invalide"); return; }
    setBusy("send");
    try {
      const blob = await sendDoc.build(company);
      const path = `documents-vierges/${Date.now()}-${sendDoc.filename}`;
      const { error: upErr } = await supabase.storage.from("devis-acceptes").upload(path, blob, { contentType: "application/pdf", upsert: true });
      if (upErr) throw new Error(upErr.message);
      const { data: signed, error: signErr } = await supabase.storage
        .from("devis-acceptes")
        .createSignedUrl(path, 60 * 60 * 24 * 30, { download: sendDoc.filename });
      if (signErr || !signed?.signedUrl) throw new Error(signErr?.message ?? "Lien indisponible");
      await sendTransactionalEmail({
        templateName: "document-vierge",
        recipientEmail: to,
        idempotencyKey: `doc-vierge-${sendDoc.key}-${Date.now()}`,
        templateData: { documentNom: sendDoc.label, pdfUrl: signed.signedUrl },
      });
      toast.success("Document envoyé", { description: to });
      setSendDoc(null); setEmail(""); setSearch("");
    } catch (e) {
      toast.error("Envoi impossible", { description: (e as Error).message });
    } finally { setBusy(null); }
  };

  const q = search.trim().toLowerCase();
  const suggestions = q.length >= 2
    ? contacts.filter((c) => `${c.label} ${c.email}`.toLowerCase().includes(q)).slice(0, 6)
    : [];

  return (
    <Card padded={false} className="mb-6">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between p-4 text-left">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-pro-accent" />
          <div>
            <div className="font-semibold text-pro-text">Documents vierges</div>
            <div className="text-xs text-pro-muted">PV, états des lieux, mandat… à télécharger ou à envoyer tout de suite</div>
          </div>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="grid gap-2 border-t border-pro-border p-4 md:grid-cols-2">
          {DOCUMENTS_VIERGES.map((d) => (
            <div key={d.key} className="flex items-center justify-between gap-3 rounded-xl border border-pro-border px-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-pro-text">{d.label}</div>
                <div className="truncate text-xs text-pro-muted">{d.description}</div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => download(d)}
                  icon={busy === `dl-${d.key}` ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}>
                  Télécharger
                </Button>
                <Button size="sm" disabled={!!busy} onClick={() => { setSendDoc(d); setEmail(""); setSearch(""); }} icon={<Send size={13} />}>
                  Envoyer
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sendDoc && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="mt-16 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-pro-text">Envoyer : {sendDoc.label}</h3>
                <p className="text-xs text-pro-muted">Le destinataire reçoit un email avec le lien PDF (valable 30 jours).</p>
              </div>
              <button onClick={() => setSendDoc(null)} className="rounded p-1 text-pro-muted hover:bg-pro-bg-soft"><X size={16} /></button>
            </div>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setEmail(e.target.value.includes("@") ? e.target.value : email); }}
              placeholder="Chercher un client, convoyeur, admin… ou taper un email"
              className="h-10 w-full rounded-lg border border-pro-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-pro-accent/30"
              autoFocus
            />
            {suggestions.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-lg border border-pro-border">
                {suggestions.map((c, i) => (
                  <button key={c.email + i} onClick={() => { setEmail(c.email); setSearch(c.label); }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-pro-bg-soft">
                    <span className="truncate">{c.label} <span className="text-xs text-pro-muted">{c.email}</span></span>
                    <span className="shrink-0 rounded-full bg-pro-bg-soft px-2 py-0.5 text-[10px] font-semibold text-pro-text-soft">{c.kind}</span>
                  </button>
                ))}
              </div>
            )}
            {email && <p className="mt-2 text-xs text-pro-muted">Destinataire : <b className="text-pro-text">{email}</b></p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSendDoc(null)}>Annuler</Button>
              <Button disabled={busy === "send" || !email} onClick={send}
                icon={busy === "send" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}>
                Envoyer
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
