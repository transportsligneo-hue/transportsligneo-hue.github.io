import { supabase } from "@/integrations/supabase/client";
import { generateEdlFinalPdf, type EdlFinalPdfData, type EdlFinalPdfDocument } from "@/lib/edl-final-pdf";

/**
 * Construction du « dossier complet » d'une mission.
 *
 * - Sur un duo Livraison + Restitution, les deux volets sont compilés dans un
 *   seul PDF (aller puis retour).
 * - L'admin peut joindre des pièces supplémentaires (PV, PDF, photos) qui sont
 *   ajoutées à la fin du dossier.
 */

const isImagePath = (p: string) => /\.(jpe?g|png|webp|heic)$/i.test(p);

async function collectLegDocuments(
  attributionId: string,
  trajet: Record<string, unknown> | null,
): Promise<EdlFinalPdfDocument[]> {
  const out: (EdlFinalPdfDocument & { rank: number })[] = [];
  try {
    const { data: docs } = await supabase
      .from("mission_documents")
      .select("type_document, nom_fichier, url_fichier, created_at")
      .eq("attribution_id", attributionId)
      .order("created_at", { ascending: false });
    const rows = ((docs ?? []) as { type_document: string; nom_fichier: string | null; url_fichier: string }[])
      .filter((d) => /pv_livraison|pv_restitution|carte_grise/i.test(d.type_document) && isImagePath(d.url_fichier));
    const seen = new Set<string>();
    const uniques = rows.filter((d) => (seen.has(d.type_document) ? false : (seen.add(d.type_document), true)));
    if (uniques.length) {
      const paths = uniques.map((d) => d.url_fichier);
      const { data: signed } = await supabase.storage.from("mission-documents").createSignedUrls(paths, 3600);
      uniques.forEach((d, i) => {
        const url = signed?.[i]?.signedUrl;
        if (!url) return;
        const isCg = /carte_grise/i.test(d.type_document);
        out.push({ label: isCg ? "Carte grise" : "PV de livraison signé", url, meta: d.nom_fichier ?? null, rank: isCg ? 2 : 1 });
      });
    }
  } catch {
    /* documents optionnels */
  }

  if (!out.some((d) => d.rank === 2) && trajet) {
    const t = trajet as { carte_grise_recto_url?: string | null; carte_grise_verso_url?: string | null };
    for (const [face, raw] of [["recto", t.carte_grise_recto_url], ["verso", t.carte_grise_verso_url]] as const) {
      if (!raw) continue;
      let url = raw;
      if (!/^https?:\/\//i.test(raw)) {
        const { data: s } = await supabase.storage.from("devis-documents").createSignedUrl(raw, 3600);
        if (!s?.signedUrl) continue;
        url = s.signedUrl;
      }
      if (!isImagePath(url.split("?")[0])) continue;
      out.push({ label: `Carte grise — ${face}`, url, meta: null, rank: 2 });
    }
  }

  return out.sort((a, b) => a.rank - b.rank).map(({ rank: _rank, ...d }) => d);
}

/** Récupère toutes les données nécessaires au PDF d'un volet de mission. */
export async function buildLegDossierData(attributionId: string, numero: string): Promise<EdlFinalPdfData | null> {
  const { data: attr } = await supabase
    .from("attributions")
    .select("id, trajet_id, convoyeur_id, numero_mission")
    .eq("id", attributionId)
    .maybeSingle();
  if (!attr) return null;

  const [trajRes, convRes, inspRes, sigRes, incRes] = await Promise.all([
    supabase.from("trajets").select("*").eq("id", attr.trajet_id).maybeSingle(),
    attr.convoyeur_id
      ? supabase.from("convoyeurs").select("nom, prenom, telephone").eq("id", attr.convoyeur_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("inspections")
      .select("id, type, equipements, kilometrage_depart, kilometrage_arrivee")
      .eq("attribution_id", attributionId),
    supabase.from("mission_signatures").select("kind, signature_data").eq("attribution_id", attributionId),
    supabase
      .from("mission_incidents")
      .select("titre, description, gravite, created_at")
      .eq("attribution_id", attributionId)
      .order("created_at", { ascending: true }),
  ]);

  const trajet = (trajRes.data ?? null) as Record<string, unknown> | null;
  if (!trajet) return null;

  const insps = (inspRes.data ?? []) as { id: string; type: string; equipements: unknown; kilometrage_depart: number | null; kilometrage_arrivee: number | null }[];
  const inspDepart = insps.find((i) => i.type === "depart");
  const inspArrivee = insps.find((i) => i.type === "arrivee");

  // Photos + signed URLs en lot
  const photosDepart: { vue_type: string; url: string }[] = [];
  const photosArrivee: { vue_type: string; url: string }[] = [];
  if (insps.length) {
    const { data: raw } = await supabase
      .from("inspection_photos")
      .select("inspection_id, vue_type, url_photo, created_at")
      .in("inspection_id", insps.map((i) => i.id))
      .order("created_at", { ascending: true });
    const rows = (raw ?? []) as { inspection_id: string; vue_type: string; url_photo: string }[];
    const toSign = Array.from(new Set(rows.filter((p) => !/^https?:\/\//i.test(p.url_photo)).map((p) => p.url_photo)));
    const signedMap = new Map<string, string>();
    if (toSign.length) {
      const { data: signed } = await supabase.storage.from("inspection-photos").createSignedUrls(toSign, 3600);
      (signed ?? []).forEach((s, i) => { if (s?.signedUrl) signedMap.set(toSign[i], s.signedUrl); });
    }
    for (const p of rows) {
      if (p.vue_type.startsWith("signature")) continue;
      const url = /^https?:\/\//i.test(p.url_photo) ? p.url_photo : (signedMap.get(p.url_photo) ?? p.url_photo);
      const target = insps.find((i) => i.id === p.inspection_id)?.type === "arrivee" ? photosArrivee : photosDepart;
      target.push({ vue_type: p.vue_type, url });
    }
  }

  const conv = (convRes.data ?? null) as { nom?: string; prenom?: string; telephone?: string } | null;
  const t = trajet as Record<string, string | null>;

  return {
    numero,
    date_mission: t.date_trajet ?? null,
    depart: String(t.depart ?? ""),
    arrivee: String(t.arrivee ?? ""),
    vehicule: {
      marque: t.marque,
      modele: t.modele,
      immatriculation: t.immatriculation,
      vin: (t.vin ?? t.vehicule_vin) ?? null,
    },
    convoyeur: conv ? { prenom: conv.prenom, nom: conv.nom, telephone: conv.telephone } : null,
    contactArrivee: {
      nom: t.arrivee_contact_nom,
      telephone: t.arrivee_contact_telephone,
      instructions: t.arrivee_contact_instructions,
    },
    equipements: (inspDepart?.equipements ?? inspArrivee?.equipements ?? null) as Record<string, unknown> | null,
    kilometrage_depart: inspDepart?.kilometrage_depart ?? null,
    kilometrage_arrivee: inspArrivee?.kilometrage_arrivee ?? null,
    photosDepart,
    photosArrivee,
    signatures: ((sigRes.data ?? []) as { kind: string; signature_data: string | null }[]).map((s) => ({
      kind: s.kind,
      url: s.signature_data,
    })),
    incidents: (incRes.data ?? []) as EdlFinalPdfData["incidents"],
    documents: await collectLegDocuments(attributionId, trajet),
  };
}

/** Génère le PDF d'un volet de mission. */
export async function buildLegDossierPdf(attributionId: string, numero: string): Promise<Blob | null> {
  const data = await buildLegDossierData(attributionId, numero);
  if (!data) return null;
  return generateEdlFinalPdf(data, { dossier: true });
}

/**
 * Fusionne plusieurs PDF + pièces jointes (PDF ou images) en un seul document.
 */
export async function mergeDossierParts(pdfs: Blob[], attachments: File[] = []): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.create();

  const appendPdf = async (bytes: ArrayBuffer) => {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  };

  for (const blob of pdfs) {
    await appendPdf(await blob.arrayBuffer());
  }

  for (const file of attachments) {
    const bytes = await file.arrayBuffer();
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (isPdf) {
      await appendPdf(bytes);
      continue;
    }
    const isPng = file.type === "image/png" || /\.png$/i.test(file.name);
    try {
      const img = isPng ? await merged.embedPng(bytes) : await merged.embedJpg(bytes);
      const page = merged.addPage([595.28, 841.89]); // A4
      const ratio = Math.min((595.28 - 48) / img.width, (841.89 - 48) / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      page.drawImage(img, { x: (595.28 - w) / 2, y: (841.89 - h) / 2, width: w, height: h });
    } catch {
      // format image non supporté (HEIC/WebP) → pièce ignorée plutôt que d'échouer
    }
  }

  const out = await merged.save();
  return new Blob([out as unknown as BlobPart], { type: "application/pdf" });
}
