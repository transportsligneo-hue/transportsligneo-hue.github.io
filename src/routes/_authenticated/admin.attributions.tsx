import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveGroupInvoiceBasis } from "@/lib/facture-group";

import { MapPin, RefreshCw, Eye, Clock, Image, FileText, Plus, Send, Receipt, Loader2, User, Truck, Car, CheckCircle2, XCircle, RotateCcw, Edit2, ExternalLink, Shield } from "lucide-react";
import { GpsMapView } from "@/components/GpsMapView";
import { MissionReport } from "@/components/MissionReport";
import { MissionDocuments } from "@/components/MissionDocuments";
import {
  PageHeader,
  Card,
  Badge,
  EmptyState,
  Modal,
  Button,
  IconButton,
  Select,
  attributionStatutTone,
} from "@/components/admin/AdminUI";
import { AdminDetailDrawer, DrawerSection, DrawerField, DrawerGrid, DrawerBadge } from "@/components/admin/AdminDetailDrawer";
import { AdminStepOverridesPanel } from "@/components/admin/AdminStepOverridesPanel";
import { AdminLiveControl } from "@/components/admin/AdminLiveControl";
import { InspectionPreuvesBlock } from "@/components/admin/drawers/InspectionPreuvesBlock";
import { AssignDriverDialog } from "@/components/admin/AssignDriverDialog";
import { PublishToCatalogueButton } from "@/components/admin/PublishToCatalogueButton";
import { CreateTestMissionButton, TestBadge, DeleteTestMissionButton } from "@/components/admin/TestMissionActions";
import { generateFacturePdf, downloadFacturePdf } from "@/lib/facture-pdf";
import { updateAdminMissionStatus } from "@/lib/adminMissionStatus";
import { missionNumberOf, displayTrajetRef, displayNumero, stripLegSuffix, hasLegSuffix, shortMissionSeq } from "@/lib/mission-number";
import { LegSuffixLegend } from "@/components/admin/LegSuffixLegend";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";

export const Route = createFileRoute("/_authenticated/admin/attributions")({
  validateSearch: (search: Record<string, unknown>) => ({
    trajet: typeof search.trajet === "string" ? search.trajet : undefined,
  }),
  component: AdminAttributions,
});


interface Attribution {
  id: string;
  trajet_id: string;
  convoyeur_id: string;
  statut: string;
  etape_courante?: string | null;
  numero_mission?: string | null;
  created_at: string;
  trajet?: { depart: string; arrivee: string; date_trajet: string | null; statut: string; statut_publication?: string | null; client_nom?: string | null; type_transport?: string | null; is_test_data?: boolean | null; mission_group_id?: string | null; leg_type?: string | null; leg_index?: number | null };
  convoyeur?: { nom: string; prenom: string };
}

interface Trajet {
  id: string;
  depart: string;
  arrivee: string;
  date_trajet: string | null;
  statut: string;
  statut_publication?: string | null;
  attribution_mode?: string | null;
  client_nom?: string | null;
  marque?: string | null;
  modele?: string | null;
  prix_client?: number | null;
  is_test_data?: boolean | null;
}

interface GpsPoint {
  latitude: number;
  longitude: number;
  recorded_at: string;
  accuracy: number | null;
}

interface InspectionPhoto {
  vue_type: string;
  url_photo: string;
  created_at: string;
}

const statutLabels: Record<string, string> = {
  propose: "Proposé",
  accepte: "Accepté",
  refuse: "Refusé",
  en_cours: "En cours",
  en_attente_validation: "En attente validation",
  validee: "Validée",
  refusee: "Refusée",
  termine: "Terminé",
  annule: "Annulé",
};

const vueLabels: Record<string, string> = {
  // Parcours séquentiel — ordre métier 18 étapes
  trois_quart_avant_gauche:   "01. 3/4 avant gauche",
  jante_avant_gauche:         "02. Jante avant gauche",
  jante_arriere_gauche:       "03. Jante arrière gauche",
  trois_quart_arriere_gauche: "04. 3/4 arrière gauche",
  arriere:                    "05. Arrière",
  coffre_ouvert:              "06. Coffre ouvert",
  roue_secours:               "07. Roue de secours / kit",
  trois_quart_arriere_droite: "08. 3/4 arrière droite",
  jante_arriere_droite:       "09. Jante arrière droite",
  siege_arriere:              "10. Sièges arrière",
  jante_avant_droite:         "11. Jante avant droite",
  trois_quart_avant_droite:   "12. 3/4 avant droite",
  siege_avant:                "13. Sièges avant",
  compteur:                   "14. Compteur (km + carburant)",
  photos_cles:                "15. Clés du véhicule",
  kit_securite:               "16. Kit de sécurité",
  pv_livraison:               "16. PV livraison / restitution",
  carte_grise:                "17. Carte grise",
  signature:                  "18. Signature client",
  // Legacy (anciennes inspections — conservés pour rétrocompatibilité)
  devant: "Avant",
  avant: "Avant",
  avant_droit: "Avant droit 3/4",
  cote_droit: "Côté droit",
  arriere_droit: "Arrière droit 3/4",
  arriere_gauche: "Arrière gauche 3/4",
  cote_gauche: "Côté gauche",
  avant_gauche: "Avant gauche 3/4",
  interieur_avant: "Intérieur avant",
  interieur_arriere: "Intérieur arrière",
  tableau_bord: "Tableau de bord",
  coffre_ferme: "Coffre fermé",
  jantes: "Jantes",
  cable: "Câble de recharge",
  documents: "Documents",
};

/** Normalise un vue_type (peut être "devant" ou "devant_<timestamp>" pour multi-photos) */
function vueLabelFor(vueType: string): string {
  if (vueLabels[vueType]) return vueLabels[vueType];
  // Strip timestamp suffix : "devant_1729600000000" → "devant"
  const m = vueType.match(/^([a-z_]+?)(?:_\d{10,})?$/);
  if (m && vueLabels[m[1]]) return vueLabels[m[1]];
  return vueType;
}

function AdminAttributions() {
  const navigate = useNavigate();
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [trajetsDisponibles, setTrajetsDisponibles] = useState<Trajet[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [assignTrajet, setAssignTrajet] = useState<Trajet | null>(null);
  const [gpsView, setGpsView] = useState<{ id: string; points: GpsPoint[] } | null>(null);
  const [photosView, setPhotosView] = useState<{ id: string; type: string; photos: InspectionPhoto[] } | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [expandedDocs, setExpandedDocs] = useState<string | null>(null);
  const [invoicingId, setInvoicingId] = useState<string | null>(null);
  const [selectedAttr, setSelectedAttr] = useState<Attribution | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [attrDetail, setAttrDetail] = useState<{ vin?: string | null; carte_grise_recto_url?: string | null; carte_grise_verso_url?: string | null; marque?: string | null; modele?: string | null; immatriculation?: string | null; client_email?: string | null; client_telephone?: string | null; prix?: number | null; numero_mission?: string | null; etape_courante?: string | null; cgRectoSigned?: string | null; cgVersoSigned?: string | null } | null>(null);

  useEffect(() => {
    if (!selectedAttr) { setAttrDetail(null); return; }
    let cancelled = false;
    (async () => {
      const [{ data: t }, { data: a }] = await Promise.all([
        supabase.from("trajets").select("vin, carte_grise_recto_url, carte_grise_verso_url, marque, modele, immatriculation, client_email, client_telephone, prix").eq("id", selectedAttr.trajet_id).maybeSingle(),
        supabase.from("attributions").select("numero_mission, etape_courante").eq("id", selectedAttr.id).maybeSingle(),
      ]);
      const sign = async (path: string | null | undefined) => {
        if (!path) return null;
        if (/^https?:\/\//.test(path)) return path;
        const { data } = await supabase.storage.from("cartes-grises").createSignedUrl(path, 3600);
        return data?.signedUrl ?? null;
      };
      const [cgRectoSigned, cgVersoSigned] = await Promise.all([
        sign(t?.carte_grise_recto_url),
        sign(t?.carte_grise_verso_url),
      ]);
      if (cancelled) return;
      setAttrDetail({
        ...(t ?? {}),
        ...(a ?? {}),
        cgRectoSigned,
        cgVersoSigned,
      });
    })();
    return () => { cancelled = true; };
  }, [selectedAttr]);

  const handleEmitFacture = async (a: Attribution) => {
    setInvoicingId(a.id);
    try {
      // 1. Refuse si une facture existe déjà (y compris sur l'autre segment d'un aller-retour)
      const basis = await resolveGroupInvoiceBasis(a.trajet_id);
      if (basis.existing) {
        toast.info("Facture déjà émise", { description: basis.existing.numero });
        return;
      }

      // 2. Charge trajet
      const { data: trajet, error: tErr } = await supabase
        .from("trajets")
        .select("id, depart, arrivee, date_trajet, client_email, client_nom, client_telephone, marque, modele, immatriculation, prix, devis_id, demande_id")
        .eq("id", a.trajet_id)
        .maybeSingle();
      if (tErr || !trajet) throw new Error("Trajet introuvable");

      // 2bis. Fallback email : devis -> demande -> mission -> profile (via user_id)
      let clientEmail = (trajet.client_email ?? "").trim();
      let clientNom = trajet.client_nom ?? "";
      if (!clientEmail && trajet.devis_id) {
        const { data: dv } = await supabase
          .from("devis").select("email, nom, prenom").eq("id", trajet.devis_id).maybeSingle();
        if (dv?.email) clientEmail = dv.email;
        if (!clientNom && dv) clientNom = `${dv.prenom ?? ""} ${dv.nom ?? ""}`.trim();
      }
      if (!clientEmail && trajet.demande_id) {
        const { data: dc } = await supabase
          .from("demandes_convoyage").select("email, nom, prenom").eq("id", trajet.demande_id).maybeSingle();
        if (dc?.email) clientEmail = dc.email;
        if (!clientNom && dc) clientNom = `${dc.prenom ?? ""} ${dc.nom ?? ""}`.trim();
      }
      if (!clientEmail) {
        const { data: mis } = await supabase
          .from("missions").select("email, user_id").eq("numero", a.numero_mission ?? "").maybeSingle();
        if (mis?.email) clientEmail = mis.email;
        if (!clientEmail && mis?.user_id) {
          const { data: pr } = await supabase
            .from("profiles").select("email, nom, prenom").eq("user_id", mis.user_id).maybeSingle();
          if (pr?.email) clientEmail = pr.email;
          if (!clientNom && pr) clientNom = `${pr.prenom ?? ""} ${pr.nom ?? ""}`.trim();
        }
      }
      if (!clientEmail) throw new Error("Email client introuvable (trajet, devis, demande, mission, profil) — renseignez l'email client sur le trajet");
      trajet.client_email = clientEmail;
      trajet.client_nom = clientNom || trajet.client_nom;

      const prixTTC = basis.totalTtc > 0 ? basis.totalTtc : Number(trajet.prix ?? 0);
      // Régime micro-entreprise (franchise en base) : le prix affiché est le net à payer.
      const { regime: regimeFact, vatRate: tauxFact } = await fetchActiveRegime();
      const microFact = regimeFact !== "societe";
      const prixHT = microFact ? prixTTC : (prixTTC > 0 ? prixTTC / (1 + tauxFact / 100) : 0);
      const prixTVA = +(prixTTC - prixHT).toFixed(2);

      const isB2B = false; // par défaut particulier (B2B = via factures B2B flow)

      // 3. Insertion — trigger remplit numero automatiquement
      const today = new Date();
      const echeance = new Date(today.getTime() + 30 * 86400000);
      const [prenom, ...rest] = (trajet.client_nom || "").trim().split(/\s+/);
      const nomFamille = rest.join(" ") || prenom || "Client";

      const { data: inserted, error: iErr } = await supabase
        .from("factures")
        .insert({
          numero: "AUTO", // remplacé par le trigger
          type_facture: isB2B ? "b2b" : "particulier",
          attribution_id: a.id,
          mission_id: trajet.id,
          client_email: trajet.client_email,
          client_nom: nomFamille,
          client_prenom: rest.length ? prenom : null,
          date_facture: today.toISOString().slice(0, 10),
          date_mission: trajet.date_trajet,
          date_echeance: echeance.toISOString().slice(0, 10),
          mode_paiement: "Virement bancaire",
          designation: basis.isGroup
            ? "Prestation de convoyage automobile — livraison + restitution"
            : "Prestation de convoyage automobile",
          depart: basis.depart ?? trajet.depart,
          arrivee: basis.arrivee ?? trajet.arrivee,

          prix_ht: +prixHT.toFixed(2),
          prix_tva: prixTVA,
          prix_ttc: prixTTC,
          tva_taux: 20,
          statut: "emise",
        })
        .select("*")
        .single();
      if (iErr || !inserted) throw new Error(iErr?.message || "Insertion impossible");

      // 4. PDF + téléchargement
      const blob = await generateFacturePdf({
        numero: inserted.numero,
        type_facture: inserted.type_facture as "particulier" | "b2b",
        date_facture: inserted.date_facture,
        date_mission: inserted.date_mission,
        date_echeance: inserted.date_echeance,
        mode_paiement: inserted.mode_paiement,
        conditions_paiement: inserted.conditions_paiement,
        client_nom: inserted.client_nom,
        client_prenom: inserted.client_prenom,
        client_societe: inserted.client_societe,
        client_email: inserted.client_email,
        client_adresse: inserted.client_adresse,
        client_siret: inserted.client_siret,
        client_tva: inserted.client_tva,
        designation: inserted.designation,
        depart: inserted.depart,
        arrivee: inserted.arrivee,
        distance_km: inserted.distance_km,
        prix_ht: Number(inserted.prix_ht),
        tva_taux: Number(inserted.tva_taux),
        prix_tva: Number(inserted.prix_tva),
        prix_ttc: Number(inserted.prix_ttc),
      });
      downloadFacturePdf(blob, inserted.numero);
      toast.success(`Facture ${inserted.numero} émise`);
    } catch (e) {
      toast.error("Impossible d'émettre la facture", { description: (e as Error).message });
    } finally {
      setInvoicingId(null);
    }
  };

  const arBaseByGroup = useMemo(() => {
    const map = new Map<string, string>();
    attributions.forEach((a) => {
      const gid = a.trajet?.mission_group_id;
      if (!gid || !a.numero_mission) return;
      const base = stripLegSuffix(a.numero_mission);
      const isAller = (a.trajet?.leg_index ?? 1) === 1 || a.trajet?.leg_type === "aller";
      const cur = map.get(gid);
      if (!cur || isAller || base < cur) map.set(gid, isAller ? base : cur ?? base);
    });
    return map;
  }, [attributions]);

  type GroupedItem =
    | { kind: "group"; gid: string; seq: string; items: Attribution[] }
    | { kind: "single"; a: Attribution };

  const groupedAttributions = useMemo<GroupedItem[]>(() => {
    const out: GroupedItem[] = [];
    const seen = new Set<string>();
    attributions.forEach((a) => {
      const gid = a.trajet?.mission_group_id ?? null;
      if (!gid) { out.push({ kind: "single", a }); return; }
      if (seen.has(gid)) return;
      seen.add(gid);
      const items = attributions
        .filter((x) => x.trajet?.mission_group_id === gid)
        .sort((x, y) => ((x.trajet?.leg_index ?? (x.trajet?.leg_type === "retour" ? 2 : 1)) - (y.trajet?.leg_index ?? (y.trajet?.leg_type === "retour" ? 2 : 1))));
      if (items.length < 2) { out.push({ kind: "single", a }); return; }
      const seq = shortMissionSeq(arBaseByGroup.get(gid) ?? a.numero_mission ?? "");
      out.push({ kind: "group", gid, seq, items });
    });
    return out;
  }, [attributions, arBaseByGroup]);

  const fetchAttributions = useCallback(async () => {
    const { data, error } = await supabase
      .from("attributions")
      .select("id, trajet_id, convoyeur_id, statut, etape_courante, numero_mission, created_at, trajet:trajets(depart, arrivee, date_trajet, statut, statut_publication, client_nom, is_test_data, mission_group_id, leg_type, leg_index), convoyeur:convoyeurs(nom, prenom)")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[admin.attributions] fetch error", error);
      // Fallback : recharger sans embed pour ne pas casser la page si un FK ou cache PostgREST pose problème
      const { data: bare, error: bareErr } = await supabase
        .from("attributions")
        .select("id, trajet_id, convoyeur_id, statut, etape_courante, numero_mission, created_at")
        .order("created_at", { ascending: false });
      if (bareErr) {
        toast.error("Impossible de charger les attributions", { description: bareErr.message });
        return;
      }
      setAttributions((bare ?? []) as unknown as Attribution[]);
      return;
    }
    setAttributions((data ?? []) as unknown as Attribution[]);
  }, []);

  const fetchOptions = useCallback(async () => {
    // Charge tous les trajets publiables/en attente qui n'ont PAS encore d'attribution active.
    // Permet de surfacer immédiatement les demandes converties dans la page Attribution.
    const { data: trajets } = await supabase
      .from("trajets")
      .select("id, depart, arrivee, date_trajet, statut, statut_publication, attribution_mode, client_nom, marque, modele, prix_client, is_test_data")
      .in("statut", ["en_attente", "attribue"])
      .order("date_trajet", { ascending: true, nullsFirst: false });
    if (!trajets) return;

    // Fix : les trajets publiés au catalogue restent visibles (badge "Au catalogue"),
    // l'admin peut reprendre la main pour attribuer manuellement (mode mixte).
    const assignableTrajets = trajets as Trajet[];

    // Filtre côté client : retire les trajets ayant déjà une attribution non annulée
    const ids = assignableTrajets.map((t) => t.id);
    if (ids.length === 0) { setTrajetsDisponibles([]); return; }
    const { data: existing } = await supabase
      .from("attributions")
      .select("trajet_id, statut")
      .in("trajet_id", ids);
    const busy = new Set((existing ?? [])
      .filter((a) => !["annule", "refusee", "refuse"].includes(a.statut))
      .map((a) => a.trajet_id));
    setTrajetsDisponibles(assignableTrajets.filter((t) => !busy.has(t.id)) as Trajet[]);
  }, []);

  useEffect(() => {
    fetchAttributions();
    fetchOptions();
  }, [fetchAttributions, fetchOptions]);

  // Deep-link depuis le panneau Missions (admin) : ?trajet=<id> ouvre directement l'attribution
  const { trajet: trajetParam } = Route.useSearch();
  const [deepLinkDone, setDeepLinkDone] = useState(false);
  useEffect(() => {
    if (!trajetParam || deepLinkDone || trajetsDisponibles.length === 0) return;
    const target = trajetsDisponibles.find((t) => t.id === trajetParam);
    if (target) {
      setAssignTrajet(target);
      setDeepLinkDone(true);
    }
  }, [trajetParam, trajetsDisponibles, deepLinkDone]);



  useEffect(() => {
    const channel = supabase
      .channel("gps-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mission_locations" },
        (payload) => {
          if (gpsView && payload.new.attribution_id === gpsView.id) {
            setGpsView((prev) =>
              prev
                ? {
                    ...prev,
                    points: [...prev.points, payload.new as unknown as GpsPoint],
                  }
                : null,
            );
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gpsView?.id]);

  const updateStatut = async (attribution: Attribution, statut: string, options?: { resetStep?: boolean; note?: string }) => {
    const actionKey = `${attribution.id}-${statut}`;
    setBusyAction(actionKey);
    try {
      const payload = await updateAdminMissionStatus({
        attributionId: attribution.id,
        trajetId: attribution.trajet_id,
        statut,
        note: options?.note,
        resetStep: options?.resetStep,
      });

      if (selectedAttr?.id === attribution.id) {
        setSelectedAttr((prev) => (prev ? { ...prev, statut, etape_courante: payload.etape_courante as string | null | undefined ?? prev.etape_courante } : prev));
      }

      toast.success(`Attribution mise à jour : ${statutLabels[statut] ?? statut}`);
      await Promise.all([fetchAttributions(), fetchOptions()]);
    } catch (error) {
      toast.error("Impossible de mettre à jour l'attribution", {
        description: error instanceof Error ? error.message : "Réessayez dans quelques secondes.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const renderAttributionActions = (attribution: Attribution) => {
    const buttons: Array<{ key: string; label: string; icon: typeof CheckCircle2; variant: "secondary" | "success" | "danger"; onClick: () => void }> = [];

    if (attribution.statut === "propose") {
      buttons.push({ key: "confirm", label: "Confirmer", icon: CheckCircle2, variant: "success", onClick: () => void updateStatut(attribution, "accepte", { note: "Attribution confirmée par l'admin" }) });
      buttons.push({ key: "refuse", label: "Refuser", icon: XCircle, variant: "danger", onClick: () => void updateStatut(attribution, "refusee", { note: "Attribution refusée par l'admin" }) });
    }

    if (["propose", "accepte", "en_cours", "en_attente_validation", "refusee", "annule"].includes(attribution.statut)) {
      buttons.push({ key: "edit", label: "Modifier", icon: Edit2, variant: "secondary", onClick: () => setAssignTrajet({ id: attribution.trajet_id, depart: attribution.trajet?.depart ?? "", arrivee: attribution.trajet?.arrivee ?? "", date_trajet: attribution.trajet?.date_trajet ?? null, statut: attribution.trajet?.statut ?? "attribue" }) });
    }

    if (attribution.statut === "en_attente_validation") {
      buttons.push({ key: "validate", label: "Valider", icon: CheckCircle2, variant: "success", onClick: () => void updateStatut(attribution, "validee", { note: "Mission validée par l'admin" }) });
    }

    if (!["annule", "validee", "termine"].includes(attribution.statut)) {
      buttons.push({ key: "cancel", label: "Annuler", icon: XCircle, variant: "danger", onClick: async () => {
        if (!(await confirmToast("Annuler définitivement cette mission ?"))) return;
        void updateStatut(attribution, "annule", { note: "Mission annulée par l'admin" });
      } });
    }

    if (["refusee", "annule"].includes(attribution.statut)) {
      buttons.push({ key: "reset", label: "Réinitialiser", icon: RotateCcw, variant: "secondary", onClick: () => void updateStatut(attribution, "propose", { resetStep: true, note: "Attribution réinitialisée par l'admin" }) });
    }

    return buttons.map((action) => (
      <Button
        key={action.key}
        size="sm"
        variant={action.variant}
        icon={<action.icon size={12} />}
        onClick={action.onClick}
        disabled={busyAction === `${attribution.id}-${action.key}` || busyAction === `${attribution.id}-${action.key === "confirm" ? "accepte" : action.key === "refuse" ? "refusee" : action.key === "cancel" ? "annule" : action.key === "validate" ? "validee" : action.key === "reset" ? "propose" : attribution.statut}`}
      >
        {action.label}
      </Button>
    ));
  };

  const viewGps = async (attributionId: string) => {
    const { data } = await supabase
      .from("mission_locations")
      .select("latitude, longitude, recorded_at, accuracy")
      .eq("attribution_id", attributionId)
      .order("recorded_at", { ascending: true });
    setGpsView({ id: attributionId, points: data || [] });
  };

  const viewPhotos = async (attributionId: string, type: string) => {
    const { data: inspection } = await supabase
      .from("inspections")
      .select("id")
      .eq("attribution_id", attributionId)
      .eq("type", type)
      .maybeSingle();
    if (!inspection) {
      setPhotosView({ id: attributionId, type, photos: [] });
      return;
    }
    const { data: photos } = await supabase
      .from("inspection_photos")
      .select("vue_type, url_photo, created_at")
      .eq("inspection_id", inspection.id)
      .order("created_at", { ascending: true });

    // Génère des signed URLs en LOT pour le bucket privé inspection-photos
    const rows = photos ?? [];
    const pathsToSign = Array.from(new Set(rows.filter(p => !/^https?:\/\//i.test(p.url_photo)).map(p => p.url_photo)));
    const signedMap = new Map<string, string>();
    if (pathsToSign.length) {
      const { data: signed } = await supabase.storage.from("inspection-photos").createSignedUrls(pathsToSign, 3600);
      (signed ?? []).forEach((s, idx) => { if (s?.signedUrl) signedMap.set(pathsToSign[idx], s.signedUrl); });
    }
    const enriched = rows.map(p => /^https?:\/\//i.test(p.url_photo) ? p : { ...p, url_photo: signedMap.get(p.url_photo) ?? p.url_photo });
    setPhotosView({ id: attributionId, type, photos: enriched });
  };

  const renderAttributionCard = (a: Attribution) => (
            <Card key={a.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => navigate({ to: "/admin/missions/$missionId", params: { missionId: a.id } })}
                onKeyDown={(e) => { if (e.key === "Enter") navigate({ to: "/admin/missions/$missionId", params: { missionId: a.id } }); }}
                className="cursor-pointer -m-1 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-pro-accent/40"
                title="Ouvrir le menu complet de la mission"
              >
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-pro-text font-semibold">
                      {attributionRef(a, arBaseByGroup)}
                    </p>
                    {!a.trajet?.mission_group_id && hasLegSuffix(a.numero_mission) && (
                      <span className="text-[11px] text-indigo-700" title="Ces deux volets ont été dissociés">
                        Ancien duo Livraison–Restitution
                      </span>
                    )}
                    <Badge tone={attributionStatutTone[a.statut] ?? "neutral"}>
                      {statutLabels[a.statut] ?? a.statut}
                    </Badge>
                    {a.trajet?.is_test_data && <TestBadge />}
                    {a.trajet?.type_transport && (
                      <span className="text-[10px] uppercase tracking-wider text-pro-muted">
                        {a.trajet.type_transport}
                      </span>
                    )}
                  </div>
                  <p className="text-pro-text-soft text-sm mt-1">
                    {a.trajet ? `${a.trajet.depart} → ${a.trajet.arrivee}` : "Trajet non renseigné"}
                  </p>
                  <p className="text-pro-muted text-xs mt-1">
                    Client : <span className="text-pro-text-soft">{a.trajet?.client_nom || "Non renseigné"}</span>
                    {" · "}Convoyeur : <span className="text-pro-text-soft">{a.convoyeur ? `${a.convoyeur.prenom} ${a.convoyeur.nom}` : "Non renseigné"}</span>
                    {a.trajet?.date_trajet && (
                      <> · {new Date(a.trajet.date_trajet).toLocaleDateString("fr-FR")}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                  {renderAttributionActions(a)}
                  <IconButton
                    onClick={() => setSelectedAttr(a)}
                    title="Aperçu rapide (panneau latéral)"
                    tone="primary"
                  >
                    <Eye size={15} />
                  </IconButton>
                  <IconButton onClick={() => viewGps(a.id)} title="Suivi GPS" tone="primary">
                    <MapPin size={15} />
                  </IconButton>
                  <IconButton onClick={() => viewPhotos(a.id, "depart")} title="Photos départ" tone="primary">
                    <Eye size={15} />
                  </IconButton>
                  <IconButton onClick={() => viewPhotos(a.id, "arrivee")} title="Photos arrivée" tone="success">
                    <Image size={15} />
                  </IconButton>
                  <IconButton onClick={() => setReportId(a.id)} title="Rapport mission" tone="primary">
                    <FileText size={15} />
                  </IconButton>
                  {(a.statut === "termine" || a.statut === "validee") && (
                    <IconButton
                      onClick={() => handleEmitFacture(a)}
                      title="Émettre la facture"
                      tone="success"
                      disabled={invoicingId === a.id}
                    >
                      {invoicingId === a.id ? <Loader2 size={15} className="animate-spin" /> : <Receipt size={15} />}
                    </IconButton>
                  )}
                  {a.trajet?.is_test_data && (
                    <DeleteTestMissionButton
                      trajetId={a.trajet_id}
                      compact
                      onDeleted={() => { fetchAttributions(); fetchOptions(); }}
                    />
                  )}
                </div>
              </div>
              </div>

              <div className="mt-3 pt-3 border-t border-pro-border" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setExpandedDocs(expandedDocs === a.id ? null : a.id)}
                  className="flex items-center gap-1.5 text-xs text-pro-text-soft hover:text-pro-accent transition-colors"
                >
                  <FileText size={12} />
                  Documents
                  <span className="text-[10px] ml-1">{expandedDocs === a.id ? "▲" : "▼"}</span>
                </button>
                {expandedDocs === a.id && (
                  <div className="mt-2">
                    <MissionDocuments attributionId={a.id} userId="" isAdmin />
                  </div>
                )}
              </div>
            </Card>
  );

  return (
    <div>
      <PageHeader
        title="Attributions"
        subtitle={`${attributions.length} attribution${attributions.length > 1 ? "s" : ""}`}
        actions={
          <>
            <CreateTestMissionButton onCreated={() => { fetchOptions(); fetchAttributions(); }} />
            <Button
              icon={<Plus size={14} />}
              onClick={() => {
                fetchOptions();
                setShowCreate(true);
              }}
            >
              Attribuer un trajet
            </Button>
            <IconButton onClick={fetchAttributions} title="Actualiser">
              <RefreshCw size={15} />
            </IconButton>
          </>
        }
      />

      {/* === Section "À attribuer" : trajets convertis sans convoyeur === */}
      {trajetsDisponibles.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-amber-900">
              À attribuer · {trajetsDisponibles.length} trajet{trajetsDisponibles.length > 1 ? "s" : ""} en attente
            </p>
            <span className="text-[10px] uppercase tracking-wider text-amber-700">Issus des devis convertis</span>
          </div>
          <div className="space-y-2">
            {trajetsDisponibles.map((t) => {
              const isPublished = t.statut_publication === "publie" && ["catalogue", "mixte"].includes(t.attribution_mode ?? "");
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-white border border-amber-100 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-pro-text truncate">
                        {t.depart} → {t.arrivee}
                      </p>
                      {t.is_test_data && <TestBadge />}
                      {isPublished && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border border-emerald-300 bg-emerald-50 text-emerald-700">
                          Au catalogue
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-pro-text-soft mt-0.5 truncate">
                      {t.client_nom || "Client non renseigné"}
                      {(t.marque || t.modele) && ` · ${[t.marque, t.modele].filter(Boolean).join(" ")}`}
                      {t.date_trajet && ` · ${new Date(t.date_trajet).toLocaleDateString("fr-FR")}`}
                      {t.prix_client != null && ` · ${Number(t.prix_client).toFixed(0)} €`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-40">
                      <PublishToCatalogueButton
                        trajetId={t.id}
                        variant="ghost"
                        label={isPublished ? "Republier" : "Publier au catalogue"}
                        onDone={() => fetchOptions()}
                      />
                    </div>
                    <Button size="sm" variant="success" icon={<Send size={12} />} onClick={() => setAssignTrajet(t)}>
                      Attribuer
                    </Button>
                    {t.is_test_data && (
                      <DeleteTestMissionButton
                        trajetId={t.id}
                        compact
                        onDeleted={() => { fetchOptions(); fetchAttributions(); }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <LegSuffixLegend className="mb-3" />

      {attributions.length === 0 ? (
        <EmptyState icon={Send} title="Aucune attribution" description="Attribuez un trajet à un convoyeur pour commencer." />
      ) : (
        <div className="space-y-3">
          {groupedAttributions.map((item) =>
            item.kind === "group" ? (
              <div key={item.gid} className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 p-3">
                <div className="mb-2.5 flex flex-wrap items-center gap-2 px-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                    <ArrowLeftRight size={12} /> Duo Livraison–Restitution
                  </span>
                  <span className="text-[11px] text-pro-text-soft">
                    Livraison {item.items[0]?.numero_mission ? displayNumero(item.items[0].numero_mission) : "—"} + Restitution{" "}
                    {item.items[1]?.numero_mission ? displayNumero(item.items[1].numero_mission) : "—"} — liées tant qu'elles ne sont pas dissociées
                  </span>
                </div>

                <div className="space-y-2">{item.items.map(renderAttributionCard)}</div>
              </div>
            ) : (
              renderAttributionCard(item.a)
            ),
          )}
        </div>
      )}

      {/* Étape 1 : choix du trajet à assigner */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Choisir un trajet à attribuer" size="md">
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {trajetsDisponibles.length === 0 ? (
            <p className="text-sm text-pro-muted text-center py-6">Aucun trajet en attente.</p>
          ) : (
            trajetsDisponibles.map((t) => (
              <div
                key={t.id}
                className="w-full p-3 rounded-xl border border-pro-border hover:border-pro-gold/40 hover:bg-pro-bg-soft/50 transition-all flex items-center gap-3"
              >
                <button
                  onClick={() => {
                    setAssignTrajet(t);
                    setShowCreate(false);
                  }}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-pro-text">
                      {t.depart} → {t.arrivee}
                    </p>
                    {t.is_test_data && <TestBadge />}
                    {t.statut_publication === "publie" && ["catalogue", "mixte"].includes(t.attribution_mode ?? "") && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border border-emerald-300 bg-emerald-50 text-emerald-700">
                        Au catalogue
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-pro-text-soft mt-0.5">
                    {t.date_trajet
                      ? new Date(t.date_trajet).toLocaleDateString("fr-FR")
                      : "Date à définir"}{" "}
                    · {statutLabels[t.statut] ?? t.statut}
                  </p>
                </button>
                <div className="shrink-0 w-44" onClick={(e) => e.stopPropagation()}>
                  <PublishToCatalogueButton
                    trajetId={t.id}
                    label="Catalogue"
                    onDone={() => {
                      toast.success("Mission publiée au catalogue");
                      setShowCreate(false);
                      fetchOptions();
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Étape 2 : assignation premium */}
      {assignTrajet && (
        <AssignDriverDialog
          open={!!assignTrajet}
          onClose={() => setAssignTrajet(null)}
          trip={{
            id: assignTrajet.id,
            depart: assignTrajet.depart,
            arrivee: assignTrajet.arrivee,
            date: assignTrajet.date_trajet,
            source: "trajet",
          }}
          onAssigned={(t) => {
            toast.success(`Trajet assigné à ${t.label}`);
            fetchAttributions();
            fetchOptions();
          }}
        />
      )}

      {/* GPS modal */}
      <Modal open={!!gpsView} onClose={() => setGpsView(null)} title="Suivi GPS en temps réel" size="lg">
        {gpsView && gpsView.points.length === 0 ? (
          <p className="text-pro-muted text-sm">Aucune position enregistrée.</p>
        ) : gpsView ? (
          <div className="space-y-3">
            <GpsMapView points={gpsView.points} className="h-[400px]" />
            <div className="flex items-center justify-between text-xs text-pro-text-soft">
              <span>{gpsView.points.length} position(s) enregistrée(s)</span>
              <a
                href={`https://www.google.com/maps/dir/${gpsView.points
                  .map((p) => `${p.latitude},${p.longitude}`)
                  .join("/")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-pro-accent hover:underline"
              >
                <MapPin size={12} /> Google Maps
              </a>
            </div>
            <div className="max-h-32 overflow-auto space-y-1">
              {gpsView.points
                .slice(-10)
                .reverse()
                .map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-xs text-pro-text-soft py-1.5 px-2 rounded bg-pro-bg-soft/50"
                  >
                    <Clock size={11} className="text-pro-accent shrink-0" />
                    <span>{new Date(p.recorded_at).toLocaleTimeString("fr-FR")}</span>
                    <span className="text-pro-muted">|</span>
                    <span>
                      {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                    </span>
                    {p.accuracy && <span className="text-pro-muted">±{Math.round(p.accuracy)}m</span>}
                  </div>
                ))}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Photos modal */}
      <Modal
        open={!!photosView}
        onClose={() => setPhotosView(null)}
        title={`Photos — État des lieux ${photosView?.type === "depart" ? "départ" : "arrivée"}`}
        size="lg"
      >
        {photosView && photosView.photos.length === 0 ? (
          <p className="text-pro-muted text-sm">Aucune photo pour cet état des lieux.</p>
        ) : photosView ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {photosView.photos.map((p) => (
              <div key={p.vue_type} className="space-y-1">
                <a href={p.url_photo} target="_blank" rel="noopener noreferrer">
                  <img
                    src={p.url_photo}
                    alt={vueLabelFor(p.vue_type)}
                    className="w-full aspect-[3/4] object-cover rounded-md border border-pro-border"
                  />
                </a>
                <p className="text-pro-text-soft text-xs text-center">
                  {vueLabelFor(p.vue_type)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </Modal>

      {/* Mission Report Modal */}
      {reportId && <MissionReport attributionId={reportId} onClose={() => setReportId(null)} />}

      {/* Drawer bleu — détail attribution */}
      {selectedAttr && (
        <AdminDetailDrawer
          open={!!selectedAttr}
          onClose={() => setSelectedAttr(null)}
          title={missionNumberOf({ id: selectedAttr.id, created_at: selectedAttr.created_at, numero_mission: attrDetail?.numero_mission })}
          subtitle={selectedAttr.trajet ? `${selectedAttr.trajet.depart} → ${selectedAttr.trajet.arrivee}` : undefined}
          badge={
            <DrawerBadge tone={selectedAttr.statut === "termine" || selectedAttr.statut === "validee" ? "green" : selectedAttr.statut === "en_cours" ? "blue" : "amber"}>
              {statutLabels[selectedAttr.statut] ?? selectedAttr.statut}
            </DrawerBadge>
          }
          footer={
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="success"
                icon={<ExternalLink size={12} />}
                onClick={() => navigate({ to: "/admin/missions/$missionId", params: { missionId: selectedAttr.id } })}
              >
                Menu complet mission
              </Button>
              <Button size="sm" onClick={() => setReportId(selectedAttr.id)} icon={<FileText size={12} />}>Rapport mission</Button>
              <Button size="sm" onClick={() => viewGps(selectedAttr.id)} icon={<MapPin size={12} />}>Suivi GPS</Button>
              <Button size="sm" onClick={() => viewPhotos(selectedAttr.id, "depart")} icon={<Image size={12} />}>Photos départ</Button>
              <Button size="sm" onClick={() => viewPhotos(selectedAttr.id, "arrivee")} icon={<Image size={12} />}>Photos arrivée</Button>
            </div>
          }
        >
          <DrawerSection title="Convoyeur" icon={<User size={12} />}>
            <DrawerGrid>
              <DrawerField label="Nom" value={selectedAttr.convoyeur ? `${selectedAttr.convoyeur.prenom} ${selectedAttr.convoyeur.nom}` : null} />
              <DrawerField label="Étape courante" value={attrDetail?.etape_courante} />
            </DrawerGrid>
          </DrawerSection>

          <DrawerSection title="Trajet" icon={<MapPin size={12} />}>
            <DrawerGrid>
              <DrawerField label="Départ" value={selectedAttr.trajet?.depart} />
              <DrawerField label="Arrivée" value={selectedAttr.trajet?.arrivee} />
              <DrawerField label="Date" value={selectedAttr.trajet?.date_trajet ? new Date(selectedAttr.trajet.date_trajet).toLocaleDateString("fr-FR") : null} />
              <DrawerField label="Prix client" value={attrDetail?.prix ? `${attrDetail.prix} €` : null} />
            </DrawerGrid>
          </DrawerSection>

          <DrawerSection title="Véhicule" icon={<Car size={12} />}>
            <DrawerGrid>
              <DrawerField label="Marque / modèle" value={[attrDetail?.marque, attrDetail?.modele].filter(Boolean).join(" ")} />
              <DrawerField label="Immatriculation" value={attrDetail?.immatriculation} mono />
              <DrawerField label="VIN" value={attrDetail?.vin} mono />
              <DrawerField label="Email client" value={attrDetail?.client_email} />
              <DrawerField label="Téléphone" value={attrDetail?.client_telephone} />
            </DrawerGrid>
            {(attrDetail?.cgRectoSigned || attrDetail?.cgVersoSigned) && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {attrDetail.cgRectoSigned && (
                  <a href={attrDetail.cgRectoSigned} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-white/10 hover:border-blue-400/50">
                    <img src={attrDetail.cgRectoSigned} alt="Carte grise recto" className="w-full h-32 object-cover" />
                    <p className="text-[10px] text-center text-white/60 py-1">Carte grise — recto</p>
                  </a>
                )}
                {attrDetail.cgVersoSigned && (
                  <a href={attrDetail.cgVersoSigned} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-white/10 hover:border-blue-400/50">
                    <img src={attrDetail.cgVersoSigned} alt="Carte grise verso" className="w-full h-32 object-cover" />
                    <p className="text-[10px] text-center text-white/60 py-1">Carte grise — verso</p>
                  </a>
                )}
              </div>
            )}
          </DrawerSection>

          <InspectionPreuvesBlock
            attributionId={selectedAttr.id}
            fallbackCarteGriseRecto={attrDetail?.carte_grise_recto_url}
            fallbackCarteGriseVerso={attrDetail?.carte_grise_verso_url}
            fallbackVin={attrDetail?.vin}
          />

          <DrawerSection title="Documents mission (uploads convoyeur)" icon={<FileText size={12} />}>
            <MissionDocuments attributionId={selectedAttr.id} userId="" isAdmin />
          </DrawerSection>

          <DrawerSection title="Contrôle live admin" icon={<Shield size={12} />}>
            <AdminLiveControl
              attributionId={selectedAttr.id}
              trajetId={selectedAttr.trajet_id}
              currentStatut={selectedAttr.statut}
              currentEtape={selectedAttr.etape_courante ?? null}
              onChange={() => { void fetchAttributions(); }}
            />
          </DrawerSection>

          <DrawerSection title="Bypass étapes obligatoires" icon={<Shield size={12} />}>
            <AdminStepOverridesPanel attributionId={selectedAttr.id} />
          </DrawerSection>
        </AdminDetailDrawer>
      )}
    </div>
  );
}


function attributionRef(
  a: Attribution,
  baseByGroup: Map<string, string>,
): string {
  // Un numéro attribué par l'admin reste la source de vérité : ne jamais le
  // reconstruire, le resuffixer ou le renuméroter. On normalise juste le format
  // d'affichage (dièse devant la séquence).
  if (a.numero_mission) return displayNumero(a.numero_mission);
  const gid = a.trajet?.mission_group_id ?? null;
  if (!gid) return missionNumberOf(a);
  return displayTrajetRef({
    id: a.trajet_id,
    createdAt: a.created_at,
    groupId: gid,
    isRoundTrip: true,
    legType: a.trajet?.leg_type ?? null,
    legIndex: a.trajet?.leg_index ?? null,
    baseNumero: baseByGroup.get(gid) ?? a.numero_mission ?? null,
  });
}
