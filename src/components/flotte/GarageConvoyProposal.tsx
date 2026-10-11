import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { HelpTip } from "@/components/ui/HelpTip";
import { nextRevision } from "@/lib/vehicle-schedule";

type Auto = { convoyage?: { on?: boolean; cible?: string; reporte_jusqu?: string; ignore_pour?: string } } & Record<string, unknown>;
type Row = {
  automatismes: Auto | null;
  controle_technique_expire_le: string | null;
  immatriculation: string | null;
  derniere_revision_le: string | null;
  derniere_revision_km: number | null;
  kilometrage: number | null;
  intervalle_revision_mois: number | null;
  intervalle_revision_km: number | null;
  km_moyen_mois: number | null;
};

const DAYS = 30;
const REPORT_DAYS = 7;
const DEFAULT_INTERVAL_KM = 15000;
const DEFAULT_INTERVAL_MONTHS = 12;
const DEFAULT_KM_PER_MONTH = 1500;

interface Proposal {
  kind: "ct" | "revision";
  due: string;
  days: number;
}

/** Brouillon de convoyage vers le garage : proposé avant une échéance (contrôle technique ou révision), jamais commandé sans validation. */
export function GarageConvoyProposal({ vehicleId }: { vehicleId: string }) {
  const navigate = useNavigate();
  const [row, setRow] = useState<Row | null>(null);

  useEffect(() => {
    void supabase
      .from("vehicles")
      .select("automatismes, controle_technique_expire_le, immatriculation, derniere_revision_le, derniere_revision_km, kilometrage, intervalle_revision_mois, intervalle_revision_km, km_moyen_mois")
      .eq("id", vehicleId)
      .maybeSingle()
      .then(({ data }) => setRow((data as Row | null) ?? null));
  }, [vehicleId]);

  if (!row?.automatismes?.convoyage?.on) return null;
  const conv = row.automatismes.convoyage;
  const today = new Date().toISOString().slice(0, 10);

  const proposals: Proposal[] = [];
  if (row.controle_technique_expire_le) {
    const due = row.controle_technique_expire_le;
    proposals.push({ kind: "ct", due, days: Math.ceil((new Date(due).getTime() - Date.now()) / 86400000) });
  }
  if (row.derniere_revision_le || row.derniere_revision_km != null) {
    const rev = nextRevision({
      lastDate: row.derniere_revision_le,
      lastKm: row.derniere_revision_km,
      currentKm: row.kilometrage,
      intervalKm: row.intervalle_revision_km ?? DEFAULT_INTERVAL_KM,
      intervalMonths: row.intervalle_revision_mois ?? DEFAULT_INTERVAL_MONTHS,
      kmPerMonth: row.km_moyen_mois ?? DEFAULT_KM_PER_MONTH,
    });
    proposals.push({ kind: "revision", due: rev.date, days: Math.ceil((new Date(rev.date).getTime() - Date.now()) / 86400000) });
  }

  const proposal = proposals
    .filter((p) => p.days <= DAYS && conv.ignore_pour !== `${p.kind}:${p.due}`)
    .sort((a, b) => a.days - b.days)[0];
  if (!proposal || (conv.reporte_jusqu && conv.reporte_jusqu > today)) return null;

  const label = proposal.kind === "ct" ? "Contrôle technique" : "Révision";
  const save = async (patch: Partial<NonNullable<Auto["convoyage"]>>, msg: string) => {
    const automatismes = { ...row.automatismes, convoyage: { ...conv, ...patch } };
    const { error } = await supabase.from("vehicles").update({ automatismes } as never).eq("id", vehicleId);
    if (error) return toast.error("Modification impossible");
    await supabase.from("vehicle_automation_logs").insert({ vehicle_id: vehicleId, automatisme: "convoyage_garage", message: msg } as never);
    setRow({ ...row, automatismes });
    toast.success(msg);
  };

  const report = new Date(Date.now() + REPORT_DAYS * 86400000).toISOString().slice(0, 10);

  return (
    <div className="col-span-2 rounded-xl border border-[#2f5fff]/30 bg-[#eef2ff] p-4">
      <div className="flex items-center gap-2">
        <Wrench size={16} className="text-[#2f5fff]" />
        <p className="font-semibold text-slate-900">Convoyage vers le garage proposé</p>
        <HelpTip title="Convoyage proposé" text="Brouillon préparé automatiquement car une échéance (contrôle technique ou révision) approche. Rien n'est commandé ni facturé tant que vous ne validez pas la demande." />
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {label} {proposal.days < 0 ? "dépassé depuis le" : "à prévoir avant le"} {new Date(proposal.due).toLocaleDateString("fr-FR")}. Le convoyeur n'est pas prévenu avant votre validation.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-lg bg-[#2f5fff] px-3 py-1.5 text-sm font-semibold text-white" onClick={() => navigate({ to: "/dashboard-pro/nouvelle-mission" })}>
          Valider et préparer la demande
        </button>
        <button className="rounded-lg border bg-white px-3 py-1.5 text-sm font-semibold" onClick={() => void save({ reporte_jusqu: report }, `Proposition de convoyage (${label.toLowerCase()}) reportée de 7 jours`)}>Reporter</button>
        <button className="rounded-lg border bg-white px-3 py-1.5 text-sm font-semibold" onClick={() => void save({ ignore_pour: `${proposal.kind}:${proposal.due}` }, `Proposition de convoyage (${label.toLowerCase()}) ignorée pour cette échéance`)}>Ignorer</button>
      </div>
    </div>
  );
}
