import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, Search, Mail, Phone, Trash2, FileText } from "lucide-react";
import { generateDevisPdf, downloadDevisPdf, type DevisData } from "@/lib/devis-pdf";

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
  { value: "envoye", label: "Envoyé", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { value: "accepte", label: "Accepté", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  { value: "refuse", label: "Refusé", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  { value: "convertit", label: "Converti en mission", color: "bg-primary/20 text-primary border-primary/30" },
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

  useEffect(() => { load(); }, []);

  const updateStatut = async (id: string, statut: string) => {
    await supabase.from("devis").update({ statut }).eq("id", id);
    setDevis(d => d.map(x => x.id === id ? { ...x, statut } : x));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer définitivement ce devis ?")) return;
    await supabase.from("devis").delete().eq("id", id);
    setDevis(d => d.filter(x => x.id !== id));
  };

  const handleDownload = async (row: DevisRow) => {
    setGeneratingId(row.id);
    try {
      const data: DevisData = {
        numero: row.numero,
        nom: row.nom, prenom: row.prenom, email: row.email, telephone: row.telephone,
        depart: row.depart, arrivee: row.arrivee,
        distance_km: row.distance_km, duree_estimee: row.duree_estimee,
        type_vehicule: row.type_vehicule, marque: row.marque, modele: row.modele,
        carburant: row.carburant, prestation: row.prestation,
        option_trajet: row.option_trajet,
        date_souhaitee: row.date_souhaitee, heure_souhaitee: row.heure_souhaitee,
        prix_estime: row.prix_estime,
        tarif_label: row.tarif_label, multiplier_label: row.multiplier_label,
        message: row.message, created_at: row.created_at,
      };
      const blob = await generateDevisPdf(data);
      downloadDevisPdf(blob, row.numero);
    } finally {
      setGeneratingId(null);
    }
  };

  const filtered = devis.filter(d => {
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-2xl md:text-3xl text-primary tracking-[0.15em] uppercase">
          Devis
        </h1>
        <p className="text-cream/50 text-sm mt-2">Historique de toutes les estimations soumises depuis le site.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card-premium p-4 rounded gold-border">
          <p className="text-cream/50 text-xs uppercase tracking-wider mb-1">Total</p>
          <p className="font-heading text-2xl gold-gradient-text">{filtered.length}</p>
        </div>
        <div className="card-premium p-4 rounded gold-border">
          <p className="text-cream/50 text-xs uppercase tracking-wider mb-1">Montant cumulé</p>
          <p className="font-heading text-2xl gold-gradient-text">{totalAmount.toLocaleString("fr-FR")} €</p>
        </div>
        <div className="card-premium p-4 rounded gold-border">
          <p className="text-cream/50 text-xs uppercase tracking-wider mb-1">Acceptés</p>
          <p className="font-heading text-2xl gold-gradient-text">
            {filtered.filter(d => d.statut === "accepte" || d.statut === "convertit").length}
          </p>
        </div>
        <div className="card-premium p-4 rounded gold-border">
          <p className="text-cream/50 text-xs uppercase tracking-wider mb-1">Emails envoyés</p>
          <p className="font-heading text-2xl gold-gradient-text">
            {filtered.filter(d => d.email_envoye).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/40" />
          <input
            type="text"
            placeholder="Rechercher par numéro, nom, email, ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-navy/60 border border-primary/20 rounded text-cream text-sm focus:border-primary/60 focus:outline-none"
          />
        </div>
        <select
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value)}
          className="px-4 py-2.5 bg-navy/60 border border-primary/20 rounded text-cream text-sm focus:border-primary/60 focus:outline-none"
        >
          <option value="">Tous les statuts</option>
          {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 card-premium rounded gold-border">
          <FileText className="mx-auto text-primary/40 mb-4" size={40} />
          <p className="text-cream/60">Aucun devis pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => {
            const statut = STATUTS.find(s => s.value === d.statut) || STATUTS[0];
            return (
              <div key={d.id} className="card-premium p-5 rounded gold-border">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-heading text-primary text-sm tracking-wider">{d.numero}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider ${statut.color}`}>
                        {statut.label}
                      </span>
                      {d.email_envoye && (
                        <span className="text-[10px] px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-300 border-emerald-500/20 uppercase tracking-wider">
                          Email envoyé
                        </span>
                      )}
                      <span className="text-cream/40 text-xs">
                        {new Date(d.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <p className="text-cream font-medium">{d.prenom} {d.nom}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-cream/60 mt-1">
                      <span className="flex items-center gap-1"><Mail size={12} />{d.email}</span>
                      {d.telephone && <span className="flex items-center gap-1"><Phone size={12} />{d.telephone}</span>}
                    </div>

                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-cream/40 uppercase tracking-wider mb-0.5">Trajet</p>
                        <p className="text-cream/90">{d.depart} → {d.arrivee}</p>
                      </div>
                      <div>
                        <p className="text-cream/40 uppercase tracking-wider mb-0.5">Distance</p>
                        <p className="text-cream/90">{d.distance_km ?? "—"} km</p>
                      </div>
                      <div>
                        <p className="text-cream/40 uppercase tracking-wider mb-0.5">Option</p>
                        <p className="text-cream/90 capitalize">{d.option_trajet}</p>
                      </div>
                      <div>
                        <p className="text-cream/40 uppercase tracking-wider mb-0.5">Véhicule</p>
                        <p className="text-cream/90">
                          {[d.marque, d.modele].filter(Boolean).join(" ") || d.type_vehicule || "—"}
                        </p>
                      </div>
                    </div>

                    {d.message && (
                      <p className="mt-3 text-xs italic text-cream/60 border-l-2 border-primary/30 pl-3">"{d.message}"</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3 shrink-0">
                    <div className="text-right">
                      <p className="font-heading text-2xl gold-gradient-text">{d.prix_estime} €</p>
                      <p className="text-[10px] text-cream/40 uppercase tracking-wider">TTC</p>
                    </div>

                    <select
                      value={d.statut}
                      onChange={(e) => updateStatut(d.id, e.target.value)}
                      className="text-xs px-2 py-1.5 bg-navy/60 border border-primary/20 rounded text-cream focus:border-primary/60 focus:outline-none"
                    >
                      {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDownload(d)}
                        disabled={generatingId === d.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-heading uppercase tracking-wider hover:bg-gold-light transition-colors disabled:opacity-60 rounded"
                      >
                        {generatingId === d.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                        PDF
                      </button>
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="p-1.5 text-cream/40 hover:text-destructive transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
