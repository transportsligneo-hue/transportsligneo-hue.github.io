import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge, Button, Table, THead, TH, TD } from "@/components/admin/AdminUI";
import { Loader2, Mail, RefreshCw, Search, X } from "lucide-react";

type LogRow = {
  id: string;
  created_at: string;
  recipient_email: string;
  template_name: string;
  status: string;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
};

const statusTone = (s: string) =>
  s === "sent" ? "success" : s === "suppressed" ? "warning" : "danger";

const statusLabel = (s: string) =>
  s === "sent" ? "Envoyé" : s === "suppressed" ? "Bloqué" : "Échec";

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

export function AdminEmailHistory() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<LogRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("email_send_log")
      .select("id, created_at, recipient_email, template_name, status, error_message, metadata")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as LogRow[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((r) =>
        `${r.recipient_email} ${r.template_name} ${JSON.stringify(r.metadata ?? {})}`
          .toLowerCase()
          .includes(needle),
      )
    : rows;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pro-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un destinataire, un devis, un sujet…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-pro-border bg-pro-surface text-sm text-pro-text"
          />
        </div>
        <Button icon={<RefreshCw size={14} />} onClick={load}>
          Actualiser
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-pro-accent" size={24} />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-pro-text-soft">Aucun email envoyé pour l'instant.</p>
      ) : (
        <Table>
          <THead>
            <TH>Date</TH>
            <TH>Destinataire</TH>
            <TH className="hidden md:table-cell">Sujet / Type</TH>
            <TH>Statut</TH>
            <TH></TH>
          </THead>
          <tbody>
            {filtered.map((r) => {
              const meta = (r.metadata ?? {}) as Record<string, unknown>;
              const subject = str(meta["subject"]) ?? r.template_name;
              const numero = str(meta["numero"]);
              return (
                <tr key={r.id} className="border-t border-pro-border">
                  <TD className="text-xs text-pro-text-soft whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TD>
                  <TD className="text-sm">{r.recipient_email}</TD>
                  <TD className="hidden md:table-cell text-xs">
                    <span className="text-pro-text">{subject}</span>
                    {numero && <span className="ml-2 text-pro-muted">{numero}</span>}
                  </TD>
                  <TD>
                    <Badge tone={statusTone(r.status) as never}>{statusLabel(r.status)}</Badge>
                  </TD>
                  <TD>
                    <Button icon={<Mail size={13} />} onClick={() => setSelected(r)}>
                      Voir
                    </Button>
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-auto rounded-xl bg-pro-surface border border-pro-border p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-pro-text">
                  {str((selected.metadata ?? {})["subject"]) ?? selected.template_name}
                </h3>
                <p className="text-xs text-pro-text-soft">
                  À {selected.recipient_email} ·{" "}
                  {new Date(selected.created_at).toLocaleString("fr-FR")} · {selected.template_name}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-pro-muted hover:text-pro-text">
                <X size={18} />
              </button>
            </div>

            {selected.error_message && (
              <p className="mb-3 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                {selected.error_message}
              </p>
            )}

            {(() => {
              const meta = (selected.metadata ?? {}) as Record<string, unknown>;
              const html = str(meta["html"]);
              const message = str(meta["message"]);
              const docUrl = str(meta["doc_url"]);
              return (
                <div className="space-y-3">
                  {message && (
                    <div className="rounded-lg border border-pro-border p-3 text-sm text-pro-text whitespace-pre-wrap">
                      {message}
                    </div>
                  )}
                  {html && (
                    <div
                      className="rounded-lg border border-pro-border bg-white p-3 text-sm text-slate-800 overflow-auto"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  )}
                  {docUrl && (
                    <a
                      href={docUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-sm text-pro-accent underline"
                    >
                      Ouvrir le document lié
                    </a>
                  )}
                  {!message && !html && (
                    <p className="text-sm text-pro-text-soft">
                      Aucun contenu détaillé enregistré pour cet envoi.
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
