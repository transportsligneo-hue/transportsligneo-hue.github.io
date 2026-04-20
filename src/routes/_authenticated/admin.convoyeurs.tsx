import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Eye, CheckCircle, XCircle, UserPlus, IdCard } from "lucide-react";
import { sendTransactionalEmail } from "@/lib/email/send";
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
  convoyeurStatutTone,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/convoyeurs")({
  component: AdminConvoyeurs,
});

interface Convoyeur {
  id: string;
  user_id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  ville: string | null;
  disponibilite: string | null;
  permis: string | null;
  message: string | null;
  statut: string;
  type_convoyeur: string;
  created_at: string;
}

const statuts = ["en_attente", "valide", "refuse", "suspendu"];
const statutLabels: Record<string, string> = {
  en_attente: "En attente",
  valide: "Validé",
  refuse: "Refusé",
  suspendu: "Suspendu",
};
const dispoLabels: Record<string, string> = {
  temps_plein: "Temps plein",
  temps_partiel: "Temps partiel",
  weekend: "Weekends",
  ponctuel: "Ponctuel",
};

interface MissionHistorique {
  id: string;
  statut: string;
  created_at: string;
  trajet?: { depart: string; arrivee: string; date_trajet: string | null; tarif_convoyeur: number | null } | null;
}

function AdminConvoyeurs() {
  const [convoyeurs, setConvoyeurs] = useState<Convoyeur[]>([]);
  const [filterStatut, setFilterStatut] = useState("all");
  const [selected, setSelected] = useState<Convoyeur | null>(null);
  const [historique, setHistorique] = useState<MissionHistorique[]>([]);
  const [loadingHisto, setLoadingHisto] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nom: "", prenom: "", email: "", telephone: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchConvoyeurs = useCallback(async () => {
    let query = supabase.from("convoyeurs").select("*").order("created_at", { ascending: false });
    if (filterStatut !== "all") query = query.eq("statut", filterStatut);
    const { data } = await query;
    if (data) setConvoyeurs(data as Convoyeur[]);
  }, [filterStatut]);

  useEffect(() => {
    fetchConvoyeurs();
  }, [fetchConvoyeurs]);

  useEffect(() => {
    if (!selected) {
      setHistorique([]);
      return;
    }
    let cancelled = false;
    const loadHisto = async () => {
      setLoadingHisto(true);
      const { data } = await supabase
        .from("attributions")
        .select("id, statut, created_at, trajet:trajets(depart, arrivee, date_trajet, tarif_convoyeur)")
        .eq("convoyeur_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!cancelled && data) setHistorique(data as unknown as MissionHistorique[]);
      if (!cancelled) setLoadingHisto(false);
    };
    loadHisto();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const updateStatut = async (id: string, statut: string) => {
    if (statut === "valide") {
      const target = convoyeurs.find((c) => c.id === id) || (selected?.id === id ? selected : null);
      if (target?.type_convoyeur === "independant") {
        const { data: docs } = await supabase
          .from("documents_convoyeurs")
          .select("type_document, statut_validation" as never)
          .eq("convoyeur_id", id);
        const required = ["permis", "identite", "domicile", "rib", "kbis", "assurance"];
        const labels: Record<string, string> = {
          permis: "Permis",
          identite: "CNI",
          domicile: "Domicile",
          rib: "RIB",
          kbis: "KBIS",
          assurance: "Assurance",
        };
        const issues: string[] = [];
        for (const r of required) {
          const d = (docs as Array<{ type_document: string; statut_validation?: string }> | null)?.find(
            (x) => x.type_document === r,
          );
          if (!d) issues.push(`${labels[r]} manquant`);
          else if (d.statut_validation !== "approuve") issues.push(`${labels[r]} non approuvé`);
        }
        if (issues.length > 0) {
          window.alert(
            `Activation impossible — ce convoyeur indépendant doit avoir tous ses documents approuvés.\n\n• ${issues.join("\n• ")}`,
          );
          return;
        }
      }
    }
    const previous = convoyeurs.find((c) => c.id === id) || (selected?.id === id ? selected : null);
    const wasNotValid = previous?.statut !== "valide";

    await supabase.from("convoyeurs").update({ statut }).eq("id", id);

    if (statut === "valide" && wasNotValid && previous) {
      try {
        await sendTransactionalEmail({
          templateName: "convoyeur-validation",
          recipientEmail: previous.email,
          idempotencyKey: `convoyeur-validation-${previous.id}`,
          templateData: { prenom: previous.prenom, nom: previous.nom },
        });
      } catch (err) {
        console.error("[admin.convoyeurs] envoi email validation échoué", err);
      }
    }

    fetchConvoyeurs();
    if (selected?.id === id) setSelected((prev) => (prev ? { ...prev, statut } : null));
  };

  const createConvoyeur = async () => {
    if (!form.nom || !form.prenom || !form.email || !form.password) {
      setCreateError("Remplissez tous les champs obligatoires.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });
      if (authError || !authData.user) {
        setCreateError(authError?.message ?? "Erreur création compte");
        return;
      }
      const { error: convError } = await supabase.from("convoyeurs").insert({
        user_id: authData.user.id,
        nom: form.nom,
        prenom: form.prenom,
        email: form.email,
        telephone: form.telephone,
        statut: "valide",
      });
      if (convError) {
        setCreateError(convError.message);
        return;
      }
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: authData.user.id,
        role: "convoyeur" as const,
      });
      if (roleError) {
        setCreateError(roleError.message);
        return;
      }
      setForm({ nom: "", prenom: "", email: "", telephone: "", password: "" });
      setShowCreate(false);
      fetchConvoyeurs();
    } finally {
      setCreating(false);
    }
  };

  const pendingCount = convoyeurs.filter((c) => c.statut === "en_attente").length;

  return (
    <div>
      <PageHeader
        title="Convoyeurs"
        subtitle={
          <>
            {convoyeurs.length} convoyeur{convoyeurs.length > 1 ? "s" : ""}
            {pendingCount > 0 && filterStatut === "all" && ` · ${pendingCount} en attente`}
          </> as unknown as string
        }
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
            <Button icon={<UserPlus size={14} />} onClick={() => setShowCreate(true)}>
              Ajouter
            </Button>
            <IconButton onClick={fetchConvoyeurs} title="Actualiser">
              <RefreshCw size={15} />
            </IconButton>
          </>
        }
      />

      {convoyeurs.length === 0 ? (
        <EmptyState icon={IdCard} title="Aucun convoyeur" description="Les inscriptions apparaîtront ici." />
      ) : (
        <Table>
          <THead>
            <TH>Convoyeur</TH>
            <TH className="hidden sm:table-cell">Contact</TH>
            <TH className="hidden md:table-cell">Type</TH>
            <TH className="hidden md:table-cell">Ville</TH>
            <TH>Statut</TH>
            <TH className="text-right">Actions</TH>
          </THead>
          <tbody>
            {convoyeurs.map((c) => (
              <TR key={c.id}>
                <TD>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-pro-accent/10 text-pro-accent flex items-center justify-center text-xs font-semibold shrink-0">
                      {(c.prenom?.[0] ?? "?").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-pro-text truncate">
                        {c.prenom} {c.nom}
                      </p>
                      <p className="text-pro-muted text-xs sm:hidden truncate">{c.email}</p>
                    </div>
                  </div>
                </TD>
                <TD className="hidden sm:table-cell text-pro-text-soft">
                  <p className="text-sm">{c.email}</p>
                  {c.telephone && <p className="text-xs text-pro-muted">{c.telephone}</p>}
                </TD>
                <TD className="hidden md:table-cell">
                  <Badge tone={c.type_convoyeur === "independant" ? "purple" : "info"}>
                    {c.type_convoyeur === "independant" ? "Indépendant" : "Salarié"}
                  </Badge>
                </TD>
                <TD className="hidden md:table-cell text-pro-text-soft">{c.ville || "—"}</TD>
                <TD>
                  <Badge tone={convoyeurStatutTone[c.statut] ?? "neutral"}>
                    {statutLabels[c.statut] ?? c.statut}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-1">
                    <IconButton onClick={() => setSelected(c)} title="Voir" tone="primary">
                      <Eye size={15} />
                    </IconButton>
                    {c.statut === "en_attente" && (
                      <>
                        <IconButton
                          onClick={() => updateStatut(c.id, "valide")}
                          title="Valider"
                          tone="success"
                        >
                          <CheckCircle size={15} />
                        </IconButton>
                        <IconButton
                          onClick={() => updateStatut(c.id, "refuse")}
                          title="Refuser"
                          tone="danger"
                        >
                          <XCircle size={15} />
                        </IconButton>
                      </>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      {/* Modal détail */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.prenom} ${selected.nom}` : ""}
        size="md"
      >
        {selected && (
          <>
            <Card padded={false} className="mb-4">
              <div className="px-4 divide-y divide-pro-border">
                <DetailRow label="Email" value={selected.email} />
                <DetailRow label="Téléphone" value={selected.telephone} />
                <DetailRow label="Ville" value={selected.ville} />
                <DetailRow
                  label="Type"
                  value={selected.type_convoyeur === "independant" ? "Indépendant" : "Salarié"}
                />
                <DetailRow label="Permis / Infos" value={selected.permis} />
                <DetailRow
                  label="Disponibilité"
                  value={
                    selected.disponibilite
                      ? dispoLabels[selected.disponibilite] ?? selected.disponibilite
                      : null
                  }
                />
                <DetailRow label="Message" value={selected.message} />
                <DetailRow
                  label="Inscrit le"
                  value={new Date(selected.created_at).toLocaleDateString("fr-FR")}
                />
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <FormField label="Type">
                <Select
                  value={selected.type_convoyeur}
                  onChange={async (e) => {
                    const newType = e.target.value;
                    await supabase
                      .from("convoyeurs")
                      .update({ type_convoyeur: newType } as any)
                      .eq("id", selected.id);
                    setSelected((prev) => (prev ? { ...prev, type_convoyeur: newType } : null));
                    fetchConvoyeurs();
                  }}
                >
                  <option value="salarie">Salarié</option>
                  <option value="independant">Indépendant</option>
                </Select>
              </FormField>
              <FormField label="Statut">
                <Select
                  value={selected.statut}
                  onChange={(e) => updateStatut(selected.id, e.target.value)}
                >
                  {statuts.map((s) => (
                    <option key={s} value={s}>
                      {statutLabels[s]}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            {selected.statut === "en_attente" && (
              <div className="flex gap-2 mb-4">
                <Button
                  variant="success"
                  className="flex-1"
                  onClick={() => updateStatut(selected.id, "valide")}
                  icon={<CheckCircle size={14} />}
                >
                  Approuver
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => updateStatut(selected.id, "refuse")}
                  icon={<XCircle size={14} />}
                >
                  Refuser
                </Button>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-pro-text-soft mb-2">
                Historique missions {historique.length > 0 && `(${historique.length})`}
              </h4>
              {loadingHisto ? (
                <p className="text-pro-muted text-sm">Chargement…</p>
              ) : historique.length === 0 ? (
                <p className="text-pro-muted text-sm">Aucune mission attribuée.</p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {historique.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-pro-bg-soft/50 border border-pro-border text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-pro-text truncate">
                          {h.trajet ? `${h.trajet.depart} → ${h.trajet.arrivee}` : "Trajet supprimé"}
                        </p>
                        <p className="text-pro-muted text-xs">
                          {h.trajet?.date_trajet
                            ? new Date(h.trajet.date_trajet).toLocaleDateString("fr-FR")
                            : new Date(h.created_at).toLocaleDateString("fr-FR")}
                          {selected.type_convoyeur === "independant" &&
                            h.trajet?.tarif_convoyeur != null &&
                            ` · ${h.trajet.tarif_convoyeur} €`}
                        </p>
                      </div>
                      <Badge tone="neutral">{h.statut}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* Modal création */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nouveau convoyeur"
        size="md"
      >
        {createError && (
          <div className="mb-3 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
            {createError}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Prénom" required>
            <TextInput
              value={form.prenom}
              onChange={(e) => setForm({ ...form, prenom: e.target.value })}
            />
          </FormField>
          <FormField label="Nom" required>
            <TextInput
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
            />
          </FormField>
          <FormField label="Email" required>
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </FormField>
          <FormField label="Téléphone">
            <TextInput
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
            />
          </FormField>
          <div className="col-span-2">
            <FormField label="Mot de passe" required>
              <TextInput
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </FormField>
          </div>
        </div>
        <Button
          className="w-full mt-4"
          onClick={createConvoyeur}
          disabled={creating}
          icon={<UserPlus size={14} />}
        >
          {creating ? "Création..." : "Créer le compte"}
        </Button>
      </Modal>
    </div>
  );
}
