/**
 * MissionPVDigitauxBlock — PV de livraison digitalisés (Model/Arval, Welcomauto/Ayvens).
 *
 * NE PAS confondre avec l'état des lieux interne.
 * Ce bloc gère uniquement les PV digitalisés des plateformes externes.
 *
 * - mode="admin"  : édition complète (toggle, lien, code, plaque, instruction)
 * - mode="driver" : lecture seule + boutons Ouvrir / Copier code / Copier plaque
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExternalLink, Copy, ClipboardCheck, Loader2, Save } from "lucide-react";

type Plateforme = "model_arval" | "welcomauto_ayvens";

interface PvRow {
  id?: string;
  plateforme: Plateforme;
  actif: boolean;
  url: string | null;
  code: string | null;
  plaque: string | null;
  instruction: string | null;
}

const PLATEFORMES: { key: Plateforme; label: string; hint: string }[] = [
  { key: "model_arval", label: "Model / Arval", hint: "PV digitalisé Model utilisé par Arval." },
  { key: "welcomauto_ayvens", label: "Welcomauto / Ayvens", hint: "PV digitalisé Welcomauto utilisé par Ayvens." },
];

const emptyRow = (p: Plateforme): PvRow => ({
  plateforme: p,
  actif: false,
  url: "",
  code: "",
  plaque: "",
  instruction: "",
});

export function MissionPVDigitauxBlock({
  attributionId,
  mode = "admin",
}: {
  attributionId: string;
  mode?: "admin" | "driver";
}) {
  const [rows, setRows] = useState<Record<Plateforme, PvRow>>({
    model_arval: emptyRow("model_arval"),
    welcomauto_ayvens: emptyRow("welcomauto_ayvens"),
  });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<Plateforme | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("mission_pv_digitaux" as never)
        .select("*")
        .eq("attribution_id", attributionId);
      if (!alive) return;
      const next: Record<Plateforme, PvRow> = {
        model_arval: emptyRow("model_arval"),
        welcomauto_ayvens: emptyRow("welcomauto_ayvens"),
      };
      ((data as PvRow[]) || []).forEach((r) => {
        if (r.plateforme in next) next[r.plateforme] = r;
      });
      setRows(next);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [attributionId]);

  const save = async (p: Plateforme) => {
    setSavingKey(p);
    const row = rows[p];
    const payload = {
      attribution_id: attributionId,
      plateforme: p,
      actif: row.actif,
      url: row.url || null,
      code: row.code || null,
      plaque: row.plaque || null,
      instruction: row.instruction || null,
    };
    const { error } = await supabase
      .from("mission_pv_digitaux" as never)
      .upsert(payload as never, { onConflict: "attribution_id,plateforme" });
    setSavingKey(null);
    if (error) {
      toast.error("Erreur d'enregistrement : " + error.message);
      return;
    }
    toast.success("PV digitalisé enregistré");
  };

  const update = (p: Plateforme, patch: Partial<PvRow>) => {
    setRows((prev) => ({ ...prev, [p]: { ...prev[p], ...patch } }));
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copié`);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="animate-spin" size={16} /> Chargement des PV digitalisés…
      </div>
    );
  }

  // ===== DRIVER : ne montre que les plateformes actives =====
  if (mode === "driver") {
    const active = PLATEFORMES.filter((p) => rows[p.key].actif);
    if (active.length === 0) return null;
    return (
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">PV de livraison digitalisés</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Ouvrez la plateforme demandée et collez le code ou la plaque.
          </p>
        </div>
        <div className="space-y-3">
          {active.map(({ key, label }) => {
            const r = rows[key];
            return (
              <article key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="font-semibold text-slate-900">{label}</p>
                </div>
                {r.instruction && (
                  <p className="text-xs text-slate-600 mb-3 leading-relaxed">{r.instruction}</p>
                )}
                <div className="grid gap-2">
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                    >
                      <ExternalLink size={16} /> Ouvrir {label}
                    </a>
                  )}
                  {r.code && (
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <span className="flex-1 text-sm font-mono font-semibold text-slate-900 truncate">{r.code}</span>
                      <button
                        type="button"
                        onClick={() => copy(r.code!, "Code")}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        <Copy size={12} /> Copier code
                      </button>
                    </div>
                  )}
                  {r.plaque && (
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <span className="flex-1 text-sm font-mono font-semibold text-slate-900 truncate">{r.plaque}</span>
                      <button
                        type="button"
                        onClick={() => copy(r.plaque!, "Plaque")}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        <Copy size={12} /> Copier plaque
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  // ===== ADMIN =====
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardCheck size={18} className="text-primary" />
        <h3 className="text-base font-semibold text-slate-900">PV de livraison digitalisés</h3>
      </div>
      <p className="text-xs text-slate-500 -mt-1">
        Plateformes externes (Model/Arval, Welcomauto/Ayvens). À ne pas confondre avec l'état des lieux interne.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {PLATEFORMES.map(({ key, label, hint }) => {
          const r = rows[key];
          return (
            <article key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <header className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{label}</p>
                  <p className="text-[11px] text-slate-500">{hint}</p>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={r.actif}
                    onChange={(e) => update(key, { actif: e.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-xs font-semibold text-slate-700">{r.actif ? "Activé" : "Désactivé"}</span>
                </label>
              </header>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">
                  Lien de la plateforme
                  <input
                    type="url"
                    placeholder="https://…"
                    value={r.url || ""}
                    onChange={(e) => update(key, { url: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Code (si nécessaire)
                  <input
                    type="text"
                    value={r.code || ""}
                    onChange={(e) => update(key, { code: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Plaque (si nécessaire)
                  <input
                    type="text"
                    value={r.plaque || ""}
                    onChange={(e) => update(key, { plaque: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono uppercase text-slate-900"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Instruction courte
                  <textarea
                    rows={2}
                    value={r.instruction || ""}
                    onChange={(e) => update(key, { instruction: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={() => save(key)}
                disabled={savingKey === key}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {savingKey === key ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Enregistrer
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
