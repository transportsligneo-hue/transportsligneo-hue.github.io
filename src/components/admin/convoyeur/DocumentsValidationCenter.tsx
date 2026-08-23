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

  const updateStatut = async (doc: DocRow, statut: Statut, motif?: string) => {
    setBusyId(doc.id);
    const { data: u } = await supabase.auth.getUser();
    const payload: Record<string, unknown> = {
      statut_validation: statut,
      motif_refus: statut === "refuse" || statut === "a_renvoyer" ? motif ?? null : null,
      valide_par: u.user?.id ?? null,
      valide_le: new Date().toISOString(),
    };
    // Optimistic
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, ...(payload as Partial<DocRow>) } : d)));
    const { error } = await supabase.from("documents_convoyeurs").update(payload as never).eq("id", doc.id);
    setBusyId(null);
    if (error) {
      toast.error("Échec de la mise à jour", { description: error.message });
      await load();
      return;
    }

    // Trace + email best-effort (non bloquant).
    const typeLabel = getConvoyeurDocLabel(doc.type_document);
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

    notifyDriver({
      convoyeurId,
      event: statut === "approuve" ? "document_valide" : "document_refuse",
      detail:
        statut === "approuve"
          ? typeLabel
          : `${typeLabel}${motif ? ` — ${motif}` : ""}${statut === "a_renvoyer" ? " (à renvoyer)" : ""}`,
    });

    // Notification in-app (RPC SECURITY DEFINER).
    try {
      const { data: c } = await supabase
        .from("convoyeurs")
        .select("user_id")
        .eq("id", convoyeurId)
        .maybeSingle();
      const userId = (c as { user_id?: string } | null)?.user_id;
      if (userId) {
        await supabase.rpc("create_user_notification" as never, {
          _user_id: userId,
          _type: "document",
          _titre:
            statut === "approuve"
              ? `Document approuvé : ${typeLabel}`
              : statut === "refuse"
                ? `Document refusé : ${typeLabel}`
                : `Document à renvoyer : ${typeLabel}`,
          _message: motif || null,
          _link: "/convoyeur/documents",
          _category: "document",
          _priority: statut === "approuve" ? "normal" : "high",
        } as never);
      }
    } catch { /* ignore */ }

    if (statut !== "approuve") {
      try {
        await sendTransactionalEmail({
          templateName: "convoyeur-document-status",
          recipientEmail: convoyeurEmail,
          idempotencyKey: `doc-${doc.id}-${statut}-${Date.now()}`,
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

    toast.success(
      statut === "approuve"
        ? "Document approuvé"
        : statut === "refuse"
          ? "Document refusé"
          : "Demande de nouveau document envoyée",
    );
    onChanged?.();
  };

  const askMotifAndUpdate = async (doc: DocRow, statut: "refuse" | "a_renvoyer") => {
    const promptTxt =
      statut === "refuse"
        ? "Motif du refus (visible par le convoyeur) :"
        : "Précisez ce que vous attendez pour ce nouveau document :";
    const motif = window.prompt(promptTxt) ?? "";
    if (statut === "a_renvoyer" && !motif.trim()) {
      toast.error("Un message est requis pour une demande de nouveau document.");
      return;
    }
    await updateStatut(doc, statut, motif.trim() || undefined);
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

  return (
    <div className="space-y-4">
      {/* Compteurs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Requis", value: stats.total, tone: "bg-slate-50 text-slate-700 ring-slate-200" },
          { label: "Approuvés", value: stats.approuves, tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
          { label: "Refusés", value: stats.refuses, tone: "bg-red-50 text-red-700 ring-red-200" },
          { label: "Manquants", value: stats.manquants, tone: "bg-amber-50 text-amber-700 ring-amber-200" },
        ].map((c) => (
          <div key={c.label} className={`rounded-lg ring-1 ring-inset px-3 py-2 ${c.tone}`}>
            <p className="text-[10px] uppercase tracking-wide opacity-70">{c.label}</p>
            <p className="text-lg font-semibold leading-tight">{c.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Chargement des documents…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {requiredTypes.map((t) => {
            const doc = byType[t.key];
            const meta = statutMeta(doc?.statut_validation);
            const url = doc ? signedUrls[doc.id] : undefined;
            const showThumb = doc && url && isImage(doc.nom_fichier);
            const showPdf = doc && url && isPdf(doc.nom_fichier);

            return (
              <div
                key={t.key}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                  <FileText size={14} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-800">{t.label}</span>
                  {doc ? (
                    <span
                      className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${meta.tone}`}
                    >
                      <meta.Icon size={11} />
                      {meta.label}
                    </span>
                  ) : (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ring-slate-200">
                      <Upload size={11} /> Manquant
                    </span>
                  )}
                </div>

                {/* Aperçu */}
                <div className="relative bg-slate-50 min-h-[140px] flex items-center justify-center">
                  {showThumb ? (
                    <img
                      src={url}
                      alt={t.label}
                      loading="lazy"
                      className="max-h-40 w-auto object-contain cursor-zoom-in"
                      onClick={() => doc && openPreview(doc)}
                    />
                  ) : showPdf ? (
                    <div className="flex flex-col items-center gap-2 py-6 text-slate-500">
                      <FileText size={28} className="text-red-500" />
                      <span className="text-xs">Fichier PDF</span>
                      <button
                        onClick={() => doc && openPreview(doc)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <Eye size={12} /> Prévisualiser
                      </button>
                    </div>
                  ) : doc ? (
                    <div className="text-xs text-slate-400 py-6">Aperçu indisponible</div>
                  ) : (
                    <div className="text-xs text-slate-400 py-6">Aucun fichier déposé</div>
                  )}
                  {doc && url && (
                    <button
                      onClick={() => openPreview(doc)}
                      title="Plein écran"
                      className="absolute top-1.5 right-1.5 rounded-md bg-white/90 backdrop-blur px-1.5 py-1 text-slate-600 shadow-sm hover:bg-white"
                    >
                      <Maximize2 size={12} />
                    </button>
                  )}
                </div>

                {/* Infos + actions */}
                <div className="px-3 py-2 space-y-1.5 text-[11px] text-slate-500">
                  {doc ? (
                    <>
                      <p className="truncate text-slate-700" title={doc.nom_fichier}>{doc.nom_fichier}</p>
                      <p>
                        Envoyé le {new Date(doc.created_at).toLocaleDateString("fr-FR")} à{" "}
                        {new Date(doc.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {doc.valide_le && (
                        <p>
                          {isConvoyeurDocApproved(doc.statut_validation) ? "Validé" : "Traité"} le{" "}
                          {new Date(doc.valide_le).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                      {doc.motif_refus && (
                        <p className="flex items-start gap-1 text-red-600">
                          <MessageSquare size={11} className="mt-0.5 shrink-0" />
                          <span className="italic">{doc.motif_refus}</span>
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="italic">Le convoyeur n'a pas encore transmis ce document.</p>
                  )}
                </div>

                {doc && (
                  <div className="flex flex-wrap gap-1.5 px-3 pb-3 pt-1 border-t border-slate-100 mt-auto">
                    <button
                      onClick={() => openPreview(doc)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                    >
                      <Eye size={12} /> Ouvrir
                    </button>
                    <button
                      onClick={() => download(doc)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                    >
                      <Download size={12} /> Télécharger
                    </button>
                    <button
                      disabled={busyId === doc.id || isConvoyeurDocApproved(doc.statut_validation)}
                      onClick={() => updateStatut(doc, "approuve")}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                    >
                      <CheckCircle2 size={12} /> Approuver
                    </button>
                    <button
                      disabled={busyId === doc.id || doc.statut_validation === "refuse"}
                      onClick={() => askMotifAndUpdate(doc, "refuse")}
                      className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-40"
                    >
                      <XCircle size={12} /> Refuser
                    </button>
                    <button
                      disabled={busyId === doc.id}
                      onClick={() => askMotifAndUpdate(doc, "a_renvoyer")}
                      className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-40"
                    >
                      <RotateCcw size={12} /> Nouveau doc
                    </button>
                  </div>
                )}
              </div>
            );
          })}
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
              <a
                href={preview.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs"
              >
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
