import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, Mail, Phone, Trash2, FileText, ArrowRightCircle, Eye, MapPin, Car, Calendar, User } from "lucide-react";
import { toast } from "sonner";
import { generateDevisPdf, downloadDevisPdf, type DevisData } from "@/lib/devis-pdf";
import {
  PageHeader,
  Card,
  KpiCard,
  Badge,
  EmptyState,
  Button,
  IconButton,
  Select,
  SearchInput,
  devisStatutTone,
} from "@/components/admin/AdminUI";
import { AdminDetailDrawer, DrawerSection, DrawerField, DrawerGrid, DrawerBadge } from "@/components/admin/AdminDetailDrawer";

export const Route = createFileRoute("/_authenticated/admin/devis")({
  component: AdminDevisPage,
});

interface DevisRow {
  id: string;
  numero: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  depart: string;
  arrivee: string;
  distance_km: number | null;
  duree_estimee: string | null;
  type_vehicule: string | null;
  marque: string | null;
  modele: string | null;
  carburant: string | null;
  prestation: string | null;
  option_trajet: string | null;
  date_souhaitee: string | null;
  heure_souhaitee: string | null;
  prix_estime: number;
  tarif_label: string | null;
  multiplier_label: string | null;
  message: string | null;
  statut: string;
  email_envoye: boolean;
  created_at: string;
  mission_id: string | null;
  converted_at: string | null;
  vin: string | null;
  carte_grise_recto_url: string | null;
  carte_grise_verso_url: string | null;
  vehicule_docs_completed: boolean;
}

const STATUTS = [
  { value: "envoye", label: "Envoyé" },
  { value: "accepte", label: "Accepté" },
  { value: "refuse", label: "Refusé" },
  { value: "convertit", label: "Converti en mission" },
];

function AdminDevisPage() {
  const [selected, setSelected] = useState<DevisRow | null>(null);
  const [devis, setDevis] = useState<DevisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const handleConvert = async (row: DevisRow) => {
    if (row.mission_id) {
      toast.info("Devis déjà converti", { description: `Mission ${row.mission_id.slice(0, 8)}…` });
      return;
    }
    if (!confirm(`Convertir le devis ${row.numero} en mission ?`)) return;
    setConvertingId(row.id);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Utilisateur non authentifié");

      const { data: mission, error: mErr } = await supabase
        .from("missions")
        .insert({
          user_id: userId,
          nom: row.nom,
          prenom: row.prenom,
          email: row.email,
          telephone: row.telephone,
          ville_depart: row.depart,
          ville_arrivee: row.arrivee,
          date_prise_en_charge: row.date_souhaitee ?? new Date().toISOString().slice(0, 10),
          type_trajet: row.option_trajet === "aller_retour" ? "aller_retour" : "aller_simple",
          marque: row.marque,
          modele: row.modele,
          carburant: row.carburant,
          remarques: row.message,
          prix_total: row.prix_estime,
          statut: "en_attente",
        })
        .select("id, numero")
        .single();
      if (mErr) throw mErr;

      const { error: dErr } = await supabase
        .from("devis")
        .update({
          statut: "convertit",
          mission_id: mission.id,
          converted_at: new Date().toISOString(),
          converted_by: userId,
        })
        .eq("id", row.id);
      if (dErr) throw dErr;

      toast.success("Mission créée", { description: `${mission.numero} depuis ${row.numero}` });
      setDevis((d) =>
        d.map((x) =>
          x.id === row.id
            ? { ...x, statut: "convertit", mission_id: mission.id, converted_at: new Date().toISOString() }
            : x
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error("Échec conversion", { description: msg });
    } finally {
      setConvertingId(null);
    }
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("devis")
      .select("*")
      .order("created_at", { ascending: false });
    setDevis((data as DevisRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatut = async (id: string, statut: string) => {
    await supabase.from("devis").update({ statut }).eq("id", id);
    setDevis((d) => d.map((x) => (x.id === id ? { ...x, statut } : x)));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer définitivement ce devis ?")) return;
    await supabase.from("devis").delete().eq("id", id);
    setDevis((d) => d.filter((x) => x.id !== id));
  };

  const handleDownload = async (row: DevisRow) => {
    setGeneratingId(row.id);
    try {
      const data: DevisData = {
        numero: row.numero,
        nom: row.nom,
        prenom: row.prenom,
        email: row.email,
        telephone: row.telephone,
        depart: row.depart,
        arrivee: row.arrivee,
        distance_km: row.distance_km,
        duree_estimee: row.duree_estimee,
        type_vehicule: row.type_vehicule,
        marque: row.marque,
        modele: row.modele,
        carburant: row.carburant,
        prestation: row.prestation,
        option_trajet: row.option_trajet,
        date_souhaitee: row.date_souhaitee,
        heure_souhaitee: row.heure_souhaitee,
        prix_estime: row.prix_estime,
        tarif_label: row.tarif_label,
        multiplier_label: row.multiplier_label,
        message: row.message,
        created_at: row.created_at,
      };
      const blob = await generateDevisPdf(data);
      downloadDevisPdf(blob, row.numero);
    } finally {
      setGeneratingId(null);
    }
  };

  const filtered = devis.filter((d) => {
    if (statutFilter && d.statut !== statutFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.numero.toLowerCase().includes(q) ||
      d.nom.toLowerCase().includes(q) ||
      d.prenom.toLowerCase().includes(q) ||
      d.email.toLowerCase().includes(q) ||
      d.depart.toLowerCase().includes(q) ||
      d.arrivee.toLowerCase().includes(q)
    );
  });

  const totalAmount = filtered.reduce((s, d) => s + Number(d.prix_estime || 0), 0);
  const acceptes = filtered.filter((d) => d.statut === "accepte" || d.statut === "convertit").length;
  const emailsEnvoyes = filtered.filter((d) => d.email_envoye).length;

  return (
    <div>
      <PageHeader title="Devis" subtitle="Estimations soumises depuis le site et l'application." />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total" value={filtered.length} icon={FileText} />
        <KpiCard
          label="Montant cumulé"
          value={`${totalAmount.toLocaleString("fr-FR")} €`}
          tone="success"
        />
        <KpiCard label="Acceptés" value={acceptes} tone="success" />
        <KpiCard label="Emails envoyés" value={emailsEnvoyes} tone="info" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par numéro, nom, email, ville..."
        />
        <Select
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value)}
          className="sm:w-56"
        >
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-pro-accent" size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Aucun devis" description="Les devis générés apparaîtront ici." />
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => {
            const statut = STATUTS.find((s) => s.value === d.statut) || STATUTS[0];
            return (
              <Card key={d.id}>
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-mono text-pro-accent text-sm font-semibold">
                        {d.numero}
                      </span>
                      <Badge tone={devisStatutTone[d.statut] ?? "neutral"}>{statut.label}</Badge>
                      {d.email_envoye && <Badge tone="success">Email envoyé</Badge>}
                      {d.mission_id && <Badge tone="info">Mission créée</Badge>}
                      <span className="text-pro-muted text-xs">
                        {new Date(d.created_at).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="text-pro-text font-medium">
                      {d.prenom} {d.nom}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-pro-text-soft mt-1">
                      <span className="flex items-center gap-1">
                        <Mail size={12} />
                        {d.email}
                      </span>
                      {d.telephone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} />
                          {d.telephone}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-pro-muted uppercase tracking-wider mb-0.5 text-[10px] font-medium">
                          Trajet
                        </p>
                        <p className="text-pro-text">
                          {d.depart} → {d.arrivee}
                        </p>
                      </div>
                      <div>
                        <p className="text-pro-muted uppercase tracking-wider mb-0.5 text-[10px] font-medium">
                          Distance
                        </p>
                        <p className="text-pro-text">{d.distance_km ?? "—"} km</p>
                      </div>
                      <div>
                        <p className="text-pro-muted uppercase tracking-wider mb-0.5 text-[10px] font-medium">
                          Option
                        </p>
                        <p className="text-pro-text capitalize">{d.option_trajet}</p>
                      </div>
                      <div>
                        <p className="text-pro-muted uppercase tracking-wider mb-0.5 text-[10px] font-medium">
                          Véhicule
                        </p>
                        <p className="text-pro-text">
                          {[d.marque, d.modele].filter(Boolean).join(" ") || d.type_vehicule || "—"}
                        </p>
                      </div>
                    </div>

                    {d.message && (
                      <p className="mt-3 text-xs italic text-pro-text-soft border-l-2 border-pro-accent/30 pl-3">
                        "{d.message}"
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-pro-text">{d.prix_estime} €</p>
                      <p className="text-[10px] text-pro-muted uppercase tracking-wider">TTC</p>
                    </div>

                    <Select
                      value={d.statut}
                      onChange={(e) => updateStatut(d.id, e.target.value)}
                      className="text-xs py-1.5"
                    >
                      {STATUTS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </Select>

                    <div className="flex gap-2 flex-wrap justify-end">
                      <IconButton title="Voir le détail" tone="primary" onClick={() => setSelected(d)}>
                        <Eye size={14} />
                      </IconButton>
                      <Button
                        size="sm"
                        onClick={() => handleDownload(d)}
                        disabled={generatingId === d.id}
                        icon={
                          generatingId === d.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Download size={12} />
                          )
                        }
                      >
                        PDF
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleConvert(d)}
                        disabled={convertingId === d.id || !!d.mission_id}
                        icon={
                          convertingId === d.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <ArrowRightCircle size={12} />
                          )
                        }
                      >
                        {d.mission_id ? "Converti" : "→ Mission"}
                      </Button>
                      <IconButton
                        onClick={() => handleDelete(d.id)}
                        title="Supprimer"
                        tone="danger"
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <DevisDrawer
        devis={selected}
        onClose={() => setSelected(null)}
        onDownload={handleDownload}
        onConvert={handleConvert}
        onDelete={(id) => { handleDelete(id); setSelected(null); }}
      />
    </div>
  );
}

function DevisDrawer({
  devis,
  onClose,
  onDownload,
  onConvert,
  onDelete,
}: {
  devis: DevisRow | null;
  onClose: () => void;
  onDownload: (d: DevisRow) => void;
  onConvert: (d: DevisRow) => void;
  onDelete: (id: string) => void;
}) {
  if (!devis) return null;
  const statut = STATUTS.find((s) => s.value === devis.statut);
  return (
    <AdminDetailDrawer
      open={!!devis}
      onClose={onClose}
      title={devis.numero}
      subtitle={`${devis.prenom} ${devis.nom}`}
      badge={
        <div className="flex flex-wrap gap-2">
          <DrawerBadge tone="blue">{statut?.label ?? devis.statut}</DrawerBadge>
          {devis.email_envoye && <DrawerBadge tone="green">Email envoyé</DrawerBadge>}
          {devis.mission_id && <DrawerBadge tone="amber">Mission créée</DrawerBadge>}
        </div>
      }
      footer={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onDownload(devis)} icon={<Download size={12} />}>PDF</Button>
          <Button size="sm" onClick={() => onConvert(devis)} disabled={!!devis.mission_id} icon={<ArrowRightCircle size={12} />}>
            {devis.mission_id ? "Converti" : "→ Mission"}
          </Button>
          <Button size="sm" onClick={() => onDelete(devis.id)} className="ml-auto bg-red-600 hover:bg-red-700 text-white" icon={<Trash2 size={12} />}>Supprimer</Button>
        </div>
      }
    >
      <DrawerSection title="Client" icon={<User size={12} />}>
        <DrawerGrid>
          <DrawerField label="Nom" value={`${devis.prenom} ${devis.nom}`} />
          <DrawerField label="Email" value={devis.email} />
          <DrawerField label="Téléphone" value={devis.telephone} />
          <DrawerField label="Créé le" value={new Date(devis.created_at).toLocaleString("fr-FR")} />
        </DrawerGrid>
      </DrawerSection>

      <DrawerSection title="Trajet" icon={<MapPin size={12} />}>
        <DrawerGrid>
          <DrawerField label="Départ" value={devis.depart} />
          <DrawerField label="Arrivée" value={devis.arrivee} />
          <DrawerField label="Distance" value={devis.distance_km ? `${devis.distance_km} km` : null} />
          <DrawerField label="Durée estimée" value={devis.duree_estimee} />
          <DrawerField label="Option" value={devis.option_trajet} />
          <DrawerField label="Prestation" value={devis.prestation} />
        </DrawerGrid>
      </DrawerSection>

      <DrawerSection title="Véhicule" icon={<Car size={12} />}>
        <DrawerGrid>
          <DrawerField label="Type" value={devis.type_vehicule} />
          <DrawerField label="Marque" value={devis.marque} />
          <DrawerField label="Modèle" value={devis.modele} />
          <DrawerField label="Carburant" value={devis.carburant} />
          <DrawerField label="VIN" value={devis.vin} mono />
          <DrawerField
            label="Documents"
            value={
              devis.vehicule_docs_completed ? (
                <DrawerBadge tone="green">Complétés par le client</DrawerBadge>
              ) : (
                <DrawerBadge tone="amber">En attente client</DrawerBadge>
              )
            }
          />
        </DrawerGrid>
        {(devis.carte_grise_recto_url || devis.carte_grise_verso_url) && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider text-white/45 mb-2">Carte grise</p>
            <CarteGriseLinks recto={devis.carte_grise_recto_url} verso={devis.carte_grise_verso_url} />
          </div>
        )}
      </DrawerSection>

      <DrawerSection title="Planification" icon={<Calendar size={12} />}>
        <DrawerGrid>
          <DrawerField label="Date souhaitée" value={devis.date_souhaitee ? new Date(devis.date_souhaitee).toLocaleDateString("fr-FR") : null} />
          <DrawerField label="Heure" value={devis.heure_souhaitee} />
          <DrawerField label="Tarif" value={devis.tarif_label} />
          <DrawerField label="Multiplicateur" value={devis.multiplier_label} />
        </DrawerGrid>
      </DrawerSection>

      <DrawerSection title="Tarification">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wider text-white/50">Prix estimé TTC</span>
          <span className="text-3xl font-semibold text-white">{Number(devis.prix_estime).toFixed(2)} €</span>
        </div>
      </DrawerSection>

      {devis.message && (
        <DrawerSection title="Message client">
          <p className="text-sm italic text-white/80">"{devis.message}"</p>
        </DrawerSection>
      )}
    </AdminDetailDrawer>
  );
}
