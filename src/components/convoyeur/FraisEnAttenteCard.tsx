/** Rappel dans Finances : frais envoyés en attente de validation, ou refusés. */
import { useEffect, useState } from "react";
import { Clock, Fuel, Receipt, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FRAIS_LABEL, eur, type FraisMission } from "@/lib/frais-mission";

export function FraisEnAttenteCard() {
  const [rows, setRows] = useState<FraisMission[]>([]);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("frais_mission" as never).select("*")
        .in("statut" as never, ["attente", "refuse"] as never)
        .order("created_at" as never, { ascending: false }).limit(30);
      setRows((data as unknown as FraisMission[]) ?? []);
    })();
  }, []);
  if (!rows.length) return null;
  const attente = rows.filter((r) => r.statut === "attente");
  const total = attente.reduce((s, r) => s + Number(r.montant_ttc), 0);
  return (
    <div style={{ background: "rgba(47,95,255,.10)", border: "1px solid rgba(120,180,255,.22)", borderRadius: 16, padding: 14, color: "#e8efff" }}>
      {attente.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14 }}>
          <Clock size={16} /> Frais en attente de validation
          <span style={{ marginLeft: "auto", color: "#7fb2ff" }}>{eur(total)}</span>
        </div>
      )}
      {rows.map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, paddingTop: 8 }}>
          {r.statut === "refuse" ? <X size={14} color="#ff8088" /> : r.type === "peage" ? <Receipt size={14} /> : <Fuel size={14} />}
          <span>{FRAIS_LABEL[r.type]} · {eur(r.montant_ttc)}</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: r.statut === "refuse" ? "#ff8088" : "#9cc4ff" }}>
            {r.statut === "refuse" ? `Refusé${r.motif_refus ? ` : ${r.motif_refus}` : ""}` : "À valider"}
          </span>
        </div>
      ))}
    </div>
  );
}
