/**
 * MissionTraceability — Affiche le bloc de double signature (départ + arrivée)
 * pour Admin / Client / B2B / Flotte. Lecture seule.
 *
 * Recherche dans `mission_documents` les documents :
 *   - pv_signature_depart_convoyeur
 *   - pv_signature_depart_client
 *   - pv_signature_arrivee_convoyeur
 *   - pv_signature_arrivee_client
 *
 * Affiche pour chaque slot : statut (signé / manquant), horodatage, miniature
 * de la signature (URL signée 1h depuis le bucket `mission-documents`).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, AlertCircle, ShieldCheck, Loader2, PenTool, Download } from "lucide-react";

interface Props {
  attributionId: string;
  /** Affichage compact (1 ligne par slot) ou complet (cartes avec image) */
  variant?: "full" | "compact";
}

type SlotKey =
  | "pv_signature_depart_convoyeur"
  | "pv_signature_depart_client"
  | "pv_signature_arrivee_convoyeur"
  | "pv_signature_arrivee_client";

interface SlotData {
  signedAt?: string;
  url?: string;
}

const SLOT_LABEL: Record<SlotKey, { phase: "Départ" | "Arrivée"; role: "Convoyeur" | "Client" }> = {
  pv_signature_depart_convoyeur: { phase: "Départ", role: "Convoyeur" },
  pv_signature_depart_client: { phase: "Départ", role: "Client" },
  pv_signature_arrivee_convoyeur: { phase: "Arrivée", role: "Convoyeur" },
  pv_signature_arrivee_client: { phase: "Arrivée", role: "Client" },
};

const SLOTS: SlotKey[] = [
  "pv_signature_depart_convoyeur",
  "pv_signature_depart_client",
  "pv_signature_arrivee_convoyeur",
  "pv_signature_arrivee_client",
];

export function MissionTraceability({ attributionId, variant = "full" }: Props) {
  const [slots, setSlots] = useState<Record<SlotKey, SlotData>>({} as Record<SlotKey, SlotData>);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const next: Record<string, SlotData> = {};

      // 1) mission_documents : type_document = pv_signature_*
      const { data: docData } = await supabase
        .from("mission_documents")
        .select("type_document, url_fichier, created_at")
        .eq("attribution_id", attributionId)
        .in("type_document", SLOTS)
        .order("created_at", { ascending: false });
      for (const row of docData ?? []) {
        if (next[row.type_document]) continue;
        const { data: signed } = await supabase.storage
          .from("mission-documents")
          .createSignedUrl(row.url_fichier, 3600);
        next[row.type_document] = { signedAt: row.created_at, url: signed?.signedUrl };
      }

      // 2) mission_signatures : signature_data (base64 data URL)
      // kind : driver_start, client_start, driver_end, client_end
      const KIND_TO_SLOT: Record<string, SlotKey> = {
        driver_start: "pv_signature_depart_convoyeur",
        client_start: "pv_signature_depart_client",
        driver_end: "pv_signature_arrivee_convoyeur",
        client_end: "pv_signature_arrivee_client",
      };
      const { data: sigData } = await supabase
        .from("mission_signatures")
        .select("kind, signature_data, signed_at, created_at")
        .eq("attribution_id", attributionId);
      for (const row of (sigData as Array<{ kind: string; signature_data: string | null; signed_at: string | null; created_at: string }> | null) ?? []) {
        const slotKey = KIND_TO_SLOT[row.kind];
        if (!slotKey || next[slotKey]) continue;
        if (row.signature_data) {
          next[slotKey] = {
            signedAt: row.signed_at ?? row.created_at,
            url: row.signature_data,
          };
        }
      }

      if (!cancelled) {
        setSlots(next as Record<SlotKey, SlotData>);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [attributionId]);

  const departComplete = !!slots.pv_signature_depart_convoyeur && !!slots.pv_signature_depart_client;
  const arriveeComplete = !!slots.pv_signature_arrivee_convoyeur && !!slots.pv_signature_arrivee_client;
  const allComplete = departComplete && arriveeComplete;

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="animate-spin" size={16} /> Chargement de la traçabilité…
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge label="Départ" ok={departComplete} />
        <Badge label="Arrivée" ok={arriveeComplete} />
        {allComplete && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <ShieldCheck size={12} /> Mission tracée
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <PenTool size={16} className="text-amber-500" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Signatures & Traçabilité</h3>
            <p className="text-xs text-slate-500 mt-0.5">Double signature obligatoire — départ et arrivée</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          allComplete ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
        }`}>
          {allComplete ? <ShieldCheck size={12} /> : <AlertCircle size={12} />}
          {allComplete ? "Complet" : "Incomplet"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SLOTS.map(key => {
          const slot = slots[key];
          const meta = SLOT_LABEL[key];
          const ok = !!slot;
          return (
            <div
              key={key}
              className={`rounded-xl border p-3 ${ok ? "border-emerald-200 bg-emerald-50/30" : "border-dashed border-slate-300 bg-slate-50"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{meta.phase}</p>
                  <p className="text-sm font-semibold text-slate-900">{meta.role}</p>
                </div>
                {ok ? (
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <Check size={14} strokeWidth={3} />
                  </span>
                ) : (
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                    <AlertCircle size={12} />
                  </span>
                )}
              </div>
              {ok ? (
                <>
                  {slot.url && (
                    <div className="relative rounded-lg bg-white border border-slate-200 p-2 mb-2 group">
                      <img src={slot.url} alt={`Signature ${meta.role} ${meta.phase}`} className="h-20 w-full object-contain" />
                      <a
                        href={slot.url}
                        download={`signature-${meta.phase}-${meta.role}.png`}
                        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition bg-slate-900/90 text-white p-1 rounded"
                        aria-label="Télécharger la signature"
                      >
                        <Download size={11} />
                      </a>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500">
                    Signé le {slot.signedAt ? new Date(slot.signedAt).toLocaleString("fr-FR") : "—"}
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-slate-500">En attente de signature</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Badge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
      ok ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
    }`}>
      {ok ? <Check size={11} /> : <AlertCircle size={11} />}
      {label} {ok ? "✓" : "—"}
    </span>
  );
}
