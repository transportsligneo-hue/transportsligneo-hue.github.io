import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, Mail, Phone, Trash2, FileText } from "lucide-react";
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
}

const STATUTS = [
  { value: "envoye", label: "Envoyé" },
  { value: "accepte", label: "Accepté" },
  { value: "refuse", label: "Refusé" },
  { value: "convertit", label: "Converti en mission" },
];

function AdminDevisPage() {
  const [devis, setDevis] = useState<DevisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);

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

                    <div className="flex gap-2">
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
    </div>
  );
}
