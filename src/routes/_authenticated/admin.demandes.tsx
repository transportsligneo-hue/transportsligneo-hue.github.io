import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Eye,
  RefreshCw,
  ArrowRightCircle,
  FileText,
  Search,
  ArrowRight,
  MapPin,
  Car,
  User,
  Calendar,
  MessageSquare,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminSection,
  AdminBadge,
  AdminEmpty,
} from "@/components/admin/ui";
import { PriceBlock } from "@/components/admin/PriceBlock";
import { quoteFromDemande } from "@/lib/pricing-engine";
import {
  AdminDetailDrawer,
  DrawerSection,
  DrawerGrid,
  DrawerField,
  DrawerBadge,
} from "@/components/admin/AdminDetailDrawer";

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
        setSelected(null);
      }
    } finally {
      setConverting(null);
    }
  };

  const updateStatut = async (id: string, statut: string) => {
    await supabase.from("demandes_convoyage").update({ statut }).eq("id", id);
    fetchDemandes();
    if (selected?.id === id) setSelected({ ...selected, statut });
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

  const quote = selected ? quoteFromDemande(selected) : null;

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
          <div className="flex flex-wrap gap-2">
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
                  <th className="hidden lg:table-cell">Prix estimé</th>
                  <th>Statut</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const q = quoteFromDemande(d);
                  return (
                    <tr
                      key={d.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(d)}
                    >
                      <td>
                        <p className="font-medium text-[color:var(--admin-text)]">
                          {d.prenom} {d.nom}
                        </p>
                        <p className="text-[color:var(--admin-muted)] text-xs">
                          {d.email}
                        </p>
                        <p className="text-[color:var(--admin-muted)] text-xs sm:hidden">
                          {d.depart} → {d.arrivee}
                        </p>
                      </td>
                      <td className="hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-[color:var(--admin-text)]">
                          {d.depart}
                          <ArrowRight
                            size={11}
                            className="text-[color:var(--admin-muted)]"
                          />
                          {d.arrivee}
                        </span>
                      </td>
                      <td className="hidden md:table-cell text-[color:var(--admin-muted)] text-xs">
                        {new Date(d.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="hidden lg:table-cell">
                        <PriceBlock quote={q} variant="compact" />
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
                          {d.statut !== "convertie" &&
                            d.statut !== "terminee" && (
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

      <AdminDetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        badge={
          selected ? (
            <DrawerBadge
              tone={
                selected.statut === "convertie" || selected.statut === "terminee"
                  ? "green"
                  : selected.statut === "annulee"
                    ? "red"
                    : "blue"
              }
            >
              {statutLabels[selected.statut] ?? selected.statut}
            </DrawerBadge>
          ) : null
        }
        title={selected ? `${selected.prenom} ${selected.nom}` : ""}
        subtitle={
          selected
            ? `Demande reçue le ${new Date(selected.created_at).toLocaleDateString("fr-FR")}`
            : ""
        }
        footer={
          selected ? (
            <div className="flex flex-wrap gap-2 justify-end">
              {selected.statut !== "convertie" && selected.statut !== "terminee" && (
                <button
                  onClick={() => convertToTrajet(selected)}
                  disabled={converting === selected.id}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  <ArrowRightCircle size={14} />
                  Convertir en trajet
                </button>
              )}
              {selected.statut !== "annulee" && (
                <button
                  onClick={() => updateStatut(selected.id, "annulee")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-400/40 bg-red-500/10 hover:bg-red-500/20 px-3 py-2 text-sm font-medium text-red-200"
                >
                  Annuler
                </button>
              )}
            </div>
          ) : null
        }
      >
        {selected ? (
          <>
            <DrawerSection title="Client" icon={<User size={12} />}>
              <DrawerGrid>
                <DrawerField label="Nom complet" value={`${selected.prenom} ${selected.nom}`} />
                <DrawerField label="Email" value={selected.email} />
                <DrawerField label="Téléphone" value={selected.telephone || "—"} />
                <DrawerField
                  label="Reçue le"
                  value={new Date(selected.created_at).toLocaleString("fr-FR")}
                />
              </DrawerGrid>
            </DrawerSection>

            <DrawerSection title="Trajet" icon={<MapPin size={12} />}>
              <DrawerGrid>
                <DrawerField label="Départ" value={selected.depart} />
                <DrawerField label="Arrivée" value={selected.arrivee} />
                <DrawerField
                  label="Date souhaitée"
                  value={
                    selected.date_souhaitee
                      ? new Date(selected.date_souhaitee).toLocaleDateString("fr-FR")
                      : "—"
                  }
                />
                <DrawerField label="Heure" value={selected.heure_souhaitee || "—"} />
              </DrawerGrid>
            </DrawerSection>

            <DrawerSection title="Véhicule" icon={<Car size={12} />}>
              <DrawerGrid>
                <DrawerField label="Marque" value={selected.marque || "—"} />
                <DrawerField label="Modèle" value={selected.modele || "—"} />
                <DrawerField label="Immatriculation" value={selected.immatriculation || "—"} mono />
                <DrawerField label="Carburant" value={selected.carburant || "—"} />
                <DrawerField label="Options" value={selected.options || "—"} />
              </DrawerGrid>
            </DrawerSection>

            {quote ? (
              <DrawerSection title="Devis estimé" icon={<Calendar size={12} />}>
                <DrawerGrid>
                  <DrawerField label="Distance" value={`${quote.distanceKm ?? "—"} km`} />
                  <DrawerField
                    label="Prix HT"
                    value={
                      typeof quote.priceHT === "number"
                        ? `${quote.priceHT.toFixed(2)} €`
                        : "—"
                    }
                  />
                  <DrawerField
                    label="TVA"
                    value={
                      typeof quote.priceTVA === "number"
                        ? `${quote.priceTVA.toFixed(2)} €`
                        : "—"
                    }
                  />
                  <DrawerField
                    label="Prix TTC"
                    value={
                      typeof quote.priceTTC === "number"
                        ? `${quote.priceTTC.toFixed(2)} €`
                        : "—"
                    }
                  />
                </DrawerGrid>
              </DrawerSection>
            ) : null}

            {selected.message ? (
              <DrawerSection title="Message" icon={<MessageSquare size={12} />}>
                <p className="text-sm text-white/80 whitespace-pre-wrap">{selected.message}</p>
              </DrawerSection>
            ) : null}
          </>
        ) : null}
      </AdminDetailDrawer>
    </div>
  );
}
