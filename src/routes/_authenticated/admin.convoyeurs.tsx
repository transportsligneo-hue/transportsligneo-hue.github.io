import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Eye, CheckCircle, XCircle, UserPlus, IdCard, User, FileText, Mail, Phone, MapPin } from "lucide-react";
import { AdminDetailDrawer, DrawerSection, DrawerField, DrawerGrid, DrawerBadge } from "@/components/admin/AdminDetailDrawer";
import { sendTransactionalEmail } from "@/lib/email/send";
import {
import { toast } from "sonner";
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
function AdminConvoyeurs() {
  const [convoyeurs, setConvoyeurs] = useState<Convoyeur[]>([]);
  const [filterStatut, setFilterStatut] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nom: "", prenom: "", email: "", telephone: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [selected, setSelected] = useState<Convoyeur | null>(null);
  const [docs, setDocs] = useState<Array<{ type_document: string; nom_fichier: string; url_fichier: string; statut_validation: string }>>([]);
  const [missionsCount, setMissionsCount] = useState<number>(0);

  useEffect(() => {
    if (!selected) { setDocs([]); setMissionsCount(0); return; }
    supabase.from("documents_convoyeurs").select("type_document, nom_fichier, url_fichier, statut_validation").eq("convoyeur_id", selected.id).then(({ data }) => setDocs(data ?? []));
    supabase.from("attributions").select("id", { count: "exact", head: true }).eq("convoyeur_id", selected.id).then(({ count }) => setMissionsCount(count ?? 0));
  }, [selected]);

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
          toast.error(
            `Activation impossible — ce convoyeur indépendant doit avoir tous ses documents approuvés.\n\n• ${issues.join("\n• ")}`,
          );
          return;
        }
      }
    }
    const previous = convoyeurs.find((c) => c.id === id) ?? null;
    const wasNotValid = previous?.statut !== "valide";

    await supabase.from("convoyeurs").update({ statut }).eq("id", id);

    if (statut === "valide" && previous?.user_id) {
      await supabase.functions.invoke("admin-user-actions", {
        body: { action: "activate_role", user_id: previous.user_id, role: "convoyeur" },
      });
    }

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
      // Use the admin-create-account edge function so the admin session is
      // never replaced and the server-side admin role check is enforced.
      const { data, error } = await supabase.functions.invoke("admin-create-account", {
        body: {
          email: form.email,
          password: form.password,
          prenom: form.prenom,
          nom: form.nom,
          telephone: form.telephone,
          role: "convoyeur",
        },
      });
      const userId = (data as { ok?: boolean; user_id?: string; error?: string } | null)?.user_id;
      const errMsg = (data as { error?: string } | null)?.error;
      if (error || !userId) {
        setCreateError(errMsg || error?.message || "Erreur création compte");
        return;
      }
      const { error: convError } = await supabase.from("convoyeurs").insert({
        user_id: userId,
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
              <TR key={c.id} onClick={() => setSelected(c)} className="cursor-pointer">
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
                    <IconButton onClick={() => setSelected(c)} title="Voir la fiche" tone="neutral">
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


      {/* Drawer bleu — fiche convoyeur */}
      {selected && (
        <AdminDetailDrawer
          open={!!selected}
          onClose={() => setSelected(null)}
          title={`${selected.prenom} ${selected.nom}`}
          subtitle={selected.email}
          badge={
            <div className="flex flex-wrap gap-2">
              <DrawerBadge tone={selected.statut === "valide" ? "green" : selected.statut === "en_attente" ? "amber" : "red"}>
                {statutLabels[selected.statut] ?? selected.statut}
              </DrawerBadge>
              <DrawerBadge tone="slate">{selected.type_convoyeur === "independant" ? "Indépendant" : "Salarié"}</DrawerBadge>
            </div>
          }
          footer={
            selected.statut === "en_attente" ? (
              <div className="flex gap-2">
                <Button onClick={() => { updateStatut(selected.id, "valide"); setSelected(null); }} className="bg-emerald-500 hover:bg-emerald-600 text-white" icon={<CheckCircle size={14} />}>Valider</Button>
                <Button onClick={() => { updateStatut(selected.id, "refuse"); setSelected(null); }} className="bg-red-500 hover:bg-red-600 text-white" icon={<XCircle size={14} />}>Refuser</Button>
              </div>
            ) : null
          }
        >
          <DrawerSection title="Contact" icon={<User size={12} />}>
            <DrawerGrid>
              <DrawerField label="Prénom" value={selected.prenom} />
              <DrawerField label="Nom" value={selected.nom} />
              <DrawerField label="Email" value={selected.email} />
              <DrawerField label="Téléphone" value={selected.telephone} />
              <DrawerField label="Ville" value={selected.ville} />
              <DrawerField label="Disponibilité" value={selected.disponibilite} />
            </DrawerGrid>
          </DrawerSection>

          <DrawerSection title="Activité" icon={<MapPin size={12} />}>
            <DrawerGrid>
              <DrawerField label="Missions totales" value={missionsCount.toString()} />
              <DrawerField label="Permis" value={selected.permis} />
              <DrawerField label="Inscrit le" value={new Date(selected.created_at).toLocaleDateString("fr-FR")} />
            </DrawerGrid>
          </DrawerSection>

          <DrawerSection title={`Documents (${docs.length})`} icon={<FileText size={12} />}>
            {docs.length === 0 ? (
              <p className="text-sm text-white/50">Aucun document fourni.</p>
            ) : (
              <div className="space-y-2">
                {docs.map((d, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-white/[0.03] border border-white/10">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white/95 capitalize">{d.type_document}</p>
                      <p className="text-[11px] text-white/40 truncate">{d.nom_fichier}</p>
                    </div>
                    <DrawerBadge tone={d.statut_validation === "approuve" ? "green" : d.statut_validation === "refuse" ? "red" : "amber"}>
                      {d.statut_validation}
                    </DrawerBadge>
                  </div>
                ))}
              </div>
            )}
          </DrawerSection>

          {selected.message && (
            <DrawerSection title="Message d'inscription" icon={<Mail size={12} />}>
              <p className="text-sm text-white/85 whitespace-pre-wrap">{selected.message}</p>
            </DrawerSection>
          )}
        </AdminDetailDrawer>
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
    </div>
  );
}
