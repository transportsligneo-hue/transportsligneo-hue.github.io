import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Copy, Share2, RefreshCw, Plus, Check, X, Search, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createPaymentLink,
  listPaymentLinks,
  refreshPaymentLinkStatus,
  searchMissionsForPaymentLink,
  setPaymentLinkMission,
  type PaymentLinkRow,
} from "@/lib/payment-links.functions";

const eur = (cents: number, currency = "EUR") =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);

const STATUT_LABEL: Record<string, string> = {
  pending: "En attente",
  processing: "En cours",
  paid: "Payé",
  failed: "Échoué",
  cancelled: "Annulé",
  expired: "Expiré",
};

const statutTone = (s: string) =>
  s === "paid" ? "green" : s === "failed" || s === "cancelled" || s === "expired" ? "red" : "orange";

type MissionOption = {
  id: string;
  numero_mission: string | null;
  trajets?: { depart?: string | null; arrivee?: string | null; client_nom?: string | null } | null;
};

export function PaymentLinksPanel({
  missionId = null,
  title = "Liens de paiement",
}: {
  missionId?: string | null;
  title?: string;
}) {
  const list = useServerFn(listPaymentLinks);
  const create = useServerFn(createPaymentLink);
  const attach = useServerFn(setPaymentLinkMission);
  const refresh = useServerFn(refreshPaymentLinkStatus);
  const searchMissions = useServerFn(searchMissionsForPaymentLink);

  const [rows, setRows] = useState<PaymentLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // formulaire
  const [provider, setProvider] = useState<"revolut" | "stripe">("revolut");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [description, setDescription] = useState("");
  const [sandbox, setSandbox] = useState(false);
  const [stripeUrl, setStripeUrl] = useState("");

  // rattachement
  const [attachFor, setAttachFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<MissionOption[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await list({ data: { missionId } });
      setRows(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [list, missionId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime : statut mis à jour dès réception du webhook Revolut.
  useEffect(() => {
    const channel = supabase
      .channel("payment-links-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_links" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  useEffect(() => {
    if (attachFor === null) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = (await searchMissions({ data: { q: query } })) as MissionOption[];
        if (!cancelled) setOptions(res);
      } catch {
        /* ignore */
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [attachFor, query, searchMissions]);

  const total = useMemo(
    () => rows.filter((r) => r.statut === "paid").reduce((s, r) => s + r.amount_cents, 0),
    [rows],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(String(amount).replace(",", "."));
    if (!(value > 0)) {
      setError("Montant invalide.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await create({
        data: {
          provider,
          amount: value,
          currency,
          description: description.trim() || null,
          missionId,
          sandbox,
          checkoutUrl: provider === "stripe" ? stripeUrl.trim() || null : null,
        },
      });
      setAmount("");
      setDescription("");
      setStripeUrl("");
      setOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Création impossible");
    } finally {
      setBusy(false);
    }
  }

  async function copy(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* ignore */
    }
  }

  async function share(row: PaymentLinkRow) {
    const url = row.checkout_url ?? "";
    const text = `Lien de paiement Transports Ligneo — ${eur(row.amount_cents, row.currency)}\n${url}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Lien de paiement", text, url });
        return;
      } catch {
        /* annulé */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  return (
    <div className="dvx-card">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[13.5px] font-bold text-[#14161c] flex items-center gap-2">
            <Link2 size={15} /> {title}
          </h3>
          <p className="dvx-col-k mb-0">
            {rows.length} lien{rows.length > 1 ? "s" : ""} · {eur(total)} encaissés
          </p>
        </div>
        <button type="button" className="dvx-btn solid" onClick={() => setOpen((v) => !v)}>
          <Plus size={14} /> Créer un lien de paiement
        </button>
      </div>

      {error && <p className="text-[12px] text-red-600 mb-3">{error}</p>}

      {open && (
        <form onSubmit={submit} className="mb-5 grid gap-3 rounded-xl border border-[#e6e8ef] p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1">
              <span className="dvx-col-k">Prestataire</span>
              <select
                className="dvx-select"
                value={provider}
                onChange={(e) => setProvider(e.target.value as "revolut" | "stripe")}
              >
                <option value="revolut">Revolut</option>
                <option value="stripe">Stripe</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="dvx-col-k">Montant</span>
              <input
                className="dvx-input"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="450,00"
              />
            </label>
            <label className="grid gap-1">
              <span className="dvx-col-k">Devise</span>
              <select className="dvx-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="USD">USD</option>
                <option value="CHF">CHF</option>
              </select>
            </label>
          </div>
          <label className="grid gap-1">
            <span className="dvx-col-k">Description</span>
            <input
              className="dvx-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Convoyage Tours → Blois"
            />
          </label>
          {provider === "stripe" && (
            <label className="grid gap-1">
              <span className="dvx-col-k">Lien Stripe existant</span>
              <input
                className="dvx-input"
                value={stripeUrl}
                onChange={(e) => setStripeUrl(e.target.value)}
                placeholder="https://buy.stripe.com/…"
              />
            </label>
          )}
          {provider === "revolut" && (
            <label className="flex items-center gap-2 text-[12.5px] text-[#14161c]">
              <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} />
              <FlaskConical size={14} /> Mode test (sandbox Revolut)
            </label>
          )}
          <div className="flex gap-2">
            <button type="submit" className="dvx-btn solid" disabled={busy}>
              {busy ? "Génération…" : "Générer"}
            </button>
            <button type="button" className="dvx-btn outline" onClick={() => setOpen(false)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="dvx-col-k">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="dvx-col-k">Aucun lien de paiement pour le moment.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-[#e6e8ef] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`dvx-badge ${r.provider === "revolut" ? "violet" : "blue"}`}>
                    {r.provider}
                  </span>
                  <span className={`dvx-badge ${statutTone(r.statut)}`}>
                    {STATUT_LABEL[r.statut] ?? r.statut}
                  </span>
                  {r.environment === "sandbox" && <span className="dvx-badge grey">test</span>}
                  <span className="text-[11.5px] text-[#a3a4ac]">
                    {new Date(r.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <p className="dvx-price">
                  {eur(r.amount_cents, r.currency)}
                  <small>TTC</small>
                </p>
              </div>

              {r.description && (
                <p className="mt-2 text-[12.5px] text-[#14161c]">{r.description}</p>
              )}

              {r.checkout_url && (
                <p className="mt-2 truncate text-[11.5px] text-[#70727d]">{r.checkout_url}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {r.checkout_url && (
                  <>
                    <button type="button" className="dvx-btn outline" onClick={() => void copy(r.checkout_url!, r.id)}>
                      {copied === r.id ? <Check size={13} /> : <Copy size={13} />}{" "}
                      {copied === r.id ? "Copié" : "Copier"}
                    </button>
                    <button type="button" className="dvx-btn outline" onClick={() => void share(r)}>
                      <Share2 size={13} /> Partager
                    </button>
                  </>
                )}
                {r.provider === "revolut" && (
                  <button
                    type="button"
                    className="dvx-btn outline"
                    onClick={async () => {
                      try {
                        await refresh({ data: { linkId: r.id } });
                        await load();
                      } catch (e: any) {
                        setError(e?.message ?? "Actualisation impossible");
                      }
                    }}
                  >
                    <RefreshCw size={13} /> Actualiser
                  </button>
                )}
                {!missionId &&
                  (r.mission_id ? (
                    <button
                      type="button"
                      className="dvx-btn outline"
                      onClick={async () => {
                        await attach({ data: { linkId: r.id, missionId: null } });
                        await load();
                      }}
                    >
                      <X size={13} /> Détacher la mission
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="dvx-btn outline"
                      onClick={() => {
                        setAttachFor(attachFor === r.id ? null : r.id);
                        setQuery("");
                      }}
                    >
                      <Search size={13} /> Rattacher à une mission
                    </button>
                  ))}
              </div>

              {attachFor === r.id && (
                <div className="mt-3 rounded-lg border border-[#e6e8ef] p-3">
                  <input
                    className="dvx-input mb-2"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Numéro de mission ou client…"
                  />
                  <div className="max-h-52 space-y-1 overflow-auto">
                    {options.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="w-full rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-[#f2f4fa]"
                        onClick={async () => {
                          await attach({ data: { linkId: r.id, missionId: m.id } });
                          setAttachFor(null);
                          await load();
                        }}
                      >
                        <span className="font-semibold">{m.numero_mission ?? "—"}</span>{" "}
                        <span className="text-[#70727d]">
                          {m.trajets?.client_nom ?? ""} · {m.trajets?.depart ?? ""} → {m.trajets?.arrivee ?? ""}
                        </span>
                      </button>
                    ))}
                    {options.length === 0 && <p className="dvx-col-k">Aucune mission trouvée.</p>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PaymentLinksPanel;
