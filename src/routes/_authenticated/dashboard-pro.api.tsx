import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Code2, KeyRound, Plus, Copy, Trash2, Loader2, Webhook, ShieldCheck,
  CheckCircle2, XCircle, BookOpen, AlertTriangle,
} from "lucide-react";
import { useCurrentOrgAccountType } from "@/hooks/useCurrentOrgAccountType";
import {
  listApiKeys, createApiKey, revokeApiKey, saveWebhookEndpoint, deleteWebhookEndpoint,
} from "@/lib/api-keys.functions";

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
}
interface HookRow {
  id: string; url: string; environment: string; events: string[]; active: boolean; created_at: string;
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

  const handleCreate = async (environment: "test" | "live") => {
    if (!orgId) return;
    setBusy(environment);
    try {
      const res = await createKey({
        data: { organizationId: orgId, name: environment === "live" ? "Clé production" : "Clé sandbox", environment },
      });
      setRevealed({ label: environment === "live" ? "Clé production" : "Clé sandbox", value: res.secret });
      await refresh();
    } catch {
      toast.error("Génération impossible.");
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
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-pro-accent" size={28} />
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
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#2f5fff]">
            <Code2 size={18} />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">Intégration</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-[#0b1026]">API &amp; Intégrations</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#5b5d6b]">
            Créez devis et missions directement depuis votre DMS, ERP ou plateforme de gestion de flotte.
            Les clés sont hashées : la valeur en clair n'est affichée qu'une seule fois.
          </p>
        </div>
        <Link
          to="/developpeurs"
          className="inline-flex items-center gap-2 rounded-xl border border-[#2f5fff] px-4 py-2 text-sm font-semibold text-[#2f5fff] hover:bg-[#2f5fff] hover:text-white transition"
        >
          <BookOpen size={16} /> Documentation
        </Link>
      </header>

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

      <section className="rounded-2xl border border-[#e6e7ee] bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#0b1026]">
            <KeyRound size={18} className="text-[#b8862a]" /> Clés API
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
        <h2 className="mb-4 text-lg font-semibold text-[#0b1026]">Journal des envois</h2>
        {deliveries.length === 0 ? (
          <p className="text-sm text-[#5b5d6b]">Aucun envoi pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {deliveries.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-[#f8f9fc] px-3 py-2 text-xs">
                {d.success ? <CheckCircle2 size={15} className="text-[#16a34a]" /> : <XCircle size={15} className="text-[#dc2626]" />}
                <span className="font-semibold text-[#0b1026]">{d.event}</span>
                <span className="font-mono text-[#5b5d6b]">{d.target_url}</span>
                <span className="text-[#8b8d99]">tentative {d.attempt} · {d.status_code ?? d.error ?? "—"}</span>
                <span className="ml-auto text-[#8b8d99]">{new Date(d.created_at).toLocaleString("fr-FR")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
