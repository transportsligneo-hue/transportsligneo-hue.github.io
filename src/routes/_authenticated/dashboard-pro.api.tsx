import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Code2, KeyRound, Plus, Copy, Trash2, Webhook, ShieldCheck, Play, RotateCw, Send,
  CheckCircle2, XCircle, BookOpen, AlertTriangle, Download, Activity,
} from "lucide-react";
import { useCurrentOrgAccountType } from "@/hooks/useCurrentOrgAccountType";
import {
  listApiKeys, createApiKey, revokeApiKey, saveWebhookEndpoint, deleteWebhookEndpoint,
  getApiUsage, replayWebhookDelivery, sendTestWebhook,
} from "@/lib/api-keys.functions";
import { API_BASE_URL, ENDPOINTS, curlExample } from "@/lib/api/openapi-spec";
import FleetPageHeader from "@/components/flotte/FleetPageHeader";

export const Route = createFileRoute("/_authenticated/dashboard-pro/api")({
  component: ApiIntegrationsPage,
});

const EVENTS = [
  "mission.assigned",
  "mission.started",
  "mission.delivered",
  "mission.cancelled",
  "invoice.available",
];

interface ApiKeyRow {
  id: string; name: string; environment: string; key_prefix: string; key_last4: string;
  created_at: string; last_used_at?: string | null; revoked_at?: string | null;
  scope?: string; allowed_ips?: string[]; expires_at?: string | null;
}
interface HookRow {
  id: string; url: string; environment: string; events: string[]; active: boolean; created_at: string;
}
interface LogRow {
  id: string; method: string; path: string; status_code: number; duration_ms: number | null;
  request_id: string | null; idempotency_key: string | null; error_type: string | null; created_at: string;
}
interface Usage {
  summary: { requests24h: number; requestsPrev24h: number; successRate: number | null; avgLatencyMs: number | null; webhooksTotal: number; webhooksOk: number };
  hourly: number[]; logs: LogRow[];
}
interface DeliveryRow {
  id: string; event: string; target_url: string; attempt: number;
  status_code: number | null; success: boolean; error: string | null; created_at: string;
}

function ApiIntegrationsPage() {
  const { data: orgInfo, isLoading: orgLoading } = useCurrentOrgAccountType();
  const orgId = orgInfo?.orgId ?? null;

  const fetchAll = useServerFn(listApiKeys);
  const createKey = useServerFn(createApiKey);
  const revokeKey = useServerFn(revokeApiKey);
  const saveHook = useServerFn(saveWebhookEndpoint);
  const deleteHook = useServerFn(deleteWebhookEndpoint);

  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [hooks, setHooks] = useState<HookRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [revealed, setRevealed] = useState<{ label: string; value: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [hookUrl, setHookUrl] = useState("");
  const [hookEnv, setHookEnv] = useState<"test" | "live">("test");
  const [hookEvents, setHookEvents] = useState<string[]>([...EVENTS]);
  const fetchUsage = useServerFn(getApiUsage);
  const replay = useServerFn(replayWebhookDelivery);
  const testHook = useServerFn(sendTestWebhook);
  const [env, setEnv] = useState<"test" | "live">("test");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [logFilter, setLogFilter] = useState<"all" | "errors">("all");
  const [keyScope, setKeyScope] = useState<"read" | "write">("write");
  const [keyIps, setKeyIps] = useState("");
  const [keyDays, setKeyDays] = useState("");
  const [tab, setTab] = useState<"journal" | "webhooks">("journal");

  const refresh = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetchAll({ data: { organizationId: orgId } });
      setKeys(res.keys as ApiKeyRow[]);
      setHooks(res.webhooks as HookRow[]);
      setDeliveries(res.deliveries as DeliveryRow[]);
    } catch {
      toast.error("Impossible de charger la configuration API.");
    } finally {
      setLoading(false);
    }
  }, [orgId, fetchAll]);

  useEffect(() => { void refresh(); }, [refresh]);

  const loadUsage = useCallback(async () => {
    if (!orgId) return;
    try {
      setUsage((await fetchUsage({ data: { organizationId: orgId, environment: env } })) as Usage);
    } catch {
      setUsage(null);
    }
  }, [orgId, env, fetchUsage]);
  useEffect(() => { void loadUsage(); }, [loadUsage]);

  const handleReplay = async (deliveryId: string) => {
    if (!orgId) return;
    setBusy(deliveryId);
    try {
      const r = await replay({ data: { organizationId: orgId, deliveryId } });
      if (r?.success) toast.success("Envoi rejoué : votre serveur a répondu correctement.");
      else toast.error("Envoi rejoué, mais votre serveur n'a pas répondu correctement.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rejeu impossible.");
    } finally { setBusy(null); }
  };

  const handleTestHook = async (endpointId: string) => {
    if (!orgId) return;
    setBusy(endpointId);
    try {
      const r = await testHook({ data: { organizationId: orgId, endpointId } });
      if (r?.success) toast.success("Événement de test reçu par votre serveur.");
      else toast.error("Test envoyé, mais votre serveur n'a pas répondu correctement.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test impossible.");
    } finally { setBusy(null); }
  };

  const handleCreate = async (environment: "test" | "live") => {
    const ips = keyIps.split(/[\s,;]+/).filter(Boolean);
    if (!orgId) return;
    setBusy(environment);
    try {
      const res = await createKey({
        data: { organizationId: orgId, name: environment === "live" ? "Clé production" : "Clé sandbox", environment,
          scope: keyScope, allowedIps: ips, expiresInDays: keyDays ? Number(keyDays) : null },
      });
      setRevealed({ label: environment === "live" ? "Clé production" : "Clé sandbox", value: res.secret });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Génération impossible.");
    } finally {
      setBusy(null);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!orgId) return;
    setBusy(keyId);
    try {
      await revokeKey({ data: { organizationId: orgId, keyId } });
      toast.success("Clé révoquée.");
      await refresh();
    } catch {
      toast.error("Révocation impossible.");
    } finally {
      setBusy(null);
    }
  };

  const handleSaveHook = async () => {
    if (!orgId) return;
    setBusy("hook");
    try {
      const res = await saveHook({
        data: { organizationId: orgId, url: hookUrl, environment: hookEnv, events: hookEvents },
      });
      setRevealed({ label: "Secret de signature webhook", value: res.secret });
      setHookUrl("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(null);
    }
  };

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value);
    toast.success("Copié dans le presse-papiers.");
  };

  if (orgLoading || loading) {
    return (
      <div className="mx-auto max-w-xl py-24 px-6">
        <div className="h-1.5 overflow-hidden rounded-full bg-[#e6e7ee]"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#16a34a]" /></div>
        <p className="mt-3 text-center text-sm text-[#5b5d6b]">Chargement de votre espace API…</p>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-[#e6e7ee] bg-white p-6 text-[#4a4c58]">
          <AlertTriangle className="mb-3 text-[#d97706]" size={22} />
          Aucune organisation rattachée à votre compte : contactez votre gestionnaire Transports Ligneo pour activer l'API.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
      <FleetPageHeader breadcrumb="API & Intégrations" eyebrow="Intégration" title="API &" highlight="Intégrations" actions={
          <Link to="/developpeurs" className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
            <BookOpen size={16} /> Documentation
          </Link>
        } />

      {revealed && (
        <div className="rounded-2xl border border-[#2f5fff]/30 bg-[#f2f6ff] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#0b1026]">
            <ShieldCheck size={16} className="text-[#2f5fff]" /> {revealed.label} — copiez-la maintenant
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 font-mono text-sm text-[#0b1026]">
              {revealed.value}
            </code>
            <button onClick={() => copy(revealed.value)} className="rounded-lg bg-[#2f5fff] p-2 text-white" aria-label="Copier">
              <Copy size={16} />
            </button>
          </div>
          <p className="mt-2 text-xs text-[#5b5d6b]">
            Cette valeur ne sera plus jamais affichée. Stockez-la côté serveur uniquement, jamais dans un code client.
          </p>
          <button onClick={() => setRevealed(null)} className="mt-3 text-xs font-semibold text-[#2f5fff]">J'ai copié</button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-[#eef0f7] p-1 text-sm font-semibold">
          {(["test", "live"] as const).map((e) => (
            <button key={e} onClick={() => setEnv(e)} className={`rounded-lg px-4 py-1.5 transition ${env === e ? "bg-white text-[#0b1026] shadow" : "text-[#5b5d6b]"}`}>
              {e === "test" ? "Sandbox" : "Production"}
            </button>
          ))}
        </div>
        <a href="/api/public/v1/openapi.json" download="ligneo-openapi.json" className="inline-flex items-center gap-2 rounded-xl border border-[#d5d6dc] px-3 py-2 text-sm font-semibold text-[#0b1026] hover:border-[#2f5fff]">
          <Download size={15} /> Fichier OpenAPI
        </a>
      </div>

      <UsageStats usage={usage} />
      <QuickStart hasKey={keys.some((k) => !k.revoked_at && k.environment === "test")} />
      <TryConsole revealedKey={revealed?.value.startsWith("sk_test_") ? revealed.value : ""} />

      <section className="rounded-2xl border border-[#e6e7ee] bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#0b1026]">
            <KeyRound size={18} className="text-[#2f5fff]" /> Clés API
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => void handleCreate("test")}
              disabled={busy === "test"}
              className="inline-flex items-center gap-2 rounded-xl border border-[#d5d6dc] px-3 py-2 text-sm font-semibold text-[#0b1026] hover:border-[#2f5fff]"
            >
              <Plus size={15} /> Clé sandbox
            </button>
            <button
              onClick={() => void handleCreate("live")}
              disabled={busy === "live"}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2f5fff] px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              <Plus size={15} /> Clé production
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 rounded-xl bg-[#f8f9fc] p-4 sm:grid-cols-3">
          <label className="text-xs font-semibold text-[#5b5d6b]">Permissions
            <select value={keyScope} onChange={(e) => setKeyScope(e.target.value as "read" | "write")} className="mt-1 w-full rounded-lg border border-[#d5d6dc] bg-white px-2 py-2 text-sm font-normal text-[#0b1026]">
              <option value="write">Lecture et écriture</option>
              <option value="read">Lecture seule</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-[#5b5d6b]">Expiration
            <select value={keyDays} onChange={(e) => setKeyDays(e.target.value)} className="mt-1 w-full rounded-lg border border-[#d5d6dc] bg-white px-2 py-2 text-sm font-normal text-[#0b1026]">
              <option value="">Jamais</option>
              <option value="30">30 jours</option>
              <option value="90">90 jours</option>
              <option value="365">1 an</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-[#5b5d6b]">IP autorisées (optionnel)
            <input value={keyIps} onChange={(e) => setKeyIps(e.target.value)} placeholder="203.0.113.4, 198.51.100.0/24" className="mt-1 w-full rounded-lg border border-[#d5d6dc] bg-white px-2 py-2 font-mono text-xs font-normal text-[#0b1026]" />
          </label>
          <p className="text-[11px] text-[#8b8d99] sm:col-span-3">Ces réglages s'appliquent à la prochaine clé générée. Laissez les IP vides pour accepter toutes les adresses.</p>
        </div>

        {keys.length === 0 ? (
          <p className="text-sm text-[#5b5d6b]">Aucune clé pour le moment. Commencez par une clé sandbox pour vos tests.</p>
        ) : (
          <ul className="divide-y divide-[#eceef4]">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#0b1026]">{k.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${k.environment === "live" ? "bg-[#e8f5ec] text-[#16a34a]" : "bg-[#eef2ff] text-[#2f5fff]"}`}>
                      {k.environment === "live" ? "production" : "sandbox"}
                    </span>
                    <span className="rounded-full bg-[#f1f2f7] px-2 py-0.5 text-[11px] font-semibold text-[#5b5d6b]">{k.scope === "read" ? "lecture seule" : "lecture + écriture"}</span>
                    {k.allowed_ips && k.allowed_ips.length > 0 && <span className="rounded-full bg-[#f1e8ff] px-2 py-0.5 text-[11px] font-semibold text-[#6d28d9]">{k.allowed_ips.length} IP</span>}
                    {k.expires_at && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${new Date(k.expires_at) < new Date() ? "bg-[#fdeaea] text-[#dc2626]" : "bg-[#f1f2f7] text-[#5b5d6b]"}`}>{new Date(k.expires_at) < new Date() ? "expirée" : `expire le ${new Date(k.expires_at).toLocaleDateString("fr-FR")}`}</span>}
                    {k.revoked_at && <span className="rounded-full bg-[#fdeaea] px-2 py-0.5 text-[11px] font-semibold text-[#dc2626]">révoquée</span>}
                  </div>
                  <code className="mt-1 block font-mono text-xs text-[#5b5d6b]">
                    {k.key_prefix}••••••••{k.key_last4}
                  </code>
                  <span className="text-[11px] text-[#8b8d99]">
                    Créée le {new Date(k.created_at).toLocaleDateString("fr-FR")}
                    {k.last_used_at ? ` · dernier appel ${new Date(k.last_used_at).toLocaleString("fr-FR")}` : " · jamais utilisée"}
                  </span>
                </div>
                {!k.revoked_at && (
                  <button
                    onClick={() => void handleRevoke(k.id)}
                    disabled={busy === k.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#f0d3d3] px-3 py-1.5 text-xs font-semibold text-[#dc2626] hover:bg-[#fdeaea]"
                  >
                    <Trash2 size={14} /> Révoquer
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[#e6e7ee] bg-white p-6">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-[#0b1026]">
          <Webhook size={18} className="text-[#2f5fff]" /> Webhooks
        </h2>
        <p className="mb-4 text-sm text-[#5b5d6b]">
          Chaque envoi est signé en HMAC SHA-256 dans l'en-tête <code className="font-mono text-xs">X-Ligneo-Signature</code>,
          avec 3 tentatives et backoff exponentiel.
        </p>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            value={hookUrl}
            onChange={(e) => setHookUrl(e.target.value)}
            placeholder="https://votre-domaine.fr/webhooks/ligneo"
            className="rounded-xl border border-[#d5d6dc] px-3 py-2 text-sm outline-none focus:border-[#2f5fff]"
            aria-label="URL du webhook"
          />
          <select
            value={hookEnv}
            onChange={(e) => setHookEnv(e.target.value as "test" | "live")}
            className="rounded-xl border border-[#d5d6dc] px-3 py-2 text-sm"
            aria-label="Environnement du webhook"
          >
            <option value="test">Sandbox</option>
            <option value="live">Production</option>
          </select>
          <button
            onClick={() => void handleSaveHook()}
            disabled={busy === "hook" || !hookUrl}
            className="rounded-xl bg-[#2f5fff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {EVENTS.map((ev) => {
            const active = hookEvents.includes(ev);
            return (
              <button
                key={ev}
                onClick={() => setHookEvents((prev) => (active ? prev.filter((e) => e !== ev) : [...prev, ev]))}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${active ? "bg-[#2f5fff] text-white" : "bg-[#f1f2f7] text-[#5b5d6b]"}`}
              >
                {ev}
              </button>
            );
          })}
        </div>

        {hooks.length > 0 && (
          <ul className="mt-5 divide-y divide-[#eceef4]">
            {hooks.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <span className="font-mono text-sm text-[#0b1026]">{h.url}</span>
                  <div className="text-[11px] text-[#8b8d99]">
                    {h.environment === "live" ? "production" : "sandbox"} · {h.events.join(", ")}
                  </div>
                </div>
                <button
                  onClick={() => void handleTestHook(h.id)}
                  disabled={busy === h.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#d5d6dc] px-3 py-1.5 text-xs font-semibold text-[#2f5fff] hover:border-[#2f5fff]"
                >
                  <Send size={13} /> {busy === h.id ? "Envoi…" : "Tester"}
                </button>
                <button
                  onClick={async () => { await deleteHook({ data: { organizationId: orgId, endpointId: h.id } }); await refresh(); }}
                  className="rounded-lg border border-[#f0d3d3] px-3 py-1.5 text-xs font-semibold text-[#dc2626]"
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[#e6e7ee] bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#0b1026]"><Activity size={18} className="text-[#2f5fff]" /> Journal</h2>
          <div className="inline-flex rounded-xl bg-[#eef0f7] p-1 text-sm font-semibold">
            <button onClick={() => setTab("journal")} className={`rounded-lg px-3 py-1 ${tab === "journal" ? "bg-white shadow text-[#0b1026]" : "text-[#5b5d6b]"}`}>Requêtes</button>
            <button onClick={() => setTab("webhooks")} className={`rounded-lg px-3 py-1 ${tab === "webhooks" ? "bg-white shadow text-[#0b1026]" : "text-[#5b5d6b]"}`}>Webhooks</button>
          </div>
        </div>

        {tab === "journal" ? (
          <>
            <div className="mb-3 flex gap-2 text-xs font-semibold">
              {(["all", "errors"] as const).map((f) => (
                <button key={f} onClick={() => setLogFilter(f)} className={`rounded-full px-3 py-1 ${logFilter === f ? "bg-[#2f5fff] text-white" : "bg-[#f1f2f7] text-[#5b5d6b]"}`}>
                  {f === "all" ? "Toutes" : "Erreurs"}
                </button>
              ))}
              <button onClick={() => void loadUsage()} className="ml-auto inline-flex items-center gap-1 text-[#2f5fff]"><RotateCw size={13} /> Actualiser</button>
            </div>
            {(() => {
              const rows = (usage?.logs ?? []).filter((l) => logFilter === "all" || l.status_code >= 400);
              if (rows.length === 0) return <p className="text-sm text-[#5b5d6b]">Aucune requête sur les 48 dernières heures. Essayez un appel avec la console ci-dessus.</p>;
              return (
                <ul className="space-y-1.5">
                  {rows.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-[#f8f9fc] px-3 py-2 text-xs">
                      <span className={`rounded-md px-2 py-0.5 font-mono font-bold ${l.status_code < 400 ? "bg-[#e8f5ec] text-[#16a34a]" : "bg-[#fdeaea] text-[#dc2626]"}`}>{l.status_code}</span>
                      <span className="font-mono font-semibold text-[#0b1026]">{l.method} {l.path}</span>
                      {l.idempotency_key && <span className="rounded-full bg-[#f1e8ff] px-2 py-0.5 text-[10px] font-bold text-[#6d28d9]">idempotent</span>}
                      {l.error_type && <span className="text-[#dc2626]">{l.error_type}</span>}
                      <span className="text-[#8b8d99]">{l.duration_ms ?? "—"} ms</span>
                      {l.request_id && <button onClick={() => copy(l.request_id!)} className="font-mono text-[#8b8d99] hover:text-[#2f5fff]" title="Copier l'identifiant">{l.request_id}</button>}
                      <span className="ml-auto text-[#8b8d99]">{new Date(l.created_at).toLocaleString("fr-FR")}</span>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </>
        ) : deliveries.length === 0 ? (
          <p className="text-sm text-[#5b5d6b]">Aucun envoi pour le moment. Ajoutez un webhook puis cliquez sur « Tester ».</p>
        ) : (
          <ul className="space-y-1.5">
            {deliveries.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-[#f8f9fc] px-3 py-2 text-xs">
                {d.success ? <CheckCircle2 size={15} className="text-[#16a34a]" /> : <XCircle size={15} className="text-[#dc2626]" />}
                <span className="font-semibold text-[#0b1026]">{d.event}</span>
                <span className="font-mono text-[#5b5d6b]">{d.target_url}</span>
                <span className="text-[#8b8d99]">tentative {d.attempt} · {d.status_code ?? d.error ?? "—"}</span>
                <button onClick={() => void handleReplay(d.id)} disabled={busy === d.id} className="inline-flex items-center gap-1 rounded-lg border border-[#d5d6dc] px-2 py-1 font-semibold text-[#2f5fff] hover:border-[#2f5fff]">
                  <RotateCw size={12} /> {busy === d.id ? "Envoi…" : "Rejouer"}
                </button>
                <span className="ml-auto text-[#8b8d99]">{new Date(d.created_at).toLocaleString("fr-FR")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}


function UsageStats({ usage }: { usage: Usage | null }) {
  const sm = usage?.summary;
  const max = Math.max(1, ...(usage?.hourly ?? [1]));
  const delta = sm && sm.requestsPrev24h > 0 ? Math.round(((sm.requests24h - sm.requestsPrev24h) / sm.requestsPrev24h) * 100) : null;
  const tile = (label: string, value: string, sub?: string) => (
    <div className="rounded-2xl border border-[#e6e7ee] bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8b8d99]">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[#0b1026]">{value}</div>
      {sub && <div className="text-xs text-[#5b5d6b]">{sub}</div>}
    </div>
  );
  return (
    <section className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tile("Requêtes (24 h)", String(sm?.requests24h ?? 0), delta === null ? "—" : `${delta >= 0 ? "+" : ""}${delta} % vs veille`)}
        {tile("Taux de succès", sm?.successRate == null ? "—" : `${sm.successRate} %`)}
        {tile("Latence moyenne", sm?.avgLatencyMs == null ? "—" : `${sm.avgLatencyMs} ms`)}
        {tile("Webhooks reçus", sm && sm.webhooksTotal ? `${sm.webhooksOk}/${sm.webhooksTotal}` : "—", "24 dernières heures")}
      </div>
      <div className="rounded-2xl border border-[#e6e7ee] bg-white p-4">
        <div className="mb-2 text-xs font-semibold text-[#5b5d6b]">Requêtes par heure — 24 dernières heures</div>
        <div className="flex h-20 items-end gap-1" role="img" aria-label="Requêtes par heure">
          {(usage?.hourly ?? Array(24).fill(0)).map((n, i) => (
            <div key={i} title={`${n} requête(s)`} className="flex-1 rounded-t bg-[#2f5fff]" style={{ height: `${Math.max(4, (n / max) * 100)}%`, opacity: n ? 1 : 0.18 }} />
          ))}
        </div>
      </div>
    </section>
  );
}

function QuickStart({ hasKey }: { hasKey: boolean }) {
  const [lang, setLang] = useState<"curl" | "node" | "python">("curl");
  const quote = ENDPOINTS.find((e) => e.method === "POST" && e.path === "/quotes");
  const body = quote?.sampleBody ? JSON.stringify(quote.sampleBody, null, 2) : "{}";
  const code = {
    curl: quote ? curlExample(quote) : "",
    node: `const res = await fetch("${API_BASE_URL}/quotes", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + process.env.LIGNEO_API_KEY,
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  },
  body: JSON.stringify(${body.replace(/\n/g, "\n  ")}),
});
console.log(await res.json());`,
    python: `import os, uuid, requests

r = requests.post(
    "${API_BASE_URL}/quotes",
    headers={
        "Authorization": "Bearer " + os.environ["LIGNEO_API_KEY"],
        "Idempotency-Key": str(uuid.uuid4()),
    },
    json=${body.replace(/\n/g, "\n    ")},
)
print(r.json())`,
  }[lang];
  return (
    <section className="rounded-2xl border border-[#e6e7ee] bg-white p-6">
      <h2 className="text-lg font-semibold text-[#0b1026]">Démarrer en 3 étapes</h2>
      <ol className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <li className={`rounded-xl p-3 ${hasKey ? "bg-[#e8f5ec]" : "bg-[#f1f2f7]"}`}><b>1.</b> Générez une clé sandbox {hasKey && "✓"}</li>
        <li className="rounded-xl bg-[#f1f2f7] p-3"><b>2.</b> Testez un appel ci-dessous</li>
        <li className="rounded-xl bg-[#f1f2f7] p-3"><b>3.</b> Passez en production avec une clé <code className="font-mono text-xs">sk_live_</code></li>
      </ol>
      <div className="mt-4 flex items-center gap-2 text-xs font-semibold">
        {(["curl", "node", "python"] as const).map((l) => (
          <button key={l} onClick={() => setLang(l)} className={`rounded-full px-3 py-1 ${lang === l ? "bg-[#2f5fff] text-white" : "bg-[#f1f2f7] text-[#5b5d6b]"}`}>{l === "node" ? "Node.js" : l === "python" ? "Python" : "cURL"}</button>
        ))}
        <button onClick={() => { void navigator.clipboard.writeText(code); toast.success("Code copié."); }} className="ml-auto inline-flex items-center gap-1 text-[#2f5fff]"><Copy size={13} /> Copier</button>
      </div>
      <pre className="mt-2 overflow-x-auto rounded-xl bg-[#0a1440] p-4 font-mono text-xs leading-6 text-[#cfe0ff]">{code}</pre>
    </section>
  );
}

function TryConsole({ revealedKey }: { revealedKey: string }) {
  const [key, setKey] = useState("");
  const [epId, setEpId] = useState(ENDPOINTS[0]?.id ?? "");
  const [pathVal, setPathVal] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [running, setRunning] = useState(false);
  const [out, setOut] = useState<{ status: number; ms: number; headers: Record<string, string>; body: string } | null>(null);
  const ep = ENDPOINTS.find((e) => e.id === epId) ?? ENDPOINTS[0];
  const needsId = ep.path.includes("{");

  useEffect(() => { if (revealedKey) setKey(revealedKey); }, [revealedKey]);
  useEffect(() => {
    setBodyText(ep.sampleBody ? JSON.stringify(ep.sampleBody, null, 2) : "");
    setPathVal("");
    setOut(null);
  }, [epId]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    if (!key.startsWith("sk_test_")) { toast.error("Collez une clé sandbox (sk_test_…). La console n'utilise jamais la production."); return; }
    const path = needsId ? ep.path.replace(/\{[^}]+\}/, encodeURIComponent(pathVal || "test")) : ep.path;
    setRunning(true);
    const t0 = performance.now();
    try {
      const res = await fetch(`/api/public/v1${path}`, {
        method: ep.method,
        headers: {
          Authorization: `Bearer ${key.trim()}`,
          ...(ep.sampleBody ? { "Content-Type": "application/json" } : {}),
          ...(ep.idempotent ? { "Idempotency-Key": crypto.randomUUID() } : {}),
        },
        body: ep.sampleBody ? bodyText : undefined,
      });
      const text = await res.text();
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* texte brut */ }
      const headers: Record<string, string> = {};
      ["x-request-id", "x-ratelimit-remaining", "idempotent-replayed"].forEach((h) => { const v = res.headers.get(h); if (v) headers[h] = v; });
      setOut({ status: res.status, ms: Math.round(performance.now() - t0), headers, body: pretty });
    } catch {
      setOut({ status: 0, ms: 0, headers: {}, body: "Appel impossible (réseau)." });
    } finally { setRunning(false); }
  };

  return (
    <section className="rounded-2xl border border-[#e6e7ee] bg-white p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[#0b1026]"><Play size={18} className="text-[#16a34a]" /> Essayer un appel</h2>
      <p className="mt-1 text-sm text-[#5b5d6b]">Appel réel sur la sandbox : aucune mission n'est créée, aucun convoyeur n'est attribué. Votre clé reste dans cette page, elle n'est jamais enregistrée.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk_test_… (collez votre clé sandbox)" aria-label="Clé sandbox" className="rounded-xl border border-[#d5d6dc] px-3 py-2 font-mono text-sm outline-none focus:border-[#2f5fff]" />
        <select value={epId} onChange={(e) => setEpId(e.target.value)} aria-label="Endpoint" className="rounded-xl border border-[#d5d6dc] px-3 py-2 text-sm">
          {ENDPOINTS.map((e) => <option key={e.id} value={e.id}>{e.method} {e.path} — {e.summary}</option>)}
        </select>
      </div>
      {needsId && <input value={pathVal} onChange={(e) => setPathVal(e.target.value)} placeholder="Identifiant (laisser vide pour un exemple sandbox)" className="mt-3 w-full rounded-xl border border-[#d5d6dc] px-3 py-2 font-mono text-sm outline-none focus:border-[#2f5fff]" />}
      {ep.sampleBody !== undefined && <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={9} spellCheck={false} aria-label="Corps JSON" className="mt-3 w-full rounded-xl border border-[#d5d6dc] bg-[#f8f9fc] p-3 font-mono text-xs outline-none focus:border-[#2f5fff]" />}
      <button onClick={() => void run()} disabled={running} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
        <Play size={15} /> {running ? "Appel en cours…" : "Envoyer"}
      </button>
      {out && (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
            <span className={`rounded-md px-2 py-0.5 font-mono font-bold ${out.status > 0 && out.status < 400 ? "bg-[#e8f5ec] text-[#16a34a]" : "bg-[#fdeaea] text-[#dc2626]"}`}>{out.status || "ERR"}</span>
            <span className="text-[#8b8d99]">{out.ms} ms</span>
            {Object.entries(out.headers).map(([k, v]) => <span key={k} className="font-mono text-[#8b8d99]">{k}: {v}</span>)}
          </div>
          <pre className="max-h-80 overflow-auto rounded-xl bg-[#0a1440] p-4 font-mono text-xs leading-6 text-[#cfe0ff]">{out.body}</pre>
        </div>
      )}
    </section>
  );
}
