import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveGroupInvoiceBasis } from "@/lib/facture-group";

import {
  ArrowLeft,
  MapPin,
  Car,
  User,
  Phone,
  Mail,
  Clock,
  Camera,
  FileText,
  PenTool,
  Activity,
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Send,
  Truck,
  ClipboardCheck,
  Receipt,
  Trash2,
  Download,
  Save,
} from "lucide-react";
import {
  Card,
  Badge,
  Button,
  IconButton,
  Select,
  attributionStatutTone,
} from "@/components/admin/AdminUI";
import { RoleBadge } from "@/components/brand/LigneoBrand";
import { GpsMapView } from "@/components/GpsMapView";
import { MissionDocuments } from "@/components/MissionDocuments";
import { MissionDocsOfficielsPanel } from "@/components/mission/MissionDocsOfficielsPanel";
import { MissionReport } from "@/components/MissionReport";
import { MissionPVDigitauxBlock } from "@/components/mission/MissionPVDigitauxBlock";
import { MissionTraceability } from "@/components/mission/MissionTraceability";
import { AdminLiveControl } from "@/components/admin/AdminLiveControl";
import { AdminStepOverridesPanel } from "@/components/admin/AdminStepOverridesPanel";
import { missionNumberOf, displayTrajetRef, stripLegSuffix } from "@/lib/mission-number";
import { AdminMissionARBanner } from "@/components/admin/AdminMissionARBanner";
import { MissionPriceCard } from "@/components/admin/MissionPriceCard";
import { MissionPriceHistory } from "@/components/admin/MissionPriceHistory";
import { AdminMissionAiPanel } from "@/components/ai/AdminMissionAiPanel";
import { generateEdlFinalPdf } from "@/lib/edl-final-pdf";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
import { ClientLogo } from "@/components/admin/ClientLogo";
import { AdminOrgContextBanner, type OrgContextKind } from "@/components/admin/AdminOrgContextBanner";
import { EditableNumero } from "@/components/admin/EditableNumero";
import { PoHistoryPanel } from "@/components/admin/PoHistoryPanel";
import { logPoEvent } from "@/lib/po-history";
import { MissionAvisGooglePanel } from "@/components/admin/missions/MissionAvisGooglePanel";
import { MissionIncidentsPanel } from "@/components/admin/missions/MissionIncidentsPanel";
import { MissionClotureAdminPanel } from "@/components/admin/missions/MissionClotureAdminPanel";
import { fetchActiveRegime } from "@/lib/pricing/fetch";

export const Route = createFileRoute("/_authenticated/admin/missions/$missionId")({
  component: AdminMissionDetail,
});

interface AttributionFull {
  id: string;
  trajet_id: string;
  convoyeur_id: string;
  statut: string;
  etape_courante: string | null;
  numero_mission: string | null;
  created_at: string;
  updated_at: string;
  pdf_share_client?: boolean | null;
}

interface TrajetFull {
  id: string;
  depart: string;
  arrivee: string;
  date_trajet: string | null;
  heure_trajet: string | null;
  statut: string;
  marque: string | null;
  modele: string | null;
  immatriculation: string | null;
  client_nom: string | null;
  client_email: string | null;
  client_telephone: string | null;
  prix: number | null;
  prix_convoyeur?: number | null;
  tarif_convoyeur?: number | null;
  arrivee_contact_nom: string | null;
  arrivee_contact_email: string | null;
  arrivee_contact_prenom: string | null;
  arrivee_contact_societe: string | null;
  arrivee_contact_telephone: string | null;
  arrivee_contact_telephone2: string | null;
  arrivee_contact_instructions: string | null;
  mission_group_id: string | null;
  leg_type: string | null;
  commande_ref?: string | null;
}

interface ConvoyeurFull {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  ville: string | null;
}

interface InspectionRow {
  id: string;
  type: string;
  statut: string;
  notes: string | null;
  created_at: string;
  photos: { id: string; vue_type: string; url_photo: string; storage_path: string; created_at: string }[];
}

interface GpsPoint {
  latitude: number;
  longitude: number;
  recorded_at: string;
  accuracy: number | null;
}

interface DocRow {
  id: string;
  type_document: string;
  nom_fichier: string;
  created_at: string;
}

interface EtapeHistoryRow {
  id: string;
  etape: string;
  notes: string | null;
  created_at: string;
}

const statutLabels: Record<string, string> = {
  propose: "Proposé",
  accepte: "Accepté",
  refuse: "Refusé",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
};

/** Étapes timeline mission */
const TIMELINE_STEPS: { key: string; label: string; icon: typeof Truck }[] = [
  { key: "propose", label: "Attribué", icon: Send },
  { key: "accepte", label: "Acceptée", icon: CheckCircle2 },
  { key: "en_cours", label: "En cours", icon: Truck },
  { key: "etat_lieux", label: "État des lieux", icon: ClipboardCheck },
  { key: "termine", label: "Terminée", icon: CheckCircle2 },
];

// formatMissionNumber moved to src/lib/mission-number.ts (shared with Attributions)

const vueLabels: Record<string, string> = {
  trois_quart_avant_gauche: "01. 3/4 avant gauche",
  jante_avant_gauche: "02. Jante avant gauche",
  jante_arriere_gauche: "03. Jante arrière gauche",
  trois_quart_arriere_gauche: "04. 3/4 arrière gauche",
  arriere: "05. Arrière",
  coffre_ouvert: "06. Coffre ouvert",
  roue_secours: "07. Roue de secours / kit",
  trois_quart_arriere_droite: "08. 3/4 arrière droite",
  jante_arriere_droite: "09. Jante arrière droite",
  siege_arriere: "10. Sièges arrière",
  jante_avant_droite: "11. Jante avant droite",
  trois_quart_avant_droite: "12. 3/4 avant droite",
  siege_avant: "13. Sièges avant",
  compteur: "14. Compteur (km + carburant)",
  photos_cles: "15. Clés du véhicule",
  kit_securite: "16. Kit sécurité",
  pv_livraison: "16. PV livraison / restitution",
  carte_grise: "17. Carte grise",
  signature: "18. Signature client",
};

function vueLabelFor(vueType: string): string {
  if (vueLabels[vueType]) return vueLabels[vueType];
  const m = vueType.match(/^([a-z_]+?)(?:_\d{10,})?$/);
  if (m && vueLabels[m[1]]) return vueLabels[m[1]];
  return vueType;
}

function AdminMissionDetail() {
  const { missionId } = Route.useParams();
  const [pvMotif, setPvMotif] = useState<string | null>(null);
  const [pvOpenKey, setPvOpenKey] = useState(0);
  const navigate = useNavigate();

  const [attribution, setAttribution] = useState<AttributionFull | null>(null);
  const [trajet, setTrajet] = useState<TrajetFull | null>(null);
  const [convoyeur, setConvoyeur] = useState<ConvoyeurFull | null>(null);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [selfies, setSelfies] = useState<{ id: string; url: string; taken_at: string; latitude: number | null; longitude: number | null }[]>([]);
  const [gpsPoints, setGpsPoints] = useState<GpsPoint[]>([]);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [history, setHistory] = useState<EtapeHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [linkedFactureId, setLinkedFactureId] = useState<string | null>(null);
  const [linkedFactureNumero, setLinkedFactureNumero] = useState<string | null>(null);
  const [regeneratingFacturePdf, setRegeneratingFacturePdf] = useState(false);
  const [poNumber, setPoNumber] = useState("");
  const [cloturePrefill, setCloturePrefill] = useState<{ categorie: string; motif: string } | null>(null);
  const [clotureKey, setClotureKey] = useState(0);
  const [generatingFacture, setGeneratingFacture] = useState(false);
  const [generatingEdlPdf, setGeneratingEdlPdf] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [contactNom, setContactNom] = useState("");
  const [contactPrenom, setContactPrenom] = useState("");
  const [contactSociete, setContactSociete] = useState("");
  const [contactTel, setContactTel] = useState("");
  const [contactTel2, setContactTel2] = useState("");
  const [contactInstr, setContactInstr] = useState("");
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);
  const [clientSociete, setClientSociete] = useState<string | null>(null);
  const [clientTypeClient, setClientTypeClient] = useState<string | null>(null);
  const [clientUserId, setClientUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!trajet) return;
    setContactNom(trajet.arrivee_contact_nom ?? "");
    setContactPrenom(trajet.arrivee_contact_prenom ?? "");
    setContactSociete(trajet.arrivee_contact_societe ?? "");
    setContactTel(trajet.arrivee_contact_telephone ?? "");
    setContactTel2(trajet.arrivee_contact_telephone2 ?? "");
    setContactInstr(trajet.arrivee_contact_instructions ?? "");
  }, [trajet]);

  // N° de PO — partagé par les deux volets d'un aller-retour
  const [savingPo, setSavingPo] = useState(false);
  useEffect(() => {
    if (!trajet) return;
    setPoNumber(trajet.commande_ref ?? "");
  }, [trajet?.id, trajet?.commande_ref]);

  const [poHistoryKey, setPoHistoryKey] = useState(0);

  const savePo = useCallback(
    async (value: string, silent = false) => {
      if (!attribution) return;
      const po = value.trim().slice(0, 60);
      const previous = trajet?.commande_ref ?? null;
      if ((previous ?? "") === po) return;
      setSavingPo(true);
      try {
        const { error } = await supabase.rpc("admin_set_mission_po" as never, {
          _attribution_id: attribution.id,
          _po: po || null,
          _apply_group: true,
        } as never);
        if (error) throw error;
        setTrajet((t) => (t ? { ...t, commande_ref: po || null } : t));
        await logPoEvent({
          action: "po_change",
          attributionId: attribution.id,
          oldPo: previous,
          newPo: po || null,
        });
        setPoHistoryKey((k) => k + 1);
        if (!silent) {
          toast.success("N° de PO enregistré", {
            description: trajet?.mission_group_id ? "Appliqué aux deux volets (Livraison + Restitution)." : undefined,
          });
        }
      } catch (e) {
        toast.error("Enregistrement du PO impossible", { description: (e as Error).message });
      } finally {
        setSavingPo(false);
      }
    },
    [attribution, trajet?.commande_ref, trajet?.mission_group_id],
  );




  // Numéro de base partagé pour un aller-retour (les 2 volets affichent 075A / 075R)
  const [groupBaseNumero, setGroupBaseNumero] = useState<string | null>(null);
  const groupId = trajet?.mission_group_id ?? null;
  useEffect(() => {
    if (!groupId) { setGroupBaseNumero(null); return; }
    let cancelled = false;
    (async () => {
      const { data: legs } = await supabase
        .from("trajets")
        .select("id, leg_index, leg_type, created_at")
        .eq("mission_group_id", groupId);
      const ids = (legs ?? []).map((l) => l.id);
      if (!ids.length) return;
      const { data: attrs } = await supabase
        .from("attributions")
        .select("trajet_id, numero_mission")
        .in("trajet_id", ids);
      const legById = new Map((legs ?? []).map((l) => [l.id, l]));
      let base: string | null = null;
      (attrs ?? []).forEach((a) => {
        if (!a.trajet_id || !a.numero_mission) return;
        const num = stripLegSuffix(a.numero_mission);
        const leg = legById.get(a.trajet_id);
        const isAller = (leg?.leg_index ?? 1) === 1 || leg?.leg_type === "aller";
        if (!base || isAller || num < base) base = isAller ? num : base ?? num;
      });
      if (!cancelled) setGroupBaseNumero(base);
    })();
    return () => { cancelled = true; };
  }, [groupId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data: attr, error: attrErr } = await supabase
      .from("attributions")
      .select("id, trajet_id, convoyeur_id, statut, etape_courante, numero_mission, created_at, updated_at, pdf_share_client")
      .eq("id", missionId)
      .maybeSingle();

    if (attrErr || !attr) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setAttribution(attr as AttributionFull);

    const [trajRes, convRes, inspRes, gpsRes, docsRes, histRes] = await Promise.all([
      supabase.from("trajets").select("*").eq("id", attr.trajet_id).maybeSingle(),
      supabase
        .from("convoyeurs")
        .select("nom, prenom, email, telephone, ville")
        .eq("id", attr.convoyeur_id)
        .maybeSingle(),
      supabase
        .from("inspections")
        .select("id, type, statut, notes, created_at")
        .eq("attribution_id", missionId)
        .order("created_at", { ascending: true }),
      supabase
        .from("mission_locations")
        .select("latitude, longitude, recorded_at, accuracy")
        .eq("attribution_id", missionId)
        .order("recorded_at", { ascending: true }),
      supabase
        .from("mission_documents")
        .select("id, type_document, nom_fichier, created_at")
        .eq("attribution_id", missionId)
        .order("created_at", { ascending: false }),
      supabase
        .from("mission_etape_history")
        .select("id, etape, notes, created_at")
        .eq("attribution_id", missionId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (trajRes.data) setTrajet(trajRes.data as TrajetFull);
    if (convRes.data) setConvoyeur(convRes.data as ConvoyeurFull);
    if (gpsRes.data) setGpsPoints(gpsRes.data as GpsPoint[]);
    if (docsRes.data) setDocuments(docsRes.data as DocRow[]);
    if (histRes.data) setHistory(histRes.data as EtapeHistoryRow[]);
    if (trajRes.data?.id) {
      const { data: adminData } = await supabase
        .from("trajets_admin_data" as never)
        .select("notes_internes")
        .eq("trajet_id" as never, trajRes.data.id as never)
        .maybeSingle();
      if (adminData && (adminData as { notes_internes?: string | null }).notes_internes) {
        setAdminNote((adminData as { notes_internes: string }).notes_internes);
      }
    }

    // Logo/société client (via email trajet)
    if (trajRes.data?.client_email) {
      const { data: p } = await supabase
        .from("profiles")
        .select("user_id, logo_url, societe, type_client" as never)
        .eq("email", trajRes.data.client_email)
        .maybeSingle();
      if (p) {
        const pp = p as { user_id?: string | null; logo_url?: string | null; societe?: string | null; type_client?: string | null };
        setClientLogoUrl(pp.logo_url ?? null);
        setClientSociete(pp.societe ?? null);
        setClientTypeClient(pp.type_client ?? null);
        setClientUserId(pp.user_id ?? null);
      }
    }

    // Photos par inspection : UNE requête .in() + signed URLs en LOT
    const inspList = (inspRes.data ?? []) as Array<{ id: string; type: string; created_at: string }>;
    if (inspList.length) {
      const { data: allPhotos } = await supabase
        .from("inspection_photos")
        .select("id, inspection_id, vue_type, url_photo, created_at")
        .in("inspection_id", inspList.map(i => i.id))
        .order("created_at", { ascending: true });
      const rawPhotos = (allPhotos ?? []) as Array<{ id: string; inspection_id: string; vue_type: string; url_photo: string; created_at: string }>;

      const pathsToSign = Array.from(new Set(rawPhotos.filter(p => !/^https?:\/\//i.test(p.url_photo)).map(p => p.url_photo)));
      const signedMap = new Map<string, string>();
      if (pathsToSign.length) {
        const { data: signed } = await supabase.storage.from("inspection-photos").createSignedUrls(pathsToSign, 3600);
        (signed ?? []).forEach((s, idx) => { if (s?.signedUrl) signedMap.set(pathsToSign[idx], s.signedUrl); });
      }

      const photosByInsp = new Map<string, InspectionRow["photos"]>();
      for (const p of rawPhotos) {
        const isUrl = /^https?:\/\//i.test(p.url_photo);
        const storage_path = isUrl ? "" : p.url_photo;
        const url_photo = isUrl ? p.url_photo : (signedMap.get(p.url_photo) ?? p.url_photo);
        const arr = photosByInsp.get(p.inspection_id) ?? [];
        arr.push({ id: p.id, vue_type: p.vue_type, url_photo, created_at: p.created_at, storage_path });
        photosByInsp.set(p.inspection_id, arr);
      }
      setInspections(inspList.map(i => ({ ...(i as Omit<InspectionRow, "photos">), photos: photosByInsp.get(i.id) ?? [] })));
    } else {
      setInspections([]);
    }

    // Selfies convoyeur (bucket privé → signed URLs en LOT)
    const { data: selfiesRaw } = await supabase
      .from("mission_selfies" as never)
      .select("id, storage_path, taken_at, latitude, longitude")
      .eq("attribution_id" as never, missionId as never)
      .order("taken_at" as never, { ascending: false } as never);
    if (selfiesRaw) {
      const rows = selfiesRaw as unknown as { id: string; storage_path: string; taken_at: string; latitude: number | null; longitude: number | null }[];
      const paths = rows.map(s => s.storage_path);
      const { data: signed } = paths.length
        ? await supabase.storage.from("mission-selfies").createSignedUrls(paths, 3600)
        : { data: [] as { signedUrl: string }[] };
      setSelfies(rows.map((s, i) => ({
        id: s.id,
        url: signed?.[i]?.signedUrl ?? "",
        taken_at: s.taken_at,
        latitude: s.latitude,
        longitude: s.longitude,
      })));
    }

    // Check existing facture
    const { data: existingFact } = await supabase
      .from("factures")
      .select("id, numero")
      .eq("attribution_id", missionId)
      .maybeSingle();
    setLinkedFactureId(existingFact?.id ?? null);
    setLinkedFactureNumero((existingFact as { numero?: string } | null)?.numero ?? null);

    setLoading(false);
  }, [missionId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime GPS + étapes + statut attribution
  useEffect(() => {
    const channel = supabase
      .channel(`mission-detail-${missionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mission_locations", filter: `attribution_id=eq.${missionId}` },
        (payload) => {
          setGpsPoints((prev) => [...prev, payload.new as unknown as GpsPoint]);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mission_etape_history", filter: `attribution_id=eq.${missionId}` },
        (payload) => {
          setHistory((prev) => [payload.new as unknown as EtapeHistoryRow, ...prev].slice(0, 20));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "attributions", filter: `id=eq.${missionId}` },
        (payload) => {
          setAttribution((prev) => prev ? { ...prev, ...(payload.new as Partial<AttributionFull>) } : prev);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [missionId]);

  const updateStatut = async (statut: string) => {
    if (!attribution) return;
    await supabase.from("attributions").update({ statut }).eq("id", attribution.id);
    setAttribution({ ...attribution, statut });
  };

  const saveAdminNote = async () => {
    if (!trajet) return;
    setSavingNote(true);
    await supabase
      .from("trajets_admin_data" as never)
      .upsert({ trajet_id: trajet.id, notes_internes: adminNote } as never, { onConflict: "trajet_id" } as never);
    setSavingNote(false);
  };

  const saveContactArrivee = async () => {
    if (!trajet) return;
    setSavingContact(true);
    try {
      const { error } = await supabase
        .from("trajets")
        .update({
          arrivee_contact_nom: contactNom.trim() || null,
          arrivee_contact_prenom: contactPrenom.trim() || null,
          arrivee_contact_societe: contactSociete.trim() || null,
          arrivee_contact_telephone: contactTel.trim() || null,
          arrivee_contact_telephone2: contactTel2.trim() || null,
          arrivee_contact_instructions: contactInstr.trim() || null,
        })
        .eq("id", trajet.id);
      if (error) throw error;
      setTrajet({
        ...trajet,
        arrivee_contact_nom: contactNom.trim() || null,
        arrivee_contact_prenom: contactPrenom.trim() || null,
        arrivee_contact_societe: contactSociete.trim() || null,
        arrivee_contact_telephone: contactTel.trim() || null,
        arrivee_contact_telephone2: contactTel2.trim() || null,
        arrivee_contact_instructions: contactInstr.trim() || null,
      });
      toast.success("Contact livraison enregistré");
    } catch (e) {
      toast.error("Enregistrement impossible", { description: (e as Error).message });
    } finally {
      setSavingContact(false);
    }
  };

  const downloadEdlPdf = async () => {
    if (!attribution || !trajet || generatingEdlPdf) return;
    setGeneratingEdlPdf(true);
    try {
      // Fetch équipements + kilométrages depuis inspections
      const { data: inspFull } = await supabase
        .from("inspections")
        .select("type, equipements, kilometrage_depart, kilometrage_arrivee")
        .eq("attribution_id", attribution.id);
      const inspDepart = inspFull?.find((i) => i.type === "depart");
      const inspArrivee = inspFull?.find((i) => i.type === "arrivee");

      // VIN depuis trajets
      const vin = (trajet as { vin?: string | null; vehicule_vin?: string | null }).vin
        ?? (trajet as { vehicule_vin?: string | null }).vehicule_vin
        ?? null;

      // Signatures (stockées en data URL base64 dans signature_data)
      const { data: sigsRaw } = await supabase
        .from("mission_signatures")
        .select("kind, signature_data")
        .eq("attribution_id", attribution.id);
      const signatures = ((sigsRaw ?? []) as { kind: string; signature_data: string | null }[])
        .map((s) => ({ kind: s.kind, url: s.signature_data }));



      // Incidents
      const { data: incidents } = await supabase
        .from("mission_incidents")
        .select("titre, description, gravite, created_at")
        .eq("attribution_id", attribution.id)
        .order("created_at", { ascending: true });

      const photosDepart = inspections
        .filter((i) => i.type === "depart")
        .flatMap((i) => i.photos)
        .filter((p) => !p.vue_type.startsWith("signature"))
        .map((p) => ({ vue_type: p.vue_type, url: p.url_photo }));
      const photosArrivee = inspections
        .filter((i) => i.type === "arrivee")
        .flatMap((i) => i.photos)
        .filter((p) => !p.vue_type.startsWith("signature"))
        .map((p) => ({ vue_type: p.vue_type, url: p.url_photo }));

      const blob = await generateEdlFinalPdf({
        numero: missionNumberOf(attribution),
        date_mission: trajet.date_trajet,
        depart: trajet.depart,
        arrivee: trajet.arrivee,
        vehicule: {
          marque: trajet.marque,
          modele: trajet.modele,
          immatriculation: trajet.immatriculation,
          vin,
        },
        convoyeur: convoyeur
          ? { prenom: convoyeur.prenom, nom: convoyeur.nom, telephone: convoyeur.telephone }
          : null,
        contactArrivee: {
          nom: trajet.arrivee_contact_nom,
          telephone: trajet.arrivee_contact_telephone,
          instructions: trajet.arrivee_contact_instructions,
        },
        equipements: (inspDepart?.equipements ?? inspArrivee?.equipements ?? null) as Record<string, unknown> | null,
        kilometrage_depart: inspDepart?.kilometrage_depart ?? null,
        kilometrage_arrivee: inspArrivee?.kilometrage_arrivee ?? null,
        photosDepart,
        photosArrivee,
        signatures,
        incidents: incidents ?? [],
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `EDL-${missionNumberOf(attribution)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF EDL généré");
    } catch (e) {
      toast.error("Génération PDF impossible", { description: (e as Error).message });
    } finally {
      setGeneratingEdlPdf(false);
    }
  };

  /** Régénère le PDF d'une facture déjà émise, en y reportant le N° de PO actuel (rétroactif). */
  const regenerateFacturePdf = async () => {
    if (!linkedFactureId || regeneratingFacturePdf) return;
    setRegeneratingFacturePdf(true);
    try {
      const po = poNumber.trim().slice(0, 60);
      await savePo(po, true);

      const { data: fact, error } = await supabase
        .from("factures")
        .select("*")
        .eq("id", linkedFactureId)
        .maybeSingle();
      if (error) throw error;
      if (!fact) throw new Error("Facture introuvable");

      const row = fact as unknown as Record<string, unknown>;
      const currentRef = (row["reference_client"] as string | null) ?? null;
      if ((po || null) !== currentRef) {
        const { error: upErr } = await supabase
          .from("factures")
          .update({
            reference_client: po || null,
            reference_label: po ? ((row["reference_label"] as string | null) || "N° de PO") : null,
          })
          .eq("id", linkedFactureId);
        if (upErr) throw upErr;
        row["reference_client"] = po || null;
        row["reference_label"] = po ? ((row["reference_label"] as string | null) || "N° de PO") : null;
      }

      const { generateFacturePdf, downloadFacturePdf } = await import("@/lib/facture-pdf");
      const blob = await generateFacturePdf({
        numero: row["numero"] as string,
        type_facture: (row["type_facture"] as "particulier" | "b2b") ?? "particulier",
        date_facture: (row["date_facture"] as string) ?? (row["created_at"] as string),
        date_mission: (row["date_mission"] as string | null) ?? null,
        date_echeance: (row["date_echeance"] as string | null) ?? null,
        mode_paiement: (row["mode_paiement"] as string | null) ?? null,
        conditions_paiement: (row["conditions_paiement"] as string | null) ?? null,
        client_nom: (row["client_nom"] as string | null) ?? null,
        client_prenom: (row["client_prenom"] as string | null) ?? null,
        client_societe: (row["client_societe"] as string | null) ?? null,
        client_email: (row["client_email"] as string | null) ?? null,
        client_adresse: (row["client_adresse"] as string | null) ?? null,
        client_siret: (row["client_siret"] as string | null) ?? null,
        client_tva: (row["client_tva"] as string | null) ?? null,
        designation: (row["designation"] as string | null) ?? null,
        depart: (row["depart"] as string | null) ?? null,
        arrivee: (row["arrivee"] as string | null) ?? null,
        distance_km: (row["distance_km"] as number | null) ?? null,
        prix_ht: Number(row["prix_ht"] ?? 0),
        tva_taux: Number(row["tva_taux"] ?? 0),
        prix_tva: Number(row["prix_tva"] ?? 0),
        prix_ttc: Number(row["prix_ttc"] ?? 0),
        reference_client: (row["reference_client"] as string | null) ?? null,
        reference_label: (row["reference_label"] as string | null) ?? null,
      });
      downloadFacturePdf(blob, row["numero"] as string);
      await logPoEvent({
        action: "pdf_regenerate",
        attributionId: attribution?.id ?? null,
        factureId: linkedFactureId,
        factureNumero: (row["numero"] as string | null) ?? linkedFactureNumero,
        oldPo: currentRef,
        newPo: po || null,
      });
      setPoHistoryKey((k) => k + 1);
      toast.success("Facture régénérée", { description: po ? `PO ${po} reporté sur le PDF.` : undefined });
    } catch (e) {
      toast.error("Régénération impossible", { description: (e as Error).message });
    } finally {
      setRegeneratingFacturePdf(false);
    }
  };


  const generateFacture = async () => {
    if (!attribution || !trajet || generatingFacture) return;
    const po = poNumber.trim().slice(0, 60);
    if (!po) {
      const ok = await confirmToast("Générer la facture sans numéro de PO ?", {
        description: "Aucun numéro de commande / PO n'a été saisi. Il n'apparaîtra pas sur la facture.",
        confirmLabel: "Générer quand même",
        cancelLabel: "Saisir un PO",
      });
      if (!ok) return;
    }
    await savePo(po, true);
    setGeneratingFacture(true);
    try {
      // Livraison + restitution = UNE seule facture au tarif de base global
      const basis = await resolveGroupInvoiceBasis(trajet.id);
      if (basis.existing) {
        setLinkedFactureId(basis.existing.id);
        toast.info("Facture déjà émise pour cette mission", { description: basis.existing.numero });
        return;
      }


      const ttc = basis.totalTtc > 0 ? basis.totalTtc : Number(trajet.prix ?? 0);
      // Régime micro-entreprise (franchise en base) : le prix affiché est le net à payer.
      const { regime: regimeFact, vatRate: tauxFact } = await fetchActiveRegime();
      const tvaTaux = regimeFact === "societe" ? tauxFact : 0;
      const ht = tvaTaux === 0 ? ttc : +(ttc / (1 + tvaTaux / 100)).toFixed(2);
      const tva = +(ttc - ht).toFixed(2);

      const today = new Date();
      // La facture reprend automatiquement le numéro de la mission (MIS-… → FAC-…)
      const baseNum = stripLegSuffix(attribution.numero_mission ?? "").trim();
      const numero = /^MIS-TLG-\d{4}-#?\d{3,}$/.test(baseNum)
        ? baseNum.replace(/^MIS-/, "FAC-")
        : `F-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;


      const nameParts = (trajet.client_nom ?? "").trim().split(/\s+/);
      const prenom = nameParts.length > 1 ? nameParts[0] : "";
      const nom = nameParts.length > 1 ? nameParts.slice(1).join(" ") : (trajet.client_nom ?? "");

      const { data: inserted, error } = await supabase
        .from("factures")
        .insert({
          numero,
          attribution_id: attribution.id,
          client_email: trajet.client_email ?? "",
          client_nom: nom || "Client",
          client_prenom: prenom || null,
          type_facture: "particulier",
          date_facture: today.toISOString().slice(0, 10),
          date_mission: trajet.date_trajet,
          designation: basis.designation,
          depart: basis.depart ?? trajet.depart,
          arrivee: basis.arrivee ?? trajet.arrivee,
          prix_ht: ht,
          tva_taux: tvaTaux,
          prix_tva: tva,
          prix_ttc: ttc,
          statut: "emise",
          mode_paiement: "Carte bancaire",
          reference_client: po || null,
          reference_label: po ? "N° de PO" : null,

        })
        .select("id")
        .single();
      if (error) throw error;
      setLinkedFactureId(inserted.id);
      toast.success("Facture créée", { description: `Numéro ${numero}` });
    } catch (e) {

      toast.error("Création impossible", { description: (e as Error).message });
    } finally {
      setGeneratingFacture(false);
    }
  };

  // Signature = dernière photo "signature"
  const signaturePhoto = useMemo(() => {
    for (const insp of inspections) {
      const sig = insp.photos.find((p) => p.vue_type === "signature" || p.vue_type.startsWith("signature_"));
      if (sig) return { url: sig.url_photo, at: sig.created_at, type: insp.type };
    }
    return null;
  }, [inspections]);

  // Activité = dernier point GPS + dernière étape
  const lastGps = gpsPoints.length ? gpsPoints[gpsPoints.length - 1] : null;
  const lastEtape = history[0];

  // Index timeline courant
  const currentStepIndex = useMemo(() => {
    if (!attribution) return 0;
    if (attribution.statut === "termine") return TIMELINE_STEPS.length - 1;
    if (attribution.statut === "en_cours") {
      const hasInsp = inspections.length > 0;
      return hasInsp ? 3 : 2;
    }
    if (attribution.statut === "accepte") return 1;
    return 0;
  }, [attribution, inspections.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-pro-accent" size={32} />
      </div>
    );
  }

  if (notFound || !attribution || !trajet) {
    return (
      <Card>
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto text-amber-500 mb-3" size={32} />
          <p className="text-pro-text font-medium">Mission introuvable</p>
          <p className="text-pro-muted text-sm mt-1">
            La référence demandée n'existe pas ou a été supprimée.
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            icon={<ArrowLeft size={14} />}
            onClick={() => navigate({ to: "/admin/attributions", search: { trajet: undefined } })}
          >
            Retour aux attributions
          </Button>
        </div>
      </Card>
    );
  }

  const missionNumber = attribution.numero_mission
    ? attribution.numero_mission
    : trajet.mission_group_id
    ? displayTrajetRef({
        id: trajet.id,
        createdAt: attribution.created_at,
        groupId: trajet.mission_group_id,
        isRoundTrip: true,
        legType: trajet.leg_type,
        baseNumero: groupBaseNumero ?? attribution.numero_mission,
      })
    : missionNumberOf(attribution);
  const isB2B = !!trajet.client_nom && trajet.client_nom.length > 0; // simple heuristique
  const lastUpdate = new Date(attribution.updated_at).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-5">
      {/* === Back === */}
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/admin/attributions"
          search={{ trajet: undefined }}
          className="inline-flex items-center gap-1.5 text-sm text-pro-text-soft hover:text-pro-accent transition-colors"
        >
          <ArrowLeft size={14} />
          Toutes les missions
        </Link>
        <IconButton onClick={fetchAll} title="Rafraîchir" tone="primary">
          <RefreshCw size={15} />
        </IconButton>
      </div>

      {(trajet.client_nom || trajet.client_email || clientSociete) && (
        <AdminOrgContextBanner
          clientId={clientUserId ?? undefined}
          name={clientSociete || trajet.client_nom || trajet.client_email || "Client"}
          kind={
            (clientTypeClient === "flotte"
              ? "flotte"
              : clientTypeClient === "b2b" || !!clientSociete
                ? "b2b"
                : "particulier") as OrgContextKind
          }
          email={trajet.client_email}
          phone={trajet.client_telephone}
          logoUrl={clientLogoUrl}
          societe={clientSociete}
        />
      )}


      {/* === Header mission === */}
      <Card>
        <div className="flex flex-col lg:flex-row items-stretch lg:items-start justify-between gap-4">
          <div className="min-w-0 w-full lg:flex-1 flex items-start gap-3">

            <ClientLogo
              src={clientLogoUrl}
              name={clientSociete || trajet.client_nom || undefined}
              isCompany={!!clientSociete || isB2B}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-semibold text-pro-text font-heading tracking-wide">
                  {missionNumber}
                </h1>
                <EditableNumero
                  table="attributions"
                  id={attribution.id}
                  column="numero_mission"
                  value={missionNumber}
                  onSaved={(next: string) => {
                    setAttribution((a) => (a ? { ...a, numero_mission: next } : a));
                    setTrajet((t) => (t ? { ...t, numero_mission: next } : t));
                  }}
                />
                <Badge tone={attributionStatutTone[attribution.statut] ?? "neutral"}>
                  {statutLabels[attribution.statut] ?? attribution.statut}
                </Badge>
                <RoleBadge role={isB2B ? "partner" : "client"} />
                <RoleBadge role="driver" />
              </div>
              {(clientSociete || trajet.client_nom) && (
                <div className="mt-1 text-xs text-pro-muted truncate">
                  {clientSociete || trajet.client_nom}
                </div>
              )}

            <div className="mt-3 grid grid-cols-1 xl:grid-cols-3 gap-2 xl:gap-3 text-sm">
              <div className="flex items-center gap-2 text-pro-text-soft">
                <Car size={14} className="text-pro-muted" />
                <span className="truncate">
                  {trajet.marque || trajet.modele
                    ? `${trajet.marque ?? ""} ${trajet.modele ?? ""}`.trim()
                    : "Véhicule —"}
                  {trajet.immatriculation && (
                    <span className="text-pro-muted ml-1">· {trajet.immatriculation}</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 text-pro-text-soft">
                <User size={14} className="text-pro-muted" />
                <span className="truncate">
                  {convoyeur ? `${convoyeur.prenom} ${convoyeur.nom}` : "Convoyeur —"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-pro-text-soft">
                <Clock size={14} className="text-pro-muted" />
                <span className="truncate">MAJ {lastUpdate}</span>
              </div>
            </div>
            </div>
          </div>



          <div className="w-full lg:w-[360px] shrink-0 flex flex-col items-stretch lg:items-end gap-2">
            <Select
              value={attribution.statut}
              onChange={(e) => updateStatut(e.target.value)}
              className="text-xs py-1.5"
            >
              {Object.entries(statutLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              icon={<FileText size={14} />}
              onClick={() => setReportOpen(true)}
            >
              Rapport complet
            </Button>
            <Button
              variant="secondary"
              icon={generatingEdlPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              onClick={downloadEdlPdf}
              disabled={generatingEdlPdf}
            >
              PDF état des lieux
            </Button>
            <button
              type="button"
              onClick={async () => {
                if (!attribution) return;
                const next = !attribution.pdf_share_client;
                const { error } = await supabase
                  .from("attributions")
                  .update({ pdf_share_client: next } as never)
                  .eq("id", attribution.id);
                if (error) {
                  toast.error("Erreur", { description: error.message });
                  return;
                }
                setAttribution({ ...attribution, pdf_share_client: next });
                toast.success(next ? "PDF partagé au client" : "Partage client désactivé");
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-colors ${
                attribution.pdf_share_client
                  ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                  : "border-white/15 text-white/70 hover:bg-white/5"
              }`}
            >
              {attribution.pdf_share_client ? "✓ PDF partagé au client" : "Partager PDF au client"}
            </button>
            {linkedFactureId ? (
              <div className="w-full rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1 min-w-[220px]">
                  <label htmlFor="po-number-emise" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300 mb-1.5">
                    <Receipt size={12} /> Facture émise{linkedFactureNumero ? ` · ${linkedFactureNumero}` : ""} — N° de PO
                    {savingPo && <Loader2 size={11} className="animate-spin" />}
                  </label>
                  <input
                    id="po-number-emise"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value.slice(0, 60))}
                    onBlur={(e) => void savePo(e.target.value)}
                    maxLength={60}
                    placeholder="Ex. PO-2026-0042"
                    className="w-full rounded-md border border-emerald-400/40 bg-[#0b1026]/70 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-emerald-300 focus:ring-1 focus:ring-emerald-300/50"
                  />
                  <p className="mt-1 text-[11px] text-white/50">
                    Le PO est reporté sur la facture existante, puis le PDF est régénéré.
                    {trajet.mission_group_id ? " Appliqué aux deux volets (Livraison + Restitution)." : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    icon={regeneratingFacturePdf ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
                    onClick={regenerateFacturePdf}
                    disabled={regeneratingFacturePdf}
                  >
                    Régénérer le PDF
                  </Button>
                  <Link
                    to="/admin/factures"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  >
                    Voir les factures
                  </Link>
                </div>
              </div>
            ) : (
              <div className="w-full rounded-lg border border-amber-400/40 bg-amber-400/[0.07] p-3 flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1 min-w-[220px]">
                  <label htmlFor="po-number" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300 mb-1.5">
                    <Receipt size={12} /> N° de PO / commande client
                    {savingPo && <Loader2 size={11} className="animate-spin" />}
                  </label>
                  <input
                    id="po-number"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value.slice(0, 60))}
                    onBlur={(e) => void savePo(e.target.value)}
                    maxLength={60}
                    placeholder="Ex. PO-2026-0042"
                    className="w-full rounded-md border border-amber-400/40 bg-[#0b1026]/70 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-amber-300 focus:ring-1 focus:ring-amber-300/50"
                  />
                  <p className="mt-1 text-[11px] text-white/50">
                    {poNumber.trim() ? "Il apparaîtra sur la facture PDF." : "À saisir avant de générer la facture — ne l'oubliez pas."}
                    {trajet.mission_group_id ? " Appliqué aux deux volets (Livraison + Restitution)." : ""}
                  </p>

                </div>
                <Button
                  icon={generatingFacture ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
                  onClick={generateFacture}
                  disabled={generatingFacture || !trajet?.prix}
                >
                  Générer facture
                </Button>
              </div>
            )}
            <PoHistoryPanel
              attributionId={attribution.id}
              refreshKey={poHistoryKey}
              className="w-full text-left"
            />
          </div>


        </div>
      </Card>

      <AdminMissionARBanner
        trajetId={trajet.id}
        groupId={trajet.mission_group_id}
        legType={trajet.leg_type}
        currentPrix={trajet.prix ?? null}
        onPriceSaved={(p) => setTrajet({ ...trajet, prix: p })}
        onGroupChanged={fetchAll}
      />

      <MissionPriceCard
        trajetId={trajet.id}
        groupId={trajet.mission_group_id}
        legType={trajet.leg_type}
        currentPrix={trajet.prix ?? null}
        currentPrixConvoyeur={trajet.prix_convoyeur ?? trajet.tarif_convoyeur ?? null}
        onSaved={({ prix, prixConvoyeur }) =>
          setTrajet({ ...trajet, prix, prix_convoyeur: prixConvoyeur, tarif_convoyeur: prixConvoyeur })
        }
      />



      {/* === Timeline progression === */}
      <Card>
        <h3 className="text-sm font-semibold text-pro-text-soft uppercase tracking-wider mb-4">
          Progression
        </h3>
        <ol className="flex items-center justify-between gap-2">
          {TIMELINE_STEPS.map((step, idx) => {
            const active = idx <= currentStepIndex;
            const current = idx === currentStepIndex;
            const Icon = step.icon;
            return (
              <li key={step.key} className="flex-1 flex flex-col items-center text-center">
                <div className="flex items-center w-full">
                  <span
                    className={`h-0.5 flex-1 ${
                      idx === 0 ? "opacity-0" : active ? "bg-pro-accent" : "bg-pro-border"
                    }`}
                  />
                  <span
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                      current
                        ? "role-admin-bg text-white border-transparent"
                        : active
                        ? "bg-pro-accent text-white border-pro-accent"
                        : "bg-white text-pro-muted border-pro-border"
                    }`}
                  >
                    {active ? <Icon size={15} /> : <Circle size={12} />}
                  </span>
                  <span
                    className={`h-0.5 flex-1 ${
                      idx === TIMELINE_STEPS.length - 1
                        ? "opacity-0"
                        : idx < currentStepIndex
                        ? "bg-pro-accent"
                        : "bg-pro-border"
                    }`}
                  />
                </div>
                <span
                  className={`text-[10px] sm:text-xs mt-1.5 uppercase tracking-wider ${
                    active ? "text-pro-text font-semibold" : "text-pro-muted"
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* === Grid principal === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Colonne gauche : trajet + client + convoyeur */}
        <div className="space-y-5 lg:col-span-2">
          {/* Trajet */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={15} className="text-pro-accent" />
              <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
                Trajet
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-pro-accent" />
                  <span className="w-px flex-1 bg-pro-border min-h-[24px]" />
                  <span className="w-2.5 h-2.5 rounded-full role-driver-bg" />
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-pro-muted">Départ</p>
                    <p className="text-pro-text text-sm">{trajet.depart}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-pro-muted">Arrivée</p>
                    <p className="text-pro-text text-sm">{trajet.arrivee}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-pro-border">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-pro-muted">Date</p>
                  <p className="text-pro-text">
                    {trajet.date_trajet
                      ? new Date(trajet.date_trajet).toLocaleDateString("fr-FR")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-pro-muted">Heure</p>
                  <p className="text-pro-text">{trajet.heure_trajet || "—"}</p>
                </div>
                {trajet.prix !== null && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-pro-muted">Prix</p>
                    <p className="text-pro-text">{trajet.prix} €</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Selfie identité convoyeur */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Camera size={15} className="text-pro-accent" />
              <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
                Selfie convoyeur ({selfies.length})
              </h3>
            </div>
            {selfies.length === 0 ? (
              <p className="text-pro-muted text-sm">Pas encore de selfie envoyé par le convoyeur.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {selfies.map((s) => (
                  <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="block group">
                    <img
                      src={s.url}
                      alt="Selfie convoyeur"
                      loading="lazy"
                      className="w-full aspect-[3/4] object-cover rounded-md border border-pro-border group-hover:border-pro-accent transition-colors"
                    />
                    <p className="text-pro-text-soft text-[10px] mt-1 truncate">
                      {new Date(s.taken_at).toLocaleString("fr-FR")}
                    </p>
                    {s.latitude !== null && s.longitude !== null && (
                      <p className="text-pro-muted text-[10px] truncate">
                        {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                      </p>
                    )}
                  </a>
                ))}
              </div>
            )}
          </Card>

          {/* Photos état des lieux */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Camera size={15} className="text-pro-accent" />
              <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
                Photos état des lieux
              </h3>
            </div>
            {inspections.length === 0 ? (
              <p className="text-pro-muted text-sm">Aucun état des lieux pour le moment.</p>
            ) : (
              <div className="space-y-5">
                {inspections.map((insp) => (
                  <div key={insp.id}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-pro-text text-sm font-medium">
                        {insp.type === "depart" ? "État des lieux — Départ" : "État des lieux — Arrivée"}
                      </p>
                      <Badge tone={insp.statut === "complete" ? "success" : "warning"}>
                        {insp.statut === "complete" ? "Complété" : insp.statut}
                      </Badge>
                    </div>
                    {insp.photos.length === 0 ? (
                      <p className="text-pro-muted text-xs">Aucune photo.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {insp.photos
                          .filter((p) => !p.vue_type.startsWith("signature"))
                          .map((p, idx) => (
                            <div key={`${p.id}-${idx}`} className="relative group">
                              <a
                                href={p.url_photo}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <img
                                  src={p.url_photo}
                                  alt={vueLabelFor(p.vue_type)}
                                  loading="lazy"
                                  className="w-full aspect-[3/4] object-cover rounded-md border border-pro-border group-hover:border-pro-accent transition-colors"
                                />
                                <p className="text-pro-text-soft text-[10px] mt-1 truncate">
                                  {vueLabelFor(p.vue_type)}
                                </p>
                              </a>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!(await confirmToast(`Supprimer la photo "${vueLabelFor(p.vue_type)}" ? Le conducteur pourra la reprendre.`))) return;
                                  try {
                                    if (p.storage_path) {
                                      await supabase.storage.from("inspection-photos").remove([p.storage_path]);
                                    }
                                    const { error } = await supabase.from("inspection_photos").delete().eq("id", p.id);
                                    if (error) throw error;
                                    setInspections((prev) => prev.map((row) => row.id === insp.id
                                      ? { ...row, photos: row.photos.filter((q) => q.id !== p.id) }
                                      : row));
                                    toast.success("Photo supprimée");
                                  } catch (err) {
                                    toast.error("Suppression impossible", { description: err instanceof Error ? err.message : "" });
                                  }
                                }}
                                title="Supprimer cette photo"
                                className="absolute top-1 right-1 p-1.5 rounded-md bg-red-600/90 text-white opacity-0 group-hover:opacity-100 hover:bg-red-700 transition shadow-sm"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <AdminMissionAiPanel inspections={inspections} />
          </Card>

          {/* Incidents signalés par le convoyeur */}
          <MissionIncidentsPanel
            attributionId={attribution.id}
            isGroup={Boolean(trajet.mission_group_id)}
            onPassageAVide={(motif) => {
              setPvMotif(motif);
              setPvOpenKey((k) => k + 1);
              document.getElementById("docs-officiels")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            onCloture={(categorie, motif) => {
              setCloturePrefill({ categorie, motif });
              setClotureKey((k) => k + 1);
              document.getElementById("cloture-admin")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />

          {/* Clôture administrative : annulation motivée */}
          <div id="cloture-admin">
            <MissionClotureAdminPanel
              attributionId={attribution.id}
              statut={attribution.statut}
              isGroup={Boolean(trajet.mission_group_id)}
              prefill={cloturePrefill}
              prefillKey={clotureKey}
              onChanged={() => { void fetchAll(); }}
              onPassageAVide={(motif) => {
                setPvMotif(motif);
                setPvOpenKey((k) => k + 1);
                document.getElementById("docs-officiels")?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            />
          </div>




          {/* Documents officiels */}
          <div id="docs-officiels">
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <FileText size={15} className="text-pro-accent" />
              <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
                Documents officiels
              </h3>
            </div>
            <MissionDocsOfficielsPanel attributionId={attribution.id} pvPrefillMotif={pvMotif} pvOpenKey={pvOpenKey} />
          </Card>
          </div>

          {/* Avis Google */}
          <MissionAvisGooglePanel
            attributionId={attribution.id}
            trajetId={trajet.id}
            clientEmail={trajet.client_email}
            clientTelephone={trajet.client_telephone}
            clientNom={trajet.client_nom}
            contactNom={[trajet.arrivee_contact_prenom, trajet.arrivee_contact_nom].filter(Boolean).join(" ") || null}
            contactEmail={trajet.arrivee_contact_email}
            contactTelephone={trajet.arrivee_contact_telephone}
          />


          {/* Documents */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <FileText size={15} className="text-pro-accent" />
              <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
                Documents ({documents.length})
              </h3>
            </div>
            <MissionDocuments attributionId={attribution.id} userId="" isAdmin />
          </Card>


          {/* PV de livraison digitalisés (plateformes partenaires) */}
          <Card>
            <MissionPVDigitauxBlock attributionId={attribution.id} mode="admin" />
          </Card>

          {/* Traçabilité double signature (départ + arrivée, convoyeur + client) */}
          <MissionTraceability attributionId={attribution.id} variant="full" />

          {/* Contrôle live admin — actions temps réel */}
          <AdminLiveControl
            attributionId={attribution.id}
            trajetId={trajet.id}
            currentStatut={attribution.statut}
            currentEtape={attribution.etape_courante}
            onChange={fetchAll}
          />

          {/* Surcouche admin : bypass / désactivation des étapes obligatoires */}
          <AdminStepOverridesPanel attributionId={attribution.id} />
        </div>

        {/* Colonne droite : convoyeur + client + GPS + activité + admin */}
        <div className="space-y-5">
          {/* Convoyeur */}
          {convoyeur && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <RoleBadge role="driver" />
                <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
                  Convoyeur
                </h3>
              </div>
              <p className="text-pro-text font-medium">
                {convoyeur.prenom} {convoyeur.nom}
              </p>
              {convoyeur.ville && (
                <p className="text-pro-muted text-xs">{convoyeur.ville}</p>
              )}
              <div className="mt-3 space-y-1.5 text-sm">
                <a
                  href={`mailto:${convoyeur.email}`}
                  className="flex items-center gap-2 text-pro-text-soft hover:text-pro-accent transition-colors"
                >
                  <Mail size={13} /> {convoyeur.email}
                </a>
                <a
                  href={`tel:${convoyeur.telephone}`}
                  className="flex items-center gap-2 text-pro-text-soft hover:text-pro-accent transition-colors"
                >
                  <Phone size={13} /> {convoyeur.telephone}
                </a>
              </div>
            </Card>
          )}

          {/* Client */}
          {trajet.client_nom && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <RoleBadge role={isB2B ? "partner" : "client"} />
                <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
                  {isB2B ? "Partner" : "Client"}
                </h3>
              </div>
              <p className="text-pro-text font-medium">{trajet.client_nom}</p>
              <div className="mt-3 space-y-1.5 text-sm">
                {trajet.client_email && (
                  <a
                    href={`mailto:${trajet.client_email}`}
                    className="flex items-center gap-2 text-pro-text-soft hover:text-pro-accent transition-colors"
                  >
                    <Mail size={13} /> {trajet.client_email}
                  </a>
                )}
                {trajet.client_telephone && (
                  <a
                    href={`tel:${trajet.client_telephone}`}
                    className="flex items-center gap-2 text-pro-text-soft hover:text-pro-accent transition-colors"
                  >
                    <Phone size={13} /> {trajet.client_telephone}
                  </a>
                )}
              </div>
            </Card>
          )}

          {/* Contact livraison (point d'arrivée) */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Phone size={15} className="text-pro-accent" />
              <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
                Contact livraison
              </h3>
            </div>
            <p className="text-pro-muted text-xs mb-3">
              Personne à appeler à l'arrivée. Visible par le convoyeur dans son interface mobile.
            </p>
            <div className="space-y-2">
              <input
                type="text"
                value={contactNom}
                onChange={(e) => setContactNom(e.target.value)}
                placeholder="Nom"
                className="w-full px-3 py-2 bg-white border border-pro-border rounded-md text-sm text-pro-text placeholder:text-pro-muted focus:border-pro-accent focus:ring-2 focus:ring-pro-accent/20 focus:outline-none"
              />
              <input
                type="text"
                value={contactPrenom}
                onChange={(e) => setContactPrenom(e.target.value)}
                placeholder="Prénom"
                className="w-full px-3 py-2 bg-white border border-pro-border rounded-md text-sm text-pro-text placeholder:text-pro-muted focus:border-pro-accent focus:ring-2 focus:ring-pro-accent/20 focus:outline-none"
              />
              <input
                type="text"
                value={contactSociete}
                onChange={(e) => setContactSociete(e.target.value)}
                placeholder="Société (optionnel)"
                className="w-full px-3 py-2 bg-white border border-pro-border rounded-md text-sm text-pro-text placeholder:text-pro-muted focus:border-pro-accent focus:ring-2 focus:ring-pro-accent/20 focus:outline-none"
              />
              <input
                type="tel"
                value={contactTel}
                onChange={(e) => setContactTel(e.target.value)}
                placeholder="Téléphone principal"
                className="w-full px-3 py-2 bg-white border border-pro-border rounded-md text-sm text-pro-text placeholder:text-pro-muted focus:border-pro-accent focus:ring-2 focus:ring-pro-accent/20 focus:outline-none"
              />
              <input
                type="tel"
                value={contactTel2}
                onChange={(e) => setContactTel2(e.target.value)}
                placeholder="Téléphone secondaire (optionnel)"
                className="w-full px-3 py-2 bg-white border border-pro-border rounded-md text-sm text-pro-text placeholder:text-pro-muted focus:border-pro-accent focus:ring-2 focus:ring-pro-accent/20 focus:outline-none"
              />
              <textarea
                value={contactInstr}
                onChange={(e) => setContactInstr(e.target.value)}
                placeholder="Instructions d'accès, code, étage…"
                rows={3}
                className="w-full px-3 py-2 bg-white border border-pro-border rounded-md text-sm text-pro-text placeholder:text-pro-muted focus:border-pro-accent focus:ring-2 focus:ring-pro-accent/20 focus:outline-none resize-none"
              />
              <Button
                size="sm"
                onClick={saveContactArrivee}
                disabled={savingContact}
                icon={savingContact ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              >
                Enregistrer
              </Button>
            </div>
          </Card>


          {/* GPS live */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin size={15} className="text-pro-accent" />
                <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
                  Suivi GPS
                </h3>
              </div>
              {gpsPoints.length > 0 && (
                <Badge tone="info">{gpsPoints.length} pts</Badge>
              )}
            </div>
            {gpsPoints.length === 0 ? (
              <p className="text-pro-muted text-sm">Pas de position enregistrée.</p>
            ) : (
              <div className="space-y-2">
                <GpsMapView points={gpsPoints} className="h-44 rounded-md overflow-hidden" />
                {lastGps && (
                  <p className="text-pro-muted text-xs flex items-center gap-1.5">
                    <Clock size={11} />
                    Dernier point : {new Date(lastGps.recorded_at).toLocaleTimeString("fr-FR")}
                  </p>
                )}
                <a
                  href={`https://www.google.com/maps/dir/${gpsPoints
                    .map((p) => `${p.latitude},${p.longitude}`)
                    .join("/")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-pro-accent hover:underline"
                >
                  <ExternalLink size={11} /> Ouvrir dans Google Maps
                </a>
              </div>
            )}
          </Card>

          {/* Activité live */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Activity size={15} className="text-pro-accent" />
              <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
                Activité
              </h3>
            </div>
            {history.length === 0 && !lastGps ? (
              <p className="text-pro-muted text-sm">Aucune activité récente hors modifications de prix.</p>
            ) : (
              <ul className="space-y-2">
                {lastEtape && (
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-pro-text">Étape : {lastEtape.etape}</p>
                      <p className="text-pro-muted text-xs">
                        {new Date(lastEtape.created_at).toLocaleString("fr-FR")}
                      </p>
                    </div>
                  </li>
                )}
                {history.slice(1, 5).map((h) => (
                  <li key={h.id} className="flex items-start gap-2 text-sm">
                    <Circle size={10} className="text-pro-muted mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-pro-text-soft">{h.etape}</p>
                      <p className="text-pro-muted text-xs">
                        {new Date(h.created_at).toLocaleTimeString("fr-FR")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <MissionPriceHistory trajetIds={[trajet.id]} />
          </Card>

          {/* Note admin */}
          <Card>
            <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider mb-2">
              Note interne admin
            </h3>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Notes visibles uniquement par les admins…"
              rows={4}
              className="w-full px-3 py-2 bg-white border border-pro-border rounded-md text-sm text-pro-text placeholder:text-pro-muted focus:border-pro-accent focus:ring-2 focus:ring-pro-accent/20 focus:outline-none resize-none"
            />
            <Button
              size="sm"
              className="mt-2"
              onClick={saveAdminNote}
              disabled={savingNote}
              icon={savingNote ? <Loader2 size={12} className="animate-spin" /> : null}
            >
              Enregistrer
            </Button>
          </Card>
        </div>
      </div>

      {/* Rapport */}
      {reportOpen && (
        <MissionReport attributionId={attribution.id} onClose={() => setReportOpen(false)} />
      )}
    </div>
  );
}
