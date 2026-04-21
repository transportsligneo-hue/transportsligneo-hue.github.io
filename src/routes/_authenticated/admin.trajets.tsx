import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sendTransactionalEmail } from "@/lib/email/send";
import { RefreshCw, Plus, Eye, Edit2, Save, Route as RouteIcon, Send, CheckCircle2, XCircle, Gavel } from "lucide-react";
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
  TextInput,
  FormField,
  trajetStatutTone,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/trajets")({
  component: AdminTrajets,
});

interface Trajet {
  id: string;
  depart: string;
  arrivee: string;
  date_trajet: string | null;
  heure_trajet: string | null;
  marque: string | null;
  modele: string | null;
  immatriculation: string | null;
  client_nom: string | null;
  client_email: string | null;
  client_telephone: string | null;
  prix: number | null;
  tarif_convoyeur: number | null;
  statut: string;
  notes_internes: string | null;
  demande_id: string | null;
  created_at: string;
  prix_suggere?: number | null;
  statut_publication?: string;
}

interface Offre {
  id: string;
  trajet_id: string;
  convoyeur_id: string;
  prix_propose: number;
  prix_suggere_snapshot: number | null;
  type_offre: string;
  statut: string;
  message: string | null;
  created_at: string;
  convoyeur?: { prenom: string; nom: string; telephone: string; email: string } | null;
}

const statuts = ["en_attente", "attribue", "accepte", "en_cours", "termine", "annule"];
const statutLabels: Record<string, string> = {
  en_attente: "En attente",
  attribue: "Attribué",
  accepte: "Accepté",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
};

const emptyTrajet = {
  depart: "",
  arrivee: "",
  date_trajet: "",
  heure_trajet: "",
  marque: "",
  modele: "",
  immatriculation: "",
  client_nom: "",
  client_email: "",
  client_telephone: "",
  prix: "",
  tarif_convoyeur: "",
  notes_internes: "",
};

function AdminTrajets() {
  const [trajets, setTrajets] = useState<Trajet[]>([]);
  const [filterStatut, setFilterStatut] = useState("all");
  const [selected, setSelected] = useState<Trajet | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyTrajet);
  const [editing, setEditing] = useState(false);
  const [offres, setOffres] = useState<Offre[]>([]);
  const [prixSuggereInput, setPrixSuggereInput] = useState<string>("");
  const [savingPub, setSavingPub] = useState(false);

  const fetchOffres = useCallback(async (trajetId: string) => {
    const { data: offresData } = await supabase
      .from("mission_offres" as never)
      .select("*")
      .eq("trajet_id" as never, trajetId as never)
      .order("prix_propose" as never, { ascending: true } as never);
    if (!offresData) {
      setOffres([]);
      return;
    }
    const list = offresData as unknown as Offre[];
    // Hydrater convoyeurs
    const ids = Array.from(new Set(list.map((o) => o.convoyeur_id)));
    if (ids.length > 0) {
      const { data: convs } = await supabase
        .from("convoyeurs")
        .select("id, prenom, nom, telephone, email")
        .in("id", ids);
      const map: Record<string, { prenom: string; nom: string; telephone: string; email: string }> = {};
      (convs ?? []).forEach((c) => {
        map[c.id] = { prenom: c.prenom, nom: c.nom, telephone: c.telephone, email: c.email };
      });
      setOffres(list.map((o) => ({ ...o, convoyeur: map[o.convoyeur_id] ?? null })));
    } else {
      setOffres(list);
    }
  }, []);

  // Charger les offres dès qu'un trajet est ouvert en lecture
  useEffect(() => {
    if (selected && !editing && !showCreate) {
      fetchOffres(selected.id);
      setPrixSuggereInput(selected.prix_suggere?.toString() ?? "");
    } else {
      setOffres([]);
    }
  }, [selected, editing, showCreate, fetchOffres]);

  const togglePublication = async (publier: boolean) => {
    if (!selected) return;
    setSavingPub(true);
    const updates: Record<string, unknown> = {
      statut_publication: publier ? "publie" : "brouillon",
    };
    if (publier && prixSuggereInput) {
      updates.prix_suggere = parseFloat(prixSuggereInput);
    }
    await supabase.from("trajets").update(updates as never).eq("id", selected.id);
    setSavingPub(false);
    setSelected({ ...selected, statut_publication: publier ? "publie" : "brouillon", prix_suggere: publier ? parseFloat(prixSuggereInput || "0") : selected.prix_suggere });
    fetchTrajets();
  };

  const validerOffre = async (offre: Offre) => {
    if (!selected) return;
    if (!confirm(`Valider ${offre.convoyeur?.prenom} ${offre.convoyeur?.nom} à ${offre.prix_propose} € ?`)) return;

    // 1) Récupérer toutes les autres offres en attente pour les notifier
    const { data: autresOffres } = await supabase
      .from("mission_offres" as never)
      .select("id, convoyeur_id, prix_propose")
      .eq("trajet_id" as never, selected.id as never)
      .neq("id" as never, offre.id as never)
      .eq("statut" as never, "en_attente" as never);

    // 2) Marquer cette offre acceptée, refuser les autres
    await supabase.from("mission_offres" as never).update({ statut: "acceptee" } as never).eq("id" as never, offre.id as never);
    await supabase
      .from("mission_offres" as never)
      .update({ statut: "refusee" } as never)
      .eq("trajet_id" as never, selected.id as never)
      .neq("id" as never, offre.id as never);
    // 3) Créer une attribution officielle
    await supabase.from("attributions").insert({
      trajet_id: selected.id,
      convoyeur_id: offre.convoyeur_id,
      statut: "propose",
    });
    // 4) Mettre le trajet en attribué + figer publication
    await supabase
      .from("trajets")
      .update({
        statut: "attribue",
        tarif_convoyeur: offre.prix_propose,
        statut_publication: "attribue",
      } as never)
      .eq("id", selected.id);

    // 5) Notifications email (best-effort)
    const dateFmt = selected.date_trajet
      ? new Date(selected.date_trajet).toLocaleDateString("fr-FR")
      : "—";
    if (offre.convoyeur?.email) {
      sendTransactionalEmail({
        templateName: "offre-acceptee",
        recipientEmail: offre.convoyeur.email,
        idempotencyKey: `offre-acceptee-${offre.id}`,
        templateData: {
          prenom: offre.convoyeur.prenom,
          depart: selected.depart,
          arrivee: selected.arrivee,
          date: dateFmt,
          prixPropose: offre.prix_propose,
        },
      }).catch(() => {});
    }
    if (autresOffres && autresOffres.length > 0) {
      const ids = autresOffres as unknown as { convoyeur_id: string; prix_propose: number; id: string }[];
      const { data: convs } = await supabase
        .from("convoyeurs")
        .select("id, prenom, email")
        .in("id", ids.map((o) => o.convoyeur_id));
      ids.forEach((o) => {
        const c = convs?.find((cc) => cc.id === o.convoyeur_id);
        if (c?.email) {
          sendTransactionalEmail({
            templateName: "offre-refusee",
            recipientEmail: c.email,
            idempotencyKey: `offre-refusee-${o.id}`,
            templateData: {
              prenom: c.prenom,
              depart: selected.depart,
              arrivee: selected.arrivee,
              date: dateFmt,
              prixPropose: o.prix_propose,
            },
          }).catch(() => {});
        }
      });
    }

    fetchOffres(selected.id);
    fetchTrajets();
    setSelected({ ...selected, statut: "attribue", tarif_convoyeur: offre.prix_propose, statut_publication: "attribue" });
  };

  const refuserOffre = async (offre: Offre) => {
    await supabase.from("mission_offres" as never).update({ statut: "refusee" } as never).eq("id" as never, offre.id as never);
    if (offre.convoyeur?.email && selected) {
      const dateFmt = selected.date_trajet
        ? new Date(selected.date_trajet).toLocaleDateString("fr-FR")
        : "—";
      sendTransactionalEmail({
        templateName: "offre-refusee",
        recipientEmail: offre.convoyeur.email,
        idempotencyKey: `offre-refusee-${offre.id}`,
        templateData: {
          prenom: offre.convoyeur.prenom,
          depart: selected.depart,
          arrivee: selected.arrivee,
          date: dateFmt,
          prixPropose: offre.prix_propose,
        },
      }).catch(() => {});
    }
    if (selected) fetchOffres(selected.id);
  };

  const fetchTrajets = useCallback(async () => {
    let query = supabase.from("trajets").select("*").order("created_at", { ascending: false });
    if (filterStatut !== "all") query = query.eq("statut", filterStatut);
    const { data } = await query;
    if (data) setTrajets(data as Trajet[]);
  }, [filterStatut]);

  useEffect(() => {
    fetchTrajets();
  }, [fetchTrajets]);

  const createTrajet = async () => {
    if (!form.depart || !form.arrivee) return;
    await supabase.from("trajets").insert({
      depart: form.depart,
      arrivee: form.arrivee,
      date_trajet: form.date_trajet || null,
      heure_trajet: form.heure_trajet || "",
      marque: form.marque || "",
      modele: form.modele || "",
      immatriculation: form.immatriculation || "",
      client_nom: form.client_nom || "",
      client_email: form.client_email || "",
      client_telephone: form.client_telephone || "",
      prix: form.prix ? parseFloat(form.prix) : null,
      tarif_convoyeur: form.tarif_convoyeur ? parseFloat(form.tarif_convoyeur) : null,
      notes_internes: form.notes_internes || "",
    });
    setForm(emptyTrajet);
    setShowCreate(false);
    fetchTrajets();
  };

  const updateTrajet = async () => {
    if (!selected) return;
    await supabase
      .from("trajets")
      .update({
        depart: form.depart,
        arrivee: form.arrivee,
        date_trajet: form.date_trajet || null,
        heure_trajet: form.heure_trajet || "",
        marque: form.marque || "",
        modele: form.modele || "",
        immatriculation: form.immatriculation || "",
        client_nom: form.client_nom || "",
        client_email: form.client_email || "",
        client_telephone: form.client_telephone || "",
        prix: form.prix ? parseFloat(form.prix) : null,
        tarif_convoyeur: form.tarif_convoyeur ? parseFloat(form.tarif_convoyeur) : null,
        notes_internes: form.notes_internes || "",
      })
      .eq("id", selected.id);
    setEditing(false);
    setSelected(null);
    fetchTrajets();
  };

  const updateStatut = async (id: string, statut: string) => {
    await supabase.from("trajets").update({ statut }).eq("id", id);
    fetchTrajets();
  };

  const openEdit = (t: Trajet) => {
    setForm({
      depart: t.depart,
      arrivee: t.arrivee,
      date_trajet: t.date_trajet ?? "",
      heure_trajet: t.heure_trajet ?? "",
      marque: t.marque ?? "",
      modele: t.modele ?? "",
      immatriculation: t.immatriculation ?? "",
      client_nom: t.client_nom ?? "",
      client_email: t.client_email ?? "",
      client_telephone: t.client_telephone ?? "",
      prix: t.prix?.toString() ?? "",
      tarif_convoyeur: t.tarif_convoyeur?.toString() ?? "",
      notes_internes: t.notes_internes ?? "",
    });
    setEditing(true);
    setSelected(t);
  };

  const isFormOpen = showCreate || (selected && editing);

  return (
    <div>
      <PageHeader
        title="Trajets"
        subtitle={`${trajets.length} trajet${trajets.length > 1 ? "s" : ""}`}
        actions={
          <>
            <Select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}>
              <option value="all">Tous</option>
              {statuts.map((s) => (
                <option key={s} value={s}>
                  {statutLabels[s]}
                </option>
              ))}
            </Select>
            <Button
              icon={<Plus size={14} />}
              onClick={() => {
                setForm(emptyTrajet);
                setShowCreate(true);
              }}
            >
              Nouveau
            </Button>
            <IconButton onClick={fetchTrajets} title="Actualiser">
              <RefreshCw size={15} />
            </IconButton>
          </>
        }
      />

      {trajets.length === 0 ? (
        <EmptyState icon={RouteIcon} title="Aucun trajet" description="Créez un trajet ou convertissez une demande." />
      ) : (
        <Table>
          <THead>
            <TH>Trajet</TH>
            <TH className="hidden sm:table-cell">Client</TH>
            <TH className="hidden md:table-cell">Date</TH>
            <TH className="hidden md:table-cell">Prix</TH>
            <TH>Statut</TH>
            <TH className="text-right">Actions</TH>
          </THead>
          <tbody>
            {trajets.map((t) => (
              <TR key={t.id}>
                <TD>
                  <p className="font-medium text-pro-text">
                    {t.depart} → {t.arrivee}
                  </p>
                  {t.marque && (
                    <p className="text-pro-muted text-xs">
                      {t.marque} {t.modele}
                    </p>
                  )}
                </TD>
                <TD className="hidden sm:table-cell text-pro-text-soft">{t.client_nom || "—"}</TD>
                <TD className="hidden md:table-cell text-pro-muted text-xs">
                  {t.date_trajet ? new Date(t.date_trajet).toLocaleDateString("fr-FR") : "—"}
                </TD>
                <TD className="hidden md:table-cell text-pro-text-soft">
                  {t.prix ? `${t.prix} €` : "—"}
                </TD>
                <TD>
                  <Badge tone={trajetStatutTone[t.statut] ?? "neutral"}>
                    {statutLabels[t.statut] ?? t.statut}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-1">
                    <IconButton
                      onClick={() => {
                        setSelected(t);
                        setEditing(false);
                      }}
                      title="Voir"
                      tone="primary"
                    >
                      <Eye size={15} />
                    </IconButton>
                    <IconButton onClick={() => openEdit(t)} title="Modifier" tone="primary">
                      <Edit2 size={15} />
                    </IconButton>
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      {/* Modal création / édition */}
      <Modal
        open={!!isFormOpen}
        onClose={() => {
          setShowCreate(false);
          setEditing(false);
          setSelected(null);
        }}
        title={editing ? "Modifier le trajet" : "Nouveau trajet"}
        size="lg"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Départ" required>
              <TextInput value={form.depart} onChange={(e) => setForm({ ...form, depart: e.target.value })} />
            </FormField>
            <FormField label="Arrivée" required>
              <TextInput value={form.arrivee} onChange={(e) => setForm({ ...form, arrivee: e.target.value })} />
            </FormField>
            <FormField label="Date">
              <TextInput
                type="date"
                value={form.date_trajet}
                onChange={(e) => setForm({ ...form, date_trajet: e.target.value })}
              />
            </FormField>
            <FormField label="Heure">
              <TextInput value={form.heure_trajet} onChange={(e) => setForm({ ...form, heure_trajet: e.target.value })} />
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Marque">
              <TextInput value={form.marque} onChange={(e) => setForm({ ...form, marque: e.target.value })} />
            </FormField>
            <FormField label="Modèle">
              <TextInput value={form.modele} onChange={(e) => setForm({ ...form, modele: e.target.value })} />
            </FormField>
            <FormField label="Immatriculation">
              <TextInput value={form.immatriculation} onChange={(e) => setForm({ ...form, immatriculation: e.target.value })} />
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Client">
              <TextInput value={form.client_nom} onChange={(e) => setForm({ ...form, client_nom: e.target.value })} />
            </FormField>
            <FormField label="Email">
              <TextInput value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} />
            </FormField>
            <FormField label="Téléphone">
              <TextInput value={form.client_telephone} onChange={(e) => setForm({ ...form, client_telephone: e.target.value })} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Prix client (€)">
              <TextInput type="number" value={form.prix} onChange={(e) => setForm({ ...form, prix: e.target.value })} />
            </FormField>
            <FormField label="Tarif convoyeur (€)">
              <TextInput
                type="number"
                value={form.tarif_convoyeur}
                onChange={(e) => setForm({ ...form, tarif_convoyeur: e.target.value })}
              />
            </FormField>
          </div>
          <FormField label="Notes internes">
            <TextInput value={form.notes_internes} onChange={(e) => setForm({ ...form, notes_internes: e.target.value })} />
          </FormField>
          <Button className="w-full" onClick={editing ? updateTrajet : createTrajet} icon={<Save size={14} />}>
            {editing ? "Enregistrer" : "Créer le trajet"}
          </Button>
        </div>
      </Modal>

      {/* Modal détail (lecture seule) */}
      <Modal
        open={!!selected && !editing && !showCreate}
        onClose={() => setSelected(null)}
        title="Détail trajet"
        size="md"
      >
        {selected && !editing && (
          <>
            <Card padded={false} className="mb-4">
              <div className="px-4 divide-y divide-pro-border">
                <DetailRow label="Départ" value={selected.depart} />
                <DetailRow label="Arrivée" value={selected.arrivee} />
                <DetailRow label="Date" value={selected.date_trajet} />
                <DetailRow label="Heure" value={selected.heure_trajet} />
                <DetailRow
                  label="Véhicule"
                  value={[selected.marque, selected.modele].filter(Boolean).join(" ") || null}
                />
                <DetailRow label="Immatriculation" value={selected.immatriculation} />
                <DetailRow label="Client" value={selected.client_nom} />
                <DetailRow label="Email" value={selected.client_email} />
                <DetailRow label="Téléphone" value={selected.client_telephone} />
                <DetailRow label="Prix client" value={selected.prix ? `${selected.prix} €` : null} />
                <DetailRow
                  label="Tarif convoyeur (interne)"
                  value={selected.tarif_convoyeur ? `${selected.tarif_convoyeur} €` : null}
                />
                <DetailRow label="Notes" value={selected.notes_internes} />
              </div>
            </Card>
            <FormField label="Statut">
              <Select
                value={selected.statut}
                onChange={(e) => {
                  updateStatut(selected.id, e.target.value);
                  setSelected({ ...selected, statut: e.target.value });
                }}
              >
                {statuts.map((s) => (
                  <option key={s} value={s}>
                    {statutLabels[s]}
                  </option>
                ))}
              </Select>
            </FormField>

            {/* === SECTION ENCHÈRES === */}
            <div className="mt-5 pt-5 border-t border-pro-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-pro-text flex items-center gap-2">
                  <Gavel size={16} className="text-pro-accent" />
                  Publication & offres convoyeurs
                </h3>
                <Badge
                  tone={
                    selected.statut_publication === "publie"
                      ? "success"
                      : selected.statut_publication === "attribue"
                      ? "info"
                      : "neutral"
                  }
                >
                  {selected.statut_publication === "publie"
                    ? "Publié"
                    : selected.statut_publication === "attribue"
                    ? "Attribué"
                    : "Brouillon"}
                </Badge>
              </div>

              {selected.statut_publication !== "attribue" && (
                <Card padded={false} className="mb-3">
                  <div className="p-3 space-y-3">
                    <FormField label="Prix suggéré aux convoyeurs (€)">
                      <TextInput
                        type="number"
                        value={prixSuggereInput}
                        onChange={(e) => setPrixSuggereInput(e.target.value)}
                        placeholder="ex: 250"
                      />
                    </FormField>
                    <div className="flex gap-2">
                      {selected.statut_publication !== "publie" ? (
                        <Button
                          variant="success"
                          onClick={() => togglePublication(true)}
                          disabled={savingPub || !prixSuggereInput}
                          icon={<Send size={14} />}
                          className="flex-1"
                        >
                          Publier aux convoyeurs
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          onClick={() => togglePublication(false)}
                          disabled={savingPub}
                          className="flex-1"
                        >
                          Dépublier
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              <p className="text-xs text-pro-muted mb-2">
                {offres.length} offre{offres.length > 1 ? "s" : ""} reçue{offres.length > 1 ? "s" : ""}
              </p>

              {offres.length === 0 ? (
                <div className="text-center py-6 text-pro-muted text-sm bg-pro-bg-soft/30 rounded-lg border border-dashed border-pro-border">
                  Aucune offre pour le moment.
                </div>
              ) : (
                <div className="space-y-2">
                  {offres.map((o) => (
                    <div
                      key={o.id}
                      className={`border rounded-lg p-3 ${
                        o.statut === "acceptee"
                          ? "border-emerald-200 bg-emerald-50/50"
                          : o.statut === "refusee" || o.statut === "retiree"
                          ? "border-pro-border bg-slate-50 opacity-60"
                          : "border-pro-border bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-pro-text text-sm">
                            {o.convoyeur?.prenom} {o.convoyeur?.nom}
                          </p>
                          <p className="text-pro-muted text-xs">
                            {o.convoyeur?.telephone} · {o.convoyeur?.email}
                          </p>
                          <p className="text-xs mt-1">
                            <span className="text-pro-muted">Type :</span>{" "}
                            {o.type_offre === "acceptation_directe" ? "Accepte le prix suggéré" : "Contre-proposition"}
                            {o.prix_suggere_snapshot != null && o.type_offre === "contre_proposition" && (
                              <span className="text-pro-muted"> (suggéré : {o.prix_suggere_snapshot} €)</span>
                            )}
                          </p>
                          {o.message && (
                            <p className="text-xs text-pro-text-soft mt-1 italic">"{o.message}"</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-emerald-700 font-bold text-lg leading-none">{o.prix_propose} €</p>
                          <Badge
                            tone={
                              o.statut === "acceptee"
                                ? "success"
                                : o.statut === "refusee" || o.statut === "retiree"
                                ? "neutral"
                                : "warning"
                            }
                          >
                            {o.statut === "en_attente"
                              ? "En attente"
                              : o.statut === "acceptee"
                              ? "Acceptée"
                              : o.statut === "refusee"
                              ? "Refusée"
                              : "Retirée"}
                          </Badge>
                        </div>
                      </div>
                      {o.statut === "en_attente" && selected.statut_publication !== "attribue" && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-pro-border">
                          <Button
                            variant="success"
                            onClick={() => validerOffre(o)}
                            icon={<CheckCircle2 size={13} />}
                            className="flex-1"
                          >
                            Valider ce convoyeur
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => refuserOffre(o.id)}
                            icon={<XCircle size={13} />}
                          >
                            Refuser
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
