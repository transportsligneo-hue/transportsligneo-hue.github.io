import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { convertDemandeToMissions } from "@/lib/admin-demande-conversion.functions";
import { Eye, RefreshCw, ArrowRightCircle, FileText, Search, ArrowRight, Mail, Phone, MapPin, Car, Calendar, Trash2, User, Inbox, Clock, CheckCircle2, Euro } from "lucide-react";
import {
  AdminPageHeader,
  AdminSection,
  AdminBadge,
  AdminEmpty,
  AdminStatCard,
} from "@/components/admin/ui";

import { PriceBlock } from "@/components/admin/PriceBlock";
import { quoteFromDemande } from "@/lib/pricing-engine";
import { AdminDetailDrawer, DrawerSection, DrawerField, DrawerGrid, DrawerBadge } from "@/components/admin/AdminDetailDrawer";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
import { AdminBadgeLegend } from "@/components/admin/AdminBadgeLegend";

export const Route = createFileRoute("/_authenticated/admin/demandes")({
  component: AdminDemandes,
});

interface Demande {
  id: string;
  user_id: string | null;
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
  prix_estime: number | null;
  distance_km: number | null;
  created_at: string;
  // Phase 6 — extended vehicle + options
  vehicule_immatriculation?: string | null;
  vehicule_vin?: string | null;
  vehicule_marque?: string | null;
  vehicule_modele?: string | null;
  vehicule_energie?: string | null;
  vehicule_type?: string | null;
  vehicule_couleur?: string | null;
  vehicule_km?: number | null;
  vehicule_notes?: string | null;
  options_meta?: Record<string, unknown> | null;
  // Restitution (Aller-retour)
  depart_retour?: string | null;
  arrivee_retour?: string | null;
  adresse_recuperation_retour?: string | null;
  recuperation_retour_identique?: boolean | null;
  immatriculation_retour?: string | null;
  marque_retour?: string | null;
  modele_retour?: string | null;
  vin_retour?: string | null;
  date_retour?: string | null;
  heure_retour?: string | null;
}

const OPTION_LABELS: Record<string, string> = {
  recharge_electrique: "⚡ Recharge électrique",
  plein_essence: "⛽ Appoint carburant",
  lavage: "🧽 Lavage",
  express: "⚡ Express",
  aller_retour: "↔ Aller-retour",
};

function renderOptionsMeta(meta: Record<string, unknown> | null | undefined): string[] {
  if (!meta) return [];
  return Object.entries(meta)
    .filter(([, v]) => v === true || (typeof v === "string" && v.length > 0) || (typeof v === "number" && v > 0))
    .map(([k, v]) => OPTION_LABELS[k] ?? `${k}: ${String(v)}`);
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

function extractFromOptions(options: string | null): { prix: number | null; distance: number | null } {
  if (!options) return { prix: null, distance: null };
  const prixMatch = options.match(/Estimation:\s*(\d+(?:[.,]\d+)?)\s*€/i);
  const distMatch = options.match(/Distance:\s*(\d+(?:[.,]\d+)?)\s*km/i);
  return {
    prix: prixMatch ? Number(prixMatch[1].replace(",", ".")) : null,
    distance: distMatch ? Number(distMatch[1].replace(",", ".")) : null,
  };
}

function AdminDemandes() {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [converting, setConverting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Demande | null>(null);
  const convertDemande = useServerFn(convertDemandeToMissions);

  const fetchDemandes = useCallback(async () => {
    const { data } = await supabase
      .from("demandes_convoyage")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data) setDemandes(data as Demande[]);
  }, []);

  useEffect(() => {
    fetchDemandes();
  }, [fetchDemandes]);

  // Temps réel : toute nouvelle demande remonte immédiatement dans la liste.
  useEffect(() => {
    const channel = supabase
      .channel("admin-demandes-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "demandes_convoyage" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const d = payload.new as Partial<Demande>;
          toast.info("Nouvelle demande de convoyage", {
            description: `${d.prenom ?? ""} ${d.nom ?? ""} · ${d.depart ?? "?"} → ${d.arrivee ?? "?"}`,
          });
        }
        fetchDemandes();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchDemandes]);

  const stats = useMemo(() => {
    const nouvelles = demandes.filter((d) => d.statut === "nouvelle" || d.statut === "a_traiter").length;
    const today = new Date().toDateString();
    const aujourdhui = demandes.filter((d) => new Date(d.created_at).toDateString() === today).length;
    const converties = demandes.filter((d) => d.statut === "convertie" || d.statut === "attribuee" || d.statut === "terminee").length;
    const potentiel = demandes
      .filter((d) => d.statut === "nouvelle" || d.statut === "a_traiter")
      .reduce((sum, d) => sum + (extractFromOptions(d.options).prix ?? 0), 0);
    return { nouvelles, aujourdhui, converties, potentiel };
  }, [demandes]);

  const countByStatut = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of demandes) m[d.statut] = (m[d.statut] ?? 0) + 1;
    return m;
  }, [demandes]);



  const convertToTrajet = async (d: Demande) => {
    setConverting(d.id);
    try {
      const rows = await convertDemande({ data: { demandeId: d.id } });
      const isAR = rows.length > 1;
      toast.success(
        isAR
          ? `Livraison + Restitution éclatée : ${rows.map((r) => `${r.leg === "aller" ? "Livraison" : "Restitution"} ${r.numero}`).join(" · ")}`
          : rows[0]
              ? `Mission ${rows[0].numero} créée`
              : "Demande convertie",
        { description: isAR ? "Deux missions indépendantes ont été créées et liées." : "La mission et le trajet ont été créés pour attribution." },
      );
      fetchDemandes();
    } catch (error) {
      toast.error("Impossible de convertir la demande", {
        description: error instanceof Error ? error.message : "Réessayez dans quelques secondes.",
      });
    } finally {
      setConverting(null);
    }
  };


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return demandes.filter((d) => {
      if (filterStatut !== "all" && d.statut !== filterStatut) return false;
      if (!q) return true;
      return (
        d.nom.toLowerCase().includes(q) ||
        d.prenom.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q) ||
        (d.telephone ?? "").toLowerCase().includes(q) ||
        d.depart.toLowerCase().includes(q) ||
        d.arrivee.toLowerCase().includes(q)
      );
    });
  }, [demandes, search, filterStatut]);


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

      <AdminBadgeLegend />


      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="À traiter" value={stats.nouvelles} icon={Inbox} accent={stats.nouvelles ? "warning" : "default"} hint="Demandes non converties" />
        <AdminStatCard label="Reçues aujourd'hui" value={stats.aujourdhui} icon={Clock} />
        <AdminStatCard label="Converties en mission" value={stats.converties} icon={CheckCircle2} accent="success" />
        <AdminStatCard label="Potentiel en attente" value={`${Math.round(stats.potentiel)} €`} icon={Euro} accent="info" hint="Somme des estimations à traiter" />
      </div>

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
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterStatut("all")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filterStatut === "all"
                  ? "bg-[#2F5FFF] text-white border-[#2F5FFF]"
                  : "border-[color:var(--admin-border)] text-[color:var(--admin-text-soft)] hover:border-[#2F5FFF]"
              }`}
            >
              Tous
              <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${filterStatut === "all" ? "bg-white/20" : "bg-[color:var(--admin-bg-soft)]"}`}>{demandes.length}</span>
            </button>
            {statuts.map((s) => {
              const active = filterStatut === s;
              const count = countByStatut[s] ?? 0;
              if (count === 0 && !active) return null;
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatut(s)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    active
                      ? "bg-[#2F5FFF] text-white border-[#2F5FFF]"
                      : "border-[color:var(--admin-border)] text-[color:var(--admin-text-soft)] hover:border-[#2F5FFF]"
                  }`}
                >
                  {statutLabels[s]}
                  <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${active ? "bg-white/20" : "bg-[color:var(--admin-bg-soft)]"}`}>{count}</span>
                </button>
              );
            })}
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
                  const fromOpts = extractFromOptions(d.options);
                  const ttc = d.prix_estime ?? fromOpts.prix ?? q?.priceTtc ?? null;
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
                        {(() => {
                          const tags = renderOptionsMeta(d.options_meta);
                          if (tags.length === 0) return null;
                          return (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {tags.slice(0, 3).map((t) => (
                                <span key={t} className="text-[10px] bg-[#d4af37]/15 text-[#8a6a10] border border-[#d4af37]/30 rounded-full px-1.5 py-0.5">
                                  {t}
                                </span>
                              ))}
                              {tags.length > 3 && (
                                <span className="text-[10px] text-[color:var(--admin-muted)]">+{tags.length - 3}</span>
                              )}
                            </div>
                          );
                        })()}
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
                          {ttc != null ? `${Number(ttc).toFixed(0)} €` : "—"}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1">
                          <AdminBadge label={statutLabels[d.statut] ?? d.statut} />
                          {(() => {
                            const marque = d.vehicule_marque ?? d.marque;
                            const modele = d.vehicule_modele ?? d.modele;
                            const plaque = d.vehicule_immatriculation ?? d.immatriculation;
                            if (!marque || !modele) return <AdminBadge label="Infos véhicule incomplètes" tone="danger" />;
                            if (!plaque) return <AdminBadge label="Plaque à confirmer" tone="warning" />;
                            return null;
                          })()}
                        </div>
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
          if (!(await confirmToast("Supprimer cette demande ?"))) return;
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
  const fromOpts = extractFromOptions(demande.options);
  const [prixEdit, setPrixEdit] = useState<string>(String(demande.prix_estime ?? fromOpts.prix ?? ""));
  const [savingPrix, setSavingPrix] = useState(false);
  useEffect(() => {
    setPrixEdit(String(demande.prix_estime ?? fromOpts.prix ?? ""));
  }, [demande.id, demande.prix_estime, fromOpts.prix]);
  const updateStatut = async (statut: string) => {
    await supabase.from("demandes_convoyage").update({ statut }).eq("id", demande.id);
    onChanged({ ...demande, statut });
  };
  const savePrix = async () => {
    setSavingPrix(true);
    try {
      const parsed = prixEdit.trim() === "" ? null : Number(prixEdit);
      const { error } = await supabase
        .from("demandes_convoyage")
        .update({ prix_estime: Number.isFinite(parsed as number) ? parsed : null })
        .eq("id", demande.id);
      if (error) throw error;
      onChanged({ ...demande, prix_estime: Number.isFinite(parsed as number) ? parsed : null });
      toast.success("Prix mis à jour");
    } catch (error) {
      toast.error("Impossible de modifier le prix", {
        description: error instanceof Error ? error.message : "Réessayez dans quelques secondes.",
      });
    } finally {
      setSavingPrix(false);
    }
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
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                const { createQuoteFromDemande } = await import("@/lib/quote-from-demande.functions");
                const res = await createQuoteFromDemande({ data: { demandeId: demande.id } });
                if (res.created) toast.success(`Devis ${res.devis.numero} généré`);
                else toast.info(`Devis déjà existant : ${res.devis.numero}`);
              } catch (e) {
                toast.error("Impossible de générer le devis", {
                  description: e instanceof Error ? e.message : "Erreur inconnue",
                });
              }
            }}
            className="text-xs"
          >
            <FileText size={12} className="mr-1" /> Générer devis
          </Button>
          <select
            value={demande.statut}
            onChange={(e) => updateStatut(e.target.value)}
            className="text-xs bg-white text-slate-800 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
          <DrawerField
            label="Marque / Modèle"
            value={[demande.vehicule_marque ?? demande.marque, demande.vehicule_modele ?? demande.modele].filter(Boolean).join(" ") || null}
          />
          <DrawerField label="Immatriculation" value={demande.vehicule_immatriculation ?? demande.immatriculation} mono />
          <DrawerField label="VIN" value={demande.vehicule_vin ?? null} mono />
          <DrawerField label="Énergie" value={demande.vehicule_energie ?? demande.carburant} />
          <DrawerField label="Type" value={demande.vehicule_type ?? null} />
          <DrawerField label="Couleur" value={demande.vehicule_couleur ?? null} />
          <DrawerField label="Kilométrage" value={demande.vehicule_km != null ? `${demande.vehicule_km} km` : null} />
        </DrawerGrid>
        {renderOptionsMeta(demande.options_meta).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {renderOptionsMeta(demande.options_meta).map((label) => (
              <span key={label} className="text-[11px] bg-[#d4af37]/15 text-[#e7c76a] border border-[#d4af37]/30 rounded-full px-2 py-0.5">
                {label}
              </span>
            ))}
          </div>
        )}
        {demande.options && (
          <p className="mt-2 text-xs text-white/60 whitespace-pre-wrap">{demande.options}</p>
        )}
      </DrawerSection>

      {(demande.options === "aller_retour" || demande.options === "aller-retour" || demande.depart_retour || demande.immatriculation_retour) && (
        <DrawerSection title="Restitution (Livraison + Restitution)" icon={<MapPin size={12} />}>
          <DrawerGrid>
            <DrawerField
              label="Récupération retour"
              value={demande.recuperation_retour_identique === false ? (demande.adresse_recuperation_retour || demande.depart_retour) : (demande.arrivee || "Adresse de livraison")}
            />
            <DrawerField label="Adresse de retour" value={demande.arrivee_retour || demande.depart} />
            <DrawerField label="Date retour" value={demande.date_retour ? new Date(demande.date_retour).toLocaleDateString("fr-FR") : null} />
            <DrawerField label="Heure retour" value={demande.heure_retour} />
            <DrawerField label="Plaque retour" value={demande.immatriculation_retour} mono />
            <DrawerField label="VIN retour" value={demande.vin_retour} mono />
            <DrawerField
              label="Marque / Modèle retour"
              value={[demande.marque_retour, demande.modele_retour].filter(Boolean).join(" ") || null}
            />
          </DrawerGrid>
        </DrawerSection>
      )}


      <DrawerSection title="Estimation tarifaire" icon={<Calendar size={12} />}>
        {(() => {
          const ttc = demande.prix_estime ?? fromOpts.prix ?? undefined;
          const km = demande.distance_km ?? fromOpts.distance ?? null;
          const src = demande.prix_estime != null
            ? "Prix actuellement enregistré"
            : fromOpts.prix != null ? "Estimation reconstituée depuis le devis" : undefined;
          return (
            <>
              <PriceBlock quote={quote} priceTtc={ttc} title="Estimation" source={src} />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="block text-[11px] text-white/60 mb-1">Prix TTC modifiable</label>
                  <input
                    type="number"
                    step="0.01"
                    value={prixEdit}
                    onChange={(e) => setPrixEdit(e.target.value)}
                    className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#5fb6ff]/60"
                    placeholder="Ex. 290"
                  />
                </div>
                <Button size="sm" onClick={() => void savePrix()} disabled={savingPrix} className="admin-btn-blue text-white border-transparent hover:text-white">
                  {savingPrix ? "Enregistrement…" : "Enregistrer le prix"}
                </Button>
              </div>
              {km != null && km > 0 && (
                <p className="mt-2 text-xs text-white/60">Distance estimée : {km} km</p>
              )}
            </>
          );
        })()}
      </DrawerSection>


      {demande.message && (
        <DrawerSection title="Message client" icon={<Mail size={12} />}>
          <p className="text-sm italic text-white/80 whitespace-pre-wrap">"{demande.message}"</p>
        </DrawerSection>
      )}
    </AdminDetailDrawer>
  );
}
