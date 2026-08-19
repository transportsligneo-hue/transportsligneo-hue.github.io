import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, TrendingUp, Wallet, CreditCard, FileDown, Clock3, CheckCircle2,
  ArrowUpRight, ArrowDownRight, Loader2, Pencil, Check, X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/convoyeur/finances")({
  component: FinancesPage,
});

interface PaidMission {
  id: string;
  ref: string;
  date: string;
  depart: string;
  arrivee: string;
  montant: number;
  updated_at: string;
  paid: boolean;
}

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const MONTHS_FULL = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

function maskIban(iban: string): string {
  const clean = iban.replace(/\s+/g, "").toUpperCase();
  if (clean.length < 8) return clean;
  return `${clean.slice(0, 4)} •••• •••• ${clean.slice(-4)}`;
}

function FinancesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<PaidMission[]>([]);
  const [iban, setIban] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("convoyeur_iban") ?? "";
  });
  const [editingIban, setEditingIban] = useState(false);
  const [ibanDraft, setIbanDraft] = useState(iban);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: conv } = await supabase
        .from("convoyeurs").select("id").eq("user_id", user.id).maybeSingle();
      if (!conv) { setLoading(false); return; }

      const { data: attrs } = await supabase
        .from("attributions")
        .select("id, statut, trajet_id")
        .eq("convoyeur_id", conv.id)
        .in("statut", ["termine"]);

      const trajetIds = (attrs ?? []).map((a) => a.trajet_id).filter(Boolean) as string[];
      if (trajetIds.length === 0) { setLoading(false); return; }

      const since = new Date();
      since.setMonth(since.getMonth() - 11);
      since.setDate(1);

      const { data: trs } = await supabase
        .from("trajets_assigned_safe" as never)
        .select("id, depart, arrivee, date_trajet, tarif_convoyeur, updated_at, numero_mission")
        .in("id", trajetIds)
        .gte("updated_at", since.toISOString());

      const now = Date.now();
      const rows: PaidMission[] = (trs ?? []).map((t) => {
        const dt = (t as any).updated_at as string;
        const paid = now - new Date(dt).getTime() > 1000 * 60 * 60 * 24 * 7; // payé si >7j
        return {
          id: (t as any).id,
          ref: (t as any).numero_mission ?? (t as any).id?.slice(0, 8).toUpperCase() ?? "—",
          date: (t as any).date_trajet ?? dt,
          depart: (t as any).depart ?? "—",
          arrivee: (t as any).arrivee ?? "—",
          montant: Number((t as any).tarif_convoyeur ?? 0),
          updated_at: dt,
          paid,
        };
      }).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

      setMissions(rows);
      setLoading(false);
    })();
  }, [user]);

  const { thisMonth, lastMonth, delta, monthly, currentLabel } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const inMonth = (d: Date, yy: number, mm: number) => d.getFullYear() === yy && d.getMonth() === mm;

    const thisMonth = missions
      .filter((x) => inMonth(new Date(x.updated_at), y, m))
      .reduce((s, x) => s + x.montant, 0);
    const lm = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
    const lastMonth = missions
      .filter((x) => inMonth(new Date(x.updated_at), lm.y, lm.m))
      .reduce((s, x) => s + x.montant, 0);
    const delta = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

    const monthly: { label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - i, 1);
      const total = missions
        .filter((x) => inMonth(new Date(x.updated_at), d.getFullYear(), d.getMonth()))
        .reduce((s, x) => s + x.montant, 0);
      monthly.push({ label: MONTHS_FR[d.getMonth()], total });
    }
    return { thisMonth, lastMonth, delta, monthly, currentLabel: MONTHS_FULL[m] };
  }, [missions]);

  const upcomingPayouts = missions.filter((x) => !x.paid);
  const pastPayouts = missions.filter((x) => x.paid);

  const maxMonthly = Math.max(1, ...monthly.map((x) => x.total));

  const saveIban = () => {
    const clean = ibanDraft.replace(/\s+/g, "").toUpperCase();
    localStorage.setItem("convoyeur_iban", clean);
    setIban(clean);
    setEditingIban(false);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#4EA8FF]" size={28} /></div>;
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/convoyeur"
          className="w-10 h-10 rounded-2xl border border-[rgba(96,165,250,0.28)] bg-white/[0.04] flex items-center justify-center text-[#c9d6f2] active:scale-95 transition-transform"
          aria-label="Retour"
        >
          <ArrowLeft size={17} />
        </Link>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4EA8FF]">Espace Finances</p>
          <h1 className="text-[24px] leading-tight font-bold text-white">Mes revenus</h1>
        </div>
      </div>

      {/* Résumé */}
      <div className="relative overflow-hidden rounded-[24px] border border-[rgba(217,181,74,0.35)] bg-gradient-to-br from-[#0e1e4a] via-[#0a1738] to-[#081230] p-5 shadow-[0_18px_45px_-20px_rgba(0,0,0,0.7)]">
        <span className="pointer-events-none absolute -top-14 -right-14 w-52 h-52 rounded-full bg-[radial-gradient(circle,rgba(217,181,74,0.22),transparent_70%)]" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] font-bold text-[#c9d6f2]">
              {currentLabel.charAt(0).toUpperCase() + currentLabel.slice(1)} {new Date().getFullYear()}
            </p>
            <p className="fin-amount-hero text-[44px] font-bold text-[#f5b940] tabular-nums leading-none mt-2 drop-shadow-[0_0_18px_rgba(217,181,74,0.4)]">
              {thisMonth.toFixed(0)} <span className="text-[26px]">€</span>
            </p>
            {delta !== null ? (
              <p className="flex items-center gap-1.5 text-[12px] mt-3">
                {delta >= 0 ? (
                  <ArrowUpRight size={14} className="text-[#34d399]" />
                ) : (
                  <ArrowDownRight size={14} className="text-[#f87171]" />
                )}
                <span className={`font-semibold ${delta >= 0 ? "text-[#34d399]" : "text-[#f87171]"}`}>
                  {delta > 0 ? "+" : ""}{delta}%
                </span>
                <span className="text-[#8fa3cc]">vs mois dernier ({lastMonth.toFixed(0)} €)</span>
              </p>
            ) : (
              <p className="text-[12px] mt-3 text-[#8fa3cc]">Premier mois d'activité rémunéré</p>
            )}
          </div>
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#2F7DFF] to-[#1a5ad6] flex items-center justify-center shadow-[0_0_16px_rgba(78,168,255,0.55)] shrink-0">
            <TrendingUp size={18} className="text-white" />
          </div>
        </div>
      </div>

      {/* Graphique 6 mois */}
      <div className="rounded-[22px] border border-[rgba(96,165,250,0.18)] bg-gradient-to-br from-[#0c1a42] via-[#0a1636] to-[#081230] p-4">
        <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#4EA8FF]">Évolution 6 mois</p>
        <div className="mt-4 flex items-end justify-between gap-2 h-32">
          {monthly.map((mo, i) => {
            const h = Math.max(6, Math.round((mo.total / maxMonthly) * 100));
            const active = i === monthly.length - 1;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                <div className="w-full flex flex-col items-center justify-end h-full">
                  <span className={`text-[9px] tabular-nums mb-1 ${active ? "fin-month-active" : "text-[#8fa3cc]"}`}>
                    {mo.total > 0 ? `${mo.total.toFixed(0)}` : ""}
                  </span>
                  <div
                    className={`w-full max-w-[26px] rounded-t-lg transition-all duration-500 ${
                      active
                        ? "bg-gradient-to-t from-[#f5b940] to-[#fbd776] shadow-[0_0_12px_rgba(217,181,74,0.55)]"
                        : "bg-gradient-to-t from-[#2F7DFF] to-[#4EA8FF]"
                    }`}
                    style={{ height: `${h}%` }}
                  />
                </div>
                <span className={`text-[10px] font-semibold ${active ? "fin-month-active text-[#f5b940]" : "text-[#8fa3cc]"}`}>
                  {mo.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Paiements à venir */}
      <section>
        <div className="flex items-center gap-2 mb-2 px-1">
          <Clock3 size={14} className="text-[#f59e0b]" />
          <h2 className="text-[13px] font-bold text-white">Paiements à venir</h2>
          <span className="text-[11px] text-[#8fa3cc]">({upcomingPayouts.length})</span>
        </div>
        {upcomingPayouts.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[rgba(96,165,250,0.22)] bg-white/[0.02] px-4 py-6 text-center text-[12px] text-[#8fa3cc]">
            Aucun paiement en attente
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingPayouts.map((m) => {
              const eta = new Date(m.updated_at);
              eta.setDate(eta.getDate() + 7);
              return (
                <div key={m.id} className="rounded-[18px] border border-[rgba(234,179,8,0.28)] bg-gradient-to-br from-[#1c1508] to-[#0a1636] p-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl border border-[rgba(234,179,8,0.35)] bg-[rgba(224,168,62,0.14)] flex items-center justify-center shrink-0">
                    <Clock3 size={16} className="text-[#f59e0b]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-white truncate">
                      {m.depart} → {m.arrivee}
                    </p>
                    <p className="text-[10.5px] text-[#8fa3cc] mt-0.5 tabular-nums">
                      Réf. {m.ref} • versement prévu le {eta.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <p className="text-[15px] font-bold text-[#f5b940] tabular-nums shrink-0">{m.montant.toFixed(0)} €</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Détail missions payées du mois */}
      <section>
        <div className="flex items-center gap-2 mb-2 px-1">
          <Wallet size={14} className="text-[#34d399]" />
          <h2 className="text-[13px] font-bold text-white">Missions rémunérées — {currentLabel}</h2>
        </div>
        {(() => {
          const now = new Date();
          const rows = missions.filter((x) => {
            const d = new Date(x.updated_at);
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
          });
          if (rows.length === 0) {
            return (
              <div className="rounded-[18px] border border-dashed border-[rgba(96,165,250,0.22)] bg-white/[0.02] px-4 py-6 text-center text-[12px] text-[#8fa3cc]">
                Aucune mission terminée ce mois-ci
              </div>
            );
          }
          return (
            <div className="space-y-2">
              {rows.map((m) => (
                <div key={m.id} className="rounded-[18px] border border-[rgba(96,165,250,0.18)] bg-gradient-to-br from-[#0c1a42] to-[#081230] p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#4EA8FF]">Réf. {m.ref}</p>
                      <p className="text-[13.5px] font-semibold text-white truncate mt-1">
                        {m.depart} → {m.arrivee}
                      </p>
                      <p className="text-[10.5px] text-[#8fa3cc] mt-1 tabular-nums">
                        {new Date(m.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    <p className="text-[16px] font-bold text-[#f5b940] tabular-nums shrink-0">{m.montant.toFixed(0)} €</p>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </section>

      {/* Historique versements */}
      <section>
        <div className="flex items-center gap-2 mb-2 px-1">
          <CheckCircle2 size={14} className="text-[#34d399]" />
          <h2 className="text-[13px] font-bold text-white">Historique des versements</h2>
        </div>
        {pastPayouts.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[rgba(96,165,250,0.22)] bg-white/[0.02] px-4 py-6 text-center text-[12px] text-[#8fa3cc]">
            Aucun versement à ce jour
          </div>
        ) : (
          <div className="rounded-[18px] border border-[rgba(96,165,250,0.18)] bg-gradient-to-br from-[#0c1a42] to-[#081230] divide-y divide-[rgba(96,165,250,0.12)] overflow-hidden">
            {pastPayouts.slice(0, 10).map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3">
                <div className="w-9 h-9 rounded-xl border border-[rgba(52,211,153,0.35)] bg-[rgba(74,208,160,0.10)] flex items-center justify-center shrink-0">
                  <CheckCircle2 size={15} className="text-[#34d399]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-white truncate">Virement — Réf. {m.ref}</p>
                  <p className="text-[10.5px] text-[#8fa3cc] mt-0.5 tabular-nums">
                    {new Date(m.updated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} • Reçu
                  </p>
                </div>
                <p className="text-[13.5px] font-bold text-[#34d399] tabular-nums shrink-0">+{m.montant.toFixed(0)} €</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Moyen de paiement */}
      <section>
        <div className="flex items-center gap-2 mb-2 px-1">
          <CreditCard size={14} className="text-[#60a5fa]" />
          <h2 className="text-[13px] font-bold text-white">Moyen de paiement</h2>
        </div>
        <div className="rounded-[18px] border border-[rgba(96,165,250,0.22)] bg-gradient-to-br from-[#0c1a42] to-[#081230] p-4">
          {editingIban ? (
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#8fa3cc]">IBAN</label>
              <input
                autoFocus
                value={ibanDraft}
                onChange={(e) => setIbanDraft(e.target.value.toUpperCase())}
                placeholder="FR76 1234 5678 9012 3456 7890 123"
                className="w-full px-3 py-2.5 rounded-xl bg-[#04091c] border border-[rgba(96,165,250,0.35)] text-white text-[13px] tabular-nums outline-none focus:border-[#4EA8FF]"
              />
              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveIban}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-[#2F7DFF] to-[#1a5ad6] text-white text-[13px] font-semibold shadow-[0_10px_20px_-8px_rgba(47,125,255,0.6)]"
                >
                  <Check size={15} /> Enregistrer
                </button>
                <button
                  onClick={() => { setIbanDraft(iban); setEditingIban(false); }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[rgba(96,165,250,0.28)] text-[#c9d6f2] text-[13px]"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl border border-[rgba(96,165,250,0.35)] bg-gradient-to-br from-[#0d1f4d] to-[#0a1638] flex items-center justify-center shrink-0">
                <CreditCard size={17} className="text-[#60a5fa]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#8fa3cc]">RIB enregistré</p>
                <p className="text-[14px] font-semibold text-white tabular-nums mt-0.5 truncate">
                  {iban ? maskIban(iban) : "Non configuré"}
                </p>
              </div>
              <button
                onClick={() => { setIbanDraft(iban); setEditingIban(true); }}
                className="w-9 h-9 rounded-xl border border-[rgba(96,165,250,0.28)] bg-white/[0.04] flex items-center justify-center text-[#c9d6f2] active:scale-95"
                aria-label="Modifier"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Documents */}
      <section>
        <div className="flex items-center gap-2 mb-2 px-1">
          <FileDown size={14} className="text-[#a78bfa]" />
          <h2 className="text-[13px] font-bold text-white">Relevés mensuels</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {monthly.slice().reverse().slice(0, 4).map((mo, i) => {
            const disabled = mo.total === 0;
            return (
              <button
                key={i}
                disabled={disabled}
                onClick={() => window.print()}
                className={`flex items-center gap-3 p-3 rounded-[16px] border transition-all ${
                  disabled
                    ? "border-[rgba(96,165,250,0.10)] bg-white/[0.02] opacity-50 cursor-not-allowed"
                    : "border-[rgba(167,139,250,0.28)] bg-gradient-to-br from-[#1a1230] to-[#0a1636] active:scale-[0.97]"
                }`}
              >
                <div className="w-9 h-9 rounded-xl border border-[rgba(167,139,250,0.35)] bg-[rgba(139,108,224,0.14)] flex items-center justify-center shrink-0">
                  <FileDown size={15} className="text-[#a78bfa]" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[12px] font-semibold text-white truncate">Relevé {mo.label}</p>
                  <p className="text-[10px] text-[#8fa3cc] tabular-nums">{mo.total.toFixed(0)} €</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
