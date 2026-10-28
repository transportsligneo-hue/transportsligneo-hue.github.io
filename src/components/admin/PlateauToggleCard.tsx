import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const KEY = "plateau_enabled";

/** Interrupteur admin : active le convoyage sur plateau dans l'estimateur (désactivé par défaut). */
export function PlateauToggleCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle();
      setEnabled(Boolean((data?.value as { enabled?: boolean } | null)?.enabled));
    })();
  }, []);

  const toggle = async (next: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: KEY, value: { enabled: next } as never }, { onConflict: "key" });
      if (error) throw error;
      setEnabled(next);
      toast.success(next ? "Plateau activé dans l'estimateur" : "Plateau désactivé");
    } catch (e) {
      toast.error("Enregistrement impossible", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`rounded-xl border p-4 text-slate-900 ${enabled ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 h-4 w-4" checked={!!enabled} disabled={enabled === null || saving} onChange={(e) => void toggle(e.target.checked)} />
        <span>
          <span className="flex items-center gap-2 text-sm font-semibold"><Truck size={15} /> Convoyage sur plateau</span>
          <span className="block text-xs text-slate-600">
            Décoché (par défaut) : l'estimateur ne propose que le convoyage par route. Coché : les clients peuvent choisir « Par plateau »
            (véhicule non roulé, 0 km au compteur). À activer une fois les autorisations obtenues (DREAL).
          </span>
          <span className={`mt-1 block text-xs font-semibold ${enabled ? "text-emerald-700" : "text-slate-500"}`}>
            Actuellement : {enabled ? "activé" : "désactivé"}.
          </span>
        </span>
      </label>
    </div>
  );
}
