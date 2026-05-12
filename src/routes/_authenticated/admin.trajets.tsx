import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sendTransactionalEmail } from "@/lib/email/send";
import { RefreshCw, Plus, Edit2, Save, Route as RouteIcon, Send, CheckCircle2, XCircle, Gavel, FileText, MapPin, Car, User, Lock } from "lucide-react";
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
  Button,
  IconButton,
  Select,
  TextInput,
  FormField,
  trajetStatutTone,
} from "@/components/admin/AdminUI";
import { PricingModeBlock } from "@/components/admin/PricingModeBlock";
import {
  AdminDetailDrawer,
  DrawerSection,
  DrawerGrid,
  DrawerField,
  DrawerBadge,
} from "@/components/admin/AdminDetailDrawer";

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
  notes_internes?: string | null;
  demande_id: string | null;
  created_at: string;
  prix_suggere?: number | null;
  statut_publication?: string;
  // B1 — pricing mode
  pricing_mode?: "fixe" | "enchere" | null;
  prix_client_ttc?: number | null;
  prix_convoyeur_fixe?: number | null;
  prix_convoyeur_min?: number | null;
  prix_convoyeur_max?: number | null;
  marge_indicative_pct?: number | null;
  // Refonte dispatch — auto depuis devis
  devis_id?: string | null;
  prix_client?: number | null;
  commission_convoyeur_pct?: number | null;
  prix_convoyeur?: number | null;
  prix_societe?: number | null;
}

interface DevisLink {
  id: string;
  numero: string;
  prix_estime: number;
  paid_at: string | null;
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
  const [linkedDevis, setLinkedDevis] = useState<DevisLink | null>(null);
  const [pctInput, setPctInput] = useState<string>("65");
  const [savingCommission, setSavingCommission] = useState(false);

  // Charge le devis lié quand selected change
  useEffect(() => {
    if (!selected?.devis_id) {
      setLinkedDevis(null);
      return;
    }
    supabase
      .from("devis")
      .select("id, numero, prix_estime, paid_at")
      .eq("id", selected.devis_id)
      .maybeSingle()
      .then(({ data }) => setLinkedDevis(data ?? null));
    setPctInput((selected.commission_convoyeur_pct ?? 65).toString());
  }, [selected?.devis_id, selected?.commission_convoyeur_pct]);

  const saveCommission = async () => {
    if (!selected) return;
    const pct = parseFloat(pctInput);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      alert("Pourcentage invalide (0-100)");
      return;
    }
    setSavingCommission(true);
    await supabase
      .from("trajets")
      .update({ commission_convoyeur_pct: pct } as never)
      .eq("id", selected.id);
    // Le trigger DB recalcule prix_convoyeur et prix_societe automatiquement
    const { data: refreshed } = await supabase
      .from("trajets")
      .select("*")
      .eq("id", selected.id)
      .maybeSingle();
    setSavingCommission(false);
    if (refreshed) setSelected({ ...selected, ...(refreshed as Partial<Trajet>) });
    fetchTrajets();
  };

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
    if (!data) return;
    const ids = (data as { id: string }[]).map((d) => d.id);
    let adminMap: Record<string, { notes_internes?: string | null; prix_client_ttc?: number | null; marge_indicative_pct?: number | null }> = {};
    if (ids.length > 0) {
      const { data: adminRows } = await supabase
        .from("trajets_admin_data" as never)
        .select("trajet_id, notes_internes, prix_client_ttc, marge_indicative_pct")
        .in("trajet_id" as never, ids as never);
      if (adminRows) {
        adminMap = (adminRows as unknown as { trajet_id: string; notes_internes: string | null; prix_client_ttc: number | null; marge_indicative_pct: number | null }[]).reduce((acc, r) => {
          acc[r.trajet_id] = { notes_internes: r.notes_internes, prix_client_ttc: r.prix_client_ttc, marge_indicative_pct: r.marge_indicative_pct };
          return acc;
        }, {} as typeof adminMap);
      }
    }
    setTrajets((data as unknown as Trajet[]).map((t) => ({ ...t, ...adminMap[t.id] })));
  }, [filterStatut]);

  useEffect(() => {
    fetchTrajets();
  }, [fetchTrajets]);

  const createTrajet = async () => {
    if (!form.depart || !form.arrivee) return;
    const { data: created } = await supabase.from("trajets").insert({
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
    }).select("id").maybeSingle();
    if (created?.id && form.notes_internes) {
      await supabase
        .from("trajets_admin_data" as never)
        .upsert({ trajet_id: created.id, notes_internes: form.notes_internes } as never, { onConflict: "trajet_id" } as never);
    }
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
      })
      .eq("id", selected.id);
    await supabase
      .from("trajets_admin_data" as never)
      .upsert({ trajet_id: selected.id, notes_internes: form.notes_internes || null } as never, { onConflict: "trajet_id" } as never);
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
              <TR key={t.id} onClick={() => { setSelected(t); setEditing(false); }}>
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
                      onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                      title="Modifier"
                      tone="primary"
                    >
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

      {/* Drawer détail premium bleu */}
      <AdminDetailDrawer
        open={!!selected && !editing && !showCreate}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.depart} → ${selected.arrivee}` : ""}
        subtitle={
          selected
            ? `${selected.client_nom || "—"}${selected.date_trajet ? " · " + new Date(selected.date_trajet).toLocaleDateString("fr-FR") : ""}`
            : ""
        }
        badge={
          selected ? (
            <DrawerBadge
              tone={
                selected.statut === "termine"
                  ? "green"
                  : selected.statut === "annule"
                    ? "red"
                    : selected.statut === "en_cours" || selected.statut === "accepte"
                      ? "blue"
                      : "amber"
              }
            >
              {statutLabels[selected.statut] ?? selected.statut}
            </DrawerBadge>
          ) : null
        }
        footer={
          selected ? (
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => openEdit(selected)}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/10 hover:bg-white/15 px-3 py-2 text-sm font-medium text-white"
              >
                <Edit2 size={14} /> Modifier
              </button>
            </div>
          ) : null
        }
        width="2xl"
      >
        {selected && (
          <>
            <DrawerSection title="Client" icon={<User size={12} />}>
              <DrawerGrid>
                <DrawerField label="Nom" value={selected.client_nom || "—"} />
                <DrawerField label="Email" value={selected.client_email || "—"} />
                <DrawerField label="Téléphone" value={selected.client_telephone || "—"} />
                <DrawerField label="Date" value={selected.date_trajet ? new Date(selected.date_trajet).toLocaleDateString("fr-FR") : "—"} />
              </DrawerGrid>
            </DrawerSection>

            <DrawerSection title="Trajet" icon={<MapPin size={12} />}>
              <DrawerGrid>
                <DrawerField label="Départ" value={selected.depart} />
                <DrawerField label="Arrivée" value={selected.arrivee} />
                <DrawerField label="Heure" value={selected.heure_trajet || "—"} />
                <DrawerField label="Immat." value={selected.immatriculation || "—"} mono />
              </DrawerGrid>
            </DrawerSection>

            <DrawerSection title="Véhicule" icon={<Car size={12} />}>
              <DrawerGrid>
                <DrawerField label="Marque" value={selected.marque || "—"} />
                <DrawerField label="Modèle" value={selected.modele || "—"} />
              </DrawerGrid>
            </DrawerSection>

            {/* Prix client — verrouillé si devis lié */}
            <DrawerSection
              title="Prix client TTC"
              icon={<FileText size={12} />}
              action={
                linkedDevis ? (
                  <DrawerBadge tone="green">
                    <Lock size={10} /> Auto depuis devis
                  </DrawerBadge>
                ) : (
                  <DrawerBadge tone="amber">Manuel</DrawerBadge>
                )
              }
            >
              {linkedDevis ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-blue-200">{linkedDevis.numero}</p>
                    <p className="text-[11px] text-white/50 mt-0.5">
                      {linkedDevis.paid_at
                        ? `Payé le ${new Date(linkedDevis.paid_at).toLocaleDateString("fr-FR")}`
                        : "Non payé"}
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-300 tabular-nums">
                    {linkedDevis.prix_estime} €
                  </p>
                </div>
              ) : (
                <p className="text-sm text-white/60">
                  {selected.prix
                    ? <>Prix saisi manuellement : <strong className="text-white">{selected.prix} €</strong></>
                    : "Aucun devis lié — saisir un prix manuel via Modifier."}
                </p>
              )}

              {/* Estimation convoyeur min/max auto */}
              {(linkedDevis?.prix_estime || selected.prix_client || selected.prix) && (() => {
                const ttc = linkedDevis?.prix_estime ?? selected.prix_client ?? selected.prix ?? 0;
                const min = Math.round(ttc * 0.55);
                const max = Math.round(ttc * 0.65);
                return (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-[10px] uppercase tracking-wider text-white/45 mb-2">
                      Estimation convoyeur recommandée (55–65 %)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-blue-500/15 border border-blue-400/30 p-3 text-center">
                        <p className="text-[10px] uppercase text-blue-200/80">Min</p>
                        <p className="text-xl font-bold text-blue-100 tabular-nums">{min} €</p>
                      </div>
                      <div className="rounded-lg bg-blue-500/25 border border-blue-400/40 p-3 text-center">
                        <p className="text-[10px] uppercase text-blue-200/80">Max</p>
                        <p className="text-xl font-bold text-blue-100 tabular-nums">{max} €</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </DrawerSection>

            {/* Statut */}
            <DrawerSection title="Statut opérationnel">
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
            </DrawerSection>

            {/* Commission */}
            {(linkedDevis || selected.prix_client != null) && (
              <DrawerSection title="Commission convoyeur" icon={<FileText size={12} />}>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={pctInput}
                    onChange={(e) => setPctInput(e.target.value)}
                    className="w-24 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:border-blue-400"
                  />
                  <span className="text-white/60 text-sm">%</span>
                  <button
                    onClick={saveCommission}
                    disabled={savingCommission}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-blue-500 hover:bg-blue-400 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    <Save size={13} /> Appliquer
                  </button>
                </div>
                {selected.prix_client != null && (() => {
                  const pct = parseFloat(pctInput) || 0;
                  const conv = Math.round(selected.prix_client! * pct) / 100;
                  const soc = Math.round((selected.prix_client! - conv) * 100) / 100;
                  return (
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/10">
                      <div className="text-center">
                        <p className="text-[10px] uppercase text-white/50">Client</p>
                        <p className="font-bold text-white tabular-nums">{selected.prix_client} €</p>
                      </div>
                      <div className="text-center bg-emerald-500/15 rounded-lg py-2">
                        <p className="text-[10px] uppercase text-emerald-200">Convoyeur</p>
                        <p className="font-bold text-emerald-200 tabular-nums">{conv} €</p>
                      </div>
                      <div className="text-center bg-amber-500/15 rounded-lg py-2">
                        <p className="text-[10px] uppercase text-amber-200">Société</p>
                        <p className="font-bold text-amber-200 tabular-nums">{soc} €</p>
                      </div>
                    </div>
                  );
                })()}
              </DrawerSection>
            )}

            {/* Mode tarification */}
            <DrawerSection title="Mode de tarification">
              <div className="bg-white rounded-lg p-3 -m-1">
                <PricingModeBlock
                  trajetId={selected.id}
                  initial={{
                    pricing_mode: selected.pricing_mode ?? "fixe",
                    prix_client_ttc: selected.prix_client_ttc,
                    prix_convoyeur_fixe: selected.prix_convoyeur_fixe,
                    prix_convoyeur_min: selected.prix_convoyeur_min,
                    prix_convoyeur_max: selected.prix_convoyeur_max,
                    marge_indicative_pct: selected.marge_indicative_pct,
                  }}
                  onSaved={(next) => setSelected({ ...selected, ...next })}
                />
              </div>
            </DrawerSection>

            {/* Publication & offres */}
            <DrawerSection
              title="Publication & offres"
              icon={<Gavel size={12} />}
              action={
                <DrawerBadge
                  tone={
                    selected.statut_publication === "publie"
                      ? "green"
                      : selected.statut_publication === "attribue"
                        ? "blue"
                        : "slate"
                  }
                >
                  {selected.statut_publication === "publie"
                    ? "Publié"
                    : selected.statut_publication === "attribue"
                      ? "Attribué"
                      : "Brouillon"}
                </DrawerBadge>
              }
            >
              {selected.statut_publication !== "attribue" && (
                <div className="space-y-3 mb-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/50 mb-1 block">
                      Prix suggéré convoyeurs (€)
                    </label>
                    <input
                      type="number"
                      value={prixSuggereInput}
                      onChange={(e) => setPrixSuggereInput(e.target.value)}
                      placeholder="ex: 250"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  {selected.statut_publication !== "publie" ? (
                    <button
                      onClick={() => togglePublication(true)}
                      disabled={savingPub || !prixSuggereInput}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      <Send size={14} /> Publier aux convoyeurs
                    </button>
                  ) : (
                    <button
                      onClick={() => togglePublication(false)}
                      disabled={savingPub}
                      className="w-full rounded-md bg-red-500/20 border border-red-400/40 hover:bg-red-500/30 px-3 py-2 text-sm font-medium text-red-200"
                    >
                      Dépublier
                    </button>
                  )}
                </div>
              )}

              <p className="text-[11px] text-white/50 mb-2">
                {offres.length} offre{offres.length > 1 ? "s" : ""} reçue{offres.length > 1 ? "s" : ""}
              </p>

              {offres.length === 0 ? (
                <p className="text-center py-4 text-white/40 text-xs border border-dashed border-white/15 rounded-lg">
                  Aucune offre pour le moment
                </p>
              ) : (
                <div className="space-y-2">
                  {offres.map((o) => (
                    <div
                      key={o.id}
                      className={`rounded-lg border p-3 ${
                        o.statut === "acceptee"
                          ? "border-emerald-400/40 bg-emerald-500/10"
                          : o.statut === "refusee" || o.statut === "retiree"
                            ? "border-white/10 bg-white/[0.02] opacity-60"
                            : "border-white/15 bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-white text-sm">
                            {o.convoyeur?.prenom} {o.convoyeur?.nom}
                          </p>
                          <p className="text-white/50 text-[11px]">
                            {o.convoyeur?.telephone} · {o.convoyeur?.email}
                          </p>
                          {o.message && (
                            <p className="text-[11px] text-white/70 mt-1 italic">"{o.message}"</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-emerald-300 font-bold text-lg leading-none">{o.prix_propose} €</p>
                        </div>
                      </div>
                      {o.statut === "en_attente" && selected.statut_publication !== "attribue" && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
                          <button
                            onClick={() => validerOffre(o)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 px-3 py-1.5 text-xs font-medium text-white"
                          >
                            <CheckCircle2 size={12} /> Valider
                          </button>
                          <button
                            onClick={() => refuserOffre(o)}
                            className="rounded-md border border-white/20 hover:bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80"
                          >
                            <XCircle size={12} className="inline mr-1" /> Refuser
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </DrawerSection>

            {selected.notes_internes && (
              <DrawerSection title="Notes internes">
                <p className="text-sm text-white/80 whitespace-pre-wrap">{selected.notes_internes}</p>
              </DrawerSection>
            )}
          </>
        )}
      </AdminDetailDrawer>
    </div>
  );
}
