import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle, Euro, FileDown, FileText, Gauge, Loader2, Save, Settings2, Users,
} from "lucide-react";
import FleetPageHeader, { FleetHeaderButton } from "@/components/flotte/FleetPageHeader";
import { useCurrentOrgAccountType } from "@/hooks/useCurrentOrgAccountType";
import {
  COST_CATEGORIES, FLEET_ROLES, getFleetMembers, getFleetOverview, saveFleetSettings,
  updateFleetMemberAccess, type FleetAlert, type FleetTco,
} from "@/lib/fleet-tco.functions";
import { downloadCsv, downloadFleetPdf, fleetToCsv } from "@/lib/fleet-tco-export";

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
      {
        property: "og:description",
        content: "Tableau de bord du coût total de possession de votre flotte de véhicules.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const fmtEur = (n: number) =>
  Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const catLabel = (id: string) => COST_CATEGORIES.find((c) => c.id === id)?.label ?? id;

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

function FleetTcoPage() {
  const { data: orgInfo, isLoading: orgLoading } = useCurrentOrgAccountType();
  const orgId = orgInfo?.orgId ?? null;
  const orgName = orgInfo?.name ?? "Votre flotte";

  const overviewFn = useServerFn(getFleetOverview);
  const membersFn = useServerFn(getFleetMembers);
  const saveSettingsFn = useServerFn(saveFleetSettings);
  const saveAccessFn = useServerFn(updateFleetMemberAccess);

  const [loading, setLoading] = useState(true);
  const [tco, setTco] = useState<FleetTco | null>(null);
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
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
      setTco(res.tco);
      setAlerts(res.alerts);
      setSites(res.sites);
      if (res.settings) {
        setSeuil(Number(res.settings.tco_ecart_seuil_pct ?? 30));
        setEmailsActifs(Boolean(res.settings.alertes_email_actives));
      }
    } catch (e) {
      toast.error((e as Error).message || "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [orgId, overviewFn, range.from, range.to, siteId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!orgId || !showAccess) return;
    membersFn({ data: { orgId } })
      .then((rows) => setMembers(rows as typeof members))
      .catch((e) => toast.error((e as Error).message));
  }, [orgId, showAccess, membersFn]);

  const vehicules = tco?.vehicules ?? [];
  const totalKm = vehicules.reduce((s, v) => s + Number(v.kilometrage || 0), 0);
  const coutKmMoyen = totalKm > 0 ? Number(tco?.total ?? 0) / totalKm : null;
  const catRows = Object.entries(tco?.par_categorie ?? {})
    .filter(([, v]) => Number(v) !== 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  const maxCat = Math.max(1, ...catRows.map(([, v]) => Number(v)));
  const top = [...vehicules].sort((a, b) => b.total - a.total).slice(0, 8);

  if (!orgLoading && !orgId) {
    return (
      <div className="rounded-2xl border border-[#eaeaee] bg-white p-8 text-center">
        <p className="text-[#70727d]">Aucune organisation associée à votre compte.</p>
      </div>
    );
  }

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
            { label: "TCO", value: fmtEur(tco?.total ?? 0) },
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

      {/* Filtres */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {([["12m", "12 mois"], ["ytd", "Année en cours"], ["all", "Depuis l'origine"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setPeriod(id)}
            className={`rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition ${
              period === id ? "border-[#14161c] bg-[#14161c] text-white" : "border-[#eaeaee] bg-white text-[#70727d] hover:bg-[#f2f2f5]"
            }`}
          >
            {label}
          </button>
        ))}
        {sites.length > 0 && (
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="rounded-full border border-[#eaeaee] bg-white px-3 py-1.5 text-[12px] font-semibold outline-none"
          >
            <option value="tous">Tous les sites</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.nom || "Site"}</option>)}
          </select>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => downloadCsv(`tco-${orgName}.csv`, fleetToCsv(vehicules))}
            className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#eaeaee] bg-white px-3 py-1.5 text-[12px] font-semibold hover:bg-[#f2f2f5]"
          >
            <FileDown size={13} /> CSV
          </button>
          <button
            onClick={() =>
              downloadFleetPdf({
                orgName,
                periode: periodeLabel,
                total: tco?.total ?? 0,
                parCategorie: tco?.par_categorie ?? {},
                vehicules,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#eaeaee] bg-white px-3 py-1.5 text-[12px] font-semibold hover:bg-[#f2f2f5]"
          >
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
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card icon={<Euro size={14} />} label="TCO consolidé" value={fmtEur(tco?.total ?? 0)} strong />
            <Card icon={<Gauge size={14} />} label="Coût moyen au km"
              value={coutKmMoyen ? `${coutKmMoyen.toFixed(3).replace(".", ",")} €` : "—"} />
            <Card icon={<Euro size={14} />} label="Coût moyen / véhicule"
              value={fmtEur(vehicules.length ? Number(tco?.total ?? 0) / vehicules.length : 0)} />
            <Card icon={<AlertTriangle size={14} />} label="Alertes actives" value={String(alerts.length)} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            {/* Répartition */}
            <div className="rounded-2xl border border-[#eaeaee] bg-white p-5">
              <p className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#a3a4ac]">
                Répartition des coûts par poste
              </p>
              {catRows.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-[#70727d]">
                  Aucun coût enregistré sur la période sélectionnée.
                </p>
              ) : (
                catRows.map(([id, v]) => (
                  <div key={id} className="mb-3">
                    <div className="mb-1 flex items-center justify-between text-[12.5px]">
                      <span className="font-semibold">{catLabel(id)}</span>
                      <span className="text-[#70727d]">
                        {fmtEur(Number(v))} · {Math.round((Number(v) / Math.max(1, Number(tco?.total ?? 1))) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded bg-[#eaeaee]">
                      <div className="h-full rounded bg-[#2f5fff] transition-[width] duration-700"
                        style={{ width: `${(Number(v) / maxCat) * 100}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Alertes */}
            <div className="rounded-2xl border border-[#eaeaee] bg-white p-5">
              <p className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#a3a4ac]">
                Alertes de pilotage
              </p>
              {alerts.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-[#70727d]">Aucune alerte : votre parc est à jour.</p>
              ) : (
                alerts.map((a, i) => (
                  <div key={`${a.vehicle_id}-${a.type}-${i}`}
                    className={`mb-2 rounded-xl border border-[#eaeaee] border-l-[3px] px-3.5 py-3 ${SEV_CLS[a.severite] ?? ""}`}>
                    <b className="text-[12.5px] font-semibold">{ALERT_LABEL[a.type]}</b>
                    <p className="mt-0.5 text-[11.5px] text-[#70727d]">
                      {a.immatriculation || "Véhicule"}
                      {a.date ? ` · échéance ${new Date(a.date).toLocaleDateString("fr-FR")}` : ""}
                      {a.km_restants != null ? ` · ${Number(a.km_restants).toLocaleString("fr-FR")} km restants` : ""}
                      {a.tco_km != null
                        ? ` · ${Number(a.tco_km).toFixed(3).replace(".", ",")} €/km contre ${Number(a.moyenne ?? 0).toFixed(3).replace(".", ",")} € en moyenne`
                        : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Classement véhicules */}
          <div className="mt-5 rounded-2xl border border-[#eaeaee] bg-white p-5">
            <p className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#a3a4ac]">
              Véhicules les plus coûteux
            </p>
            {top.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[#70727d]">Aucun véhicule à afficher.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[12.5px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.04em] text-[#a3a4ac]">
                      <th className="pb-2 font-medium">Véhicule</th>
                      <th className="pb-2 font-medium">Kilométrage</th>
                      <th className="pb-2 font-medium">TCO</th>
                      <th className="pb-2 font-medium">€ / km</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((v) => (
                      <tr key={v.id} className="border-t border-[#eaeaee]">
                        <td className="py-2.5">
                          <b className="font-semibold">{[v.marque, v.modele].filter(Boolean).join(" ") || "Véhicule"}</b>
                          <span className="ml-2 font-mono text-[11px] text-[#a3a4ac]">{v.immatriculation || "—"}</span>
                        </td>
                        <td className="py-2.5 text-[#70727d]">{Number(v.kilometrage || 0).toLocaleString("fr-FR")} km</td>
                        <td className="py-2.5 font-semibold">{fmtEur(v.total)}</td>
                        <td className="py-2.5 text-[#70727d]">
                          {v.tco_km != null ? `${Number(v.tco_km).toFixed(3).replace(".", ",")} €` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Réglages */}
          <div className="mt-5 rounded-2xl border border-[#eaeaee] bg-white p-5">
            <p className="mb-3.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#a3a4ac]">
              <Settings2 size={13} /> Réglages des alertes
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-[#a3a4ac]">Seuil de surcoût (%)</span>
                <input
                  type="number" min={5} max={200} value={seuil}
                  onChange={(e) => setSeuil(Number(e.target.value))}
                  className="w-32 rounded-[9px] border border-[#eaeaee] px-2.5 py-2 text-[12.5px] outline-none focus:border-[#2f5fff]"
                />
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
                    await saveFleetSettings === null;
                    await saveSettingsFn({ data: { orgId, seuilPct: seuil, emailsActifs, emails: [] } });
                    toast.success("Réglages enregistrés");
                    await load();
                  } catch (e) { toast.error((e as Error).message); } finally { setSavingSettings(false); }
                }}
                className="inline-flex items-center gap-1.5 rounded-[9px] fleet-btn-violet px-3.5 py-2 text-[12px] font-semibold disabled:opacity-50"
              >
                {savingSettings ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Enregistrer
              </button>
            </div>
          </div>

          {/* Accès & périmètres */}
          {showAccess && (
            <div className="mt-5 rounded-2xl border border-[#eaeaee] bg-white p-5">
              <p className="mb-3.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#a3a4ac]">
                <Users size={13} /> Accès & périmètres
              </p>
              {members.length === 0 ? (
                <p className="py-4 text-[13px] text-[#70727d]">Aucun membre actif.</p>
              ) : (
                members.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    sites={sites}
                    onSave={async (role, siteIds) => {
                      try {
                        await saveAccessFn({ data: { memberId: m.id, role, siteIds } });
                        setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, role, sites: siteIds } : x)));
                        toast.success("Accès mis à jour");
                      } catch (e) { toast.error((e as Error).message); }
                    }}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Card({ icon, label, value, strong }: { icon: React.ReactNode; label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-2xl bg-white p-5 ${strong ? "border-[1.5px] border-[#14161c]" : "border border-[#eaeaee]"}`}>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#a3a4ac]">{icon} {label}</span>
      <p className={`mt-2 font-extrabold tracking-[-0.02em] ${strong ? "text-[26px]" : "text-[19px]"}`}>{value}</p>
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
