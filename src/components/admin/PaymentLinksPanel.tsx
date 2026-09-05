import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Link2,
  Copy,
  Share2,
  RefreshCw,
  Plus,
  Check,
  X,
  Search,
  FlaskConical,
  MessageSquare,
  Mail,
  History,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createPaymentLink,
  getPaymentLinkHistory,
  listPaymentLinks,
  refreshPaymentLinkStatus,
  searchDevisForPaymentLink,
  searchMissionsForPaymentLink,
  sendPaymentLink,
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
  trajets?: {
    depart?: string | null;
    arrivee?: string | null;
    client_nom?: string | null;
    client_email?: string | null;
    client_telephone?: string | null;
    prix_client?: number | null;
  } | null;
};

type DevisOption = {
  id: string;
  numero: string | null;
  nom?: string | null;
  prenom?: string | null;
  email?: string | null;
  telephone?: string | null;
  depart?: string | null;
  arrivee?: string | null;
  prix_estime?: number | null;
};

type HistoryData = {
  attachments: Array<{ id: string; action: string; mission_id: string | null; created_at: string }>;
  sends: Array<{
    id: string;
    channel: string;
    destination: string;
    status: string;
    error: string | null;
    created_at: string;
  }>;
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
  const searchDevis = useServerFn(searchDevisForPaymentLink);
  const sendLink = useServerFn(sendPaymentLink);
  const loadHistory = useServerFn(getPaymentLinkHistory);

  const [rows, setRows] = useState<PaymentLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");

  // rattachement dans le formulaire
  const [linkTarget, setLinkTarget] = useState<"mission" | "devis">("mission");
  const [formQuery, setFormQuery] = useState("");
  const [missionOptions, setMissionOptions] = useState<MissionOption[]>([]);
  const [devisOptions, setDevisOptions] = useState<DevisOption[]>([]);
  const [pickedMission, setPickedMission] = useState<MissionOption | null>(null);
  const [pickedDevis, setPickedDevis] = useState<DevisOption | null>(null);

  // rattachement a posteriori
  const [attachFor, setAttachFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<MissionOption[]>([]);

  // envois & historique
  const [sendFor, setSendFor] = useState<string | null>(null);
  const [sendChannel, setSendChannel] = useState<"sms" | "email">("sms");
  const [sendTo, setSendTo] = useState("");
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);

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

  // Recherche dans le formulaire de création.
  useEffect(() => {
    if (!open || missionId) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        if (linkTarget === "mission") {
          const res = (await searchMissions({ data: { q: formQuery } })) as MissionOption[];
          if (!cancelled) setMissionOptions(res);
        } else {
          const res = (await searchDevis({ data: { q: formQuery } })) as DevisOption[];
          if (!cancelled) setDevisOptions(res);
        }
      } catch {
        /* ignore */
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, missionId, linkTarget, formQuery, searchMissions, searchDevis]);

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

  function pickMission(m: MissionOption) {
    setPickedMission(m);
    setPickedDevis(null);
    if (m.trajets?.client_nom) setNom(m.trajets.client_nom);
    if (m.trajets?.client_email) setEmail(m.trajets.client_email);
    if (m.trajets?.client_telephone) setTelephone(m.trajets.client_telephone);
    // Toujours reprendre le prix à jour de la mission (devis modifié inclus).
    if (m.trajets?.prix_client) setAmount(String(m.trajets.prix_client));
    if (m.trajets?.depart) {
      setDescription(`Convoyage ${m.trajets.depart} → ${m.trajets.arrivee ?? ""}`.trim());
    }
  }

  function pickDevis(d: DevisOption) {
    setPickedDevis(d);
    setPickedMission(null);
    if (d.nom) setNom(d.nom);
    if (d.prenom) setPrenom(d.prenom);
    if (d.email) setEmail(d.email);
    if (d.telephone) setTelephone(d.telephone);
    // Le montant suit toujours la dernière révision du devis.
    if (d.prix_estime) setAmount(String(d.prix_estime));
    if (d.depart) {
      setDescription(`Devis ${d.numero ?? ""} · ${d.depart} → ${d.arrivee ?? ""}`.trim());
    }
  }


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(String(amount).replace(",", "."));
    if (!(value > 0)) {
      setError("Montant invalide.");
      return;
    }
    const targetMission = missionId ?? pickedMission?.id ?? null;
    const targetDevis = missionId ? null : (pickedDevis?.id ?? null);
    if (!targetMission && !targetDevis) {
      setError("Choisissez la mission ou le devis auquel rattacher ce paiement.");
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
          missionId: targetMission,
          devisId: targetDevis,
          sandbox,
          clientNom: nom.trim() || null,
          clientPrenom: prenom.trim() || null,
          clientEmail: email.trim() || null,
          clientTelephone: telephone.trim() || null,
          checkoutUrl: provider === "stripe" ? stripeUrl.trim() || null : null,
        },
      });
      setAmount("");
      setDescription("");
      setStripeUrl("");
      setNom("");
      setPrenom("");
      setEmail("");
      setTelephone("");
      setPickedMission(null);
      setPickedDevis(null);
      setFormQuery("");
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

  async function doSend(row: PaymentLinkRow) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await sendLink({
        data: { linkId: row.id, channel: sendChannel, destination: sendTo.trim() || null },
      });
      setNotice(
        `Lien envoyé par ${sendChannel === "sms" ? "SMS" : "email"} à ${(res as any).destination}.`,
      );
      setSendFor(null);
      setSendTo("");
      if (historyFor === row.id) setHistory((await loadHistory({ data: { linkId: row.id } })) as HistoryData);
    } catch (e: any) {
      setError(e?.message ?? "Envoi impossible");
    } finally {
      setBusy(false);
    }
  }

  async function toggleHistory(row: PaymentLinkRow) {
    if (historyFor === row.id) {
      setHistoryFor(null);
      setHistory(null);
      return;
    }
    setHistoryFor(row.id);
    setHistory(null);
    try {
      setHistory((await loadHistory({ data: { linkId: row.id } })) as HistoryData);
    } catch (e: any) {
      setError(e?.message ?? "Historique indisponible");
    }
  }

  function rattachement(r: PaymentLinkRow) {
    if (r.attributions?.numero_mission) return `Mission ${r.attributions.numero_mission}`;
    if (r.devis?.numero) return `Devis ${r.devis.numero}`;
    if (r.factures?.numero) return `Facture ${r.factures.numero}`;
    return null;
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
      {notice && <p className="text-[12px] text-emerald-600 mb-3">{notice}</p>}

      {open && (
        <form onSubmit={submit} className="mb-5 grid gap-3 rounded-xl border border-[#e6e8ef] p-4">
          {!missionId && (
            <div className="grid gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`dvx-btn ${linkTarget === "mission" ? "solid" : "outline"}`}
                  onClick={() => setLinkTarget("mission")}
                >
                  Mission
                </button>
                <button
                  type="button"
                  className={`dvx-btn ${linkTarget === "devis" ? "solid" : "outline"}`}
                  onClick={() => setLinkTarget("devis")}
                >
                  Devis
                </button>
              </div>
              {pickedMission || pickedDevis ? (
                <div className="flex items-center justify-between rounded-lg bg-[#f2f4fa] px-3 py-2 text-[12.5px]">
                  <span>
                    <b>
                      {pickedMission ? pickedMission.numero_mission : pickedDevis?.numero}
                    </b>{" "}
                    <span className="text-[#70727d]">
                      {pickedMission
                        ? `${pickedMission.trajets?.depart ?? ""} → ${pickedMission.trajets?.arrivee ?? ""}`
                        : `${pickedDevis?.depart ?? ""} → ${pickedDevis?.arrivee ?? ""}`}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="dvx-btn outline"
                    onClick={() => {
                      setPickedMission(null);
                      setPickedDevis(null);
                    }}
                  >
                    <X size={13} /> Changer
                  </button>
                </div>
              ) : (
                <>
                  <input
                    className="dvx-input"
                    value={formQuery}
                    onChange={(e) => setFormQuery(e.target.value)}
                    placeholder={
                      linkTarget === "mission"
                        ? "Numéro de mission…"
                        : "Numéro de devis, nom ou email…"
                    }
                  />
                  <div className="max-h-44 space-y-1 overflow-auto">
                    {linkTarget === "mission"
                      ? missionOptions.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className="w-full rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-[#f2f4fa]"
                            onClick={() => pickMission(m)}
                          >
                            <span className="font-semibold">{m.numero_mission ?? "—"}</span>{" "}
                            <span className="text-[#70727d]">
                              {m.trajets?.client_nom ?? ""} · {m.trajets?.depart ?? ""} →{" "}
                              {m.trajets?.arrivee ?? ""}
                            </span>
                          </button>
                        ))
                      : devisOptions.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            className="w-full rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-[#f2f4fa]"
                            onClick={() => pickDevis(d)}
                          >
                            <span className="font-semibold">{d.numero ?? "—"}</span>{" "}
                            <span className="text-[#70727d]">
                              {d.prenom ?? ""} {d.nom ?? ""} · {d.depart ?? ""} → {d.arrivee ?? ""}
                            </span>
                          </button>
                        ))}
                  </div>
                </>
              )}
            </div>
          )}

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

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="dvx-col-k">Prénom</span>
              <input className="dvx-input" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
            </label>
            <label className="grid gap-1">
              <span className="dvx-col-k">Nom</span>
              <input className="dvx-input" value={nom} onChange={(e) => setNom(e.target.value)} />
            </label>
            <label className="grid gap-1">
              <span className="dvx-col-k">Email</span>
              <input
                className="dvx-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@exemple.fr"
              />
            </label>
            <label className="grid gap-1">
              <span className="dvx-col-k">Téléphone</span>
              <input
                className="dvx-input"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="06 12 34 56 78"
              />
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
              <FlaskConical size={14} /> Mode test (sandbox Revolut — nécessite une clé secrète sandbox)
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
                  {rattachement(r) && (
                    <span className="dvx-badge blue">
                      <FileText size={11} /> {rattachement(r)}
                    </span>
                  )}
                  <span className="text-[11.5px] text-[#a3a4ac]">
                    {new Date(r.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <p className="dvx-price">
                  {eur(r.amount_cents, r.currency)}
                  <small>TTC</small>
                </p>
              </div>

              {(r.client_prenom || r.client_nom || r.client_email || r.client_telephone) && (
                <p className="mt-2 text-[12px] text-[#70727d]">
                  {[r.client_prenom, r.client_nom].filter(Boolean).join(" ")}
                  {r.client_email ? ` · ${r.client_email}` : ""}
                  {r.client_telephone ? ` · ${r.client_telephone}` : ""}
                </p>
              )}

              {r.description && <p className="mt-2 text-[12.5px] text-[#14161c]">{r.description}</p>}

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
                    <button
                      type="button"
                      className="dvx-btn outline"
                      onClick={() => {
                        setSendFor(sendFor === r.id ? null : r.id);
                        setSendChannel("sms");
                        setSendTo(r.client_telephone ?? "");
                      }}
                    >
                      <MessageSquare size={13} /> Envoyer
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
                <button type="button" className="dvx-btn outline" onClick={() => void toggleHistory(r)}>
                  <History size={13} /> Historique
                </button>
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

              {sendFor === r.id && (
                <div className="mt-3 grid gap-2 rounded-lg border border-[#e6e8ef] p-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`dvx-btn ${sendChannel === "sms" ? "solid" : "outline"}`}
                      onClick={() => {
                        setSendChannel("sms");
                        setSendTo(r.client_telephone ?? "");
                      }}
                    >
                      <MessageSquare size={13} /> SMS
                    </button>
                    <button
                      type="button"
                      className={`dvx-btn ${sendChannel === "email" ? "solid" : "outline"}`}
                      onClick={() => {
                        setSendChannel("email");
                        setSendTo(r.client_email ?? "");
                      }}
                    >
                      <Mail size={13} /> Email
                    </button>
                  </div>
                  <input
                    className="dvx-input"
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                    placeholder={sendChannel === "sms" ? "06 12 34 56 78" : "client@exemple.fr"}
                  />
                  <div className="flex gap-2">
                    <button type="button" className="dvx-btn solid" disabled={busy} onClick={() => void doSend(r)}>
                      {busy ? "Envoi…" : "Envoyer le lien"}
                    </button>
                    <button type="button" className="dvx-btn outline" onClick={() => setSendFor(null)}>
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {historyFor === r.id && (
                <div className="mt-3 rounded-lg border border-[#e6e8ef] p-3 text-[12px]">
                  {!history ? (
                    <p className="dvx-col-k">Chargement…</p>
                  ) : (
                    <>
                      <p className="dvx-col-k">Envois</p>
                      {history.sends.length === 0 ? (
                        <p className="text-[#70727d]">Aucun envoi.</p>
                      ) : (
                        history.sends.map((s) => (
                          <p key={s.id} className="text-[#14161c]">
                            {new Date(s.created_at).toLocaleString("fr-FR")} ·{" "}
                            {s.channel === "sms" ? "SMS" : "Email"} → {s.destination} ·{" "}
                            <span className={s.status === "sent" ? "text-emerald-600" : "text-red-600"}>
                              {s.status === "sent" ? "envoyé" : `échec ${s.error ?? ""}`}
                            </span>
                          </p>
                        ))
                      )}
                      <p className="dvx-col-k mt-2">Rattachements</p>
                      {history.attachments.length === 0 ? (
                        <p className="text-[#70727d]">Aucun mouvement.</p>
                      ) : (
                        history.attachments.map((a) => (
                          <p key={a.id} className="text-[#14161c]">
                            {new Date(a.created_at).toLocaleString("fr-FR")} ·{" "}
                            {a.action === "attach" ? "rattaché" : "détaché"}
                          </p>
                        ))
                      )}
                      {r.paid_at && (
                        <p className="mt-2 text-emerald-600">
                          Payé le {new Date(r.paid_at).toLocaleString("fr-FR")}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

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
