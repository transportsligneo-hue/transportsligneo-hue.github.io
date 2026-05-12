import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  UserPlus,
  IdCard,
  User,
  Briefcase,
  FileText,
} from "lucide-react";
import { sendTransactionalEmail } from "@/lib/email/send";
import {
  PageHeader,
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
  convoyeurStatutTone,
} from "@/components/admin/AdminUI";
import {
  AdminDetailDrawer,
  DrawerSection,
  DrawerGrid,
  DrawerField,
  DrawerBadge,
} from "@/components/admin/AdminDetailDrawer";

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
interface DocRow {
  id: string;
  type_document: string;
  nom_fichier: string;
  statut_validation: string;
}

function AdminConvoyeurs() {
  const [convoyeurs, setConvoyeurs] = useState<Convoyeur[]>([]);
  const [filterStatut, setFilterStatut] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nom: "", prenom: "", email: "", telephone: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [selected, setSelected] = useState<Convoyeur | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [missionsCount, setMissionsCount] = useState(0);

  const openConvoyeur = async (c: Convoyeur) => {
    setSelected(c);
    setDocs([]);
    setMissionsCount(0);
    const [docsRes, attrRes] = await Promise.all([
      supabase
        .from("documents_convoyeurs")
        .select("id, type_document, nom_fichier, statut_validation")
        .eq("convoyeur_id", c.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("attributions")
        .select("id", { count: "exact", head: true })
        .eq("convoyeur_id", c.id),
    ]);
    setDocs((docsRes.data ?? []) as DocRow[]);
    setMissionsCount(attrRes.count ?? 0);
  };

  const fetchConvoyeurs = useCallback(async () => {
    let query = supabase.from("convoyeurs").select("*").order("created_at", { ascending: false });
    if (filterStatut !== "all") query = query.eq("statut", filterStatut);
    const { data } = await query;
    if (data) setConvoyeurs(data as Convoyeur[]);
  }, [filterStatut]);

  useEffect(() => {
    fetchConvoyeurs();
  }, [fetchConvoyeurs]);

  const updateStatut = async (id: string, statut: string) => {
    if (statut === "valide") {
      const target = convoyeurs.find((c) => c.id === id) ?? null;
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
    const previous = convoyeurs.find((c) => c.id === id) ?? null;
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
        subtitle={`${convoyeurs.length} convoyeur${convoyeurs.length > 1 ? "s" : ""}${
          pendingCount > 0 && filterStatut === "all" ? ` · ${pendingCount} en attente` : ""
        }`}
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
              <TR key={c.id} onClick={() => openConvoyeur(c)}>
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
                <TD onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <IconButton onClick={() => openConvoyeur(c)} title="Voir la fiche" tone="primary">
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

      <AdminDetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        badge={
          selected ? (
            <DrawerBadge
              tone={
                selected.statut === "valide"
                  ? "green"
                  : selected.statut === "refuse" || selected.statut === "suspendu"
                    ? "red"
                    : "amber"
              }
            >
              {statutLabels[selected.statut] ?? selected.statut}
            </DrawerBadge>
          ) : null
        }
        title={selected ? `${selected.prenom} ${selected.nom}` : ""}
        subtitle={selected ? `${selected.type_convoyeur === "independant" ? "Indépendant" : "Salarié"} · ${selected.email}` : ""}
        footer={
          selected ? (
            <div className="flex flex-wrap gap-2 justify-end">
              {selected.statut !== "valide" && (
                <button
                  onClick={() => {
                    updateStatut(selected.id, "valide");
                    setSelected(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-sm font-medium text-white"
                >
                  <CheckCircle size={14} /> Valider
                </button>
              )}
              {selected.statut !== "refuse" && (
                <button
                  onClick={() => {
                    updateStatut(selected.id, "refuse");
                    setSelected(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-400/40 bg-red-500/10 hover:bg-red-500/20 px-3 py-2 text-sm font-medium text-red-200"
                >
                  <XCircle size={14} /> Refuser
                </button>
              )}
              {selected.statut !== "suspendu" && selected.statut === "valide" && (
                <button
                  onClick={() => {
                    updateStatut(selected.id, "suspendu");
                    setSelected(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-2 text-sm font-medium text-amber-200"
                >
                  Suspendre
                </button>
              )}
            </div>
          ) : null
        }
      >
        {selected ? (
          <>
            <DrawerSection title="Identité" icon={<User size={12} />}>
              <DrawerGrid>
                <DrawerField label="Prénom" value={selected.prenom} />
                <DrawerField label="Nom" value={selected.nom} />
                <DrawerField label="Email" value={selected.email} />
                <DrawerField label="Téléphone" value={selected.telephone} />
                <DrawerField label="Type" value={selected.type_convoyeur === "independant" ? "Indépendant" : "Salarié"} />
                <DrawerField label="Inscrit le" value={new Date(selected.created_at).toLocaleString("fr-FR")} />
              </DrawerGrid>
            </DrawerSection>

            <DrawerSection title="Profil professionnel" icon={<Briefcase size={12} />}>
              <DrawerGrid>
                <DrawerField label="Ville" value={selected.ville || "—"} />
                <DrawerField label="Disponibilité" value={selected.disponibilite || "—"} />
                <DrawerField label="Permis" value={selected.permis || "—"} />
                <DrawerField label="Missions effectuées" value={String(missionsCount)} />
              </DrawerGrid>
              {selected.message ? (
                <p className="mt-3 text-sm text-white/70 whitespace-pre-wrap">{selected.message}</p>
              ) : null}
            </DrawerSection>

            <DrawerSection title={`Documents (${docs.length})`} icon={<FileText size={12} />}>
              {docs.length === 0 ? (
                <p className="text-sm text-white/50">Aucun document envoyé.</p>
              ) : (
                <ul className="space-y-2">
                  {docs.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between text-sm bg-white/5 rounded-md px-3 py-2"
                    >
                      <span className="text-white/90">{d.type_document}</span>
                      <DrawerBadge
                        tone={
                          d.statut_validation === "approuve"
                            ? "green"
                            : d.statut_validation === "refuse"
                              ? "red"
                              : "amber"
                        }
                      >
                        {d.statut_validation}
                      </DrawerBadge>
                    </li>
                  ))}
                </ul>
              )}
            </DrawerSection>
          </>
        ) : null}
      </AdminDetailDrawer>
    </div>
  );
}
