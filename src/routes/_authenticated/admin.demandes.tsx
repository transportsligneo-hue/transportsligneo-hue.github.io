import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, RefreshCw, ArrowRightCircle, Trash2, FileText } from "lucide-react";
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
  demandeStatutTone,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/demandes")({
  component: AdminDemandes,
});

interface Demande {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  email: string;
  depart: string;
  arrivee: string;
  date_souhaitee: string | null;
  heure_souhaitee: string | null;
  marque: string | null;
  modele: string | null;
  immatriculation: string | null;
  carburant: string | null;
  options: string | null;
  message: string | null;
  statut: string;
  created_at: string;
}

const statuts = ["nouvelle", "a_traiter", "convertie", "attribuee", "terminee", "annulee"];
const statutLabels: Record<string, string> = {
  nouvelle: "Nouvelle",
  a_traiter: "À traiter",
  convertie: "Convertie",
  attribuee: "Attribuée",
  terminee: "Terminée",
  annulee: "Annulée",
};

function AdminDemandes() {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [selected, setSelected] = useState<Demande | null>(null);
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [converting, setConverting] = useState<string | null>(null);

  const fetchDemandes = useCallback(async () => {
    let query = supabase.from("demandes_convoyage").select("*").order("created_at", { ascending: false });
    if (filterStatut !== "all") query = query.eq("statut", filterStatut);
    const { data } = await query;
    if (data) setDemandes(data as Demande[]);
  }, [filterStatut]);

  useEffect(() => {
    fetchDemandes();
  }, [fetchDemandes]);

  const updateStatut = async (id: string, statut: string) => {
    await supabase.from("demandes_convoyage").update({ statut }).eq("id", id);
    fetchDemandes();
    if (selected?.id === id) setSelected((prev) => (prev ? { ...prev, statut } : null));
  };

  const convertToTrajet = async (d: Demande) => {
    setConverting(d.id);
    try {
      const { error } = await supabase.from("trajets").insert({
        demande_id: d.id,
        depart: d.depart,
        arrivee: d.arrivee,
        date_trajet: d.date_souhaitee,
        heure_trajet: d.heure_souhaitee ?? "",
        marque: d.marque ?? "",
        modele: d.modele ?? "",
        immatriculation: d.immatriculation ?? "",
        client_nom: `${d.prenom} ${d.nom}`,
        client_email: d.email,
        client_telephone: d.telephone ?? "",
        statut: "en_attente",
      });
      if (!error) {
        await updateStatut(d.id, "convertie");
        setSelected(null);
      }
    } finally {
      setConverting(null);
    }
  };

  const deleteDemande = async (id: string) => {
    if (!confirm("Supprimer cette demande ?")) return;
    await supabase.from("demandes_convoyage").delete().eq("id", id);
    setSelected(null);
    fetchDemandes();
  };

  return (
    <div>
      <PageHeader
        title="Demandes"
        subtitle={`${demandes.length} demande${demandes.length > 1 ? "s" : ""}`}
        actions={
          <>
            <Select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}>
              <option value="all">Tous les statuts</option>
              {statuts.map((s) => (
                <option key={s} value={s}>
                  {statutLabels[s]}
                </option>
              ))}
            </Select>
            <IconButton onClick={fetchDemandes} title="Actualiser">
              <RefreshCw size={15} />
            </IconButton>
          </>
        }
      />

      {demandes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucune demande"
          description="Les demandes du formulaire de devis apparaîtront ici."
        />
      ) : (
        <Table>
          <THead>
            <TH>Client</TH>
            <TH className="hidden sm:table-cell">Trajet</TH>
            <TH className="hidden md:table-cell">Date</TH>
            <TH>Statut</TH>
            <TH className="text-right">Actions</TH>
          </THead>
          <tbody>
            {demandes.map((d) => (
              <TR key={d.id}>
                <TD>
                  <p className="font-medium text-pro-text">
                    {d.prenom} {d.nom}
                  </p>
                  <p className="text-pro-muted text-xs sm:hidden">
                    {d.depart} → {d.arrivee}
                  </p>
                </TD>
                <TD className="hidden sm:table-cell text-pro-text-soft">
                  {d.depart} → {d.arrivee}
                </TD>
                <TD className="hidden md:table-cell text-pro-muted text-xs">
                  {new Date(d.created_at).toLocaleDateString("fr-FR")}
                </TD>
                <TD>
                  <Badge tone={demandeStatutTone[d.statut] ?? "neutral"}>
                    {statutLabels[d.statut] ?? d.statut}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-1">
                    <IconButton onClick={() => setSelected(d)} title="Voir" tone="primary">
                      <Eye size={15} />
                    </IconButton>
                    {d.statut !== "convertie" && d.statut !== "terminee" && (
                      <IconButton
                        onClick={() => convertToTrajet(d)}
                        disabled={converting === d.id}
                        title="Convertir en trajet"
                        tone="success"
                      >
                        <ArrowRightCircle size={15} />
                      </IconButton>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Détail demande" size="md">
        {selected && (
          <>
            <Card padded={false} className="mb-4">
              <div className="px-4 py-3 bg-pro-bg-soft/40 border-b border-pro-border flex items-center justify-between">
                <p className="text-pro-text font-medium">
                  {selected.prenom} {selected.nom}
                </p>
                <Badge tone={demandeStatutTone[selected.statut] ?? "neutral"}>
                  {statutLabels[selected.statut] ?? selected.statut}
                </Badge>
              </div>
              <div className="px-4 divide-y divide-pro-border">
                <DetailRow label="Email" value={selected.email} />
                <DetailRow label="Téléphone" value={selected.telephone} />
                <DetailRow label="Départ" value={selected.depart} />
                <DetailRow label="Arrivée" value={selected.arrivee} />
                <DetailRow label="Date souhaitée" value={selected.date_souhaitee} />
                <DetailRow label="Heure" value={selected.heure_souhaitee} />
                <DetailRow
                  label="Véhicule"
                  value={[selected.marque, selected.modele].filter(Boolean).join(" ") || null}
                />
                <DetailRow label="Immatriculation" value={selected.immatriculation} />
                <DetailRow label="Carburant" value={selected.carburant} />
                <DetailRow label="Options" value={selected.options} />
                <DetailRow label="Message" value={selected.message} />
              </div>
            </Card>

            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium text-pro-text-soft">Statut</span>
              <Select
                value={selected.statut}
                onChange={(e) => updateStatut(selected.id, e.target.value)}
                className="ml-auto text-xs py-1.5"
              >
                {statuts.map((s) => (
                  <option key={s} value={s}>
                    {statutLabels[s]}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex gap-2">
              {selected.statut !== "convertie" && selected.statut !== "terminee" && (
                <Button
                  variant="success"
                  onClick={() => convertToTrajet(selected)}
                  disabled={converting === selected.id}
                  icon={<ArrowRightCircle size={14} />}
                  className="flex-1"
                >
                  Convertir en trajet
                </Button>
              )}
              <Button
                variant="danger"
                onClick={() => deleteDemande(selected.id)}
                icon={<Trash2 size={14} />}
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
