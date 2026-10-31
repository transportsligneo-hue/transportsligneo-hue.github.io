/**
 * DocumentsValidationCenter — véritable centre de validation admin des documents
 * convoyeurs. À utiliser dans le drawer / fiche convoyeur.
 *
 * Fonctions couvertes :
 *  - grille des documents attendus (permis, identité, RIB, assurance, KBIS si indépendant, autres) ;
 *  - aperçu inline (image ou PDF via <iframe>) + modale plein écran zoomable ;
 *  - téléchargement ;
 *  - validation / refus / demande de nouveau document, chacun avec commentaire ;
 *  - date d'envoi + date/auteur de validation ;
 *  - mise à jour optimiste (aucun rechargement de page) ;
 *  - envoi email + notification in-app + log activity (best-effort).
 *
 * Aucune logique métier existante n'est modifiée : la table cible reste
 * `documents_convoyeurs` avec les mêmes colonnes.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  FileText,
  Clock,
  RotateCcw,
  MessageSquare,
  Maximize2,
  X,
  Upload,
  ShieldCheck,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { confirmToast } from "@/lib/confirm-toast";
import { sendTransactionalEmail } from "@/lib/email/send";
import { notifyDriver } from "@/lib/push/driver-notify";
import {
  CONVOYEUR_DOC_TYPES,
  getConvoyeurDocLabel,
  getVisibleConvoyeurDocTypes,
  isConvoyeurDocApproved,
  normalizeConvoyeurDocType,
} from "@/lib/convoyeur-documents";

export interface DocRow {
  id: string;
  convoyeur_id: string;
  type_document: string;
  nom_fichier: string;
  url_fichier: string;
  created_at: string;
  statut_validation: string | null;
  motif_refus: string | null;
  valide_par: string | null;
  valide_le: string | null;
}

interface Props {
  convoyeurId: string;
  convoyeurEmail: string;
  convoyeurPrenom: string;
  convoyeurNom: string;
  typeConvoyeur: string;
  onChanged?: () => void;
}

type Statut = "approuve" | "refuse" | "a_renvoyer" | "en_attente";
type Filtre = "all" | Statut;

function statutMeta(s: string | null | undefined): { label: string; tone: string; Icon: typeof CheckCircle2 } {
  switch (s) {
    case "approuve":
      return { label: "Approuvé", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200", Icon: CheckCircle2 };
    case "refuse":
      return { label: "Refusé", tone: "bg-red-50 text-red-700 ring-red-200", Icon: XCircle };
    case "a_renvoyer":
      return { label: "À renvoyer", tone: "bg-orange-50 text-orange-700 ring-orange-200", Icon: RotateCcw };
    default:
      return { label: "En attente", tone: "bg-amber-50 text-amber-700 ring-amber-200", Icon: Clock };
  }
}

function isImage(name: string) {
  return /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name);
}
function isPdf(name: string) {
  return /\.pdf$/i.test(name);
}

export function DocumentsValidationCenter({
  convoyeurId,
  convoyeurEmail,
  convoyeurPrenom,
  convoyeurNom,
  typeConvoyeur,
  onChanged,
}: Props) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filtre, setFiltre] = useState<Filtre>("all");
  const [motifDlg, setMotifDlg] = useState<{ docs: DocRow[]; statut: "refuse" | "a_renvoyer" } | null>(null);
  const [motifTxt, setMotifTxt] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("documents_convoyeurs")
      .select("*")
      .eq("convoyeur_id", convoyeurId)
      .order("created_at", { ascending: false });
    setDocs((data as DocRow[]) ?? []);
    setLoading(false);
  }, [convoyeurId]);

  useEffect(() => {
    load();
  }, [load]);

  // Génère des URLs signées en batch (10 min) pour aperçu instantané.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map: Record<string, string> = {};
      await Promise.all(
        docs.map(async (d) => {
          if (d.url_fichier.startsWith("http")) {
            map[d.id] = d.url_fichier;
            return;
          }
          const { data } = await supabase.storage
            .from("convoyeur-documents")
            .createSignedUrl(d.url_fichier, 600);
          if (data?.signedUrl) map[d.id] = data.signedUrl;
        }),
      );
      if (!cancelled) setSignedUrls(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [docs]);

  const requiredTypes = useMemo(
    () => getVisibleConvoyeurDocTypes(typeConvoyeur),
    [typeConvoyeur],
  );

  const byType = useMemo(() => {
    const m: Record<string, DocRow | undefined> = {};
    for (const d of docs) {
      const normalized = normalizeConvoyeurDocType(d.type_document);
      if (!m[normalized]) m[normalized] = d;
    }
    return m;
  }, [docs]);

  const stats = useMemo(() => {
    const required = requiredTypes.filter((t) => t.required);
    const total = required.length;
    const approuves = required.filter((t) => isConvoyeurDocApproved(byType[t.key]?.statut_validation)).length;
    const refuses = required.filter((t) => byType[t.key]?.statut_validation === "refuse").length;
    const manquants = required.filter((t) => !byType[t.key]).length;
    return { total, approuves, refuses, manquants };
  }, [requiredTypes, byType]);

  /** Écrit le statut en base + trace d'activité (par document). */
  const persistStatut = async (doc: DocRow, statut: Statut, motif?: string): Promise<boolean> => {
    const { data: u } = await supabase.auth.getUser();
    const payload: Record<string, unknown> = {
      statut_validation: statut,
      motif_refus: statut === "refuse" || statut === "a_renvoyer" ? motif ?? null : null,
      valide_par: u.user?.id ?? null,
      valide_le: new Date().toISOString(),
    };
    // Optimiste
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, ...(payload as Partial<DocRow>) } : d)));
    const { error } = await supabase.from("documents_convoyeurs").update(payload as never).eq("id", doc.id);
    if (error) {
      toast.error("Échec de la mise à jour", { description: error.message });
      return false;
    }
    try {
      await supabase.rpc("log_activity" as never, {
        _action:
          statut === "approuve"
            ? "admin.document_convoyeur.approuve"
            : statut === "refuse"
              ? "admin.document_convoyeur.refuse"
              : "admin.document_convoyeur.a_renvoyer",
        _entity_type: "document_convoyeur",
        _entity_id: doc.id,
        _metadata: { type_document: doc.type_document, motif: motif ?? null, convoyeur_id: convoyeurId } as never,
      } as never);
    } catch { /* ignore */ }
    return true;
  };

  /** Prévient le convoyeur UNE seule fois (push, in-app, e-mail) même pour plusieurs documents. */
  const notifyConvoyeur = async (docsDone: DocRow[], statut: Statut, motif?: string) => {
    if (!docsDone.length) return;
    const labels = docsDone.map((d) => getConvoyeurDocLabel(d.type_document));
    const typeLabel = labels.join(", ");
    notifyDriver({
      convoyeurId,
      event: statut === "approuve" ? "document_valide" : "document_refuse",
      detail:
        statut === "approuve"
          ? typeLabel
          : `${typeLabel}${motif ? ` — ${motif}` : ""}${statut === "a_renvoyer" ? " (à renvoyer)" : ""}`,
    });
    try {
      const { data: c } = await supabase.from("convoyeurs").select("user_id").eq("id", convoyeurId).maybeSingle();
      const userId = (c as { user_id?: string } | null)?.user_id;
      if (userId) {
        const plur = docsDone.length > 1;
        await supabase.rpc("create_user_notification" as never, {
          _user_id: userId,
          _type: "document",
          _titre:
            statut === "approuve"
              ? `${plur ? "Documents approuvés" : "Document approuvé"} : ${typeLabel}`
              : statut === "refuse"
                ? `${plur ? "Documents refusés" : "Document refusé"} : ${typeLabel}`
                : `${plur ? "Documents à renvoyer" : "Document à renvoyer"} : ${typeLabel}`,
          _message: motif || null,
          _link: "/convoyeur/documents",
          _category: "document",
          _priority: statut === "approuve" ? "normal" : "high",
        } as never);
      }
    } catch { /* ignore */ }
    {
      // E-mail pour tout changement : validation, refus ou document à renvoyer.
      try {
        await sendTransactionalEmail({
          templateName: "convoyeur-document-status",
          recipientEmail: convoyeurEmail,
          idempotencyKey: `doc-${docsDone.map((d) => d.id).join("-")}-${statut}-${Date.now()}`,
          templateData: {
            prenom: convoyeurPrenom,
            nom: convoyeurNom,
            document: typeLabel,
            statut,
            motif: motif ?? "",
          },
        });
      } catch { /* template optionnel — ne bloque pas */ }
    }
  };

  const updateStatut = async (doc: DocRow, statut: Statut, motif?: string) => {
    setBusyId(doc.id);
    const ok = await persistStatut(doc, statut, motif);
    setBusyId(null);
    if (!ok) {
      await load();
      return;
    }
    await notifyConvoyeur([doc], statut, motif);
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(doc.id);
      return n;
    });
    toast.success(
      statut === "approuve" ? "Document approuvé" : statut === "refuse" ? "Document refusé" : "Demande de nouveau document envoyée",
    );
    onChanged?.();
  };

  /** Traitement en lot : une écriture par document, mais une seule notification. */
  const bulkUpdate = async (targets: DocRow[], statut: Statut, motif?: string) => {
    if (!targets.length) return;
    setBulkBusy(true);
    const done: DocRow[] = [];
    for (const d of targets) {
      if (await persistStatut(d, statut, motif)) done.push(d);
    }
    if (done.length) await notifyConvoyeur(done, statut, motif);
    setBulkBusy(false);
    setSelected(new Set());
    if (done.length !== targets.length) {
      toast.error(`${targets.length - done.length} document(s) n'ont pas pu être mis à jour`);
      await load();
    }
    if (done.length) {
      toast.success(
        `${done.length} document${done.length > 1 ? "s" : ""} ${
          statut === "approuve" ? "approuvé" : statut === "refuse" ? "refusé" : "à renvoyer"
        }${done.length > 1 ? "s" : ""}`,
      );
    }
    onChanged?.();
  };

  const askMotif = (targets: DocRow[], statut: "refuse" | "a_renvoyer") => {
    setMotifTxt("");
    setMotifDlg({ docs: targets, statut });
  };

  const confirmMotif = async () => {
    if (!motifDlg) return;
    const motif = motifTxt.trim();
    if (motifDlg.statut === "a_renvoyer" && !motif) {
      toast.error("Un message est requis pour une demande de nouveau document.");
      return;
    }
    const { docs: targets, statut } = motifDlg;
    setMotifDlg(null);
    if (targets.length === 1) await updateStatut(targets[0], statut, motif || undefined);
    else await bulkUpdate(targets, statut, motif || undefined);
  };

  const download = async (doc: DocRow) => {
    const url = signedUrls[doc.id] ?? doc.url_fichier;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openPreview = (doc: DocRow) => {
    const url = signedUrls[doc.id];
    if (!url) {
      toast.error("Aperçu indisponible");
      return;
    }
    setPreview({ url, name: doc.nom_fichier });
  };

  // Documents visibles selon le filtre ; sélectionnables = déposés et pas encore approuvés.
  const visible = requiredTypes
    .map((t) => ({ t, doc: byType[t.key] }))
    .filter(({ doc }) => filtre === "all" || (doc && (doc.statut_validation ?? "en_attente") === filtre));
  const selectable = visible.filter(({ doc }) => doc && !isConvoyeurDocApproved(doc.statut_validation)).map(({ doc }) => doc as DocRow);
  const allSelected = selectable.length > 0 && selectable.every((d) => selected.has(d.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((d) => d.id)));
  const selectedDocs = docs.filter((d) => selected.has(d.id));
  const countBy = (s: Statut) => requiredTypes.filter((t) => (byType[t.key]?.statut_validation ?? (byType[t.key] ? "en_attente" : "")) === s).length;
  const attente = countBy("en_attente");
  const totalDeposes = requiredTypes.filter((t) => byType[t.key]).length;
  const approuvesAll = requiredTypes.filter((t) => isConvoyeurDocApproved(byType[t.key]?.statut_validation)).length;
  const pct = requiredTypes.length ? Math.round((approuvesAll / requiredTypes.length) * 100) : 0;
  const initiales = `${convoyeurPrenom?.[0] ?? ""}${convoyeurNom?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="dvc space-y-4">
      {/* Bandeau */}
      <div className="dvc-hero">
        <div className="dvc-hl">
          <span className="dvc-av">{initiales || "?"}</span>
          <div className="min-w-0">
            <small>Convoyeurs › Documents</small>
            <h2>{convoyeurPrenom} {convoyeurNom}</h2>
            <span className="dvc-sub">{typeConvoyeur === "independant" || typeConvoyeur === "indépendant" ? "Indépendant" : typeConvoyeur}</span>
          </div>
        </div>
        <div className="dvc-hr">
          <div className="dvc-kp"><small>Reçus</small><b>{totalDeposes}/{requiredTypes.length}</b></div>
          <div className="dvc-kp"><small>À traiter</small><b>{attente}</b></div>
          <div className="dvc-kp"><small>Manquants</small><b>{stats.manquants}</b></div>
          <div className="dvc-ring" style={{ ["--p" as string]: pct }}>
            <i><span>{approuvesAll}/{requiredTypes.length}</span><small>validés</small></i>
          </div>
        </div>
      </div>

      {/* Barre d'outils : tout sélectionner + filtres */}
      <div className="dvc-tool">
        <button type="button" className="dvc-all" onClick={toggleAll} disabled={selectable.length === 0}>
          <span className={`dvc-chk ${allSelected ? "on" : ""}`}><Check size={13} strokeWidth={3} /></span>
          {allSelected ? "Tout désélectionner" : "Tout sélectionner (à traiter)"}
        </button>
        <div className="dvc-chips">
          {([
            ["all", "Tous", requiredTypes.length],
            ["en_attente", "En attente", countBy("en_attente")],
            ["approuve", "Approuvés", countBy("approuve")],
            ["refuse", "Refusés", countBy("refuse")],
            ["a_renvoyer", "À renvoyer", countBy("a_renvoyer")],
          ] as [Filtre, string, number][]).map(([k, l, n]) => (
            <button key={k} type="button" className={`dvc-chip ${filtre === k ? "act" : ""}`} onClick={() => setFiltre(k)}>
              {l}<b>{n}</b>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Chargement des documents…</div>
      ) : (
        <div className="dvc-grid">
          {visible.map(({ t, doc }) => {
            const meta = statutMeta(doc?.statut_validation);
            const url = doc ? signedUrls[doc.id] : undefined;
            const showThumb = doc && url && isImage(doc.nom_fichier);
            const showPdf = doc && url && isPdf(doc.nom_fichier);
            const approved = doc ? isConvoyeurDocApproved(doc.statut_validation) : false;
            const on = !!doc && selected.has(doc.id);
            const tone = approved ? "ok" : doc?.statut_validation === "refuse" ? "ko" : doc?.statut_validation === "a_renvoyer" ? "or" : doc ? "wa" : "mi";
            return (
              <div key={t.key} className={`dvc-card ${on ? "on" : ""} ${!doc ? "miss" : ""}`}>
                {doc && !approved && (
                  <button type="button" className="dvc-sel" onClick={() => toggle(doc.id)} aria-label={`Sélectionner ${t.label}`}>
                    <span className={`dvc-chk ${on ? "on" : ""}`}><Check size={13} strokeWidth={3} /></span>
                  </button>
                )}
                <div className={`dvc-ct ${doc && !approved ? "" : "nosel"}`}>
                  <h3>{t.label}</h3>
                  <span className={`dvc-st ${tone}`}>
                    <i />
                    {doc ? meta.label : "Manquant"}
                  </span>
                </div>

                <div className="dvc-pv" onClick={() => doc && url && openPreview(doc)}>
                  {showThumb ? (
                    <img src={url} alt={t.label} loading="lazy" className="max-h-36 w-auto object-contain" />
                  ) : showPdf ? (
                    <div className="dvc-pg"><i /><i /><i /><i /><i /><i /><i /><i /></div>
                  ) : doc ? (
                    <span className="dvc-mis">Aperçu indisponible</span>
                  ) : (
                    <span className="dvc-mis"><Upload size={22} className="mx-auto mb-1" />Aucun fichier déposé</span>
                  )}
                  {doc && url && <span className="dvc-ex"><Maximize2 size={13} /></span>}
                </div>

                <div className="dvc-info">
                  {doc ? (
                    <>
                      <b title={doc.nom_fichier}>{doc.nom_fichier}</b>
                      Envoyé le {new Date(doc.created_at).toLocaleDateString("fr-FR")} à{" "}
                      {new Date(doc.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      {doc.valide_le && (
                        <><br />{approved ? "Validé" : "Traité"} le {new Date(doc.valide_le).toLocaleDateString("fr-FR")}</>
                      )}
                      {doc.motif_refus && (
                        <span className="dvc-motif"><MessageSquare size={11} /> {doc.motif_refus}</span>
                      )}
                    </>
                  ) : (
                    <i>Le convoyeur n'a pas encore transmis ce document.</i>
                  )}
                </div>

                {doc && (
                  <div className="dvc-act">
                    <button type="button" className="dvc-b g" onClick={() => openPreview(doc)}><Eye size={14} />Ouvrir</button>
                    <button type="button" className="dvc-b g" onClick={() => download(doc)}><Download size={14} />Télécharger</button>
                    <button type="button" className="dvc-b ok" disabled={busyId === doc.id || approved} onClick={() => updateStatut(doc, "approuve")}><CheckCircle2 size={14} />Approuver</button>
                    <button type="button" className="dvc-b ko" disabled={busyId === doc.id || doc.statut_validation === "refuse"} onClick={() => askMotif([doc], "refuse")}><XCircle size={14} />Refuser</button>
                    <button type="button" className="dvc-b or" disabled={busyId === doc.id} onClick={() => askMotif([doc], "a_renvoyer")}><RotateCcw size={14} />Nouveau doc</button>
                  </div>
                )}
              </div>
            );
          })}
          {visible.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              Aucun document dans ce filtre.
            </div>
          )}
        </div>
      )}

      {/* Bypass admin */}
      <BypassPanel
        convoyeurId={convoyeurId}
        onDone={async () => {
          await load();
          onChanged?.();
        }}
      />

      {/* Barre d'actions en lot */}
      <div className={`dvc-bar ${selectedDocs.length > 0 ? "show" : ""}`} role="toolbar" aria-label="Actions sur la sélection">
        <div>
          <span className="n">{selectedDocs.length}</span>
          <small>sélectionné{selectedDocs.length > 1 ? "s" : ""}</small>
        </div>
        <button type="button" className="dvc-b ok" disabled={bulkBusy} onClick={() => bulkUpdate(selectedDocs, "approuve")}>
          <CheckCircle2 size={14} />{bulkBusy ? "Validation…" : "Valider la sélection"}
        </button>
        <button type="button" className="dvc-b ko" disabled={bulkBusy} onClick={() => askMotif(selectedDocs, "refuse")}>Refuser</button>
        <button type="button" className="dvc-b g" disabled={bulkBusy} onClick={() => askMotif(selectedDocs, "a_renvoyer")}>Demander un nouveau doc</button>
        <button type="button" className="dvc-b g" disabled={bulkBusy} onClick={() => setSelected(new Set())}>Annuler</button>
      </div>

      {/* Motif (un seul pour toute la sélection) */}
      {motifDlg && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/60 p-4" onClick={() => setMotifDlg(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-[17px] font-bold text-slate-900">
              {motifDlg.statut === "refuse" ? "Refuser" : "Demander un nouveau document"}
              {motifDlg.docs.length > 1 ? ` (${motifDlg.docs.length} documents)` : ""}
            </h4>
            <p className="mt-1 text-[12.5px] text-slate-500">
              {motifDlg.docs.length > 1
                ? "Un seul motif pour toute la sélection, un seul message au convoyeur."
                : motifDlg.statut === "refuse"
                  ? "Motif du refus (visible par le convoyeur)."
                  : "Précisez ce que vous attendez pour ce nouveau document."}
            </p>
            <textarea
              autoFocus
              value={motifTxt}
              onChange={(e) => setMotifTxt(e.target.value)}
              placeholder="Message visible par le convoyeur…"
              className="mt-3 h-24 w-full resize-none rounded-xl border border-slate-200 p-3 text-[13px] outline-none focus:border-[#2f5fff]"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="dvc-b g" onClick={() => setMotifDlg(null)}>Annuler</button>
              <button type="button" className="dvc-b pr" onClick={confirmMotif}>Envoyer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale plein écran */}
      {preview && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <button
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 hover:bg-white/20 text-white p-2"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
          <div
            className="bg-white rounded-xl overflow-hidden max-w-5xl w-full max-h-[92vh] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 text-sm text-slate-700">
              <span className="truncate">{preview.name}</span>
              <a href={preview.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs">
                <Download size={12} /> Télécharger
              </a>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center">
              {isPdf(preview.name) ? (
                <iframe src={preview.url} title={preview.name} className="w-full h-[85vh]" />
              ) : (
                <img src={preview.url} alt={preview.name} className="max-w-full max-h-[85vh] object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Bypass admin : forcer approbation d'un doc absent ---------- */

function BypassPanel({ convoyeurId, onDone }: { convoyeurId: string; onDone: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("");
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);

  const force = async () => {
    if (!type) {
      toast.error("Sélectionnez un type de document");
      return;
    }
    if (!motif.trim()) {
      toast.error("Un motif de bypass est requis (tracé dans l'historique).");
      return;
    }
    if (!(await confirmToast("Forcer l'approbation de ce document sans fichier ? Cette action sera tracée."))) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    // Crée une ligne "bypass" pour matérialiser l'approbation.
    const { data, error } = await supabase
      .from("documents_convoyeurs")
      .insert({
        convoyeur_id: convoyeurId,
        type_document: type,
        nom_fichier: `BYPASS_ADMIN_${type}.txt`,
        url_fichier: `bypass/${convoyeurId}/${type}`,
        statut_validation: "approuve",
        motif_refus: `[BYPASS ADMIN] ${motif.trim()}`,
        valide_par: u.user?.id ?? null,
        valide_le: new Date().toISOString(),
      } as never)
      .select("id")
      .single();
    if (error) {
      setBusy(false);
      toast.error("Bypass impossible", { description: error.message });
      return;
    }
    try {
      await supabase.rpc("log_activity" as never, {
        _action: "admin.document_convoyeur.bypass",
        _entity_type: "document_convoyeur",
        _entity_id: (data as { id: string }).id,
        _metadata: { type_document: type, motif: motif.trim(), convoyeur_id: convoyeurId } as never,
      } as never);
    } catch { /* ignore */ }
    setBusy(false);
    setOpen(false);
    setType("");
    setMotif("");
    toast.success("Document forcé (bypass admin)");
    await onDone();
  };

  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 text-xs font-semibold text-amber-800 hover:text-amber-900"
      >
        <ShieldCheck size={13} /> Mode bypass administrateur {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="mt-3 space-y-2 text-xs text-amber-900">
          <p className="opacity-80">
            Approuve manuellement un document même s'il n'a pas encore été transmis. Chaque bypass est enregistré dans l'historique avec l'administrateur, la date et le motif.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs"
            >
              <option value="">Type de document…</option>
              {CONVOYEUR_DOC_TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
            <input
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Motif du bypass (obligatoire)"
              className="sm:col-span-2 rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs"
            />
          </div>
          <button
            onClick={force}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            <ShieldCheck size={12} /> Forcer l'approbation
          </button>
        </div>
      )}
    </div>
  );
}
