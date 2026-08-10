import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Printer, Download, Loader2, FilePlus2 } from "lucide-react";
import {
  generateFicheMissionPdf,
  generatePassageAVidePdf,
  generateEdlPapierPdf,
  downloadBlob,
} from "@/lib/documents-officiels";
import { fetchCompanyInfo, isCompanyComplete, resolveClientBillingIdentity, type CompanyInfo } from "@/lib/doc-branding";

type Variant = "light" | "dark";

interface Props {
  attributionId: string;
  userId?: string | null;
  variant?: Variant;
  /** Motif pré-rempli du passage à vide (ex. déclenché depuis un incident). */
  pvPrefillMotif?: string | null;
  /** Incrémenter cette clé ouvre le formulaire passage à vide. */
  pvOpenKey?: number;
}

interface TrajetLite {
  id: string;
  numero_mission: string | null;
  depart: string;
  arrivee: string;
  date_trajet: string | null;
  heure_trajet: string | null;
  marque: string | null;
  modele: string | null;
  vehicule_type: string | null;
  vehicule_energie: string | null;
  vehicule_km: number | null;
  vehicule_notes: string | null;
  immatriculation: string | null;
  vehicule_immatriculation: string | null;
  vin: string | null;
  vehicule_vin: string | null;
  client_nom: string | null;
  client_email: string | null;
  arrivee_contact_societe: string | null;
  arrivee_contact_nom: string | null;
  arrivee_contact_prenom: string | null;
  contact_depart_nom: string | null;
  contact_depart_tel: string | null;
  contact_depart_note: string | null;
  contact_arrivee_nom: string | null;
  contact_arrivee_tel: string | null;
  contact_arrivee_note: string | null;
}

interface ConvoyeurLite {
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
  siret?: string | null;
}

interface StoredDoc {
  id: string;
  nom_fichier: string;
  url_fichier: string;
  created_at: string;
}

const PV_TYPE = "passage_a_vide";

export function MissionDocsOfficielsPanel({ attributionId, userId, variant = "light", pvPrefillMotif, pvOpenKey = 0 }: Props) {
  const dark = variant === "dark";
  const [trajet, setTrajet] = useState<TrajetLite | null>(null);
  const [convoyeur, setConvoyeur] = useState<ConvoyeurLite | null>(null);
  const [numero, setNumero] = useState<string>("");
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [pvDocs, setPvDocs] = useState<StoredDoc[]>([]);
  const [clientSociete, setClientSociete] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showPvForm, setShowPvForm] = useState(false);
  const [pvForm, setPvForm] = useState({
    vehicule_type: "",
    vehicule_modele: "",
    vehicule_immat: "",
    motif: "",
    heures: "",
    distance_km: "",
  });

  const reload = useCallback(async () => {
    const { data: attr } = await supabase
      .from("attributions")
      .select("id, trajet_id, convoyeur_id, numero_mission")
      .eq("id", attributionId)
      .maybeSingle();
    if (!attr) { setLoading(false); return; }

    const [tRes, cRes, dRes, comp] = await Promise.all([
      supabase.from("trajets").select("*").eq("id", attr.trajet_id).maybeSingle(),
      attr.convoyeur_id
        ? supabase.from("convoyeurs").select("nom, prenom, telephone, siret").eq("id", attr.convoyeur_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("mission_documents")
        .select("id, nom_fichier, url_fichier, created_at")
        .eq("attribution_id", attributionId)
        .eq("type_document", PV_TYPE)
        .order("created_at", { ascending: false }),
      fetchCompanyInfo(),
    ]);

    const t = tRes.data as unknown as TrajetLite | null;
    setTrajet(t);
    setConvoyeur((cRes.data as unknown as ConvoyeurLite | null) ?? null);
    setNumero(attr.numero_mission || t?.numero_mission || "—");
    setPvDocs((dRes.data as StoredDoc[] | null) ?? []);
    setCompany(comp);

    // Société du client (organisation / profil) — sinon nom du particulier
    let soc = (t?.arrivee_contact_societe || "").trim() || null;
    if (!soc && t?.client_email) {
      try {
        const ident = await resolveClientBillingIdentity({ email: t.client_email });
        soc = ident?.societe || null;
      } catch { /* accès restreint côté convoyeur : on garde le fallback */ }
    }
    setClientSociete(soc);
    setLoading(false);
  }, [attributionId]);

  useEffect(() => { void reload(); }, [reload]);

  // Ouverture pilotée depuis l'extérieur (panneau Incidents)
  useEffect(() => {
    if (!pvOpenKey) return;
    setShowPvForm(true);
    if (pvPrefillMotif) setPvForm((f) => ({ ...f, motif: pvPrefillMotif }));
  }, [pvOpenKey, pvPrefillMotif]);

  const convoyeurNom = convoyeur ? [convoyeur.prenom, convoyeur.nom].filter(Boolean).join(" ") : null;
  const contactArriveeNom =
    [trajet?.arrivee_contact_prenom, trajet?.arrivee_contact_nom].filter(Boolean).join(" ") ||
    trajet?.contact_arrivee_nom ||
    null;
  const contactDepartNom = trajet?.contact_depart_nom || null;
  const marqueModele =
    [trajet?.marque, trajet?.modele].filter(Boolean).join(" ") || trajet?.vehicule_type || null;
  const immat = trajet?.immatriculation || trajet?.vehicule_immatriculation || null;



  const guardCompany = () => {
    if (!isCompanyComplete(company)) {
      toast.error("Informations légales de l'entreprise incomplètes (Réglages > Informations légales).");
      return false;
    }
    return true;
  };

  const refSafe = (numero || "mission").replace(/[^a-zA-Z0-9-]/g, "");

  const downloadFiche = async () => {
    if (!trajet || !guardCompany()) return;
    setBusy("fiche");
    try {
      const blob = await generateFicheMissionPdf({
        numero,
        vehicule_marque: trajet.marque,
        vehicule_modele: trajet.modele,
        vehicule_type: trajet.vehicule_type,
        immatriculation: immat,
        vin: trajet.vin || trajet.vehicule_vin,
        carburant: trajet.vehicule_energie,
        enlevement_adresse: trajet.depart,
        enlevement_contact: [trajet.contact_depart_nom, trajet.contact_depart_tel].filter(Boolean).join(" — ") || null,
        enlevement_creneau: [trajet.date_trajet, trajet.heure_trajet].filter(Boolean).join(" ") || null,
        enlevement_instructions: trajet.contact_depart_note,
        livraison_adresse: trajet.arrivee,
        livraison_contact: [trajet.contact_arrivee_nom, trajet.contact_arrivee_tel].filter(Boolean).join(" — ") || null,
        livraison_creneau: [trajet.date_trajet, trajet.heure_trajet].filter(Boolean).join(" ") || null,
        livraison_instructions: trajet.contact_arrivee_note,
        convoyeur_nom: convoyeurNom,
        convoyeur_tel: convoyeur?.telephone ?? null,
        notes: trajet.vehicule_notes,
      }, company);
      downloadBlob(blob, `Fiche-mission-${refSafe}.pdf`);
    } catch {
      toast.error("Génération impossible");
    } finally { setBusy(null); }
  };

  const downloadEdl = async (v: "livraison" | "restitution") => {
    if (!trajet || !guardCompany()) return;
    setBusy(`edl-${v}`);
    try {
      const blob = await generateEdlPapierPdf({
        numero,
        variant: v,
        client: trajet.client_nom,
        societe: clientSociete || trajet.client_nom,
        marque_modele: marqueModele,
        immatriculation: immat,
        vin: trajet.vin || trajet.vehicule_vin,
        kilometrage_depart: trajet.vehicule_km != null ? String(trajet.vehicule_km) : null,
        carburant: trajet.vehicule_energie,
        depart: trajet.depart,
        arrivee: trajet.arrivee,
        date_prevue: trajet.date_trajet,
        convoyeur_nom: (v === "livraison" ? contactArriveeNom : contactDepartNom) || convoyeurNom,
      }, company);
      downloadBlob(blob, `EDL-${v === "livraison" ? "Livraison" : "Restitution"}-${refSafe}.pdf`);
    } catch {
      toast.error("Génération impossible");
    } finally { setBusy(null); }
  };

  const openStored = async (url: string) => {
    if (/^https?:/.test(url)) { window.open(url, "_blank"); return; }
    const { data } = await supabase.storage.from("mission-documents").createSignedUrl(url, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Document indisponible");
  };

  const generatePv = async () => {
    if (!trajet || !guardCompany()) return;
    if (!pvForm.motif.trim()) { toast.error("Indique le motif du passage à vide"); return; }
    setBusy("pv");
    try {
      const blob = await generatePassageAVidePdf({
        numero: `PAV-${refSafe}`,
        convoyeur_nom: convoyeurNom,
        convoyeur_siret: convoyeur?.siret ?? null,
        vehicule_type: pvForm.vehicule_type || null,
        vehicule_modele: pvForm.vehicule_modele || null,
        vehicule_immat: pvForm.vehicule_immat || null,
        motif: pvForm.motif,
        depart: trajet.depart,
        arrivee: trajet.arrivee,
        date_trajet: trajet.date_trajet,
        heures: pvForm.heures || null,
        distance_km: pvForm.distance_km ? Number(pvForm.distance_km) : null,
        mission_ref: numero,
      }, company);

      const filename = `Passage-a-vide-${refSafe}-${Date.now()}.pdf`;
      const path = `${attributionId}/${filename}`;
      const { error: upErr } = await supabase.storage
        .from("mission-documents")
        .upload(path, blob, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;
      const uid = userId || (await supabase.auth.getUser()).data.user?.id || "";
      const { error: insErr } = await supabase.from("mission_documents").insert({
        attribution_id: attributionId,
        uploaded_by: uid,
        type_document: PV_TYPE,
        nom_fichier: filename,
        url_fichier: path,
      });
      if (insErr) throw insErr;
      downloadBlob(blob, filename);
      toast.success("Passage à vide généré et attaché à la mission");
      setShowPvForm(false);
      setPvForm({ vehicule_type: "", vehicule_modele: "", vehicule_immat: "", motif: "", heures: "", distance_km: "" });
      await reload();
    } catch {
      toast.error("Génération du passage à vide impossible");
    } finally { setBusy(null); }
  };

  const btn = dark
    ? "w-full flex items-center gap-3 rounded-2xl border border-[rgba(120,180,255,0.16)] bg-[rgba(20,32,72,0.45)] px-4 py-3 text-left text-[14px] font-semibold text-[#EAF3FF] transition hover:border-[rgba(47,216,255,0.35)]"
    : "w-full flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-medium text-foreground transition hover:border-primary/50";
  const input = dark
    ? "w-full rounded-lg border border-[rgba(120,180,255,0.2)] bg-[rgba(10,18,48,0.6)] px-3 py-2 text-[13px] text-[#EAF3FF] outline-none"
    : "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none";

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" size={20} /></div>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      <button type="button" className={btn} onClick={() => void downloadFiche()} disabled={busy === "fiche"}>
        {busy === "fiche" ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
        <span className="flex-1">Fiche de mission</span>
        <Download size={16} className="opacity-60" />
      </button>

      <button type="button" className={btn} onClick={() => void downloadEdl("livraison")} disabled={busy === "edl-livraison"}>
        {busy === "edl-livraison" ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
        <span className="flex-1">État des lieux — Livraison</span>
        <Download size={16} className="opacity-60" />
      </button>

      <button type="button" className={btn} onClick={() => void downloadEdl("restitution")} disabled={busy === "edl-restitution"}>
        {busy === "edl-restitution" ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
        <span className="flex-1">État des lieux — Restitution</span>
        <Download size={16} className="opacity-60" />
      </button>

      {pvDocs.map((d) => (
        <button key={d.id} type="button" className={btn} onClick={() => void openStored(d.url_fichier)}>
          <FileText size={18} />
          <span className="flex-1">
            Passage à vide
            <span className="ml-2 opacity-60 text-xs">{new Date(d.created_at).toLocaleDateString("fr-FR")}</span>
          </span>
          <Download size={16} className="opacity-60" />
        </button>
      ))}

      {!showPvForm && (
        <button type="button" className={btn} onClick={() => setShowPvForm(true)}>
          <FilePlus2 size={18} />
          <span className="flex-1">Générer un passage à vide</span>
        </button>
      )}

      {showPvForm && (
        <div className={dark
          ? "rounded-2xl border border-[rgba(120,180,255,0.16)] bg-[rgba(20,32,72,0.45)] p-4 flex flex-col gap-2.5"
          : "rounded-xl border border-border bg-card p-4 flex flex-col gap-2.5"}>
          <div className={dark ? "text-[13px] font-bold text-[#EAF3FF]" : "text-sm font-semibold text-foreground"}>
            Passage à vide — {numero}
          </div>
          <input className={input} placeholder="Type de véhicule utilisé" value={pvForm.vehicule_type}
            onChange={(e) => setPvForm({ ...pvForm, vehicule_type: e.target.value })} />
          <input className={input} placeholder="Marque et modèle" value={pvForm.vehicule_modele}
            onChange={(e) => setPvForm({ ...pvForm, vehicule_modele: e.target.value })} />
          <input className={input} placeholder="Immatriculation" value={pvForm.vehicule_immat}
            onChange={(e) => setPvForm({ ...pvForm, vehicule_immat: e.target.value })} />
          <input className={input} placeholder="Motif précis du trajet à vide" value={pvForm.motif}
            onChange={(e) => setPvForm({ ...pvForm, motif: e.target.value })} />
          <div className="flex gap-2.5">
            <input className={input} placeholder="Heures (ex. 08h00 - 11h30)" value={pvForm.heures}
              onChange={(e) => setPvForm({ ...pvForm, heures: e.target.value })} />
            <input className={input} placeholder="Distance (km)" inputMode="numeric" value={pvForm.distance_km}
              onChange={(e) => setPvForm({ ...pvForm, distance_km: e.target.value.replace(/[^0-9]/g, "") })} />
          </div>
          <div className="flex gap-2.5">
            <button type="button" className={btn} onClick={() => void generatePv()} disabled={busy === "pv"}>
              {busy === "pv" ? <Loader2 size={18} className="animate-spin" /> : <FilePlus2 size={18} />}
              <span className="flex-1">Générer le document</span>
            </button>
            <button type="button" className={btn} onClick={() => setShowPvForm(false)}>
              <span className="flex-1">Annuler</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
