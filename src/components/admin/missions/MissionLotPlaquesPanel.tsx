import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Car, Banknote, Layers } from "lucide-react";
import { Card, Button } from "@/components/admin/AdminUI";
import { VehiculesPrixDialog } from "@/components/admin/VehiculesPrixDialog";
import { stripLegSuffix } from "@/lib/mission-number";

type Sibling = {
  trajetId: string;
  attributionId: string | null;
  plaque: string;
  vehicule: string;
  prix: number | null;
};

/**
 * Affiche toutes les plaques d'un même lot / devis groupé.
 * Chaque véhicule reçoit un sous-numéro (#108.1, #108.2, …) et son prix
 * est modifiable directement depuis la fiche mission.
 */
export function MissionLotPlaquesPanel({
  trajetId,
  lotId,
  devisId,
  lotReference,
  baseNumero,
  onPricesSaved,
}: {
  trajetId: string;
  lotId: string | null;
  devisId: string | null;
  lotReference?: string | null;
  baseNumero: string | null;
  onPricesSaved?: () => void;
}) {
  const [rows, setRows] = useState<Sibling[]>([]);
  const [prixOpen, setPrixOpen] = useState(false);

  const load = useCallback(async () => {
    if (!lotId && !devisId) {
      setRows([]);
      return;
    }
    let q = supabase
      .from("trajets")
      .select("id, immatriculation, vehicule_immatriculation, marque, modele, prix, created_at");
    q = lotId ? q.eq("lot_id", lotId) : q.eq("devis_id", devisId!);
    const { data } = await q.order("created_at", { ascending: true });
    const list = (data ?? []) as Array<Record<string, unknown>>;
    if (list.length < 2) {
      setRows([]);
      return;
    }
    const ids = list.map((t) => String(t.id));
    const { data: attrs } = await supabase
      .from("attributions")
      .select("id, trajet_id")
      .in("trajet_id", ids);
    const attrByTrajet = new Map(
      ((attrs ?? []) as Array<{ id: string; trajet_id: string | null }>).map((a) => [a.trajet_id, a.id]),
    );
    setRows(
      list.map((t) => ({
        trajetId: String(t.id),
        attributionId: attrByTrajet.get(String(t.id)) ?? null,
        plaque: String(t.immatriculation ?? t.vehicule_immatriculation ?? "—"),
        vehicule: `${(t.marque as string) ?? ""} ${(t.modele as string) ?? ""}`.trim(),
        prix: t.prix != null ? Number(t.prix) : null,
      })),
    );
  }, [lotId, devisId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (rows.length < 2) return null;

  const base = stripLegSuffix(baseNumero ?? "").trim();
  const total = rows.reduce((s, r) => s + (r.prix ?? 0), 0);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Layers size={16} className="text-pro-accent shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-pro-text">
              Véhicules du devis ({rows.length} plaques)
            </h3>
            <p className="text-xs text-pro-muted truncate">
              {lotReference ? `Lot ${lotReference} · ` : ""}Total {total.toFixed(2)} €
            </p>
          </div>
        </div>
        <Button variant="secondary" icon={<Banknote size={14} />} onClick={() => setPrixOpen(true)}>
          Prix par véhicule
        </Button>
      </div>

      <div className="grid gap-2">
        {rows.map((r, i) => {
          const current = r.trajetId === trajetId;
          const label = base ? `${base}.${i + 1}` : `Véhicule ${i + 1}`;
          const inner = (
            <div
              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                current
                  ? "border-pro-accent/60 bg-pro-accent/5"
                  : "border-pro-border bg-pro-surface hover:bg-pro-surface-2"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Car size={14} className="text-pro-muted shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-pro-text truncate">
                    {label}
                    {current && <span className="ml-2 text-[11px] text-pro-accent">· affichée</span>}
                  </p>
                  <p className="text-xs text-pro-muted truncate">
                    {r.vehicule || "Véhicule —"}
                    {r.plaque !== "—" && <span className="plate-tag plate-tag--sm ml-2">{r.plaque}</span>}
                  </p>
                </div>
              </div>
              <span className="text-sm font-semibold text-pro-text shrink-0">
                {r.prix != null ? `${r.prix.toFixed(2)} €` : "—"}
              </span>
            </div>
          );
          if (current || !r.attributionId) return <div key={r.trajetId}>{inner}</div>;
          return (
            <Link
              key={r.trajetId}
              to="/admin/missions/$missionId"
              params={{ missionId: r.attributionId }}
              className="block"
            >
              {inner}
            </Link>
          );
        })}
      </div>

      <VehiculesPrixDialog
        open={prixOpen}
        onClose={() => setPrixOpen(false)}
        trajetIds={rows.map((r) => r.trajetId)}
        title={`Prix par véhicule${lotReference ? ` — lot ${lotReference}` : ""}`}
        onSaved={() => {
          void load();
          onPricesSaved?.();
        }}
      />
    </Card>
  );
}
