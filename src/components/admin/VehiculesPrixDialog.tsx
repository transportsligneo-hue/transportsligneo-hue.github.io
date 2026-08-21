import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Banknote, Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/admin/AdminUI";

type Row = {
  id: string;
  plaque: string;
  vehicule: string;
  trajet: string;
  prix: string;
  prixConvoyeur: string;
};

const parseEur = (v: string): number | null => {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

/**
 * Édition du prix véhicule par véhicule (par plaque) pour :
 *  - un lot de missions groupées (trajetIds)
 *  - un devis groupé (devisId → tous les trajets rattachés)
 * Chaque ligne est enregistrée via l'RPC admin_update_trajet_prix, qui
 * resynchronise mission, devis (total + ligne véhicule) et facture non émise.
 */
export function VehiculesPrixDialog({
  open,
  onClose,
  trajetIds,
  devisId,
  title = "Prix par véhicule",
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  trajetIds?: string[];
  devisId?: string;
  title?: string;
  onSaved?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("trajets")
        .select(
          "id, immatriculation, vehicule_immatriculation, marque, modele, depart, arrivee, prix, prix_client, prix_convoyeur, tarif_convoyeur, created_at",
        );
      if (trajetIds?.length) query = query.in("id", trajetIds);
      else if (devisId) query = query.eq("devis_id", devisId);
      else {
        setRows([]);
        return;
      }
      const { data, error } = await query.order("created_at", { ascending: true });
      if (error) throw error;
      const list = (data ?? []) as Array<Record<string, unknown>>;
      setRows(
        list.map((t) => ({
          id: String(t.id),
          plaque: String(t.immatriculation ?? t.vehicule_immatriculation ?? "—"),
          vehicule: [t.marque, t.modele].filter(Boolean).join(" ") || "Véhicule",
          trajet: [t.depart, t.arrivee].filter(Boolean).join(" → "),
          prix: t.prix != null ? String(t.prix) : t.prix_client != null ? String(t.prix_client) : "",
          prixConvoyeur:
            t.prix_convoyeur != null
              ? String(t.prix_convoyeur)
              : t.tarif_convoyeur != null
                ? String(t.tarif_convoyeur)
                : "",
        })),
      );
    } catch (e) {
      toast.error("Chargement impossible", { description: e instanceof Error ? e.message : "" });
    } finally {
      setLoading(false);
    }
  }, [devisId, trajetIds?.join(",")]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open) return null;

  const total = rows.reduce((s, r) => {
    const n = parseEur(r.prix);
    return s + (typeof n === "number" && !Number.isNaN(n) ? n : 0);
  }, 0);

  const patch = (id: string, next: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));

  const saveAll = async () => {
    for (const r of rows) {
      const pc = parseEur(r.prix);
      const pv = parseEur(r.prixConvoyeur);
      if (pc == null || Number.isNaN(pc) || Number.isNaN(pv)) {
        toast.error(`Prix invalide pour ${r.plaque}`);
        return;
      }
    }
    setSaving(true);
    let ok = 0;
    try {
      for (const r of rows) {
        const pc = parseEur(r.prix) as number;
        const pv = parseEur(r.prixConvoyeur);
        const { error } = await supabase.rpc("admin_update_trajet_prix" as never, {
          _trajet_id: r.id,
          _prix: pc,
          _prix_convoyeur: pv ?? null,
        } as never);
        if (error) throw error;
        ok += 1;
      }
      toast.success("Prix enregistrés", {
        description: `${ok} véhicule${ok > 1 ? "s" : ""} · total ${total.toFixed(2)} € — devis, missions et factures non émises synchronisés`,
      });
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error("Enregistrement partiel", {
        description: e instanceof Error ? e.message : `${ok} ligne(s) enregistrée(s)`,
      });
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mt-10 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-pro-text">
            <Banknote size={16} className="text-pro-accent" /> {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-pro-muted hover:bg-black/5"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-[13px] text-pro-muted">
            <Loader2 size={15} className="animate-spin" /> Chargement des véhicules…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-pro-muted">Aucun véhicule à tarifer.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-1 gap-2 rounded-xl border border-black/10 bg-[#f7f9ff] p-3 sm:grid-cols-[1fr_auto_auto]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="plate-tag plate-tag--sm">{r.plaque}</span>
                    <span className="truncate text-[12.5px] font-semibold text-pro-text">{r.vehicule}</span>
                  </div>
                  <p className="truncate text-[11px] text-pro-muted">{r.trajet}</p>
                </div>
                <label className="text-[10.5px] font-semibold uppercase tracking-wide text-pro-muted">
                  Prix client €
                  <input
                    value={r.prix}
                    onChange={(e) => patch(r.id, { prix: e.target.value })}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="mt-1 block h-9 w-32 rounded-lg border border-black/15 bg-white px-2 text-[13px] font-semibold text-pro-text"
                  />
                </label>
                <label className="text-[10.5px] font-semibold uppercase tracking-wide text-pro-muted">
                  Rému. convoyeur €
                  <input
                    value={r.prixConvoyeur}
                    onChange={(e) => patch(r.id, { prixConvoyeur: e.target.value })}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="mt-1 block h-9 w-32 rounded-lg border border-black/15 bg-white px-2 text-[13px] font-semibold text-pro-text"
                  />
                </label>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-pro-text">
            Total client : {total.toFixed(2)} €
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Annuler</Button>
            <Button onClick={saveAll} disabled={saving || loading || rows.length === 0}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Enregistrer les prix
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(body, document.body) : body;
}
