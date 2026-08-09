/**
 * Checklist bloquante affichée AVANT chaque état des lieux (départ ET arrivée).
 *
 * Les 3 points sont obligatoires : le bouton reste grisé tant que les cases
 * ne sont pas toutes cochées. Purement front, aucune écriture DB : la
 * checklist réapparaît à chaque nouvel EDL.
 */
import { useState } from "react";
import { Check, ShieldCheck, Shirt, IdCard, TriangleAlert, X } from "lucide-react";

const ITEMS = [
  { key: "gilet", icon: TriangleAlert, label: "Gilet jaune porté",
    hint: "Gilet haute visibilité enfilé avant d'approcher le véhicule." },
  { key: "tenue", icon: Shirt, label: "Tenue correcte (survêtement proscrit)",
    hint: "Tenue propre et professionnelle, conforme à la charte." },
  { key: "permis", icon: IdCard, label: "Permis de conduire en ma possession",
    hint: "Permis original en cours de validité, sur moi." },
] as const;

type ItemKey = (typeof ITEMS)[number]["key"];

interface Props {
  phase: "depart" | "arrivee";
  onConfirm: () => void;
  onClose: () => void;
}

export function EdlStartChecklistGate({ phase, onConfirm, onClose }: Props) {
  const [checked, setChecked] = useState<Record<ItemKey, boolean>>({
    gilet: false, tenue: false, permis: false,
  });
  const all = ITEMS.every((i) => checked[i.key]);

  return (
    <div className="edl-shell fixed inset-x-0 top-0 z-[110] flex flex-col" style={{ height: "100dvh", maxHeight: "100dvh" }}>
      <header className="edl-glass-strong rounded-none border-x-0 border-t-0 px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Quitter"
          className="w-10 h-10 rounded-xl edl-glass flex items-center justify-center hover:scale-95 transition"
        >
          <X size={18} className="text-white" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--edl-cyan)] font-bold">
            Avant de commencer
          </p>
          <p className="text-sm font-semibold text-white truncate">
            Checklist obligatoire · état des lieux {phase === "depart" ? "de départ" : "d'arrivée"}
          </p>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="edl-glass p-4 flex items-start gap-3">
            <ShieldCheck size={18} className="text-[var(--edl-cyan)] mt-0.5 shrink-0" />
            <p className="text-[13px] leading-relaxed text-[var(--edl-text-soft)]">
              Confirmez ces 3 points pour démarrer la prise de photos. Cette validation
              est demandée à chaque état des lieux.
            </p>
          </div>

          {ITEMS.map((item) => {
            const Icon = item.icon;
            const on = checked[item.key];
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={on}
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
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-white">
                    <Icon size={15} className="text-[var(--edl-cyan)]" /> {item.label}
                  </span>
                  <span className="block mt-1 text-[12px] text-[var(--edl-text-soft)]">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </main>

      <footer
        className="edl-glass-strong rounded-none border-x-0 border-b-0 shrink-0 px-4 pt-3 safe-bottom"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={onConfirm}
          disabled={!all}
          className="edl-cta w-full h-14 flex items-center justify-center gap-2 text-base disabled:opacity-40 disabled:pointer-events-none"
        >
          <ShieldCheck size={18} />
          {all ? "Commencer l'état des lieux" : "Cochez les 3 points pour continuer"}
        </button>
      </footer>
    </div>
  );
}
