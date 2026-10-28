import { PageSkeleton } from "@/components/driver2/PageSkeleton";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useRef, useCallback } from "react";
import { AlertCircle, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { notifyDocumentDepose } from "@/lib/admin-alert.functions";
import {
  getVisibleConvoyeurDocTypes,
  getDocRenewal,
  isConvoyeurDocApproved,
  normalizeConvoyeurDocType,
} from "@/lib/convoyeur-documents";
import MonContratCard from "@/components/convoyeur/MonContratCard";
import IdVerifyCard from "@/components/convoyeur/IdVerifyCard";
import { ProgressHero, ProfileCardView, DocCardView, SectionTitle, type DocStatus } from "@/components/convoyeur/DocumentsUI";
import { DocumentScanner } from "@/components/inspection/DocumentScanner";

/** Nettoie le nom de fichier : Supabase Storage refuse accents/espaces/caractères spéciaux. */
function safeFileName(name: string) {
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
  return cleaned.slice(-80) || "fichier";
}


export const Route = createFileRoute("/_authenticated/convoyeur/documents")({
  component: ConvoyeurDocuments,
});

interface DocRow {
  id: string;
  nom_fichier: string;
  type_document: string;
  url_fichier: string;
  statut_validation: string;
  motif_refus: string | null;
  created_at: string;
}

function ConvoyeurDocuments() {
  const { user } = useAuth();
  const [convoyeurId, setConvoyeurId] = useState<string | null>(null);
  const [typeConvoyeur, setTypeConvoyeur] = useState<string>("independant");
  const [docs, setDocs] = useState<Record<string, DocRow>>({});
  const [autres, setAutres] = useState<DocRow[]>([]);
  const [scanFor, setScanFor] = useState<{ key: string } | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const avatarRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async (cId: string) => {
    const { data } = await supabase
      .from("documents_convoyeurs")
      .select("*")
      .eq("convoyeur_id", cId)
      .order("created_at", { ascending: false });
    const map: Record<string, DocRow> = {};
    const others: DocRow[] = [];
    (data || []).forEach((d: DocRow) => {
      if (normalizeConvoyeurDocType(d.type_document) === "autre") { others.push(d); return; }
      // garde le plus récent par type
      const normalized = normalizeConvoyeurDocType(d.type_document);
      if (!map[normalized]) map[normalized] = d;
    });
    setDocs(map);
    setAutres(others);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: conv } = await supabase
        .from("convoyeurs")
        .select("id, type_convoyeur")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!conv) { setLoading(false); return; }
      setConvoyeurId(conv.id);
      setTypeConvoyeur(conv.type_convoyeur || "independant");
      await reload(conv.id);
      const { data: prof } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      setAvatarUrl((prof as { avatar_url?: string | null } | null)?.avatar_url ?? null);
      setLoading(false);
    })();
  }, [user, reload]);

  const handleUpload = async (spec: { key: string }, file: File) => {
    if (!user) return;
    if (!convoyeurId) {
      toast.error("Votre fiche convoyeur n'est pas encore créée. Contactez le support.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (15 Mo maximum).");
      return;
    }
    setUploadingKey(spec.key);
    try {
      const path = `${user.id}/${spec.key}_${Date.now()}_${safeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from("convoyeur-documents")
        .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
      if (upErr) throw upErr;

      // Replace previous of same type
      const previous = spec.key === "autre" ? undefined : docs[spec.key];
      if (previous) {
        await supabase.from("documents_convoyeurs").delete().eq("id", previous.id);
      }
      const { error: insErr } = await supabase.from("documents_convoyeurs").insert({
        convoyeur_id: convoyeurId,
        nom_fichier: file.name,
        type_document: spec.key,
        url_fichier: path,
        statut_validation: "en_attente",
      });
      if (insErr) throw insErr;
      void notifyDocumentDepose({ data: { convoyeurId, typeDocument: spec.key } }).catch(() => {});
      await reload(convoyeurId);
      toast.success("Document envoyé");
    } catch (err) {
      console.error("[convoyeur.documents] upload", err);
      toast.error(err instanceof Error ? err.message : "Envoi impossible");
    } finally {
      setUploadingKey(null);
    }
  };

  const handleAvatar = async (file: File) => {
    if (!user) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Photo trop volumineuse (8 Mo maximum).");
      return;
    }
    setUploadingKey("__avatar");
    try {
      const path = `${user.id}/avatar_${Date.now()}_${safeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: pub.publicUrl })
        .eq("user_id", user.id);
      if (updErr) throw updErr;
      setAvatarUrl(pub.publicUrl);
      toast.success("Photo de profil mise à jour");
    } catch (err) {
      console.error("[convoyeur.documents] avatar", err);
      toast.error(err instanceof Error ? err.message : "Envoi de la photo impossible");
    } finally {
      setUploadingKey(null);
    }
  };


  const deleteAutre = async (d: DocRow) => {
    if (!convoyeurId) return;
    if (!window.confirm("Supprimer ce document ?")) return;
    const { error } = await supabase.from("documents_convoyeurs").delete().eq("id", d.id);
    if (error) { toast.error("Suppression impossible"); return; }
    await reload(convoyeurId);
    toast.success("Document supprimé");
  };

  const removeDoc = async (d: DocRow) => {
    if (!window.confirm("Supprimer ce document ?")) return;
    const { error } = await supabase.from("documents_convoyeurs").delete().eq("id", d.id);
    if (error) { toast.error("Suppression impossible"); return; }
    if (!d.url_fichier.startsWith("http")) void supabase.storage.from("convoyeur-documents").remove([d.url_fichier]);
    if (convoyeurId) await reload(convoyeurId);
    toast.success("Document supprimé");
  };

  const openPreview = async (d: DocRow) => {
    if (d.url_fichier.startsWith("http")) { setPreviewUrl(d.url_fichier); return; }
    const { data } = await supabase.storage.from("convoyeur-documents").createSignedUrl(d.url_fichier, 300);
    if (data?.signedUrl) setPreviewUrl(data.signedUrl);
  };

  if (loading) return <PageSkeleton />;

  const visibleDocs = getVisibleConvoyeurDocTypes(typeConvoyeur);
  const requiredCount = visibleDocs.filter(d => d.required).length;
  const validatedCount = visibleDocs.filter(d => d.required && isConvoyeurDocApproved(docs[d.key]?.statut_validation)).length;

  const renderDoc = (spec: (typeof visibleDocs)[number], override?: DocRow, extra?: { label?: string; onDelete?: () => void; add?: boolean }) => {
    const d = override ?? (spec.key === "autre" ? undefined : docs[spec.key]);
    const status: DocStatus = !d ? "none" : isConvoyeurDocApproved(d.statut_validation) ? "approved" : d.statut_validation === "refuse" ? "refused" : "pending";
    const rn = d ? getDocRenewal(spec, d.created_at) : null;
    const renewal = rn
      ? {
          tone: (rn.expired ? "expired" : rn.soon ? "soon" : "ok") as "expired" | "soon" | "ok",
          text: rn.expired ? `Expirée depuis le ${rn.expiresAt.toLocaleDateString("fr-FR")} : renouvelez-la`
            : rn.soon ? `À renouveler avant le ${rn.expiresAt.toLocaleDateString("fr-FR")} (${rn.daysLeft} j)`
            : `Valable jusqu'au ${rn.expiresAt.toLocaleDateString("fr-FR")}`,
        }
      : null;
    const scanClass = "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-[#d7dff0] bg-[#ffffff] px-3 text-sm font-semibold text-[#1c2c58] active:scale-[.98]";
    return (
      <DocCardView
        key={override?.id ?? spec.key + (extra?.add ? "-add" : "")}
        label={extra?.label ?? spec.label}
        required={spec.required}
        hint={extra?.add ? "Contrat, attestation, justificatif… Ajoutez autant de documents que nécessaire." : spec.hint}
        onDelete={extra?.onDelete}
        uploadLabels={extra?.add ? { add: "Ajouter", replace: "Remplacer" } : undefined}
        status={status}
        fileName={d?.nom_fichier}
        dateLabel={d ? new Date(d.created_at).toLocaleDateString("fr-FR") : undefined}
        refusMotif={d?.motif_refus}
        renewal={renewal}
        uploading={uploadingKey === spec.key}
        onPreview={d ? () => void openPreview(d) : undefined}
        scanClass={scanClass}
        uploadInput={
          <input
            ref={(el) => { fileRefs.current[spec.key] = el; }}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(spec, f); }}
          />
        }
        scanButton={
          <button type="button" className={scanClass} onClick={() => setScanFor(spec)}>
            <ScanLine size={16} /> Scanner
          </button>
        }
      />
    );
  };
  const shortLabel: Record<string, string> = { permis: "Permis", identite: "CNI recto", identite_verso: "CNI verso", rib: "RIB", assurance: "RC Pro", kbis: "Kbis", vigilance: "Vigilance URSSAF" };
  const heroItems = visibleDocs.filter((d) => d.key !== "autre").map((d) => {
    const x = docs[d.key];
    const status: DocStatus = !x ? "none" : isConvoyeurDocApproved(x.statut_validation) ? "approved" : x.statut_validation === "refuse" ? "refused" : "pending";
    return { label: shortLabel[d.key] ?? d.label, status, required: d.required };
  });
  const autreSpec = visibleDocs.find((d) => d.key === "autre")!;
  const requiredDocs = visibleDocs.filter((d) => d.required);
  const optionalDocs = visibleDocs.filter((d) => !d.required && d.key !== "autre");

  return (
    <div className="space-y-4 pb-6">
      <div className="px-1">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-[#0a1638]">Mes documents</h1>
        <p className="mt-0.5 text-sm text-[#5a6788]">Vos pièces officielles et votre contrat, au même endroit.</p>
      </div>

      {!convoyeurId && (
        <div className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-sky-600" />
          <p className="text-sm text-[#0a1638]">
            Votre fiche convoyeur n'est pas encore créée : l'envoi de documents est indisponible.
            Contactez l'équipe Transports Ligneo pour finaliser votre inscription.
          </p>
        </div>
      )}

      <ProgressHero done={validatedCount} total={requiredCount} items={heroItems} />

      <IdVerifyCard />

      <MonContratCard />

      <ProfileCardView avatarUrl={avatarUrl} uploading={uploadingKey === "__avatar"}>
        <input
          ref={avatarRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatar(f); }}
        />
      </ProfileCardView>

      <SectionTitle>Pièces obligatoires</SectionTitle>
      <div className="space-y-3">{requiredDocs.map((d) => renderDoc(d))}</div>

      {optionalDocs.length > 0 && (<>
        <SectionTitle>Si vous êtes indépendant</SectionTitle>
        <div className="space-y-3">{optionalDocs.map((d) => renderDoc(d))}</div>
      </>)}

      <SectionTitle>Autres documents</SectionTitle>
      <div className="space-y-3">
        {autres.map((d) => renderDoc(autreSpec, d, { label: "Document complémentaire", onDelete: () => void deleteAutre(d) }))}
        {renderDoc(autreSpec, undefined, { label: "Ajouter un autre document", add: true })}
      </div>

      {scanFor && (
        <div className="drv2">
          <DocumentScanner
            onCancel={() => setScanFor(null)}
            onScanned={async (file) => { const k = scanFor; setScanFor(null); await handleUpload(k, file); }}
          />
        </div>
      )}

      {/* Aperçu */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="max-h-[90vh] max-w-3xl overflow-auto" onClick={(e) => e.stopPropagation()}>
            {/\.pdf(\?|$)/i.test(previewUrl) ? (
              <iframe src={previewUrl} className="h-[80vh] w-[90vw] rounded-lg bg-white" title="Aperçu PDF" />
            ) : (
              <img src={previewUrl} alt="Aperçu" className="max-w-full rounded-lg" />
            )}
            <button
              onClick={() => setPreviewUrl(null)}
              className="mt-3 w-full rounded-2xl bg-white py-3 text-sm font-semibold text-[#0a1638]"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
