/**
 * Page admin : Paramètres IA.
 * - Toggle global + niveau d'assistance
 * - Grille de switches par capacité
 * - Statistiques 30 jours
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { useAiSettings } from "@/lib/ai/context";
import { AI_CAPABILITIES, type AiCapability, type AssistanceLevel } from "@/lib/ai/types";
import { updateAiSettings, getAiUsageStats, type AiUsageStats } from "@/lib/ai/settings.functions";

export const Route = createFileRoute("/_authenticated/admin/parametres-ia")({
  component: AiSettingsPage,
});

function AiSettingsPage() {
  const { settings, refresh } = useAiSettings();
  const update = useServerFn(updateAiSettings);
  const fetchStats = useServerFn(getAiUsageStats);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [stats, setStats] = useState<AiUsageStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchStats({ data: undefined as never }).then((r) => {
      if (!cancelled && r.ok) setStats(r.stats);
    }).catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [fetchStats]);

  const grouped = useMemo(() => {
    const m = new Map<string, typeof AI_CAPABILITIES>();
    for (const c of AI_CAPABILITIES) {
      const arr = m.get(c.group) ?? [];
      arr.push(c);
      m.set(c.group, arr);
    }
    return [...m.entries()];
  }, []);

  const applyPatch = async (patch: Record<string, boolean | string>, label: string) => {
    setSaving(label); setError(null); setSaved(null);
    try {
      const res = await update({ data: patch as never });
      if (!res.ok) throw new Error(res.error ?? "Erreur");
      setSaved(label);
      await refresh();
      setTimeout(() => setSaved(null), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex items-center gap-4">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-900 shadow-lg">
            <Sparkles className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-3xl font-serif font-semibold text-slate-900">Paramètres IA</h1>
            <p className="text-sm text-slate-600">
              Activez ou désactivez chaque capacité individuellement. Les changements sont appliqués immédiatement.
            </p>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
        {saved && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 flex items-center gap-2">
            <Check className="h-4 w-4" /> {saved} enregistré
          </div>
        )}

        {/* Kill switch global */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">IA globale</h2>
              <p className="text-sm text-slate-600">
                Interrupteur maître. Désactivé, l'application se comporte exactement comme sans IA.
              </p>
            </div>
            <Toggle
              checked={settings.ai_enabled}
              busy={saving === "IA globale"}
              onChange={(v) => applyPatch({ ai_enabled: v }, "IA globale")}
            />
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2">
            {(["minimal","standard","avance"] as AssistanceLevel[]).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => applyPatch({ assistance_level: lvl }, "Niveau d'assistance")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                  settings.assistance_level === lvl
                    ? "border-amber-500 bg-amber-50 text-amber-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {lvl === "avance" ? "Avancé" : lvl}
              </button>
            ))}
          </div>
        </section>

        {/* Capacités groupées */}
        <section className={`space-y-6 ${settings.ai_enabled ? "" : "opacity-60 pointer-events-none"}`}>
          {grouped.map(([group, items]) => (
            <div key={group} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{group}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((c) => {
                  const cap = c.key as AiCapability;
                  const checked = Boolean(settings[cap]);
                  return (
                    <div key={cap} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <span className="text-sm text-slate-800">{c.label}</span>
                      <Toggle
                        checked={checked}
                        busy={saving === c.label}
                        onChange={(v) => applyPatch({ [cap]: v }, c.label)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Statistiques */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Statistiques d'utilisation (30 jours)</h2>
          {!stats && <p className="text-sm text-slate-500">Chargement…</p>}
          {stats && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Appels" value={stats.total_calls_30d.toLocaleString("fr-FR")} />
                <Stat label="Taux de succès" value={`${Math.round(stats.success_rate * 100)}%`} />
                <Stat label="Latence moyenne" value={`${stats.avg_latency_ms} ms`} />
                <Stat label="Latence p95" value={`${stats.p95_latency_ms} ms`} />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-700">Par capacité</h4>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left px-3 py-2">Capacité</th>
                        <th className="text-right px-3 py-2">Appels</th>
                        <th className="text-right px-3 py-2">Succès</th>
                        <th className="text-right px-3 py-2">Latence moy.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.by_capability.map((r) => (
                        <tr key={r.capability} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-800">{r.capability}</td>
                          <td className="px-3 py-2 text-right">{r.calls}</td>
                          <td className="px-3 py-2 text-right">{Math.round(r.success_rate * 100)}%</td>
                          <td className="px-3 py-2 text-right">{r.avg_latency_ms} ms</td>
                        </tr>
                      ))}
                      {stats.by_capability.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-slate-500">Aucun appel IA sur la période.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Toggle({
  checked, onChange, busy,
}: { checked: boolean; onChange: (v: boolean) => void; busy?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={busy}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        checked ? "bg-amber-500" : "bg-slate-300"
      } ${busy ? "opacity-70" : ""}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
      {busy && <Loader2 className="absolute inset-0 m-auto h-3 w-3 animate-spin text-white" />}
    </button>
  );
}
