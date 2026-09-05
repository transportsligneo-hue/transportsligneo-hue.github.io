/**
 * AdminScanDocumentPanel · scan / import intelligent de documents (admin).
 *
 * Section dédiée de l'espace admin (plus de bouton flottant) :
 *   1. Choix du type de document (devis signé, PV de livraison, PV de
 *      restitution, carte grise, EDL papier, facture, bon de commande,
 *      mandat, autre + champ libre).
 *   2. Capture photo via PremiumScanner OU import d'un fichier existant
 *      (photo ou PDF en pièce jointe).
 *   3. OCR : numéro de mission, client, plaque, date.
 *   4. Écran de confirmation (jamais de classement silencieux) ou recherche
 *      manuelle avec autocomplétion.
 *   5. Upload dans le bucket mission-documents + ligne mission_documents
 *      (visible client) + journal document_scan_logs (traçabilité).
 *   6. "Ajouter un autre document" pour enchaîner.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ScanLine, Loader2, Check, Search, AlertTriangle, Upload,
  FileSignature, FileCheck2, ClipboardList, Receipt, FileText, RotateCcw, IdCard, Handshake,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PremiumScanner } from "@/components/scanner/PremiumScanner";
import { scanDocumentExtract } from "@/lib/scanner/scan-document.functions";
import type { ExtractionResult } from "@/lib/scanner/types";

/* ------------------------------------------------------------------ types */

const DOC_TYPES = [
  { value: "devis_signe", label: "Devis signé", icon: FileSignature, hint: "devis" },
  { value: "pv_livraison", label: "PV de livraison", icon: FileCheck2, hint: "pv_livraison" },
  { value: "pv_restitution", label: "PV de restitution", icon: FileCheck2, hint: "pv_restitution" },
  { value: "carte_grise", label: "Carte grise", icon: IdCard, hint: "carte_grise" },
  { value: "edl_papier", label: "État des lieux papier", icon: ClipboardList, hint: "pv_livraison" },
  { value: "facture", label: "Facture", icon: Receipt, hint: "facture" },
  { value: "bon_commande", label: "Bon de commande", icon: FileText, hint: "bon_commande" },
  { value: "mandat", label: "Mandat", icon: Handshake, hint: "mandat" },
  { value: "autre", label: "Autre", icon: FileText, hint: "" },
] as const;

type DocTypeValue = (typeof DOC_TYPES)[number]["value"];

interface MissionOption {
  attributionId: string;
  numero: string;
  clientNom: string;
  clientEmail: string;
  immat: string;
  vehicule: string;
}

type Step = "type" | "ocr" | "confirm" | "done";

/* -------------------------------------------------------------- utilitaires */

const norm = (s?: string | null) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const normPlate = (s?: string | null) => norm(s).replace(/[^A-Z0-9]/g, "");

/** Extrait un numéro de mission/devis d'un texte OCR : MIS-TLG-2026-#123. */
function findNumero(text: string): string | null {
  const m = /\b(MIS|DEV|PV)[\s-]*TLG[\s-]*(\d{4})[\s-]*#?\s*([0-9]+(?:[.\-][A-Z0-9]+)?)/i.exec(text);
  if (!m) return null;
  return `${m[1].toUpperCase()}-TLG-${m[2]}-#${m[3].toUpperCase()}`;
}

/** Clé de comparaison : on ignore le préfixe (MIS/DEV/PV) et la ponctuation. */
const numeroKey = (n?: string | null) =>
  norm(n).replace(/^(MIS|DEV|PV)[-\s]*TLG[-\s]*/, "").replace(/[^0-9A-Z.]/g, "");

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/* ---------------------------------------------------------------- composant */

export function AdminScanDocumentPanel() {
  const { user } = useAuth();
  const extract = useServerFn(scanDocumentExtract);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<Step>("type");
  const [docType, setDocType] = useState<DocTypeValue>("devis_signe");
  const [typeLibre, setTypeLibre] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  const [blob, setBlob] = useState<Blob | null>(null);
  const [mime, setMime] = useState("image/jpeg");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [ocrFailed, setOcrFailed] = useState(false);

  const [missions, setMissions] = useState<MissionOption[]>([]);
  const [suggestion, setSuggestion] = useState<{ mission: MissionOption; auto: boolean } | null>(null);
  const [selected, setSelected] = useState<MissionOption | null>(null);
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  /* charge la liste des missions */
  useEffect(() => {
    if (missions.length) return;
    (async () => {
      const { data, error } = await supabase
        .from("attributions")
        .select("id, numero_mission, trajets(numero_mission, client_nom, client_email, immatriculation, marque, modele)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        console.warn("[scan] missions load", error);
        return;
      }
      const rows = (data || []) as unknown as Array<{
        id: string;
        numero_mission: string | null;
        trajets: {
          numero_mission: string | null; client_nom: string | null; client_email: string | null;
          immatriculation: string | null; marque: string | null; modele: string | null;
        } | null;
      }>;
      setMissions(
        rows.map((r) => ({
          attributionId: r.id,
          numero: r.numero_mission || r.trajets?.numero_mission || "—",
          clientNom: r.trajets?.client_nom || "",
          clientEmail: r.trajets?.client_email || "",
          immat: r.trajets?.immatriculation || "",
          vehicule: [r.trajets?.marque, r.trajets?.modele].filter(Boolean).join(" "),
        })),
      );
    })();
  }, [missions.length]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const resetDoc = useCallback(() => {
    setBlob(null);
    setMime("image/jpeg");
    setPreviewUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
    setExtraction(null);
    setOcrFailed(false);
    setSuggestion(null);
    setSelected(null);
    setManual(false);
    setQuery("");
  }, []);

  /* ------------------------------------------------------ rapprochement OCR */

  const matchMission = useCallback((res: ExtractionResult | null): { mission: MissionOption; auto: boolean } | null => {
    if (!res || !missions.length) return null;
    const f = res.fields;
    const haystack = [res.raw_text, f.numero_dossier, f.numero_commande, f.numero_facture].filter(Boolean).join("\n");
    const numero = findNumero(haystack);

    if (numero) {
      const key = numeroKey(numero);
      const hit = missions.find((m) => numeroKey(m.numero) === key);
      if (hit) return { mission: hit, auto: true };
    }

    const plate = normPlate(f.immatriculation);
    if (plate.length >= 6) {
      const hit = missions.find((m) => normPlate(m.immat) === plate);
      if (hit) return { mission: hit, auto: true };
    }

    const nom = norm(f.client_nom || f.titulaire_nom);
    if (nom.length >= 4) {
      const hit = missions.find((m) => {
        const c = norm(m.clientNom);
        return c.length >= 4 && (c === nom || c.includes(nom) || nom.includes(c));
      });
      if (hit) return { mission: hit, auto: false };
    }
    return null;
  }, [missions]);

  /* ---------------------------------------------------- capture / import */

  const processDocument = useCallback(async (file: Blob, fileMime: string) => {
    setBlob(file);
    setMime(fileMime);
    setPreviewUrl(URL.createObjectURL(file));
    setStep("ocr");
    setOcrFailed(false);

    if (!fileMime.startsWith("image/")) {
      // PDF ou autre : pas d'OCR image, classement manuel.
      setManual(true);
      setStep("confirm");
      return;
    }

    try {
      const dataUrl = await blobToDataUrl(file);
      const hint = DOC_TYPES.find((d) => d.value === docType)?.hint || undefined;
      const res = await extract({ data: { image_data_url: dataUrl, hint_type: hint } });
      if (!res.ok) {
        setOcrFailed(true);
        setManual(true);
        setStep("confirm");
        return;
      }
      setExtraction(res.extraction);
      const match = matchMission(res.extraction);
      setSuggestion(match);
      setSelected(match?.mission ?? null);
      setManual(!match);
      setStep("confirm");
    } catch (err) {
      console.error("[scan] ocr", err);
      setOcrFailed(true);
      setManual(true);
      setStep("confirm");
    }
  }, [docType, extract, matchMission]);

  const handleCapture = useCallback((pages: Blob[]) => {
    setScannerOpen(false);
    const page = pages[0];
    if (!page) return;
    void processDocument(page, "image/jpeg");
  }, [processDocument]);

  const openScanner = useCallback(() => {
    if (isNativeScannerAvailable()) {
      void (async () => {
        const res = await scanNativeDocument({ maxPages: 1, filename: "document" });
        if (res.status === "success" && res.files[0]) {
          void processDocument(res.files[0], res.files[0].type || "image/jpeg");
          return;
        }
        if (res.status === "cancelled") return;
        if (res.status === "error") {
          toast.error("Scanner indisponible", { description: res.message });
        }
        setScannerOpen(true);
      })();
      return;
    }
    setScannerOpen(true);
  }, [processDocument]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void processDocument(file, file.type || "application/octet-stream");
  }, [processDocument]);


  /* ------------------------------------------------------------- classement */

  const typeLabel = useMemo(() => {
    if (docType === "autre") return typeLibre.trim() || "Autre document";
    return DOC_TYPES.find((d) => d.value === docType)?.label || docType;
  }, [docType, typeLibre]);

  const save = useCallback(async () => {
    if (!blob || !selected || !user) return;
    setSaving(true);
    try {
      const stamp = Date.now();
      const ext = mime.includes("pdf") ? "pdf" : mime.includes("png") ? "png" : "jpg";
      const safe = `${docType}-${(selected.numero || "mission").replace(/[^a-zA-Z0-9.-]/g, "")}-${stamp}.${ext}`;
      const path = `${selected.attributionId}/${safe}`;
      const { error: upErr } = await supabase.storage
        .from("mission-documents")
        .upload(path, blob, { contentType: mime });
      if (upErr) throw upErr;

      const { data: docRow, error: insErr } = await supabase
        .from("mission_documents")
        .insert({
          attribution_id: selected.attributionId,
          type_document: docType === "autre" ? "autre" : docType,
          nom_fichier: `${typeLabel} — ${selected.numero}.${ext}`,
          url_fichier: path,
          uploaded_by: user.id,
          ajoute_par: "admin",
          visible_client: true,
          visible_driver: false,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      const f = extraction?.fields;
      await supabase.from("document_scan_logs").insert({
        mission_document_id: docRow?.id ?? null,
        attribution_id: selected.attributionId,
        numero_mission: selected.numero,
        type_document: docType,
        type_libre: docType === "autre" ? typeLibre.trim() || null : null,
        scanned_by: user.id,
        classement: suggestion?.auto && suggestion.mission.attributionId === selected.attributionId ? "automatique" : "manuel",
        confiance: extraction?.confidence ?? null,
        ocr_numero: findNumero(extraction?.raw_text || "") ?? null,
        ocr_client: f?.client_nom || f?.titulaire_nom || null,
        ocr_plaque: f?.immatriculation || null,
        ocr_date: f?.date_livraison || null,
      });

      toast.success(`Document classé sur ${selected.numero}`);
      setSavedCount((n) => n + 1);
      setStep("done");
    } catch (err) {
      console.error("[scan] save", err);
      toast.error("Classement impossible", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }, [blob, selected, user, docType, typeLabel, extraction, suggestion, typeLibre, mime]);

  /* --------------------------------------------------------------- recherche */

  const results = useMemo(() => {
    const q = norm(query);
    const qp = normPlate(query);
    if (!q) return missions.slice(0, 12);
    return missions
      .filter((m) =>
        numeroKey(m.numero).includes(numeroKey(query)) ||
        norm(m.clientNom).includes(q) ||
        norm(m.clientEmail).includes(q) ||
        (qp.length >= 3 && normPlate(m.immat).includes(qp)),
      )
      .slice(0, 20);
  }, [missions, query]);

  /* ------------------------------------------------------------------ rendu */

  return (
    <div className="max-w-3xl">
      <div className="rounded-2xl bg-[#0b1026] border border-white/10 text-white shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
          <ScanLine size={18} className="text-[#d4af37]" />
          <h2 className="font-semibold">Scanner ou importer un document</h2>
        </div>

        <div className="p-5 space-y-4">
          {/* 1. type */}
          {step === "type" && (
            <>
              <p className="text-sm text-white/70">Quel type de document allez-vous ajouter ?</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {DOC_TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = docType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setDocType(t.value)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm transition ${
                        active
                          ? "border-[#d4af37] bg-[#d4af37]/15 text-white"
                          : "border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.07]"
                      }`}
                    >
                      <Icon size={16} className={active ? "text-[#d4af37]" : "text-white/50"} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
              {docType === "autre" && (
                <input
                  value={typeLibre}
                  onChange={(e) => setTypeLibre(e.target.value)}
                  placeholder="Précisez le type de document"
                  className="w-full rounded-lg bg-white/[0.05] border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#d4af37]"
                />
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#e7c76a] text-[#0b1026] font-semibold py-3 text-sm"
                >
                  <ScanLine size={16} /> Prendre une photo
                </button>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 py-3 text-sm text-white/90 hover:bg-white/[0.06]"
                >
                  <Upload size={16} /> Importer un fichier (photo ou PDF)
                </button>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFile}
                className="hidden"
              />
              {savedCount > 0 && (
                <p className="text-xs text-white/50 text-center">{savedCount} document(s) classé(s) dans cette session.</p>
              )}
            </>
          )}

          {/* 2. OCR */}
          {step === "ocr" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Loader2 className="animate-spin text-[#d4af37]" />
              <p className="text-sm text-white/70">Lecture automatique du document…</p>
            </div>
          )}

          {/* 3. confirmation */}
          {step === "confirm" && (
            <>
              {previewUrl && mime.startsWith("image/") && (
                <img src={previewUrl} alt="Aperçu du document" className="w-full max-h-56 object-contain rounded-lg border border-white/10 bg-black/30" />
              )}
              {previewUrl && !mime.startsWith("image/") && (
                <p className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-xs text-white/70">
                  Fichier PDF prêt à être classé (pas de lecture automatique).
                </p>
              )}

              {ocrFailed && (
                <div className="flex gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-200">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>Lecture automatique impossible (photo floue ou peu lisible). Reprenez la photo ou classez le document manuellement.</span>
                </div>
              )}

              {suggestion && !manual && (
                <div className="rounded-xl border border-[#d4af37]/40 bg-[#d4af37]/10 p-4 space-y-1">
                  <p className="text-sm">
                    Ce document semble correspondre à la mission{" "}
                    <strong>{suggestion.mission.numero}</strong>
                    {suggestion.mission.clientNom ? <> — {suggestion.mission.clientNom}</> : null}.
                  </p>
                  {suggestion.mission.immat && (
                    <p className="text-xs text-white/60">{suggestion.mission.vehicule} · {suggestion.mission.immat}</p>
                  )}
                  <p className="text-xs text-white/50">
                    {suggestion.auto ? "Correspondance forte" : "Correspondance approximative — vérifiez"}
                    {typeof extraction?.confidence === "number" ? ` · confiance OCR ${Math.round(extraction.confidence * 100)} %` : ""}
                  </p>
                </div>
              )}

              {(manual || !suggestion) && (
                <div className="space-y-2">
                  <label className="text-xs text-white/60">Rechercher la mission ou le client</label>
                  <div className="flex items-center gap-2 rounded-lg bg-white/[0.05] border border-white/15 px-3">
                    <Search size={15} className="text-white/40" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="N° mission, client ou plaque"
                      className="flex-1 bg-transparent py-2 text-sm outline-none"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">
                    {results.length === 0 && <p className="p-3 text-xs text-white/50">Aucune mission trouvée.</p>}
                    {results.map((m) => (
                      <button
                        key={m.attributionId}
                        type="button"
                        onClick={() => setSelected(m)}
                        className={`w-full text-left px-3 py-2 text-sm transition ${
                          selected?.attributionId === m.attributionId ? "bg-[#d4af37]/15" : "hover:bg-white/[0.06]"
                        }`}
                      >
                        <span className="font-medium">{m.numero}</span>
                        <span className="block text-xs text-white/55">
                          {[m.clientNom, m.vehicule, m.immat].filter(Boolean).join(" · ")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-white/50">
                Type : <span className="text-white/80">{typeLabel}</span>
                {selected && <> · Destination : <span className="text-white/80">{selected.numero}</span></>}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!selected || saving}
                  onClick={save}
                  className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#e7c76a] text-[#0b1026] font-semibold py-2.5 text-sm disabled:opacity-50"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Confirmer le classement
                </button>
                {suggestion && !manual && (
                  <button type="button" onClick={() => setManual(true)} className="rounded-lg border border-white/20 px-3 py-2.5 text-sm">
                    Corriger
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { resetDoc(); setStep("type"); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2.5 text-sm"
                >
                  <RotateCcw size={14} /> Recommencer
                </button>
              </div>
            </>
          )}

          {/* 4. terminé */}
          {step === "done" && (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto w-11 h-11 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center">
                <Check className="text-emerald-300" size={20} />
              </div>
              <p className="text-sm text-white/80">
                Document classé sur <strong>{selected?.numero}</strong>. Il est visible côté admin et dans l'espace client.
              </p>
              <button
                type="button"
                onClick={() => { resetDoc(); setStep("type"); }}
                className="w-full rounded-lg bg-gradient-to-r from-[#d4af37] to-[#e7c76a] text-[#0b1026] font-semibold py-2.5 text-sm"
              >
                Ajouter un autre document
              </button>
            </div>
          )}
        </div>
      </div>

      {scannerOpen && (
        <PremiumScanner
          title={typeLabel}
          hint="Cadrez le document dans le rectangle"
          multiPage={false}
          onCancel={() => setScannerOpen(false)}
          onCapture={handleCapture}
        />
      )}
    </div>
  );
}
