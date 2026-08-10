/**
 * Admin — Alertes opérationnelles.
 * Missions à risque détectées automatiquement : suivi, acquittement, réglages des seuils.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import { supabase } from "@/integrations/supabase/client";
import { useMissionAlerts } from "@/hooks/useMissionAlerts";
import {
  ALERT_TYPES,
  DEFAULT_ALERTES_CONFIG,
  SEVERITY_META,
  alertTypeLabel,
  sinceLabel,
  type AlertSeverity,
  type AlertesConfig,
} from "@/lib/mission-alerts";
import {
  AlertTriangle, RefreshCw, ShieldCheck, Check, Phone, MapPin,
  Loader2, Settings2, History, Zap, ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/alertes")({
  component: AdminAlertes,
});

type Tab = "actives" | "historique" | "reglages";

function AdminAlertes() {
  const [tab, setTab] = useState<Tab>("actives");
  const [running, setRunning] = useState(false);
  const active = useMissionAlerts("active");
  const history = useMissionAlerts("history", 100);

  const runDetection = async () => {
    setRunning(true);
    const { error } = await supabase.rpc("admin_run_alert_detection" as never, {} as never);
    setRunning(false);
    if (error) toast.error("Analyse impossible", { description: error.message });
    else {
      toast.success("Analyse des missions terminée");
      active.refetch();
    }
  };

  return (
    <div className="adm6 space-y-5">
      <AdminSectionHeader
        breadcrumb="Alertes opérationnelles"
        eyebrow="Supervision temps réel"
        title="Alertes opérationnelles"
        subtitle="Missions à risque : retards, silences GPS, EDL manquants et incidents non traités."
        actions={
          <button
            onClick={runDetection}
            disabled={running}
            className="h-9 px-3 rounded-lg bg-[#2f5fff] text-white flex items-center gap-1.5 text-[13px] font-semibold hover:bg-[#2450e0] disabled:opacity-60"
          >
            {running ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Analyser maintenant
          </button>
        }
      />

      {/* Compteurs */}
      <div className="grid grid-cols-3 gap-3">
        {(["critique", "attention", "info"] as const).map((s) => (
          <div key={s} className={`rounded-xl border p-4 ${SEVERITY_META[s].card}`}>
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--a6-muted)]">
              <span className={`h-2 w-2 rounded-full ${SEVERITY_META[s].dot}`} /> {SEVERITY_META[s].label}
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--a6-text)]">{active.counts[s]}</p>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <div className="flex items-center gap-2 flex-wrap">
        <button className={`a6-chip ${tab === "actives" ? "active" : ""}`} onClick={() => setTab("actives")}>
          <AlertTriangle size={13} className="inline mr-1" /> En cours · {active.counts.total}
        </button>
        <button className={`a6-chip ${tab === "historique" ? "active" : ""}`} onClick={() => setTab("historique")}>
          <History size={13} className="inline mr-1" /> Historique
        </button>
        <button className={`a6-chip ${tab === "reglages" ? "active" : ""}`} onClick={() => setTab("reglages")}>
          <Settings2 size={13} className="inline mr-1" /> Réglages
        </button>
      </div>

      {tab === "reglages" ? (
        <AlertesSettings />
      ) : (
        <AlertsList
          list={tab === "actives" ? active.alerts : history.alerts}
          loading={tab === "actives" ? active.loading : history.loading}
          readOnly={tab === "historique"}
          onChanged={() => { active.refetch(); history.refetch(); }}
        />
      )}
    </div>
  );
}

function AlertsList({
  list, loading, readOnly, onChanged,
}: {
  list: ReturnType<typeof useMissionAlerts>["alerts"];
  loading: boolean;
  readOnly: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (id: string, rpc: "acknowledge_mission_alert" | "resolve_mission_alert") => {
    setBusy(id);
    const { error } = await supabase.rpc(rpc as never, { _alert_id: id } as never);
    setBusy(null);
    if (error) toast.error("Action impossible", { description: error.message });
    else onChanged();
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#2f5fff]" size={22} /></div>;
  }
  if (list.length === 0) {
    return (
      <div className="a6-card p-12 text-center">
        <ShieldCheck size={30} className="mx-auto text-emerald-500 mb-3" />
        <p className="font-semibold text-[var(--a6-text)]">Aucune alerte</p>
        <p className="text-[12.5px] text-[var(--a6-dim)]">Les missions en cours respectent les seuils configurés.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {list.map((a) => {
        const conv = a.attribution?.convoyeur;
        const traj = a.attribution?.trajet;
        return (
          <li key={a.id} className={`rounded-xl border p-4 ${SEVERITY_META[a.severity].card}`}>
            <div className="flex items-start gap-3">
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${SEVERITY_META[a.severity].dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${SEVERITY_META[a.severity].chip}`}>
                    {SEVERITY_META[a.severity].label}
                  </span>
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--a6-muted)]">
                    {alertTypeLabel(a.alert_type)}
                  </span>
                  <span className="text-[10.5px] text-[var(--a6-dim)]">{sinceLabel(a.triggered_at)}</span>
                  {a.escalated_at && (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-red-600">
                      <ArrowUpRight size={11} /> escaladée
                    </span>
                  )}
                  {a.status === "acknowledged" && (
                    <span className="text-[10.5px] font-semibold text-emerald-600">prise en compte</span>
                  )}
                </div>

                <p className="mt-1 text-[13.5px] font-semibold text-[var(--a6-text)]">{a.titre}</p>
                {a.message && <p className="text-[12px] text-[var(--a6-muted)] mt-0.5">{a.message}</p>}

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[var(--a6-muted)]">
                  {a.attribution?.numero_mission && (
                    <span className="a6-mono font-semibold text-[var(--a6-blue-deep)]">{a.attribution.numero_mission}</span>
                  )}
                  {traj && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} /> {traj.depart} → {traj.arrivee}
                    </span>
                  )}
                  {conv && (
                    <span className="inline-flex items-center gap-1">
                      {[conv.prenom, conv.nom].filter(Boolean).join(" ") || "Convoyeur"}
                      {conv.telephone && (
                        <a href={`tel:${conv.telephone}`} className="inline-flex items-center gap-1 font-semibold text-[#2f5fff] hover:underline">
                          <Phone size={11} /> {conv.telephone}
                        </a>
                      )}
                    </span>
                  )}
                  {traj?.client_telephone && (
                    <a href={`tel:${traj.client_telephone}`} className="inline-flex items-center gap-1 font-semibold text-[#2f5fff] hover:underline">
                      <Phone size={11} /> Client {traj.client_nom ?? ""}
                    </a>
                  )}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {a.attribution?.trajet_id && (
                    <Link
                      to="/admin/missions"
                      className="rounded-lg border border-[#eaeaee] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#2f5fff] hover:bg-[#f4f7ff]"
                    >
                      Ouvrir la mission
                    </Link>
                  )}
                  {!readOnly && a.status === "open" && (
                    <button
                      onClick={() => act(a.id, "acknowledge_mission_alert")}
                      disabled={busy === a.id}
                      className="rounded-lg bg-[#2f5fff] px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-[#2450e0] disabled:opacity-60"
                    >
                      Prendre en charge
                    </button>
                  )}
                  {!readOnly && (
                    <button
                      onClick={() => act(a.id, "resolve_mission_alert")}
                      disabled={busy === a.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#eaeaee] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[var(--a6-muted)] hover:text-[var(--a6-text)] disabled:opacity-60"
                    >
                      <Check size={12} /> Clôturer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function AlertesSettings() {
  const [config, setConfig] = useState<AlertesConfig>(DEFAULT_ALERTES_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings" as never)
        .select("value")
        .eq("key" as never, "alertes_operationnelles" as never)
        .maybeSingle();
      const value = (data as unknown as { value?: AlertesConfig } | null)?.value;
      if (value) setConfig({ ...DEFAULT_ALERTES_CONFIG, ...value, types: { ...DEFAULT_ALERTES_CONFIG.types, ...(value.types ?? {}) } });
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings" as never)
      .update({ value: config } as never)
      .eq("key" as never, "alertes_operationnelles" as never);
    setSaving(false);
    if (error) toast.error("Enregistrement impossible", { description: error.message });
    else toast.success("Réglages enregistrés");
  };

  const patchType = (key: string, patch: Partial<AlertesConfig["types"][string]>) =>
    setConfig((c) => ({ ...c, types: { ...c.types, [key]: { ...c.types[key], ...patch } } }));

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#2f5fff]" size={22} /></div>;

  return (
    <div className="space-y-3">
      <div className="a6-card p-4 flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--a6-text)]">
          <input type="checkbox" checked={config.enabled} onChange={(e) => setConfig({ ...config, enabled: e.target.checked })} />
          <Zap size={14} className="text-[#2f5fff]" /> Détection automatique activée
        </label>
        <label className="inline-flex items-center gap-2 text-[12.5px] text-[var(--a6-muted)]">
          Escalade en critique après
          <input
            type="number"
            min={5}
            value={config.escalade_minutes}
            onChange={(e) => setConfig({ ...config, escalade_minutes: Number(e.target.value) })}
            className="w-20 rounded-lg border border-[var(--a6-border)] px-2 py-1 text-[12.5px]"
          />
          minutes sans prise en charge
        </label>
        <button
          onClick={save}
          disabled={saving}
          className="ml-auto h-9 px-4 rounded-lg bg-[#2f5fff] text-white text-[13px] font-semibold hover:bg-[#2450e0] disabled:opacity-60"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {Object.entries(ALERT_TYPES).map(([key, meta]) => {
        const c = config.types[key] ?? { enabled: true, seuil: meta.defautSeuil, severite: "attention" as AlertSeverity };
        return (
          <div key={key} className="a6-card p-4 flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 min-w-[260px]">
              <input type="checkbox" checked={c.enabled} onChange={(e) => patchType(key, { enabled: e.target.checked })} />
              <span>
                <span className="block text-[13px] font-semibold text-[var(--a6-text)]">{meta.label}</span>
                <span className="block text-[11.5px] text-[var(--a6-dim)]">{meta.description}</span>
              </span>
            </label>
            <label className="inline-flex items-center gap-2 text-[12px] text-[var(--a6-muted)]">
              Seuil
              <input
                type="number"
                min={0}
                value={c.seuil}
                onChange={(e) => patchType(key, { seuil: Number(e.target.value) })}
                className="w-20 rounded-lg border border-[var(--a6-border)] px-2 py-1 text-[12.5px]"
              />
              {meta.unite}
            </label>
            <label className="inline-flex items-center gap-2 text-[12px] text-[var(--a6-muted)]">
              Sévérité
              <select
                value={c.severite}
                onChange={(e) => patchType(key, { severite: e.target.value as AlertSeverity })}
                className="rounded-lg border border-[var(--a6-border)] px-2 py-1 text-[12.5px]"
              >
                <option value="info">Info</option>
                <option value="attention">Attention</option>
                <option value="critique">Critique</option>
              </select>
            </label>
          </div>
        );
      })}
    </div>
  );
}
