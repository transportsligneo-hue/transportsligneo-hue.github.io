/**
 * Checklist de sécurité obligatoire AVANT le départ vers le lieu d'enlèvement.
 *
 * Bloquante : le bouton "En route pour récupérer le véhicule" reste inactif
 * tant que les 3 points ne sont pas cochés. La validation est horodatée et
 * enregistrée (table mission_departure_checklists) pour l'admin en cas de
 * contrôle ou de litige.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, Loader2, Check, X, Shirt, IdCard, TriangleAlert } from "lucide-react";

interface Props {
  attributionId: string;
  userId: string;
  onValidated: () => void | Promise<void>;
  onClose: () => void;
}

const ITEMS = [
  { key: "gilet_jaune", icon: TriangleAlert, label: "Gilet jaune à disposition dans le véhicule",
    hint: "Obligatoire et accessible depuis l'habitacle." },
  { key: "tenue_conforme", icon: Shirt, label: "Tenue appropriée",
    hint: "Propre et professionnelle, conforme à la charte de présentation." },
  { key: "permis_en_possession", icon: IdCard, label: "Permis de conduire valide en ma possession",
    hint: "Permis original, en cours de validité, sur moi." },
] as const;

type ItemKey = (typeof ITEMS)[number]["key"];

export function DepartureChecklistSheet({ attributionId, userId, onValidated, onClose }: Props) {
  const [checked, setChecked] = useState<Record<ItemKey, boolean>>({
    gilet_jaune: false, tenue_conforme: false, permis_en_possession: false,
  });
  const [busy, setBusy] = useState(false);

  const allChecked = ITEMS.every((i) => checked[i.key]);

  const validate = async () => {
    if (!allChecked || busy) return;
    setBusy(true);
    const { error } = await supabase
      .from("mission_departure_checklists" as never)
      .upsert(
        {
          attribution_id: attributionId,
          gilet_jaune: true,
          tenue_conforme: true,
          permis_en_possession: true,
          validated_at: new Date().toISOString(),
          created_by: userId,
        } as never,
        { onConflict: "attribution_id" } as never,
      );
    setBusy(false);
    if (error) {
      toast.error("Enregistrement impossible", { description: error.message });
      return;
    }
    toast.success("Checklist de sécurité validée");
    await onValidated();
  };

  return (
    <div className="fixed inset-0 z-[92] bg-[#050A1C]/94 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 text-white">
        <button type="button" onClick={onClose} aria-label="Fermer" className="p-2 rounded-lg hover:bg-white/10">
          <X size={18} />
        </button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#2FD8FF]">Avant de partir</p>
          <p className="text-sm font-semibold">Checklist de sécurité</p>
        </div>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        <div className="flex items-start gap-3 rounded-2xl border border-[rgba(47,216,255,0.28)] bg-[rgba(47,216,255,0.07)] p-4">
          <ShieldCheck size={18} className="text-[#2FD8FF] mt-0.5 shrink-0" />
          <p className="text-[13px] leading-relaxed text-[#C9DBF7]">
            Ces trois points sont obligatoires avant de prendre la route vers le lieu d'enlèvement.
            Votre validation est horodatée et conservée dans le dossier de mission.
          </p>
        </div>

        {ITEMS.map((item) => {
          const Icon = item.icon;
          const on = checked[item.key];
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setChecked((p) => ({ ...p, [item.key]: !p[item.key] }))}
              className="w-full flex items-start gap-3 text-left rounded-2xl p-4 transition"
              style={{
                border: `1px solid ${on ? "rgba(52,232,176,0.45)" : "rgba(120,180,255,0.16)"}`,
                background: on ? "rgba(52,232,176,0.08)" : "rgba(20,32,72,0.45)",
              }}
            >
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  border: `1.5px solid ${on ? "#34E8B0" : "rgba(120,180,255,0.4)"}`,
                  background: on ? "#34E8B0" : "transparent",
                  color: "#06231A",
                }}
              >
                {on && <Check size={14} strokeWidth={3.2} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 text-[14px] font-semibold text-[#EAF3FF]">
                  <Icon size={15} className="text-[#8FB2E8]" /> {item.label}
                </span>
                <span className="block mt-1 text-[12px] text-[#8FA6CE]">{item.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="p-4 border-t border-white/10 safe-bottom">
        <button
          type="button"
          onClick={() => void validate()}
          disabled={!allChecked || busy}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition disabled:opacity-45"
          style={{
            background: allChecked
              ? "linear-gradient(90deg,#2F6BFF,#2FD8FF)"
              : "rgba(255,255,255,0.08)",
            color: allChecked ? "#04122E" : "#8FA6CE",
          }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
          {allChecked ? "Valider et démarrer le trajet" : "Cochez les 3 points pour continuer"}
        </button>
      </div>
    </div>
  );
}
