import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, RefreshCw, Trash2, MessageSquare, Mail, Phone, Building2 } from "lucide-react";
import {
  PageHeader,
  Card,
  Badge,
  Table,
  THead,
  TH,
  TR,
  TD,
  EmptyState,
  Modal,
  DetailRow,
  Button,
  IconButton,
  Select,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/messages")({
  component: AdminMessages,
});

interface ContactMessage {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  profil: string;
  segment: string | null;
  societe: string | null;
  volume: string | null;
  message: string;
  statut: string;
  type_demande: string;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  convoyage: "Convoyage",
  devis: "Devis",
  b2b: "B2B",
  partenariat: "Partenariat",
};

const TYPE_TONES: Record<string, "info" | "primary" | "purple" | "success"> = {
  convoyage: "info",
  devis: "primary",
  b2b: "purple",
  partenariat: "success",
};

const STATUT_LABELS: Record<string, string> = {
  nouveau: "Nouveau",
  en_cours: "En cours",
  traite: "Traité",
  archive: "Archivé",
};

const STATUT_TONES: Record<string, "info" | "warning" | "success" | "neutral"> = {
  nouveau: "info",
  en_cours: "warning",
  traite: "success",
  archive: "neutral",
};

const TYPES = ["convoyage", "devis", "b2b", "partenariat"];
const STATUTS = ["nouveau", "en_cours", "traite", "archive"];

function AdminMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatut, setFilterStatut] = useState<string>("all");

  const fetchMessages = useCallback(async () => {
    let q = supabase.from("contact_messages").select("*").order("created_at", { ascending: false });
    if (filterType !== "all") q = q.eq("type_demande", filterType);
    if (filterStatut !== "all") q = q.eq("statut", filterStatut);
    const { data } = await q;
    if (data) setMessages(data as ContactMessage[]);
  }, [filterType, filterStatut]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const updateStatut = async (id: string, statut: string) => {
    await supabase.from("contact_messages").update({ statut }).eq("id", id);
    fetchMessages();
    if (selected?.id === id) setSelected((p) => (p ? { ...p, statut } : null));
  };

  const updateType = async (id: string, type_demande: string) => {
    await supabase.from("contact_messages").update({ type_demande }).eq("id", id);
    fetchMessages();
    if (selected?.id === id) setSelected((p) => (p ? { ...p, type_demande } : null));
  };

  const deleteMessage = async (id: string) => {
    if (!confirm("Supprimer ce message ?")) return;
    await supabase.from("contact_messages").delete().eq("id", id);
    setSelected(null);
    fetchMessages();
  };

  // Counts per type for tabs
  const counts = TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = messages.filter((m) => m.type_demande === t).length;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Messages & Demandes"
        subtitle={`${messages.length} message${messages.length > 1 ? "s" : ""}`}
        actions={
          <>
            <Select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}>
              <option value="all">Tous statuts</option>
              {STATUTS.map((s) => (
                <option key={s} value={s}>
                  {STATUT_LABELS[s]}
                </option>
              ))}
            </Select>
            <IconButton onClick={fetchMessages} title="Actualiser">
              <RefreshCw size={15} />
            </IconButton>
          </>
        }
      />

      {/* Type filter tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setFilterType("all")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            filterType === "all"
              ? "bg-pro-accent text-white border-pro-accent"
              : "bg-white border-pro-border text-pro-text-soft hover:bg-pro-bg-soft"
          }`}
        >
          Tous ({messages.length})
        </button>
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              filterType === t
                ? "bg-pro-accent text-white border-pro-accent"
                : "bg-white border-pro-border text-pro-text-soft hover:bg-pro-bg-soft"
            }`}
          >
            {TYPE_LABELS[t]} {filterType === "all" ? `(${counts[t] ?? 0})` : ""}
          </button>
        ))}
      </div>

      {messages.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Aucun message"
          description="Les messages du formulaire de contact apparaîtront ici."
        />
      ) : (
        <Table>
          <THead>
            <TH>Contact</TH>
            <TH className="hidden sm:table-cell">Type</TH>
            <TH className="hidden md:table-cell">Société</TH>
            <TH className="hidden md:table-cell">Date</TH>
            <TH>Statut</TH>
            <TH className="text-right">Actions</TH>
          </THead>
          <tbody>
            {messages.map((m) => (
              <TR key={m.id}>
                <TD>
                  <p className="font-medium text-pro-text">
                    {m.prenom} {m.nom}
                  </p>
                  <p className="text-pro-muted text-xs truncate max-w-[200px]">{m.email}</p>
                </TD>
                <TD className="hidden sm:table-cell">
                  <Badge tone={TYPE_TONES[m.type_demande] ?? "neutral"}>
                    {TYPE_LABELS[m.type_demande] ?? m.type_demande}
                  </Badge>
                </TD>
                <TD className="hidden md:table-cell text-pro-text-soft text-xs">
                  {m.societe || "—"}
                </TD>
                <TD className="hidden md:table-cell text-pro-muted text-xs">
                  {new Date(m.created_at).toLocaleDateString("fr-FR")}
                </TD>
                <TD>
                  <Badge tone={STATUT_TONES[m.statut] ?? "neutral"}>
                    {STATUT_LABELS[m.statut] ?? m.statut}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-1">
                    <IconButton onClick={() => setSelected(m)} title="Voir" tone="primary">
                      <Eye size={15} />
                    </IconButton>
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Détail message" size="md">
        {selected && (
          <>
            <Card padded={false} className="mb-4">
              <div className="px-4 py-3 bg-pro-bg-soft/40 border-b border-pro-border flex items-center justify-between gap-2 flex-wrap">
                <p className="text-pro-text font-medium">
                  {selected.prenom} {selected.nom}
                </p>
                <div className="flex items-center gap-2">
                  <Badge tone={TYPE_TONES[selected.type_demande] ?? "neutral"}>
                    {TYPE_LABELS[selected.type_demande] ?? selected.type_demande}
                  </Badge>
                  <Badge tone={STATUT_TONES[selected.statut] ?? "neutral"}>
                    {STATUT_LABELS[selected.statut] ?? selected.statut}
                  </Badge>
                </div>
              </div>
              <div className="px-4 divide-y divide-pro-border">
                <DetailRow label="Email" value={selected.email} />
                <DetailRow label="Téléphone" value={selected.telephone} />
                <DetailRow label="Profil" value={selected.profil} />
                <DetailRow label="Société" value={selected.societe} />
                <DetailRow label="Segment" value={selected.segment} />
                <DetailRow label="Volume" value={selected.volume} />
                <DetailRow label="Message" value={selected.message} />
                <DetailRow
                  label="Reçu le"
                  value={new Date(selected.created_at).toLocaleString("fr-FR")}
                />
              </div>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-medium text-pro-text-soft block mb-1">Type</label>
                <Select
                  value={selected.type_demande}
                  onChange={(e) => updateType(selected.id, e.target.value)}
                  className="w-full text-xs py-1.5"
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-pro-text-soft block mb-1">Statut</label>
                <Select
                  value={selected.statut}
                  onChange={(e) => updateStatut(selected.id, e.target.value)}
                  className="w-full text-xs py-1.5"
                >
                  {STATUTS.map((s) => (
                    <option key={s} value={s}>
                      {STATUT_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={`mailto:${selected.email}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-pro-accent text-white text-sm font-medium hover:bg-pro-accent-hover"
              >
                <Mail size={14} /> Répondre
              </a>
              {selected.telephone && (
                <a
                  href={`tel:${selected.telephone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-white border border-pro-border text-pro-text text-sm font-medium hover:bg-pro-bg-soft"
                >
                  <Phone size={14} /> Appeler
                </a>
              )}
              {selected.societe && (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-pro-bg-soft text-pro-text-soft text-sm">
                  <Building2 size={14} /> {selected.societe}
                </span>
              )}
              <Button
                variant="danger"
                onClick={() => deleteMessage(selected.id)}
                icon={<Trash2 size={14} />}
                className="ml-auto"
              >
                Supprimer
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
