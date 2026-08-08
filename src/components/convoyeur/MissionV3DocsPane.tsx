import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ClipboardCheck, FileText, CreditCard, ShieldCheck, Camera, PenLine,
  ChevronRight, Upload, Loader2, Printer,
} from "lucide-react";
import { toast } from "sonner";
import { generateEdlPapierPdf, downloadBlob, type EdlPapierVariant } from "@/lib/documents-officiels";
import { MissionDocsOfficielsPanel } from "@/components/mission/MissionDocsOfficielsPanel";

export interface EdlPapierContext {
  numero: string;
  client?: string | null;
  societe?: string | null;
  marque_modele?: string | null;
  immatriculation?: string | null;
  vin?: string | null;
  kilometrage_depart?: string | null;
  carburant?: string | null;
  depart?: string | null;
  arrivee?: string | null;
  date_prevue?: string | null;
  convoyeur_nom?: string | null;
}

interface Props {
  attributionId: string;
  userId: string;
  inspectionDepartDone: boolean;
  inspectionArriveeDone: boolean;
  carteGriseAvailable: boolean;
  /** Données mission/véhicule pour pré-remplir l'état des lieux papier. */
  edlContext?: EdlPapierContext | null;
}

type DocStatus = "valide" | "attente" | "manquant";

interface DocRow {
  id: string;
  type_document: string;
  nom_fichier: string;
  url_fichier: string;
  created_at: string;
}

interface DocItem {
  key: string;
  label: string;
  status: DocStatus;
  icon: typeof FileText;
  accent: "green" | "amber" | "pink" | "cyan";
  onUpload?: () => void;
  onOpen?: () => Promise<void> | void;
  /** Type stocké en base quand le document est uploadé/scanné. */
  uploadType?: string;
  /** Nb de pages max pour le scanner natif. */
  scanPages?: number;
}


const ACCENT: Record<DocItem["accent"], { bg: string; border: string; color: string }> = {
  green: { bg: "rgba(52,232,176,0.10)", border: "rgba(52,232,176,0.35)", color: "#34E8B0" },
  amber: { bg: "rgba(255,182,72,0.10)", border: "rgba(255,182,72,0.35)", color: "#FFB648" },
  pink:  { bg: "rgba(255,80,110,0.10)", border: "rgba(255,80,110,0.35)", color: "#FF6B85" },
  cyan:  { bg: "rgba(47,216,255,0.10)", border: "rgba(47,216,255,0.35)", color: "#2FD8FF" },
};

const STATUS_LABEL: Record<DocStatus, string> = {
  valide: "Validé",
  attente: "En attente",
  manquant: "Manquant",
};

const STATUS_ACCENT: Record<DocStatus, DocItem["accent"]> = {
  valide: "green",
  attente: "amber",
  manquant: "pink",
};

export function MissionV3DocsPane({
  attributionId, userId,
  inspectionDepartDone, inspectionArriveeDone,
  carteGriseAvailable, edlContext,
}: Props) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [hasClientSig, setHasClientSig] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const reload = async () => {
    const [{ data: dRows }, { data: insps }, { data: sRows }] = await Promise.all([
      supabase.from("mission_documents").select("id, type_document, nom_fichier, url_fichier, created_at").eq("attribution_id", attributionId),
      supabase.from("inspections").select("id").eq("attribution_id", attributionId),
      supabase.from("mission_signatures" as never).select("kind").eq("attribution_id" as never, attributionId as never),
    ]);
    setDocs((dRows as DocRow[]) || []);
    const inspIds = (insps || []).map((i: { id: string }) => i.id);
    if (inspIds.length > 0) {
      const { data: pRows } = await supabase.from("inspection_photos").select("id").in("inspection_id", inspIds).limit(1);
      setPhotoCount((pRows || []).length);
    } else {
      setPhotoCount(0);
    }
    const kinds = new Set(((sRows as { kind: string }[]) || []).map(r => r.kind));
    setHasClientSig(kinds.has("client_end") || kinds.has("client_start"));
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [attributionId]);

  const findDoc = (types: string[]) => docs.find(d => types.includes(d.type_document));

  const openStored = async (url: string) => {
    if (!url) return;
    if (/^https?:/.test(url)) { window.open(url, "_blank"); return; }
    const { data } = await supabase.storage.from("mission-documents").createSignedUrl(url, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const uploadFor = async (key: string, docType: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error("Fichier trop volumineux (max 10 Mo)"); return; }
    setUploadingKey(key);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${attributionId}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage.from("mission-documents").upload(path, file, { upsert: false });
    if (upErr) { toast.error("Upload impossible"); setUploadingKey(null); return; }
    await supabase.from("mission_documents").insert({
      attribution_id: attributionId,
      uploaded_by: userId,
      type_document: docType,
      nom_fichier: file.name,
      url_fichier: path,
    });
    toast.success("Document envoyé");
    await reload();
    setUploadingKey(null);
  };

  const triggerFile = (key: string) => fileRefs.current[key]?.click();

  const [edlBusy, setEdlBusy] = useState<EdlPapierVariant | null>(null);
  const downloadEdlPapier = async (variant: EdlPapierVariant) => {
    if (!edlContext || edlBusy) return;
    setEdlBusy(variant);
    try {
      const blob = await generateEdlPapierPdf({ ...edlContext, variant });
      const ref = (edlContext.numero || "mission").replace(/[^a-zA-Z0-9-]/g, "");
      downloadBlob(blob, `EDL-${variant === "livraison" ? "Livraison" : "Restitution"}-${ref}.pdf`);
    } catch {
      toast.error("Génération du PDF impossible");
    } finally {
      setEdlBusy(null);
    }
  };

  const pvEnlev = findDoc(["pv_enlevement", "pv_depart"]);
  const contrat = findDoc(["contrat"]);
  const attest = findDoc(["assurance", "attestation_assurance"]);

  const pvLivr = findDoc(["pv_livraison", "pv_arrivee"]);
  const carteGrise = findDoc(["carte_grise"]);

  const items: DocItem[] = [
    {
      key: "pv_enlev",
      label: "Procès-verbal d'enlèvement",
      status: pvEnlev ? "valide" : inspectionDepartDone ? "valide" : "attente",
      icon: ClipboardCheck,
      accent: pvEnlev || inspectionDepartDone ? "green" : "amber",
      onOpen: pvEnlev ? () => openStored(pvEnlev.url_fichier) : undefined,
      onUpload: () => triggerFile("pv_enlev"),
      uploadType: "pv_enlevement",
      scanPages: 4,
    },
    {
      key: "pv_livraison",
      label: "Procès-verbal de livraison",
      status: pvLivr ? "valide" : inspectionArriveeDone ? "valide" : "attente",
      icon: ClipboardCheck,
      accent: pvLivr || inspectionArriveeDone ? "green" : "amber",
      onOpen: pvLivr ? () => openStored(pvLivr.url_fichier) : undefined,
      onUpload: () => triggerFile("pv_livraison"),
      uploadType: "pv_livraison",
      scanPages: 4,
    },
    {
      key: "contrat",
      label: "Contrat de convoyage",
      status: contrat ? "valide" : "attente",
      icon: FileText,
      accent: contrat ? "green" : "amber",
      onOpen: contrat ? () => openStored(contrat.url_fichier) : undefined,
      onUpload: () => triggerFile("contrat"),
      uploadType: "contrat",
      scanPages: 6,
    },
    {
      key: "cg",
      label: "Carte grise (CG)",
      status: carteGrise || carteGriseAvailable ? "valide" : "attente",
      icon: CreditCard,
      accent: carteGrise || carteGriseAvailable ? "green" : "amber",
      onOpen: carteGrise ? () => openStored(carteGrise.url_fichier) : undefined,
      onUpload: () => triggerFile("cg"),
      uploadType: "carte_grise",
      scanPages: 2,
    },
    {
      key: "assurance",
      label: "Attestation d'assurance",
      status: attest ? "valide" : "attente",
      icon: ShieldCheck,
      accent: attest ? "green" : "amber",
      onOpen: attest ? () => openStored(attest.url_fichier) : undefined,
      onUpload: () => triggerFile("assurance"),
      uploadType: "assurance",
      scanPages: 3,
    },
    {
      key: "photos",
      label: "Photos état des lieux",
      status: photoCount > 0 ? "valide" : "manquant",
      icon: Camera,
      accent: photoCount > 0 ? "green" : "pink",
    },
    {
      key: "sig_client",
      label: "Signature client (état des lieux)",
      status: hasClientSig ? "valide" : "attente",
      icon: PenLine,
      accent: hasClientSig ? "green" : "amber",
    },
  ];

  const validated = items.filter(i => i.status === "valide").length;
  const total = items.length;
  const pct = Math.round((validated / total) * 100);


  return (
    <div className="v3-docs-root">
      <style>{`
        .v3-docs-root { display: flex; flex-direction: column; gap: 12px; }
        .v3-doc-summary { position: relative; background: linear-gradient(155deg, rgba(20,32,72,0.55), rgba(10,18,48,0.55));
          border: 1px solid rgba(120,180,255,0.14); border-radius: 22px; padding: 18px; overflow: hidden; }
        .v3-doc-summary-head { display: flex; align-items: center; justify-content: space-between; }
        .v3-doc-summary-title { font-size: 15px; font-weight: 800; color: #EAF3FF; }
        .v3-doc-summary-pill { font-size: 11.5px; font-weight: 800; color: #2FD8FF;
          background: rgba(47,216,255,0.08); border: 1px solid rgba(47,216,255,0.35);
          padding: 6px 14px; border-radius: 999px; }
        .v3-doc-progress { margin-top: 14px; height: 6px; border-radius: 999px;
          background: rgba(255,255,255,0.06); overflow: hidden; }
        .v3-doc-progress-fill { height: 100%; background: linear-gradient(90deg,#2F6BFF,#2FD8FF);
          border-radius: 999px; transition: width .6s cubic-bezier(.4,0,.2,1); box-shadow: 0 0 12px rgba(47,216,255,0.5); }

        .v3-doc-item { position: relative; display: flex; align-items: center; gap: 14px;
          padding: 16px; border-radius: 20px;
          background: linear-gradient(155deg, rgba(20,32,72,0.4), rgba(10,18,48,0.4));
          border: 1px solid rgba(120,180,255,0.12); cursor: pointer; transition: all .18s;
          font-family: inherit; color: inherit; text-align: left; width: 100%; }
        .v3-doc-item:hover { border-color: rgba(47,216,255,0.28); background: rgba(255,255,255,0.03); }
        .v3-doc-icon { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; }
        .v3-doc-body { flex: 1; min-width: 0; }
        .v3-doc-label { font-size: 14.5px; font-weight: 700; color: #EAF3FF; line-height: 1.3; }
        .v3-doc-status { display: inline-flex; margin-top: 8px; font-size: 10.5px; font-weight: 800; letter-spacing: .6px;
          padding: 4px 10px; border-radius: 999px; text-transform: uppercase; }
        .v3-doc-chev { color: #5F7BB8; flex-shrink: 0; }
      `}</style>

      <div className="v3-doc-summary">
        <div className="v3-doc-summary-head">
          <div className="v3-doc-summary-title">Dossier de mission</div>
          <div className="v3-doc-summary-pill">{validated}/{total} validés</div>
        </div>
        <div className="v3-doc-progress"><div className="v3-doc-progress-fill" style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="v3-doc-summary">
        <div className="v3-doc-summary-head">
          <div className="v3-doc-summary-title">Documents officiels</div>
        </div>
        <div style={{ marginTop: 12 }}>
          <MissionDocsOfficielsPanel attributionId={attributionId} userId={userId} variant="dark" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#2FD8FF]" size={20} /></div>
      ) : (
        items.map(item => {
          const acc = ACCENT[item.accent];
          const statusAcc = ACCENT[STATUS_ACCENT[item.status]];
          const Icon = item.icon;
          const isUploading = uploadingKey === item.key
            || (item.key === "edl_papier_livraison" && edlBusy === "livraison")
            || (item.key === "edl_papier_restitution" && edlBusy === "restitution");
          const clickable = item.onOpen ?? item.onUpload;
          return (
            <div key={item.key} className="v3-doc-item" role="button" tabIndex={0}
              onClick={() => { if (isUploading) return; if (item.onOpen) void item.onOpen(); else item.onUpload?.(); }}
              onKeyDown={(e) => { if (e.key === "Enter" && clickable) { if (item.onOpen) void item.onOpen(); else item.onUpload?.(); } }}
            >
              <div className="v3-doc-icon" style={{ background: acc.bg, border: `1px solid ${acc.border}`, color: acc.color }}>
                {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Icon size={20} strokeWidth={2.2} />}
              </div>
              <div className="v3-doc-body">
                <div className="v3-doc-label">{item.label}</div>
                <span className="v3-doc-status" style={{ background: statusAcc.bg, border: `1px solid ${statusAcc.border}`, color: statusAcc.color }}>
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
              {item.onUpload && !item.onOpen ? (
                <Upload size={16} className="v3-doc-chev" />
              ) : (
                <ChevronRight size={18} className="v3-doc-chev" />
              )}
              {item.onUpload && (
                <input
                  ref={(el) => { fileRefs.current[item.key] = el; }}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const docType = item.key === "contrat" ? "contrat" : item.key === "assurance" ? "assurance" : "autre";
                      void uploadFor(item.key, docType, f);
                    }
                    e.target.value = "";
                  }}
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
