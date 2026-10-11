import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { HelpTip } from "@/components/ui/HelpTip";

type Auto = { convoyage?: { on?: boolean; cible?: string; reporte_jusqu?: string; ignore_pour?: string } } & Record<string, unknown>;
type Row = { automatismes: Auto | null; controle_technique_expire_le: string | null; immatriculation: string | null };

const DAYS = 30;

/** Brouillon de convoyage vers le garage : proposé avant une échéance, jamais commandé sans validation. */
export function GarageConvoyProposal({ vehicleId }: { vehicleId: string }) {
  const navigate = useNavigate();
  const [row, setRow] = useState<Row | null>(null);

  useEffect(() => {
    void supabase.from("vehicles").select("automatismes, controle_technique_expire_le, immatriculation").eq("id", vehicleId).maybeSingle()
      .then(({ data }) => setRow((data as Row | null) ?? null));
  }, [vehicleId]);

  if (!row?.automatismes?.convoyage?.on || !row.controle_technique_expire_le) return null;
  const conv = row.automatismes.convoyage;
  const due = row.controle_technique_expire_le;
  const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  const today = new Date().toISOString().slice(0, 10);
  if (days > DAYS || conv.ignore_pour === due || (conv.reporte_jusqu && conv.reporte_jusqu > today)) return null;

  const save = async (patch: Partial<NonNullable<Auto["convoyage"]>>, msg: string) => {
    const automatismes = { ...row.automatismes, convoyage: { ...conv, ...patch } };
    const { error } = await supabase.from("vehicles").update({ automatismes } as never).eq("id", vehicleId);
    if (error) return toast.error("Modification impossible");
    await supabase.from("vehicle_automation_logs").insert({ vehicle_id: vehicleId, automatisme: "convoyage_garage", message: msg } as never);
    setRow({ ...row, automatismes });
    toast.success(msg);
  };

  const report = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  return (
    <div className="col-span-2 rounded-xl border border-[#2f5fff]/30 bg-[#eef2ff] p-4">
      <div className="flex items-center gap-2">
        <Wrench size={16} className="text-[#2f5fff]" />
        <p className="font-semibold text-slate-900">Convoyage vers le contrôle technique proposé</p>
        <HelpTip text="Brouillon préparé automatiquement car l'échéance approche. Rien n'est commandé ni facturé tant que vous ne validez pas la demande." />
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Contrôle technique {days < 0 ? "dépassé depuis le" : "à faire avant le"} {new Date(due).toLocaleDateString("fr-FR")}. Le convoyeur n'est pas prévenu avant votre validation.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-lg bg-[#2f5fff] px-3 py-1.5 text-sm font-semibold text-white" onClick={() => navigate({ to: "/dashboard-pro/nouvelle-mission" })}>
          Valider et préparer la demande
        </button>
        <button className="rounded-lg border bg-white px-3 py-1.5 text-sm font-semibold" onClick={() => void save({ reporte_jusqu: report }, "Proposition de convoyage reportée de 7 jours")}>Reporter</button>
        <button className="rounded-lg border bg-white px-3 py-1.5 text-sm font-semibold" onClick={() => void save({ ignore_pour: due }, "Proposition de convoyage ignorée pour cette échéance")}>Ignorer</button>
      </div>
    </div>
  );
}
