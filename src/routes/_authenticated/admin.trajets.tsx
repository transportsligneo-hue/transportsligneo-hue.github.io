import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sendTransactionalEmail } from "@/lib/email/send";
import { RefreshCw, Plus, Edit2, Save, Route as RouteIcon, Send, CheckCircle2, XCircle, Gavel, FileText, Ban, Search, Mail, Phone, Calendar, Eye, Layers } from "lucide-react";
import {
  Card,
  Badge,
  EmptyState,
  Modal,
  DetailRow,
  Button,
  IconButton,
  Select,
  TextInput,
  FormField,
} from "@/components/admin/AdminUI";
import { PricingModeBlock } from "@/components/admin/PricingModeBlock";
import { PublishToCatalogueButton } from "@/components/admin/PublishToCatalogueButton";
import { CreateTestMissionButton, TestBadge, DeleteTestMissionButton } from "@/components/admin/TestMissionActions";
import { ScanToPrefill } from "@/components/scanner/ScanToPrefill";
import { QrHandoffButton } from "@/components/scanner/QrHandoffButton";
import type { ExtractedFields } from "@/lib/scanner/types";
import { toast } from "sonner";
import { notifyDriver } from "@/lib/push/driver-notify";
import { confirmToast } from "@/lib/confirm-toast";

export const Route = createFileRoute("/_authenticated/admin/trajets")({
  component: AdminTrajets,
});

interface Trajet {
  id: string;
  depart: string;
  arrivee: string;
  date_trajet: string | null;
  heure_trajet: string | null;
  marque: string | null;
  modele: string | null;
  immatriculation: string | null;
  client_nom: string | null;
  client_email: string | null;
  client_telephone: string | null;
  prix: number | null;
  tarif_convoyeur: number | null;
  statut: string;
  notes_internes?: string | null;
  demande_id: string | null;
  created_at: string;
  prix_suggere?: number | null;
  statut_publication?: string;
  // B1 — pricing mode
  pricing_mode?: "fixe" | "enchere" | null;
  prix_client_ttc?: number | null;
  prix_convoyeur_fixe?: number | null;
  prix_convoyeur_min?: number | null;
  prix_convoyeur_max?: number | null;
  marge_indicative_pct?: number | null;
  // Refonte dispatch — auto depuis devis
  devis_id?: string | null;
  prix_client?: number | null;
  commission_convoyeur_pct?: number | null;
  prix_convoyeur?: number | null;
  prix_societe?: number | null;
  is_test_data?: boolean | null;
  mission_group_id?: string | null;
  leg_type?: string | null;
  leg_index?: number | null;
  type_mission?: string | null;
}

interface DevisLink {
  id: string;
  numero: string;
  prix_estime: number;
  paid_at: string | null;
}

interface Offre {
  id: string;
  trajet_id: string;
  convoyeur_id: string;
  prix_propose: number;
  prix_suggere_snapshot: number | null;
  type_offre: string;
  statut: string;
  message: string | null;
  created_at: string;
  admin_counter_offer?: number | null;
  admin_counter_at?: string | null;
  commentaire_convoyeur?: string | null;
  convoyeur?: { prenom: string; nom: string; telephone: string; email: string } | null;
}

const statuts = ["en_attente", "attribue", "accepte", "en_cours", "termine", "annule"];
const statutLabels: Record<string, string> = {
  en_attente: "En attente",
  attribue: "Attribué",
  accepte: "Accepté",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
};

const emptyTrajet = {
  depart: "",
  arrivee: "",
  date_trajet: "",
  heure_trajet: "",
  marque: "",
  modele: "",
  immatriculation: "",
  client_nom: "",
  client_email: "",
  client_telephone: "",
  prix: "",
  tarif_convoyeur: "",
  notes_internes: "",
};

function AdminTrajets() {
  const [trajets, setTrajets] = useState<Trajet[]>([]);
  const [filterStatut, setFilterStatut] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Trajet | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyTrajet);
  const [editing, setEditing] = useState(false);
  const [offres, setOffres] = useState<Offre[]>([]);
  const [prixSuggereInput, setPrixSuggereInput] = useState<string>("");
  const [savingPub, setSavingPub] = useState(false);
  const [linkedDevis, setLinkedDevis] = useState<DevisLink | null>(null);
  const [pctInput, setPctInput] = useState<string>("65");
  const [savingCommission, setSavingCommission] = useState(false);
  const [counterInputs, setCounterInputs] = useState<Record<string, string>>({});
  const [savingCounter, setSavingCounter] = useState<string | null>(null);

  const counterOffre = async (offre: Offre) => {
    const raw = counterInputs[offre.id];
    const value = parseFloat((raw ?? "").replace(",", "."));
    if (!value || value <= 0) {
      toast.error("Saisis un montant de contre-proposition valide.");
      return;
    }
    setSavingCounter(offre.id);
    const { error } = await supabase
      .from("mission_offres" as never)
      .update({
        admin_counter_offer: value,
        admin_counter_at: new Date().toISOString(),
      } as never)
      .eq("id" as never, offre.id as never);
    setSavingCounter(null);
    if (error) {
      toast.error("Impossible d'enregistrer la contre-proposition.");
      return;
    }
    toast.success(`Contre-proposition à ${value} € envoyée.`);
    if (selected) fetchOffres(selected.id);
  };

  const isPartnershipTrajet = useCallback((trajet: Pick<Trajet, "depart" | "arrivee">) => {
    const depart = (trajet.depart ?? "").trim().toLowerCase();
    return depart.includes("partenariat");
  }, []);

  const getTrajetPriority = useCallback((trajet: Trajet) => {
    const priorityByStatut: Record<string, number> = {
      en_cours: 60,
      attribue: 50,
      accepte: 40,
      en_attente: 30,
      termine: 20,
      annule: 10,
    };
    return priorityByStatut[trajet.statut] ?? 0;
  }, []);

  // Charge le devis lié quand selected change
  useEffect(() => {
    if (!selected?.devis_id) {
      setLinkedDevis(null);
      return;
    }
    supabase
      .from("devis")
      .select("id, numero, prix_estime, paid_at")
      .eq("id", selected.devis_id)
      .maybeSingle()
      .then(({ data }) => setLinkedDevis(data ?? null));
    setPctInput((selected.commission_convoyeur_pct ?? 65).toString());
  }, [selected?.devis_id, selected?.commission_convoyeur_pct]);

  const saveCommission = async () => {
    if (!selected) return;
    const pct = parseFloat(pctInput);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error("Pourcentage invalide (0-100)");
      return;
    }
    setSavingCommission(true);
    await supabase
      .from("trajets")
      .update({ commission_convoyeur_pct: pct } as never)
      .eq("id", selected.id);
    // Le trigger DB recalcule prix_convoyeur et prix_societe automatiquement
    const { data: refreshed } = await supabase
      .from("trajets")
      .select("*")
      .eq("id", selected.id)
      .maybeSingle();
    setSavingCommission(false);
    if (refreshed) setSelected({ ...selected, ...(refreshed as Partial<Trajet>) });
    fetchTrajets();
  };

  const fetchOffres = useCallback(async (trajetId: string) => {
    const { data: offresData } = await supabase
      .from("mission_offres" as never)
      .select("*")
      .eq("trajet_id" as never, trajetId as never)
      .order("prix_propose" as never, { ascending: true } as never);
    if (!offresData) {
      setOffres([]);
      return;
    }
    const list = offresData as unknown as Offre[];
    // Hydrater convoyeurs
    const ids = Array.from(new Set(list.map((o) => o.convoyeur_id)));
    if (ids.length > 0) {
      const { data: convs } = await supabase
        .from("convoyeurs")
        .select("id, prenom, nom, telephone, email")
        .in("id", ids);
      const map: Record<string, { prenom: string; nom: string; telephone: string; email: string }> = {};
      (convs ?? []).forEach((c) => {
        map[c.id] = { prenom: c.prenom, nom: c.nom, telephone: c.telephone, email: c.email };
      });
      setOffres(list.map((o) => ({ ...o, convoyeur: map[o.convoyeur_id] ?? null })));
    } else {
      setOffres(list);
    }
  }, []);

  // Charger les offres dès qu'un trajet est ouvert en lecture
  useEffect(() => {
    if (selected && !editing && !showCreate) {
      fetchOffres(selected.id);
      setPrixSuggereInput(selected.prix_suggere?.toString() ?? "");
    } else {
      setOffres([]);
    }
  }, [selected, editing, showCreate, fetchOffres]);

  const togglePublication = async (publier: boolean) => {
    if (!selected) return;
    setSavingPub(true);
    const updates: Record<string, unknown> = {
      statut_publication: publier ? "publie" : "brouillon",
    };
    if (publier && prixSuggereInput) {
      updates.prix_suggere = parseFloat(prixSuggereInput);
    }
    await supabase.from("trajets").update(updates as never).eq("id", selected.id);
    setSavingPub(false);
    setSelected({ ...selected, statut_publication: publier ? "publie" : "brouillon", prix_suggere: publier ? parseFloat(prixSuggereInput || "0") : selected.prix_suggere });
    fetchTrajets();
  };

  const validerOffre = async (offre: Offre) => {
    if (!selected) return;
    if (!(await confirmToast(`Valider ${offre.convoyeur?.prenom} ${offre.convoyeur?.nom} à ${offre.prix_propose} € ?`))) return;

    const { error } = await supabase.rpc("admin_award_offer", { _offre_id: offre.id });
    if (error) {
      toast.error(error.message);
      return;
    }

    notifyDriver({ convoyeurId: offre.convoyeur_id ?? undefined, trajetId: selected.id, event: "mission_validee" });

    // Notifications email (best-effort)
    const dateFmt = selected.date_trajet
      ? new Date(selected.date_trajet).toLocaleDateString("fr-FR")
      : "—";
    if (offre.convoyeur?.email) {
      sendTransactionalEmail({
        templateName: "offre-acceptee",
        recipientEmail: offre.convoyeur.email,
        idempotencyKey: `offre-acceptee-${offre.id}`,
        templateData: {
          prenom: offre.convoyeur.prenom,
          depart: selected.depart,
          arrivee: selected.arrivee,
          date: dateFmt,
          prixPropose: offre.prix_propose,
        },
      }).catch(() => {});
    }

    fetchOffres(selected.id);
    fetchTrajets();
    setSelected({ ...selected, statut: "attribue", tarif_convoyeur: offre.prix_propose, statut_publication: "attribue" });
    toast.success("Mission attribuée.");
  };

  const refuserOffre = async (offre: Offre) => {
    await supabase.from("mission_offres" as never).update({ statut: "refusee" } as never).eq("id" as never, offre.id as never);
    if (offre.convoyeur?.email && selected) {
      const dateFmt = selected.date_trajet
        ? new Date(selected.date_trajet).toLocaleDateString("fr-FR")
        : "—";
      sendTransactionalEmail({
        templateName: "offre-refusee",
        recipientEmail: offre.convoyeur.email,
        idempotencyKey: `offre-refusee-${offre.id}`,
        templateData: {
          prenom: offre.convoyeur.prenom,
          depart: selected.depart,
          arrivee: selected.arrivee,
          date: dateFmt,
          prixPropose: offre.prix_propose,
        },
      }).catch(() => {});
    }
    if (selected) fetchOffres(selected.id);
  };

  const fetchTrajets = useCallback(async () => {
    let query = supabase.from("trajets").select("*").order("created_at", { ascending: false });
    if (filterStatut !== "all") query = query.eq("statut", filterStatut);
    const { data } = await query;
    if (!data) return;
    const ids = (data as { id: string }[]).map((d) => d.id);
    let adminMap: Record<string, { notes_internes?: string | null; prix_client_ttc?: number | null; marge_indicative_pct?: number | null }> = {};
    if (ids.length > 0) {
      const { data: adminRows } = await supabase
        .from("trajets_admin_data" as never)
        .select("trajet_id, notes_internes, prix_client_ttc, marge_indicative_pct")
        .in("trajet_id" as never, ids as never);
      if (adminRows) {
        adminMap = (adminRows as unknown as { trajet_id: string; notes_internes: string | null; prix_client_ttc: number | null; marge_indicative_pct: number | null }[]).reduce((acc, r) => {
          acc[r.trajet_id] = { notes_internes: r.notes_internes, prix_client_ttc: r.prix_client_ttc, marge_indicative_pct: r.marge_indicative_pct };
          return acc;
        }, {} as typeof adminMap);
      }
    }
    const enriched = (data as unknown as Trajet[]).map((t) => ({ ...t, ...adminMap[t.id] }));
    const operational = enriched.filter((trajet) => !isPartnershipTrajet(trajet));
    const deduped = new Map<string, Trajet>();

    operational.forEach((trajet) => {
      const key = trajet.demande_id
        ? `demande:${trajet.demande_id}:${trajet.mission_group_id ?? "solo"}:${trajet.leg_type ?? "simple"}:${trajet.leg_index ?? 1}`
        : `trajet:${trajet.id}`;
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, trajet);
        return;
      }

      const existingPriority = getTrajetPriority(existing);
      const nextPriority = getTrajetPriority(trajet);
      const shouldReplace =
        nextPriority > existingPriority ||
        (nextPriority === existingPriority && new Date(trajet.created_at).getTime() > new Date(existing.created_at).getTime());

      if (shouldReplace) {
        deduped.set(key, trajet);
      }
    });

    setTrajets(
      Array.from(deduped.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    );
  }, [filterStatut, getTrajetPriority, isPartnershipTrajet]);

  useEffect(() => {
    fetchTrajets();
  }, [fetchTrajets]);

  const createTrajet = async () => {
    if (!form.depart || !form.arrivee) return;
    const { data: created } = await supabase.from("trajets").insert({
      depart: form.depart,
      arrivee: form.arrivee,
      date_trajet: form.date_trajet || null,
      heure_trajet: form.heure_trajet || "",
      marque: form.marque || "",
      modele: form.modele || "",
      immatriculation: form.immatriculation || "",
      client_nom: form.client_nom || "",
      client_email: form.client_email || "",
      client_telephone: form.client_telephone || "",
      prix: form.prix ? parseFloat(form.prix) : null,
      tarif_convoyeur: form.tarif_convoyeur ? parseFloat(form.tarif_convoyeur) : null,
    }).select("id").maybeSingle();
    if (created?.id && form.notes_internes) {
      await supabase
        .from("trajets_admin_data" as never)
        .upsert({ trajet_id: created.id, notes_internes: form.notes_internes } as never, { onConflict: "trajet_id" } as never);
    }
    setForm(emptyTrajet);
    setShowCreate(false);
    fetchTrajets();
  };

  const updateTrajet = async () => {
    if (!selected) return;
    await supabase
      .from("trajets")
      .update({
        depart: form.depart,
        arrivee: form.arrivee,
        date_trajet: form.date_trajet || null,
        heure_trajet: form.heure_trajet || "",
        marque: form.marque || "",
        modele: form.modele || "",
        immatriculation: form.immatriculation || "",
        client_nom: form.client_nom || "",
        client_email: form.client_email || "",
        client_telephone: form.client_telephone || "",
        prix: form.prix ? parseFloat(form.prix) : null,
        tarif_convoyeur: form.tarif_convoyeur ? parseFloat(form.tarif_convoyeur) : null,
      })
      .eq("id", selected.id);
    await supabase
      .from("trajets_admin_data" as never)
      .upsert({ trajet_id: selected.id, notes_internes: form.notes_internes || null } as never, { onConflict: "trajet_id" } as never);
    setEditing(false);
    setSelected(null);
    fetchTrajets();
  };

  const updateStatut = async (id: string, statut: string) => {
    const updates: Record<string, unknown> = { statut };
    // Synchroniser statut_publication pour éviter les incohérences
    if (statut === "annule") {
      updates.statut_publication = "brouillon";
    } else if (statut === "en_attente") {
      updates.statut_publication = "publie";
    } else if (["attribue", "accepte", "en_cours", "termine"].includes(statut)) {
      updates.statut_publication = "attribue";
    }

    const { error: trajetError } = await supabase
      .from("trajets")
      .update(updates as never)
      .eq("id", id);
    if (trajetError) {
      console.error("[admin.trajets] update statut error:", trajetError);
      toast.error("Échec mise à jour", { description: trajetError.message });
      return;
    }

    // Cascader sur les attributions actives liées
    if (statut === "annule") {
      const { error: attrError } = await supabase
        .from("attributions")
        .update({ statut: "annule", etape_courante: null } as never)
        .eq("trajet_id", id)
        .not("statut", "in", "(annule,validee,termine,refusee)");
      if (attrError) {
        console.error("[admin.trajets] cascade attributions error:", attrError);
      }
      toast.success("Mission annulée");
    } else if (statut === "en_attente") {
      // Réouvre : libère les attributions actives
      await supabase
        .from("attributions")
        .update({ statut: "annule", etape_courante: null } as never)
        .eq("trajet_id", id)
        .in("statut", ["propose", "accepte", "en_cours"]);
      toast.success("Trajet rouvert");
    } else {
      toast.success(`Statut → ${statutLabels[statut] ?? statut}`);
    }

    fetchTrajets();
  };

  const cancelTrajet = async (t: Trajet) => {
    if (t.statut === "annule") return;
    if (!(await confirmToast(`Annuler la mission ${t.depart} → ${t.arrivee} ?`))) return;
    await updateStatut(t.id, "annule");
    if (selected?.id === t.id) {
      setSelected({ ...selected, statut: "annule", statut_publication: "brouillon" });
    }
  };

  const openEdit = (t: Trajet) => {
    setForm({
      depart: t.depart,
      arrivee: t.arrivee,
      date_trajet: t.date_trajet ?? "",
      heure_trajet: t.heure_trajet ?? "",
      marque: t.marque ?? "",
      modele: t.modele ?? "",
      immatriculation: t.immatriculation ?? "",
      client_nom: t.client_nom ?? "",
      client_email: t.client_email ?? "",
      client_telephone: t.client_telephone ?? "",
      prix: t.prix?.toString() ?? "",
      tarif_convoyeur: t.tarif_convoyeur?.toString() ?? "",
      notes_internes: t.notes_internes ?? "",
    });
    setEditing(true);
    setSelected(t);
  };

  const isFormOpen = showCreate || (selected && editing);

  const filteredTrajets = trajets.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.depart.toLowerCase().includes(q) ||
      t.arrivee.toLowerCase().includes(q) ||
      (t.client_nom ?? "").toLowerCase().includes(q) ||
      (t.marque ?? "").toLowerCase().includes(q) ||
      (t.modele ?? "").toLowerCase().includes(q) ||
      (t.immatriculation ?? "").toLowerCase().includes(q)
    );
  });

  const enAttente = trajets.filter((t) => t.statut === "en_attente").length;
  const enCours = trajets.filter((t) => t.statut === "en_cours" || t.statut === "accepte" || t.statut === "attribue").length;
  const termines = trajets.filter((t) => t.statut === "termine").length;

  return (
    <div>
      {/* ===== En-tête ===== */}
      <div className="dvx-head">
        <div className="min-w-0">
          <h1 className="dvx-title">Trajets</h1>
          <p className="dvx-sub">
            Pipeline complet des missions — édition, diffusion et attribution aux convoyeurs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateTestMissionButton onCreated={fetchTrajets} />
          <button
            type="button"
            className="dvx-cta"
            onClick={() => {
              setForm(emptyTrajet);
              setShowCreate(true);
            }}
          >
            <Plus size={16} />
            Nouveau trajet
          </button>
        </div>
      </div>

      {/* ===== Statistiques ===== */}
      <div className="dvx-stats">
        <div className="dvx-stat">
          <span className="dvx-stat-ic blue"><RouteIcon size={17} /></span>
          <p className="dvx-stat-k">Total</p>
          <p className="dvx-stat-v">{trajets.length}</p>
          <p className="dvx-stat-t dim">Trajets suivis</p>
        </div>
        <div className="dvx-stat">
          <span className="dvx-stat-ic orange"><Send size={17} /></span>
          <p className="dvx-stat-k">En attente</p>
          <p className="dvx-stat-v">{enAttente}</p>
          <p className={`dvx-stat-t ${enAttente > 0 ? "warn" : "dim"}`}>
            {enAttente > 0 ? "À diffuser / attribuer" : "Rien en attente"}
          </p>
        </div>
        <div className="dvx-stat">
          <span className="dvx-stat-ic violet"><Layers size={17} /></span>
          <p className="dvx-stat-k">En cours</p>
          <p className="dvx-stat-v">{enCours}</p>
          <p className="dvx-stat-t dim">Attribués ou en exécution</p>
        </div>
        <div className="dvx-stat">
          <span className="dvx-stat-ic green"><CheckCircle2 size={17} /></span>
          <p className="dvx-stat-k">Terminés</p>
          <p className="dvx-stat-v">{termines}</p>
          <p className={`dvx-stat-t ${termines > 0 ? "up" : "dim"}`}>Missions livrées</p>
        </div>
      </div>

      {/* ===== Barre de filtres ===== */}
      <div className="dvx-filters">
        <div className="dvx-search">
          <Search size={15} />
          <input
            className="dvx-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un trajet, un client, une plaque…"
          />
        </div>
        <select className="dvx-select" value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}>
          <option value="all">Tous les statuts</option>
          {statuts.map((s) => (
            <option key={s} value={s}>{statutLabels[s]}</option>
          ))}
        </select>
        <button type="button" className="dvx-export" onClick={fetchTrajets}>
          <RefreshCw size={14} />
          Actualiser
        </button>
      </div>

      {typeof window !== "undefined" && localStorage.getItem("admin.trajets.dismissB2BBanner") !== "1" && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-pro-border/60 bg-pro-bg-soft/40 px-3 py-2 text-xs">
          <div className="flex-1">
            <span className="text-pro-text">Les demandes de partenariat sont suivies dans leur section dédiée.</span>{" "}
            <Link to="/admin/b2b-leads" className="font-medium text-pro-accent hover:underline">
              Ouvrir
            </Link>
          </div>
          <button
            aria-label="Masquer"
            onClick={() => {
              localStorage.setItem("admin.trajets.dismissB2BBanner", "1");
              // Force re-render
              window.dispatchEvent(new Event("storage"));
              setTimeout(() => window.location.reload(), 50);
            }}
            className="text-pro-muted hover:text-pro-text"
          >
            ×
          </button>
        </div>
      )}

      {filteredTrajets.length === 0 ? (
        <EmptyState icon={RouteIcon} title="Aucun trajet" description="Créez un trajet ou convertissez une demande." />
      ) : (
        <div className="space-y-3.5">
          {filteredTrajets.map((t) => {
            const tone =
              t.statut === "annule" ? "red"
              : t.statut === "termine" ? "green"
              : t.statut === "en_cours" ? "violet"
              : t.statut === "attribue" || t.statut === "accepte" ? "blue"
              : "orange";
            const initials = (t.client_nom || "—").slice(0, 2).toUpperCase();
            return (
              <div key={t.id} className={`dvx-card ${t.statut === "annule" ? "is-archived" : ""}`}>
                {/* En-tête */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className={`dvx-badge ${tone}`}>{statutLabels[t.statut] ?? t.statut}</span>
                    {t.is_test_data && <TestBadge />}
                    <span className="text-[11.5px] text-[#a3a4ac]">
                      {new Date(t.created_at).toLocaleDateString("fr-FR", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="dvx-price">
                      {t.prix ? `${Number(t.prix).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : "—"}
                      <small>CLIENT</small>
                    </p>
                  </div>
                </div>

                {/* Corps */}
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="dvx-avatar">{initials}</span>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-bold text-[#14161c] truncate">{t.client_nom || "—"}</p>
                      {t.client_email && (
                        <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-[#70727d] truncate">
                          <Mail size={11} className="shrink-0" />{t.client_email}
                        </p>
                      )}
                      {t.client_telephone && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[#70727d]">
                          <Phone size={11} className="shrink-0" />{t.client_telephone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="dvx-col-k">Trajet</p>
                    <div className="flex items-start gap-2">
                      <span className="dvx-dot start" />
                      <p className="text-[12.5px] text-[#14161c] leading-snug">{t.depart}</p>
                    </div>
                    <div className="mt-1.5 flex items-start gap-2">
                      <span className="dvx-dot end" />
                      <p className="text-[12.5px] text-[#14161c] leading-snug">{t.arrivee}</p>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="dvx-col-k">Véhicule</p>
                    <p className="text-[12.5px] text-[#14161c]">
                      {[t.marque, t.modele].filter(Boolean).join(" ") || "—"}
                    </p>
                    {t.immatriculation && <p className="dvx-vin mt-1">{t.immatriculation}</p>}
                  </div>

                  <div className="min-w-0">
                    <p className="dvx-col-k">Date souhaitée</p>
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#14161c]">
                      <Calendar size={12} className="text-[#2f5fff]" />
                      {t.date_trajet
                        ? new Date(t.date_trajet).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
                        : "Date à définir"}
                      {t.heure_trajet ? ` · ${t.heure_trajet.slice(0, 5)}` : ""}
                    </p>
                  </div>
                </div>

                {/* Pied de carte */}
                <div className="dvx-foot">
                  <button type="button" className="dvx-ico" title="Voir / éditer" onClick={() => { setSelected(t); setEditing(false); }}>
                    <Eye size={15} />
                  </button>
                  <button type="button" className="dvx-btn" onClick={() => openEdit(t)}>
                    <Edit2 size={13} />
                    Modifier
                  </button>
                  {t.statut !== "annule" && t.statut !== "termine" && (
                    <button type="button" className="dvx-ico danger" title="Annuler la mission" onClick={() => void cancelTrajet(t)}>
                      <Ban size={15} />
                    </button>
                  )}
                  {t.is_test_data && (
                    <DeleteTestMissionButton trajetId={t.id} compact onDeleted={fetchTrajets} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal création / édition */}
      <Modal
        open={!!isFormOpen}
        onClose={() => {
          setShowCreate(false);
          setEditing(false);
          setSelected(null);
        }}
        title={editing ? "Modifier le trajet" : "Nouveau trajet"}
        size="lg"
      >
        <div className="space-y-3">
          {!editing && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gradient-to-br from-[#0b1026] to-[#111a3d] border border-[#d4af37]/30">
              <div className="text-white">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  📄 Pré-remplir par scan IA
                </p>
                <p className="text-[11px] text-white/60">
                  Carte grise, bon de commande, PV… tous les champs sont détectés automatiquement.
                </p>
              </div>
              {(() => {
                const applyExtracted = (fields: ExtractedFields) => {
                  setForm((prev) => ({
                    ...prev,
                    depart: fields.lieu_depart || prev.depart,
                    arrivee: fields.lieu_arrivee || prev.arrivee,
                    date_trajet: prev.date_trajet,
                    marque: fields.marque || prev.marque,
                    modele: fields.modele || prev.modele,
                    immatriculation: fields.immatriculation || prev.immatriculation,
                    client_nom: fields.client_nom || fields.titulaire_nom || prev.client_nom,
                    client_email: fields.client_email || prev.client_email,
                    client_telephone: fields.client_telephone || prev.client_telephone,
                    notes_internes: [
                      prev.notes_internes,
                      fields.vin ? `VIN: ${fields.vin}` : "",
                      fields.numero_commande ? `Cmd: ${fields.numero_commande}` : "",
                      fields.numero_dossier ? `Dossier: ${fields.numero_dossier}` : "",
                      fields.kilometrage ? `Km: ${fields.kilometrage}` : "",
                      fields.observations || "",
                    ].filter(Boolean).join(" · ").slice(0, 500),
                  }));
                };
                return (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <ScanToPrefill label="Scanner" multiPage onExtracted={applyExtracted} />
                    <QrHandoffButton context="admin_mission" onExtracted={applyExtracted} />
                  </div>
                );
              })()}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Départ" required>
              <TextInput value={form.depart} onChange={(e) => setForm({ ...form, depart: e.target.value })} />
            </FormField>
            <FormField label="Arrivée" required>
              <TextInput value={form.arrivee} onChange={(e) => setForm({ ...form, arrivee: e.target.value })} />
            </FormField>
            <FormField label="Date">
              <TextInput
                type="date"
                value={form.date_trajet}
                onChange={(e) => setForm({ ...form, date_trajet: e.target.value })}
              />
            </FormField>
            <FormField label="Heure">
              <TextInput value={form.heure_trajet} onChange={(e) => setForm({ ...form, heure_trajet: e.target.value })} />
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Marque">
              <TextInput value={form.marque} onChange={(e) => setForm({ ...form, marque: e.target.value })} />
            </FormField>
            <FormField label="Modèle">
              <TextInput value={form.modele} onChange={(e) => setForm({ ...form, modele: e.target.value })} />
            </FormField>
            <FormField label="Immatriculation">
              <TextInput value={form.immatriculation} onChange={(e) => setForm({ ...form, immatriculation: e.target.value })} />
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Client">
              <TextInput value={form.client_nom} onChange={(e) => setForm({ ...form, client_nom: e.target.value })} />
            </FormField>
            <FormField label="Email">
              <TextInput value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} />
            </FormField>
            <FormField label="Téléphone">
              <TextInput value={form.client_telephone} onChange={(e) => setForm({ ...form, client_telephone: e.target.value })} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Prix client (€)">
              <TextInput type="number" value={form.prix} onChange={(e) => setForm({ ...form, prix: e.target.value })} />
            </FormField>
            <FormField label="Tarif convoyeur (€)">
              <TextInput
                type="number"
                value={form.tarif_convoyeur}
                onChange={(e) => setForm({ ...form, tarif_convoyeur: e.target.value })}
              />
            </FormField>
          </div>
          <FormField label="Notes internes">
            <TextInput value={form.notes_internes} onChange={(e) => setForm({ ...form, notes_internes: e.target.value })} />
          </FormField>
          <Button className="w-full" onClick={editing ? updateTrajet : createTrajet} icon={<Save size={14} />}>
            {editing ? "Enregistrer" : "Créer le trajet"}
          </Button>
        </div>
      </Modal>

      {/* Modal détail (lecture seule) */}
      <Modal
        open={!!selected && !editing && !showCreate}
        onClose={() => setSelected(null)}
        title="Détail trajet"
        size="md"
      >
        {selected && !editing && (
          <>
            <Card padded={false} className="mb-4">
              <div className="px-4 divide-y divide-pro-border">
                <DetailRow label="Départ" value={selected.depart} />
                <DetailRow label="Arrivée" value={selected.arrivee} />
                <DetailRow label="Date" value={selected.date_trajet} />
                <DetailRow label="Heure" value={selected.heure_trajet} />
                <DetailRow
                  label="Véhicule"
                  value={[selected.marque, selected.modele].filter(Boolean).join(" ") || null}
                />
                <DetailRow label="Immatriculation" value={selected.immatriculation} />
                <DetailRow label="Client" value={selected.client_nom} />
                <DetailRow label="Email" value={selected.client_email} />
                <DetailRow label="Téléphone" value={selected.client_telephone} />
                <DetailRow label="Prix client" value={selected.prix ? `${selected.prix} €` : null} />
                <DetailRow
                  label="Tarif convoyeur (interne)"
                  value={selected.tarif_convoyeur ? `${selected.tarif_convoyeur} €` : null}
                />
                <DetailRow label="Notes" value={selected.notes_internes} />
              </div>
            </Card>
            <FormField label="Statut">
              <Select
                value={selected.statut}
                onChange={(e) => {
                  updateStatut(selected.id, e.target.value);
                  setSelected({ ...selected, statut: e.target.value });
                }}
              >
                {statuts.map((s) => (
                  <option key={s} value={s}>
                    {statutLabels[s]}
                  </option>
                ))}
              </Select>
            </FormField>

            {/* === SECTION DEVIS LIÉ + COMMISSION CONVOYEUR === */}
            {(linkedDevis || selected.prix_client != null) && (
              <div className="mt-5 pt-5 border-t border-pro-border">
                <h3 className="font-semibold text-pro-text flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-pro-accent" />
                  Devis & répartition automatique
                </h3>

                {linkedDevis && (
                  <Card padded={false} className="mb-3">
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-pro-muted">Devis source</p>
                        <p className="font-mono text-sm text-pro-text mt-0.5">{linkedDevis.numero}</p>
                        <p className="text-xs text-pro-text-soft mt-0.5">
                          {linkedDevis.paid_at ? `Payé le ${new Date(linkedDevis.paid_at).toLocaleDateString("fr-FR")}` : "Non payé"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] uppercase tracking-wider text-pro-muted">Montant client</p>
                        <p className="text-pro-accent font-bold text-lg leading-tight">{linkedDevis.prix_estime} €</p>
                      </div>
                    </div>
                  </Card>
                )}

                <Card padded={false}>
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-pro-text-soft mb-1.5">
                        Commission convoyeur (%)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={pctInput}
                          onChange={(e) => setPctInput(e.target.value)}
                          className="w-24 px-3 py-2 border border-pro-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pro-accent"
                        />
                        <span className="text-pro-muted text-sm">%</span>
                        <Button
                          onClick={saveCommission}
                          disabled={savingCommission}
                          icon={<Save size={13} />}
                          className="ml-auto"
                        >
                          Appliquer
                        </Button>
                      </div>
                    </div>

                    {/* Aperçu live (avant sauvegarde) */}
                    {selected.prix_client != null && (() => {
                      const pct = parseFloat(pctInput) || 0;
                      const conv = Math.round(selected.prix_client! * pct) / 100;
                      const soc = Math.round((selected.prix_client! - conv) * 100) / 100;
                      return (
                        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-pro-border">
                          <div className="text-center">
                            <p className="text-[10px] uppercase tracking-wider text-pro-muted">Client paie</p>
                            <p className="text-pro-text font-bold text-base mt-1 tabular-nums">{selected.prix_client} €</p>
                          </div>
                          <div className="text-center bg-emerald-50 rounded-lg py-2">
                            <p className="text-[10px] uppercase tracking-wider text-emerald-700">Convoyeur</p>
                            <p className="text-emerald-700 font-bold text-base mt-1 tabular-nums">{conv} €</p>
                          </div>
                          <div className="text-center bg-amber-50 rounded-lg py-2">
                            <p className="text-[10px] uppercase tracking-wider text-amber-700">Société</p>
                            <p className="text-amber-700 font-bold text-base mt-1 tabular-nums">{soc} €</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </Card>
              </div>
            )}

            {/* === SECTION TARIFICATION (B1) === */}
            <div className="mt-5 pt-5 border-t border-pro-border">
              <PricingModeBlock
                trajetId={selected.id}
                lockedClientPrice={linkedDevis?.prix_estime ?? null}
                lockedSourceLabel={linkedDevis ? `devis ${linkedDevis.numero}` : null}
                initial={{
                  pricing_mode: selected.pricing_mode ?? "fixe",
                  prix_client_ttc: selected.prix_client_ttc,
                  prix_convoyeur_fixe: selected.prix_convoyeur_fixe,
                  prix_convoyeur_min: selected.prix_convoyeur_min,
                  prix_convoyeur_max: selected.prix_convoyeur_max,
                  marge_indicative_pct: selected.marge_indicative_pct,
                }}
                onSaved={(next) => setSelected({ ...selected, ...next })}
              />
            </div>

            {/* === SECTION DIFFUSION === */}
            <div className="mt-5 pt-5 border-t border-pro-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-pro-text flex items-center gap-2">
                  <Gavel size={16} className="text-pro-accent" />
                  Diffusion & attribution
                </h3>
                <Badge
                  tone={
                    selected.statut_publication === "publie"
                      ? "success"
                      : selected.statut_publication === "attribue"
                      ? "info"
                      : "neutral"
                  }
                >
                  {selected.statut_publication === "publie"
                    ? "Publié"
                    : selected.statut_publication === "attribue"
                    ? "Attribué"
                    : "Brouillon"}
                </Badge>
              </div>

              {selected.statut_publication !== "attribue" && (
                <Card padded={false} className="mb-3">
                  <div className="p-3 space-y-3">
                    <FormField label="Prix suggéré aux convoyeurs (€)">
                      <TextInput
                        type="number"
                        value={prixSuggereInput}
                        onChange={(e) => setPrixSuggereInput(e.target.value)}
                        placeholder="ex: 250"
                      />
                    </FormField>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* PRIMARY : Catalogue public (visible par tous les convoyeurs validés) */}
                      <PublishToCatalogueButton
                        trajetId={selected.id}
                        onDone={() => { fetchTrajets(); setSelected({ ...selected, statut_publication: "publie" }); }}
                        variant="button"
                        label="Publier au catalogue public"
                      />

                      {/* SECONDARY : Attribution restreinte (ancien "Publier aux convoyeurs" — cercle admin uniquement) */}
                      {selected.statut_publication !== "publie" ? (
                        <Button
                          variant="secondary"
                          onClick={() => togglePublication(true)}
                          disabled={savingPub || !prixSuggereInput}
                          icon={<Send size={14} />}
                        >
                          Diffusion restreinte
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          onClick={() => togglePublication(false)}
                          disabled={savingPub}
                        >
                          Dépublier
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-pro-muted leading-relaxed">
                      <strong>Catalogue public</strong> : la mission apparaît instantanément dans l'onglet Catalogue de tous les convoyeurs validés (avec ou sans contre-offres).<br />
                      <strong>Diffusion restreinte</strong> : les convoyeurs de votre cercle interne reçoivent une notification.
                    </p>
                  </div>
                </Card>
              )}

              <p className="text-xs text-pro-muted mb-2">
                {offres.length} offre{offres.length > 1 ? "s" : ""} reçue{offres.length > 1 ? "s" : ""}
              </p>

              {offres.length === 0 ? (
                <div className="text-center py-6 text-pro-muted text-sm bg-pro-bg-soft/30 rounded-lg border border-dashed border-pro-border">
                  Aucune offre pour le moment.
                </div>
              ) : (
                <div className="space-y-2">
                  {offres.map((o) => (
                    <div
                      key={o.id}
                      className={`border rounded-lg p-3 ${
                        o.statut === "acceptee"
                          ? "border-emerald-200 bg-emerald-50/50"
                          : o.statut === "refusee" || o.statut === "retiree"
                          ? "border-pro-border bg-slate-50 opacity-60"
                          : "border-pro-border bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-pro-text text-sm">
                            {o.convoyeur?.prenom} {o.convoyeur?.nom}
                          </p>
                          <p className="text-pro-muted text-xs">
                            {o.convoyeur?.telephone} · {o.convoyeur?.email}
                          </p>
                          <p className="text-xs mt-1">
                            <span className="text-pro-muted">Type :</span>{" "}
                            {o.type_offre === "acceptation_directe" ? "Accepte le prix suggéré" : "Contre-proposition"}
                            {o.prix_suggere_snapshot != null && o.type_offre === "contre_proposition" && (
                              <span className="text-pro-muted"> (suggéré : {o.prix_suggere_snapshot} €)</span>
                            )}
                          </p>
                          {o.message && (
                            <p className="text-xs text-pro-text-soft mt-1 italic">"{o.message}"</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-emerald-700 font-bold text-lg leading-none">{o.prix_propose} €</p>
                          <Badge
                            tone={
                              o.statut === "acceptee"
                                ? "success"
                                : o.statut === "refusee" || o.statut === "retiree"
                                ? "neutral"
                                : "warning"
                            }
                          >
                            {o.statut === "en_attente"
                              ? "En attente"
                              : o.statut === "acceptee"
                              ? "Acceptée"
                              : o.statut === "refusee"
                              ? "Refusée"
                              : "Retirée"}
                          </Badge>
                        </div>
                      </div>
                      {o.admin_counter_offer != null && (
                        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/70 px-2 py-1.5 text-xs text-amber-900">
                          Contre-proposition envoyée : <strong>{o.admin_counter_offer} €</strong>
                          {o.admin_counter_at && (
                            <span className="text-amber-700"> · {new Date(o.admin_counter_at).toLocaleString("fr-FR")}</span>
                          )}
                        </div>
                      )}
                      {o.statut === "en_attente" && selected.statut_publication !== "attribue" && (
                        <div className="mt-3 pt-3 border-t border-pro-border space-y-2">
                          <div className="flex gap-2">
                            <Button
                              variant="success"
                              onClick={() => validerOffre(o)}
                              icon={<CheckCircle2 size={13} />}
                              className="flex-1"
                            >
                              Valider ce convoyeur
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => refuserOffre(o)}
                              icon={<XCircle size={13} />}
                            >
                              Refuser
                            </Button>
                          </div>
                          <div className="flex gap-2 items-center">
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="0.01"
                              placeholder="Contre-proposer (€)"
                              value={counterInputs[o.id] ?? ""}
                              onChange={(e) =>
                                setCounterInputs((prev) => ({ ...prev, [o.id]: e.target.value }))
                              }
                              className="flex-1 rounded-md border border-pro-border bg-white px-2 py-1.5 text-sm outline-none focus:border-pro-accent"
                            />
                            <Button
                              variant="secondary"
                              onClick={() => counterOffre(o)}
                              disabled={savingCounter === o.id}
                            >
                              {savingCounter === o.id ? "…" : "Contre-proposer"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
