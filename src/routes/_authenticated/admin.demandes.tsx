import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, RefreshCw, ArrowRightCircle, FileText, Search, ArrowRight, Mail, Phone, MapPin, Car, Calendar, Trash2, User } from "lucide-react";
import {
  AdminPageHeader,
  AdminSection,
  AdminBadge,
  AdminEmpty,
} from "@/components/admin/ui";
import { PriceBlock } from "@/components/admin/PriceBlock";
import { quoteFromDemande } from "@/lib/pricing-engine";
import { AdminDetailDrawer, DrawerSection, DrawerField, DrawerGrid, DrawerBadge } from "@/components/admin/AdminDetailDrawer";
import { Button } from "@/components/ui/button";

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
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [converting, setConverting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Demande | null>(null);

  const fetchDemandes = useCallback(async () => {
    let query = supabase
      .from("demandes_convoyage")
      .select("*")
      .order("created_at", { ascending: false });
    if (filterStatut !== "all") query = query.eq("statut", filterStatut);
    const { data } = await query;
    if (data) setDemandes(data as Demande[]);
  }, [filterStatut]);

  useEffect(() => {
    fetchDemandes();
  }, [fetchDemandes]);

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
        await supabase.from("demandes_convoyage").update({ statut: "convertie" }).eq("id", d.id);
        fetchDemandes();
      }
    } finally {
      setConverting(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return demandes;
    return demandes.filter(
      (d) =>
        d.nom.toLowerCase().includes(q) ||
        d.prenom.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q) ||
        (d.telephone ?? "").toLowerCase().includes(q) ||
        d.depart.toLowerCase().includes(q) ||
        d.arrivee.toLowerCase().includes(q)
    );
  }, [demandes, search]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Pipeline"
        title="Demandes de convoyage"
        subtitle={`${filtered.length} demande${filtered.length > 1 ? "s" : ""} affichée${filtered.length > 1 ? "s" : ""}`}
        breadcrumb={[{ label: "Admin", to: "/admin" }, { label: "Demandes" }]}
        actions={
          <button
            onClick={fetchDemandes}
            className="admin-btn-ghost inline-flex items-center gap-1.5"
            title="Actualiser"
          >
            <RefreshCw size={14} /> Actualiser
          </button>
        }
      />

      <AdminSection>
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--admin-muted)]"
            />
            <input
              type="text"
              placeholder="Rechercher (nom, email, trajet…)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] text-sm focus:outline-none focus:border-[color:var(--admin-accent)]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatut("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                filterStatut === "all"
                  ? "bg-[color:var(--admin-accent)] text-white border-[color:var(--admin-accent)]"
                  : "border-[color:var(--admin-border)] text-[color:var(--admin-text-soft)] hover:border-[color:var(--admin-accent)]"
              }`}
            >
              Tous
            </button>
            {statuts.map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatut(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  filterStatut === s
                    ? "bg-[color:var(--admin-accent)] text-white border-[color:var(--admin-accent)]"
                    : "border-[color:var(--admin-border)] text-[color:var(--admin-text-soft)] hover:border-[color:var(--admin-accent)]"
                }`}
              >
                {statutLabels[s]}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <AdminEmpty
            icon={FileText}
            title="Aucune demande"
            description="Les demandes du formulaire apparaîtront ici."
          />
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="admin-table w-full">
              <thead>
                <tr>
                  <th>Client</th>
                  <th className="hidden sm:table-cell">Trajet</th>
                  <th className="hidden md:table-cell">Date</th>
                  <th>TTC</th>
                  <th>Statut</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const q = quoteFromDemande(d);
                  return (
                    <tr key={d.id} className="cursor-pointer hover:bg-[color:var(--admin-accent-soft)]/40" onClick={() => setSelected(d)}>
                      <td>
                        <span className="font-medium text-[color:var(--admin-text)]">
                          {d.prenom} {d.nom}
                        </span>
                        <p className="text-[color:var(--admin-muted)] text-xs truncate max-w-[180px]">
                          {d.email}
                        </p>
                        <p className="text-[color:var(--admin-muted)] text-xs sm:hidden truncate max-w-[180px]">
                          {d.depart} → {d.arrivee}
                        </p>
                      </td>
                      <td className="hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-[color:var(--admin-text)]">
                          {d.depart}
                          <ArrowRight size={11} className="text-[color:var(--admin-muted)]" />
                          {d.arrivee}
                        </span>
                      </td>
                      <td className="hidden md:table-cell text-[color:var(--admin-muted)] text-xs">
                        {new Date(d.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td>
                        <span className="font-semibold text-[color:var(--admin-text)] tabular-nums whitespace-nowrap">
                          {q?.priceTtc != null ? `${Number(q.priceTtc).toFixed(0)} €` : "—"}
                        </span>
                      </td>
                      <td>
                        <AdminBadge label={statutLabels[d.statut] ?? d.statut} />
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelected(d)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[color:var(--admin-accent)] hover:bg-[color:var(--admin-accent-soft)]"
                            title="Voir la fiche"
                          >
                            <Eye size={15} />
                          </button>
                          {d.statut !== "convertie" && d.statut !== "terminee" && (
                            <button
                              onClick={() => convertToTrajet(d)}
                              disabled={converting === d.id}
                              title="Convertir en trajet"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-emerald-700 hover:bg-[color:var(--admin-success-soft)] disabled:opacity-50"
                            >
                              <ArrowRightCircle size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        )}
      </AdminSection>

      <DemandeDrawer
        demande={selected}
        onClose={() => setSelected(null)}
        onConvert={(d) => { void convertToTrajet(d); setSelected(null); }}
        onChanged={(updated) => { setSelected(updated); fetchDemandes(); }}
        onDelete={async (id) => {
          if (!window.confirm("Supprimer cette demande ?")) return;
          await supabase.from("demandes_convoyage").delete().eq("id", id);
          setSelected(null);
          fetchDemandes();
        }}
      />
    </div>
  );
}

function DemandeDrawer({
  demande, onClose, onConvert, onChanged, onDelete,
}: {
  demande: Demande | null;
  onClose: () => void;
  onConvert: (d: Demande) => void;
  onChanged: (d: Demande) => void;
  onDelete: (id: string) => void;
}) {
  if (!demande) return null;
  const quote = quoteFromDemande(demande);
  const updateStatut = async (statut: string) => {
    await supabase.from("demandes_convoyage").update({ statut }).eq("id", demande.id);
    onChanged({ ...demande, statut });
  };
  return (
    <AdminDetailDrawer
      open={!!demande}
      onClose={onClose}
      title={`${demande.depart} → ${demande.arrivee}`}
      subtitle={`${demande.prenom} ${demande.nom} · ${new Date(demande.created_at).toLocaleString("fr-FR")}`}
      badge={<DrawerBadge tone="blue">{statutLabels[demande.statut] ?? demande.statut}</DrawerBadge>}
      footer={
        <div className="flex flex-wrap gap-2 items-center">
          {demande.statut !== "convertie" && demande.statut !== "terminee" && (
            <Button size="sm" onClick={() => onConvert(demande)} className="bg-emerald-500 hover:bg-emerald-600 text-white">
              <ArrowRightCircle size={12} className="mr-1" /> Convertir en trajet
            </Button>
          )}
          <select
            value={demande.statut}
            onChange={(e) => updateStatut(e.target.value)}
            className="text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1.5"
          >
            {statuts.map((s) => (
              <option key={s} value={s} className="text-black">{statutLabels[s]}</option>
            ))}
          </select>
          <Button size="sm" variant="destructive" onClick={() => onDelete(demande.id)} className="ml-auto">
            <Trash2 size={12} className="mr-1" /> Supprimer
          </Button>
        </div>
      }
    >
      <DrawerSection title="Client" icon={<User size={12} />}>
        <DrawerGrid>
          <DrawerField label="Nom" value={`${demande.prenom} ${demande.nom}`} />
          <DrawerField label="Email" value={demande.email} />
          <DrawerField label="Téléphone" value={demande.telephone} />
        </DrawerGrid>
      </DrawerSection>

      <DrawerSection title="Trajet" icon={<MapPin size={12} />}>
        <DrawerGrid>
          <DrawerField label="Départ" value={demande.depart} />
          <DrawerField label="Arrivée" value={demande.arrivee} />
          <DrawerField label="Date" value={demande.date_souhaitee ? new Date(demande.date_souhaitee).toLocaleDateString("fr-FR") : null} />
          <DrawerField label="Heure" value={demande.heure_souhaitee} />
        </DrawerGrid>
      </DrawerSection>

      <DrawerSection title="Véhicule" icon={<Car size={12} />}>
        <DrawerGrid>
          <DrawerField label="Marque / Modèle" value={[demande.marque, demande.modele].filter(Boolean).join(" ")} />
          <DrawerField label="Immatriculation" value={demande.immatriculation} mono />
          <DrawerField label="Carburant" value={demande.carburant} />
          <DrawerField label="Options" value={demande.options} />
        </DrawerGrid>
      </DrawerSection>

      <DrawerSection title="Estimation tarifaire" icon={<Calendar size={12} />}>
        <PriceBlock quote={quote} title="Estimation" />
      </DrawerSection>

      {demande.message && (
        <DrawerSection title="Message client" icon={<Mail size={12} />}>
          <p className="text-sm italic text-white/80 whitespace-pre-wrap">"{demande.message}"</p>
        </DrawerSection>
      )}
    </AdminDetailDrawer>
  );
}
