import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, ChevronDown, Euro, FileDown, FileText,
  Fuel, Gauge, Loader2, Receipt, Save, Search, Settings2, TrendingUp, Users, Wrench,
} from "lucide-react";
import FleetPageHeader, { FleetHeaderButton } from "@/components/flotte/FleetPageHeader";
import { useCurrentOrgAccountType } from "@/hooks/useCurrentOrgAccountType";
import { supabase } from "@/integrations/supabase/client";
import {
  COST_CATEGORIES, FLEET_ROLES, getFleetMembers, getFleetOverview, saveFleetSettings,
  updateFleetMemberAccess, type FleetAlert, type FleetTco,
} from "@/lib/fleet-tco.functions";
import { downloadCsv, downloadFleetPdf, fleetToCsv } from "@/lib/fleet-tco-export";
import { PlateBadge } from "@/components/plate/PlateBadge";
import { HelpTip } from "@/components/ui/HelpTip";
import { useIsDemoAccount } from "@/components/demo/demo-guard";

export const Route = createFileRoute("/_authenticated/dashboard-pro/tco")({
  component: FleetTcoPage,
  head: () => ({
    meta: [
      { title: "Coûts & TCO du parc — Transports Ligneo" },
      {
        name: "description",
        content:
          "Pilotez le coût total de possession de votre flotte : postes de dépense, coût au kilomètre, alertes d'échéances et exports comptables.",
      },
      { property: "og:title", content: "Coûts & TCO du parc — Transports Ligneo" },
      { property: "og:type", content: "website" },
    ],
  }),
});

const fmtEur = (n: number) =>
  Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const fmtKm = (n: number | null) => (n == null ? "—" : `${n.toFixed(3).replace(".", ",")} €`);
const catLabel = (id: string) => COST_CATEGORIES.find((c) => c.id === id)?.label ?? id;

const CAT_COLORS: Record<string, string> = {
  carburant: "#2f5fff", entretien: "#16a34a", assurance: "#7c3aed", pneumatiques: "#0ea5e9",
  peages: "#f59e0b", amendes: "#dc2626", convoyage: "#14b8a6", financement: "#0f172a",
  taxes: "#ec4899", depreciation: "#64748b", autre: "#a3a4ac",
};

const ALERT_LABEL: Record<FleetAlert["type"], string> = {
  controle_technique: "Contrôle technique",
  revision: "Révision",
  contrat: "Fin de contrat",
  tco_eleve: "Surcoût détecté",
};

const SEV_CLS: Record<string, string> = {
  critique: "border-l-[#dc2626] bg-[#fdeaea]",
  haute: "border-l-[#d97706] bg-[#fef3e2]",
  moyenne: "border-l-[#2f5fff] bg-[#eef2ff]",
};

type Veh = FleetTco["vehicules"][number];
type CostRow = { vehicle_id: string; categorie: string; montant: number; date_cout: string };

/* ---------- Jeu de données de démonstration (compte démo uniquement) ---------- */
function buildDemo(): { tco: FleetTco; alerts: FleetAlert[]; costs: CostRow[] } {
  const base: Array<[string, string, string, string, number, number]> = [
    ["FG-214-QX", "Renault", "Master", "utilitaire", 84200, 1.0],
    ["GH-482-LM", "Peugeot", "Expert", "utilitaire", 61350, 0.92],
    ["GK-731-ZA", "Citroën", "Jumpy", "utilitaire", 47800, 0.88],
    ["FZ-095-TB", "Renault", "Trafic", "utilitaire", 112400, 1.22],
    ["GL-318-PD", "Tesla", "Model 3", "berline", 38900, 0.8],
    ["FV-640-RN", "BMW", "Série 3", "berline", 71200, 1.1],
    ["GM-157-CS", "Mercedes", "Vito", "utilitaire", 56700, 1.05],
    ["FX-872-HK", "Volkswagen", "Transporter", "utilitaire", 129800, 1.35],
  ];
  const costs: CostRow[] = [];
  const now = new Date();
  const vehicules: Veh[] = base.map(([plate, marque, modele, type, km, k], idx) => {
    const id = `demo-${idx}`;
    let total = 0;
    for (let m = 11; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 15).toISOString().slice(0, 10);
      const season = 1 + 0.12 * Math.sin((m + idx) / 2);
      const add = (categorie: string, montant: number) => {
        const v = Math.round(montant * season * k);
        total += v; costs.push({ vehicle_id: id, categorie, montant: v, date_cout: d });
      };
      add("carburant", 420);
      add("assurance", 135);
      add("financement", 390);
      if (m % 3 === 0) add("entretien", 310);
      if (m % 4 === 1) add("convoyage", 240);
      if (m % 5 === 2) add("peages", 85);
      if (m === 6) add("pneumatiques", 640);
      if (m === 3 && idx % 3 === 0) add("amendes", 90);
    }
    return { id, immatriculation: plate, marque, modele, type_vehicule: type, site_id: null, kilometrage: km, total, tco_km: total / km } as Veh;
  });
  const par_categorie: Record<string, number> = {};
  costs.forEach((c) => { par_categorie[c.categorie] = (par_categorie[c.categorie] ?? 0) + c.montant; });
  const total = vehicules.reduce((s, v) => s + v.total, 0);
  const moy = total / vehicules.reduce((s, v) => s + v.kilometrage, 0);
  const d30 = new Date(Date.now() + 18 * 864e5).toISOString().slice(0, 10);
  const d60 = new Date(Date.now() + 52 * 864e5).toISOString().slice(0, 10);
  const alerts: FleetAlert[] = [
    { type: "controle_technique", vehicle_id: "demo-3", immatriculation: "FZ-095-TB", severite: "critique", date: d30 },
    { type: "revision", vehicle_id: "demo-7", immatriculation: "FX-872-HK", severite: "haute", km_restants: 1200 },
    { type: "contrat", vehicle_id: "demo-5", immatriculation: "FV-640-RN", severite: "moyenne", date: d60 },
    { type: "tco_eleve", vehicle_id: "demo-7", immatriculation: "FX-872-HK", severite: "haute", tco_km: vehicules[7].tco_km, moyenne: moy },
  ];
  return { tco: { total, par_categorie, vehicules }, alerts, costs };
}

/* ---------- Petits composants graphiques (SVG, sans dépendance) ---------- */
function Donut({ parts, total }: { parts: Array<{ id: string; value: number }>; total: number }) {
  const R = 54, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <svg viewBox="0 0 140 140" className="h-[150px] w-[150px] shrink-0 -rotate-90" role="img" aria-label="Répartition du TCO">
      <circle cx="70" cy="70" r={R} fill="none" stroke="#f2f2f5" strokeWidth="18" />
      {parts.map((p) => {
        const len = (p.value / Math.max(1, total)) * C;
        const el = (
          <circle key={p.id} cx="70" cy="70" r={R} fill="none" stroke={CAT_COLORS[p.id] ?? "#a3a4ac"} strokeWidth="18"
            strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-acc} />
        );
        acc += len;
        return el;
      })}
    </svg>
  );
}

function MonthlyChart({ months }: { months: Array<{ key: string; label: string; total: number; cats: Record<string, number> }> }) {
  const max = Math.max(1, ...months.map((m) => m.total));
  const W = 640, H = 200, padL = 40, padB = 26, padT = 10;
  const bw = (W - padL) / Math.max(1, months.length);
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Évolution mensuelle des coûts">
      {ticks.map((t) => {
        const y = padT + (H - padB - padT) * (1 - t / max);
        return (
          <g key={t}>
            <line x1={padL} x2={W} y1={y} y2={y} stroke="#eaeaee" strokeDasharray="3 4" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#a3a4ac">{t >= 1000 ? `${Math.round(t / 100) / 10}k` : t}</text>
          </g>
        );
      })}
      {months.map((m, i) => {
        let y = H - padB;
        const x = padL + i * bw + bw * 0.18;
        const w = bw * 0.64;
        return (
          <g key={m.key}>
            {COST_CATEGORIES.map((c) => {
              const v = m.cats[c.id] ?? 0;
              if (!v) return null;
              const h = (v / max) * (H - padB - padT);
              y -= h;
              return <rect key={c.id} x={x} y={y} width={w} height={h} fill={CAT_COLORS[c.id]} rx={i === 0 ? 0 : 1}><title>{`${m.label} · ${c.label} : ${fmtEur(v)}`}</title></rect>;
            })}
            <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="#a3a4ac">{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value == null || !isFinite(value)) return <span className="text-[#a3a4ac]">—</span>;
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
      Math.abs(value) < 3 ? "bg-[#f2f2f5] text-[#70727d]" : up ? "bg-[#fdeaea] text-[#dc2626]" : "bg-[#e8f7ee] text-[#16a34a]"
    }`}>
      {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{Math.abs(value).toFixed(0)}%
    </span>
  );
}

function FleetTcoPage() {
  const { data: orgInfo, isLoading: orgLoading } = useCurrentOrgAccountType();
  const isDemo = useIsDemoAccount();
  const orgId = orgInfo?.orgId ?? null;
  const orgName = orgInfo?.name ?? "Votre flotte";

  const overviewFn = useServerFn(getFleetOverview);
  const membersFn = useServerFn(getFleetMembers);
  const saveSettingsFn = useServerFn(saveFleetSettings);
  const saveAccessFn = useServerFn(updateFleetMemberAccess);

  const [loading, setLoading] = useState(true);
  const [tco, setTco] = useState<FleetTco | null>(null);
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [sites, setSites] = useState<Array<{ id: string; nom: string | null }>>([]);
  const [siteId, setSiteId] = useState<string>("tous");
  const [period, setPeriod] = useState<"12m" | "ytd" | "all">("12m");
  const [seuil, setSeuil] = useState(30);
  const [emailsActifs, setEmailsActifs] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [members, setMembers] = useState<
    Array<{ id: string; role: string; email: string | null; nom: string | null; sites: string[] }>
  >([]);
  const [showAccess, setShowAccess] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ k: "total" | "tco_km" | "kilometrage" | "ecart"; dir: 1 | -1 }>({ k: "total", dir: -1 });
  const [typeFilter, setTypeFilter] = useState("tous");

  const range = useMemo(() => {
    const now = new Date();
    if (period === "all") return { from: null as string | null, to: null as string | null };
    if (period === "ytd") return { from: `${now.getFullYear()}-01-01`, to: null };
    const d = new Date(now);
    d.setMonth(d.getMonth() - 12);
    return { from: d.toISOString().slice(0, 10), to: null };
  }, [period]);

  const periodeLabel = period === "all" ? "Depuis l'origine" : period === "ytd" ? "Année en cours" : "12 derniers mois";

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await overviewFn({
        data: { orgId, from: range.from, to: range.to, siteId: siteId === "tous" ? null : siteId },
      });
      setSites(res.sites);
      if (res.settings) {
        setSeuil(Number(res.settings.tco_ecart_seuil_pct ?? 30));
        setEmailsActifs(Boolean(res.settings.alertes_email_actives));
      }
      if (isDemo && (res.tco?.vehicules ?? []).length === 0) {
        const d = buildDemo();
        setTco(d.tco); setAlerts(d.alerts); setCosts(d.costs);
      } else {
        setTco(res.tco);
        setAlerts(res.alerts);
        const ids = (res.tco?.vehicules ?? []).map((v) => v.id);
        if (ids.length) {
          let qy = supabase.from("vehicle_costs").select("vehicle_id, categorie, montant, date_cout")
            .in("vehicle_id", ids).eq("statut", "actif").limit(5000);
          if (range.from) qy = qy.gte("date_cout", range.from);
          const { data: rows } = await qy;
          setCosts(((rows ?? []) as Array<{ vehicle_id: string; categorie: string; montant: number | string; date_cout: string }>)
            .map((r) => ({ ...r, montant: Number(r.montant) })));
        } else setCosts([]);
      }
    } catch (e) {
      toast.error((e as Error).message || "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [orgId, overviewFn, range.from, range.to, siteId, isDemo]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!orgId || !showAccess) return;
    membersFn({ data: { orgId } })
      .then((rows) => setMembers(rows as typeof members))
      .catch((e) => toast.error((e as Error).message));
  }, [orgId, showAccess, membersFn]);

  const vehicules = tco?.vehicules ?? [];
  const total = Number(tco?.total ?? 0);
  const totalKm = vehicules.reduce((s, v) => s + Number(v.kilometrage || 0), 0);
  const coutKmMoyen = totalKm > 0 ? total / totalKm : null;
  const catRows = Object.entries(tco?.par_categorie ?? {})
    .filter(([, v]) => Number(v) !== 0)
    .map(([id, v]) => ({ id, value: Number(v) }))
    .sort((a, b) => b.value - a.value);

  const months = useMemo(() => {
    const map = new Map<string, { key: string; label: string; total: number; cats: Record<string, number> }>();
    const now = new Date();
    const n = period === "ytd" ? now.getMonth() + 1 : 12;
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, { key, label: d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""), total: 0, cats: {} });
    }
    costs.forEach((c) => {
      const m = map.get(c.date_cout.slice(0, 7));
      if (!m) return;
      m.total += c.montant;
      m.cats[c.categorie] = (m.cats[c.categorie] ?? 0) + c.montant;
    });
    return [...map.values()];
  }, [costs, period]);

  const monthlyAvg = months.length ? months.reduce((s, m) => s + m.total, 0) / months.length : 0;
  const last = months[months.length - 1]?.total ?? 0;
  const prev = months[months.length - 2]?.total ?? 0;
  const momDelta = prev > 0 ? ((last - prev) / prev) * 100 : null;
  const energie = catRows.find((c) => c.id === "carburant")?.value ?? 0;
  const entretien = catRows.find((c) => c.id === "entretien")?.value ?? 0;

  const types = useMemo(() => [...new Set(vehicules.map((v) => v.type_vehicule).filter(Boolean))] as string[], [vehicules]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = vehicules
      .filter((v) => typeFilter === "tous" || v.type_vehicule === typeFilter)
      .filter((v) => !needle || `${v.immatriculation ?? ""} ${v.marque ?? ""} ${v.modele ?? ""}`.toLowerCase().includes(needle))
      .map((v) => ({ ...v, ecart: coutKmMoyen && v.tco_km != null ? ((v.tco_km - coutKmMoyen) / coutKmMoyen) * 100 : null }));
    return list.sort((a, b) => {
      const av = (a[sort.k] ?? -Infinity) as number, bv = (b[sort.k] ?? -Infinity) as number;
      return (av - bv) * sort.dir;
    });
  }, [vehicules, q, typeFilter, sort, coutKmMoyen]);
  const sortBy = (k: typeof sort.k) => setSort((s) => (s.k === k ? { k, dir: (s.dir * -1) as 1 | -1 } : { k, dir: -1 }));

  const overspend = rows.filter((r) => r.ecart != null && r.ecart > seuil);
  const potentiel = overspend.reduce((s, r) => s + (coutKmMoyen ? (r.tco_km! - coutKmMoyen) * Number(r.kilometrage || 0) : 0), 0);

  if (!orgLoading && !orgId) {
    return (
      <div className="rounded-2xl border border-[#eaeaee] bg-white p-8 text-center">
        <p className="text-[#70727d]">Aucune organisation associée à votre compte.</p>
      </div>
    );
  }

  const btn = "inline-flex items-center gap-1.5 rounded-[10px] border border-[#eaeaee] bg-white px-3.5 py-2 text-[12px] font-semibold shadow-[0_1px_0_rgba(20,22,28,.03)] transition hover:border-[#cfd2db] hover:bg-[#f7f7f9]";
  const th = "cursor-pointer select-none pb-2.5 font-semibold hover:text-[#14161c]";

  return (
    <div className="-m-2 rounded-2xl bg-[#f7f7f9] p-4 sm:p-6 font-[Inter,ui-sans-serif,system-ui] text-[#14161c]">
      <div className="mb-6">
        <FleetPageHeader
          breadcrumb="Coûts & TCO"
          eyebrow={`Pilotage ${orgName}`}
          title="Coût total de"
          highlight="possession"
          badge="Flotte partenaire"
          logoUrl={orgInfo?.logoUrl ?? null}
          logoAlt={orgName}
          subtitle={`${periodeLabel} · ${vehicules.length} véhicule${vehicules.length > 1 ? "s" : ""} suivi${vehicules.length > 1 ? "s" : ""} — carburant, entretien, financement et convoyage consolidés.`}
          stats={[
            { label: "TCO", value: fmtEur(total) },
            { label: "€ / km", value: coutKmMoyen ? coutKmMoyen.toFixed(3).replace(".", ",") : "—", tone: "accent" as const },
            { label: "Alertes", value: alerts.length, tone: "warn" as const },
          ]}
          actions={
            <FleetHeaderButton onClick={() => setShowAccess((s) => !s)}>
              <Users size={14} /> Accès & périmètres
            </FleetHeaderButton>
          }
        />
      </div>

      {/* Barre d'outils */}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-[#eaeaee] bg-white p-2.5">
        <div className="flex rounded-[10px] bg-[#f2f2f5] p-0.5">
          {([["12m", "12 mois"], ["ytd", "Année en cours"], ["all", "Tout"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setPeriod(id)}
              className={`rounded-[8px] px-3.5 py-1.5 text-[12px] font-semibold transition ${
                period === id ? "bg-[#14161c] text-white shadow" : "text-[#70727d] hover:text-[#14161c]"
              }`}>
              {label}
            </button>
          ))}
        </div>
        {sites.length > 0 && (
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)}
            className="rounded-[10px] border border-[#eaeaee] bg-white px-3 py-2 text-[12px] font-semibold outline-none">
            <option value="tous">Tous les sites</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.nom || "Site"}</option>)}
          </select>
        )}
        <HelpTip title="Coût total de possession" text="Le TCO additionne tout ce que coûte chaque véhicule sur la période : carburant ou recharge, entretien, assurance, financement et convoyages. Le coût au kilomètre divise ce total par les kilomètres parcourus. Une alerte apparaît quand un véhicule coûte nettement plus que la moyenne du parc." />
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={() => setShowSettings((s) => !s)} className={btn}><Settings2 size={13} /> Alertes</button>
          <button onClick={() => downloadCsv(`tco-${orgName}.csv`, fleetToCsv(vehicules))} className={btn}><FileDown size={13} /> Export CSV</button>
          <button
            onClick={() => downloadFleetPdf({ orgName, periode: periodeLabel, total, parCategorie: tco?.par_categorie ?? {}, vehicules })}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#14161c] px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-[#2a2d38]">
            <FileText size={13} /> Rapport PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-[#eaeaee] bg-white p-8 text-[#70727d]">
          <Loader2 className="animate-spin text-[#2f5fff]" size={18} /> Consolidation des coûts…
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Kpi icon={<Euro size={14} />} label="TCO consolidé" value={fmtEur(total)} strong />
            <Kpi icon={<Gauge size={14} />} label="Coût moyen au km" value={fmtKm(coutKmMoyen)} />
            <Kpi icon={<TrendingUp size={14} />} label="Coût mensuel moyen" value={fmtEur(monthlyAvg)} extra={<Delta value={momDelta} />} sub="vs mois précédent" />
            <Kpi icon={<Receipt size={14} />} label="Coût / véhicule" value={fmtEur(vehicules.length ? total / vehicules.length : 0)} />
            <Kpi icon={<Fuel size={14} />} label="Énergie" value={fmtEur(energie)} sub={total ? `${Math.round((energie / total) * 100)}% du TCO` : undefined} />
            <Kpi icon={<Wrench size={14} />} label="Entretien" value={fmtEur(entretien)} sub={total ? `${Math.round((entretien / total) * 100)}% du TCO` : undefined} />
          </div>

          {/* Évolution + répartition */}
          <div className="mb-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Panel title="Évolution mensuelle des coûts" right={<span className="text-[11px] text-[#a3a4ac]">par poste · € TTC</span>}>
              {costs.length === 0 ? <Empty>Aucun coût enregistré sur la période.</Empty> : <MonthlyChart months={months} />}
            </Panel>
            <Panel title="Répartition par poste">
              {catRows.length === 0 ? <Empty>Aucun coût enregistré.</Empty> : (
                <div className="flex flex-wrap items-center gap-5">
                  <div className="relative">
                    <Donut parts={catRows} total={total} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#a3a4ac]">Total</span>
                      <b className="text-[16px] font-extrabold">{fmtEur(total)}</b>
                    </div>
                  </div>
                  <ul className="min-w-[150px] flex-1 space-y-1.5">
                    {catRows.slice(0, 7).map((c) => (
                      <li key={c.id} className="flex items-center gap-2 text-[12px]">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CAT_COLORS[c.id] }} />
                        <span className="flex-1 truncate font-medium">{catLabel(c.id)}</span>
                        <span className="text-[#70727d]">{Math.round((c.value / Math.max(1, total)) * 100)}%</span>
                        <b className="w-[68px] text-right font-semibold">{fmtEur(c.value)}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          </div>

          {/* Alertes + potentiel d'économies */}
          <div className="mb-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Panel title="Alertes de pilotage" right={<span className="rounded-full bg-[#fef3e2] px-2 py-0.5 text-[11px] font-bold text-[#d97706]">{alerts.length}</span>}>
              {alerts.length === 0 ? <Empty>Aucune alerte : votre parc est à jour.</Empty> : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {alerts.map((a, i) => (
                    <div key={`${a.vehicle_id}-${a.type}-${i}`}
                      className={`rounded-xl border border-[#eaeaee] border-l-[3px] px-3.5 py-3 ${SEV_CLS[a.severite] ?? ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <b className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                          {a.type === "tco_eleve" ? <AlertTriangle size={13} /> : <CalendarClock size={13} />}{ALERT_LABEL[a.type]}
                        </b>
                        <span className="text-[10.5px] font-bold uppercase text-[#70727d]">{a.severite}</span>
                      </div>
                      <p className="mt-1 text-[11.5px] text-[#70727d]">
                        {a.immatriculation || "Véhicule"}
                        {a.date ? ` · échéance ${new Date(a.date).toLocaleDateString("fr-FR")}` : ""}
                        {a.km_restants != null ? ` · ${Number(a.km_restants).toLocaleString("fr-FR")} km restants` : ""}
                        {a.tco_km != null ? ` · ${fmtKm(Number(a.tco_km))}/km contre ${fmtKm(Number(a.moyenne ?? 0))} en moyenne` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Potentiel d'optimisation">
              <p className="text-[28px] font-extrabold tracking-[-0.02em] text-[#16a34a]">{fmtEur(potentiel)}</p>
              <p className="mt-1 text-[12px] text-[#70727d]">
                {overspend.length === 0
                  ? "Aucun véhicule ne dépasse le seuil de surcoût : le parc est homogène."
                  : `Économie théorique si les ${overspend.length} véhicule${overspend.length > 1 ? "s" : ""} au-dessus de +${seuil}% revenaient à la moyenne du parc.`}
              </p>
              {overspend.slice(0, 3).map((r) => (
                <div key={r.id} className="mt-3 flex items-center justify-between rounded-lg bg-[#f7f7f9] px-3 py-2 text-[12px]">
                  <span className="font-semibold">{r.immatriculation || r.modele}</span>
                  <Delta value={r.ecart} />
                </div>
              ))}
            </Panel>
          </div>

          {/* Tableau complet */}
          <Panel
            title="Détail par véhicule"
            right={
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a3a4ac]" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Plaque, marque…"
                    className="w-[170px] rounded-[10px] border border-[#eaeaee] bg-white py-1.5 pl-8 pr-2.5 text-[12px] outline-none focus:border-[#2f5fff]" />
                </div>
                {types.length > 1 && (
                  <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                    className="rounded-[10px] border border-[#eaeaee] bg-white px-2.5 py-1.5 text-[12px] outline-none">
                    <option value="tous">Tous types</option>
                    {types.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </div>
            }
          >
            {rows.length === 0 ? <Empty>Aucun véhicule à afficher.</Empty> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[12.5px]">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-[0.05em] text-[#a3a4ac]">
                      <th className="pb-2.5 font-semibold">Véhicule</th>
                      <th className={th} onClick={() => sortBy("kilometrage")}>Kilométrage {sort.k === "kilometrage" ? (sort.dir < 0 ? "↓" : "↑") : ""}</th>
                      <th className={th} onClick={() => sortBy("total")}>TCO {sort.k === "total" ? (sort.dir < 0 ? "↓" : "↑") : ""}</th>
                      <th className="pb-2.5 font-semibold">Part du parc</th>
                      <th className={th} onClick={() => sortBy("tco_km")}>€ / km {sort.k === "tco_km" ? (sort.dir < 0 ? "↓" : "↑") : ""}</th>
                      <th className={th} onClick={() => sortBy("ecart")}>Écart moyenne {sort.k === "ecart" ? (sort.dir < 0 ? "↓" : "↑") : ""}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((v) => (
                      <tr key={v.id} className="border-t border-[#eaeaee] transition hover:bg-[#fafafc]">
                        <td className="py-3">
                          <b className="font-semibold">{[v.marque, v.modele].filter(Boolean).join(" ") || "Véhicule"}</b>
                          <span className="ml-2 inline-flex align-middle">{v.immatriculation ? <PlateBadge plate={v.immatriculation} size="sm" /> : "—"}</span>
                        </td>
                        <td className="py-3 text-[#70727d]">{Number(v.kilometrage || 0).toLocaleString("fr-FR")} km</td>
                        <td className="py-3 font-semibold">{fmtEur(v.total)}</td>
                        <td className="py-3">
                          <div className="h-1.5 w-24 overflow-hidden rounded bg-[#eaeaee]">
                            <div className="h-full rounded bg-[#2f5fff]" style={{ width: `${Math.min(100, (v.total / Math.max(1, total)) * 100 * 3)}%` }} />
                          </div>
                          <span className="text-[10.5px] text-[#a3a4ac]">{Math.round((v.total / Math.max(1, total)) * 100)}%</span>
                        </td>
                        <td className="py-3 text-[#70727d]">{fmtKm(v.tco_km)}</td>
                        <td className="py-3"><Delta value={v.ecart} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#14161c] text-[12.5px] font-bold">
                      <td className="pt-3">Total parc</td>
                      <td className="pt-3">{totalKm.toLocaleString("fr-FR")} km</td>
                      <td className="pt-3">{fmtEur(total)}</td>
                      <td />
                      <td className="pt-3">{fmtKm(coutKmMoyen)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Panel>

          {/* Réglages */}
          {showSettings && (
            <div className="mt-5">
              <Panel title="Réglages des alertes">
                <div className="flex flex-wrap items-end gap-4">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-[#a3a4ac]">Seuil de surcoût (%)</span>
                    <input type="number" min={5} max={200} value={seuil} onChange={(e) => setSeuil(Number(e.target.value))}
                      className="w-32 rounded-[10px] border border-[#eaeaee] px-2.5 py-2 text-[12.5px] outline-none focus:border-[#2f5fff]" />
                  </label>
                  <label className="flex items-center gap-2 pb-2 text-[12.5px] font-semibold">
                    <input type="checkbox" checked={emailsActifs} onChange={(e) => setEmailsActifs(e.target.checked)} />
                    Recevoir les alertes par email
                  </label>
                  <button
                    disabled={savingSettings || !orgId}
                    onClick={async () => {
                      if (!orgId) return;
                      setSavingSettings(true);
                      try {
                        await saveSettingsFn({ data: { orgId, seuilPct: seuil, emailsActifs, emails: [] } });
                        toast.success("Réglages enregistrés");
                        await load();
                      } catch (e) { toast.error((e as Error).message); } finally { setSavingSettings(false); }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-[10px] fleet-btn-violet px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
                  >
                    {savingSettings ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Enregistrer
                  </button>
                </div>
              </Panel>
            </div>
          )}

          {/* Accès & périmètres */}
          {showAccess && (
            <div className="mt-5">
              <Panel title="Accès & périmètres">
                {members.length === 0 ? (
                  <p className="py-4 text-[13px] text-[#70727d]">Aucun membre actif.</p>
                ) : (
                  members.map((m) => (
                    <MemberRow key={m.id} member={m} sites={sites}
                      onSave={async (role, siteIds) => {
                        try {
                          await saveAccessFn({ data: { memberId: m.id, role, siteIds } });
                          setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, role, sites: siteIds } : x)));
                          toast.success("Accès mis à jour");
                        } catch (e) { toast.error((e as Error).message); }
                      }} />
                  ))
                )}
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Panel({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#eaeaee] bg-white p-5 shadow-[0_1px_2px_rgba(20,22,28,.03)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.05em] text-[#14161c]">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-[13px] text-[#70727d]">{children}</p>;
}

function Kpi({ icon, label, value, strong, sub, extra }: { icon: React.ReactNode; label: string; value: string; strong?: boolean; sub?: string; extra?: React.ReactNode }) {
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(20,22,28,.03)] ${strong ? "border-[1.5px] border-[#14161c]" : "border border-[#eaeaee]"}`}>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#a3a4ac]">{icon} {label}</span>
      <p className={`mt-2 font-extrabold tracking-[-0.02em] ${strong ? "text-[24px]" : "text-[19px]"}`}>{value}</p>
      {(sub || extra) && <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#a3a4ac]">{extra}{sub}</p>}
    </div>
  );
}

function MemberRow({
  member, sites, onSave,
}: {
  member: { id: string; role: string; email: string | null; nom: string | null; sites: string[] };
  sites: Array<{ id: string; nom: string | null }>;
  onSave: (role: string, siteIds: string[]) => Promise<void>;
}) {
  const [role, setRole] = useState(member.role);
  const [selected, setSelected] = useState<string[]>(member.sites);
  const dirty = role !== member.role || selected.join() !== member.sites.join();

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[#eaeaee] py-3">
      <div className="min-w-[180px] flex-1">
        <b className="text-[13px] font-semibold">{member.nom || member.email || "Membre"}</b>
        <p className="text-[11.5px] text-[#70727d]">{member.email}</p>
      </div>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="rounded-[9px] border border-[#eaeaee] bg-white px-2.5 py-2 text-[12px] outline-none"
      >
        {["owner", "admin", "manager", "member", ...FLEET_ROLES.map((r) => r.id)]
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .map((id) => (
            <option key={id} value={id}>
              {FLEET_ROLES.find((r) => r.id === id)?.label ?? id}
            </option>
          ))}
      </select>
      {sites.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sites.map((s) => {
            const on = selected.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => setSelected((prev) => (on ? prev.filter((x) => x !== s.id) : [...prev, s.id]))}
                className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition ${
                  on ? "border-[#2f5fff] bg-[#eef2ff] text-[#2f5fff]" : "border-[#eaeaee] text-[#70727d] hover:bg-[#f2f2f5]"
                }`}
              >
                {s.nom || "Site"}
              </button>
            );
          })}
        </div>
      )}
      <button
        disabled={!dirty}
        onClick={() => onSave(role, selected)}
        className="rounded-[9px] border border-[#eaeaee] px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40 hover:bg-[#f2f2f5]"
      >
        Appliquer
      </button>
    </div>
  );
}
