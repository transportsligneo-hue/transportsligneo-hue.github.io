import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Car, Plus, Search, Loader2, Pencil, Trash2, X, Save, AlertCircle, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { confirmToast } from "@/lib/confirm-toast";
import VehicleDetailPanel, {
  docStatus, worstDocStatus, type FleetVehicle,
} from "@/components/flotte/VehicleDetailPanel";
import { useCurrentOrgAccountType } from "@/hooks/useCurrentOrgAccountType";
import { lookupPlate } from "@/lib/plate.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard-pro/flotte")({
  component: FleetPage,
});

type Vehicle = FleetVehicle;

const EMPTY: Partial<Vehicle> = {
  vin: "", immatriculation: "", marque: "", modele: "",
  energie: "", type_vehicule: "", couleur: "", kilometrage: null,
  statut: "actif", notes: "",
  assurance_expire_le: null, controle_technique_expire_le: null, carte_grise_expire_le: null,
  mise_en_circulation: null, assurance_cout_annuel: null,
  prochaine_revision_km: null, intervalle_revision_km: 20000,
};

const FILTERS = [
  { id: "tous", label: "Tous" },
  { id: "actif", label: "Disponibles" },
  { id: "en_mission", label: "En mission" },
  { id: "indispo", label: "Immobilisés" },
  { id: "archive", label: "Archivés" },
];

const STATUS_META: Record<Vehicle["statut"], { label: string; dot: string }> = {
  actif: { label: "Disponible", dot: "bg-[#16a34a]" },
  en_mission: { label: "En mission", dot: "bg-[#2f5fff]" },
  indispo: { label: "Immobilisé", dot: "bg-[#dc2626]" },
  archive: { label: "Archivé", dot: "bg-[#a3a4ac]" },
};

const DOT_CLS: Record<string, string> = {
  ok: "bg-[#16a34a]",
  warn: "bg-[#d97706] fleet-dot-warn",
  expired: "bg-[#dc2626]",
  unknown: "bg-[#d5d6dc]",
};

const vehicleLabel = (v: Vehicle) =>
  v.immatriculation || v.vin || [v.marque, v.modele].filter(Boolean).join(" ") || "Véhicule";

function FleetPage() {
  const { user } = useAuth();
  const { data: orgInfo, isLoading: orgLoading } = useCurrentOrgAccountType();
  const orgId = orgInfo?.orgId ?? null;
  const orgName = orgInfo?.name ?? null;
  const [orgRole, setOrgRole] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [sites, setSites] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("tous");
  const [draft, setDraft] = useState<Partial<Vehicle> | null>(null);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [panelTab, setPanelTab] = useState<"general" | "documents" | "entretien" | "historique">("general");
  const [saving, setSaving] = useState(false);
  const [plateBusy, setPlateBusy] = useState(false);
  const lookupPlateFn = useServerFn(lookupPlate);

  const handlePlateLookup = async () => {
    const plate = (draft?.immatriculation || "").trim();
    if (plate.length < 4) {
      toast.error("Saisissez une plaque valide");
      return;
    }
    setPlateBusy(true);
    try {
      const result = await lookupPlateFn({ data: { plate } });
      if (!result.ok || !result.data) {
        toast.error(result.error || "Aucune donnée trouvée · remplissez manuellement");
        return;
      }
      const d = result.data;
      setDraft((prev) => ({
        ...(prev || {}),
        marque: prev?.marque || d.marque || prev?.marque || null,
        modele: prev?.modele || d.modele || prev?.modele || null,
        vin: prev?.vin || d.vin || prev?.vin || null,
        energie: prev?.energie || d.carburant || prev?.energie || null,
      }));
      toast.success("Informations véhicule récupérées");
    } catch {
      toast.error("Service indisponible · remplissez manuellement");
    } finally {
      setPlateBusy(false);
    }
  };

  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: mems } = await supabase
        .from("organization_members")
        .select("organization_id, member_role")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1);
      const row = (mems ?? [])[0] as { organization_id: string; member_role: string } | undefined;
      // Pas de membership explicite : le compte pro reste gestionnaire de son parc
      setOrgRole(row?.member_role ?? "admin");
    })();
  }, [user]);

  useEffect(() => {
    if (!orgLoading && !orgId) setLoading(false);
  }, [orgLoading, orgId]);


  const fetchVehicles = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const [{ data, error }, { data: siteRows }] = await Promise.all([
      supabase.from("vehicles").select("*").eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      supabase.from("organization_sites").select("id, nom").eq("organization_id", orgId),
    ]);
    if (error) setErr(error.message);
    else if (data) setVehicles(data as Vehicle[]);
    if (siteRows) {
      setSites(Object.fromEntries((siteRows as { id: string; nom: string | null }[]).map((s) => [s.id, s.nom ?? ""])));
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { void fetchVehicles(); }, [fetchVehicles]);

  useEffect(() => {
    if (!orgId) return;
    const ch = supabase
      .channel(`fleet-${orgId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "vehicles",
        filter: `organization_id=eq.${orgId}`,
      }, () => fetchVehicles())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, fetchVehicles]);

  // garde le panneau synchronisé avec les données fraîches
  useEffect(() => {
    if (!selected) return;
    const fresh = vehicles.find((v) => v.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [vehicles]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (statutFilter !== "tous" && v.statut !== statutFilter) return false;
      if (statutFilter === "tous" && v.statut === "archive") return false;
      if (!q) return true;
      return [v.vin, v.immatriculation, v.marque, v.modele]
        .filter(Boolean).some((x) => String(x).toLowerCase().includes(q));
    });
  }, [vehicles, search, statutFilter]);

  const actifs = useMemo(() => vehicles.filter((v) => v.statut !== "archive"), [vehicles]);

  const alerts = useMemo(
    () => actifs.filter((v) => ["warn", "expired"].includes(worstDocStatus(v))),
    [actifs],
  );

  const kpi = useMemo(() => ({
    total: actifs.length,
    dispo: actifs.filter((v) => v.statut === "actif").length,
    enMission: actifs.filter((v) => v.statut === "en_mission").length,
    docs: alerts.length,
  }), [actifs, alerts]);

  const canManage = orgRole === "admin" || orgRole === "owner";

  const openDocs = (v: Vehicle) => { setPanelTab("documents"); setSelected(v); };

  const openCreate = () => { setDraft({ ...EMPTY }); setErr(null); };
  const openEdit = (v: Vehicle) => { setDraft({ ...v }); setErr(null); };

  const save = async () => {
    if (!draft || !orgId) return;
    setSaving(true); setErr(null);
    const payload = {
      organization_id: orgId,
      vin: (draft.vin || null) as string | null,
      immatriculation: (draft.immatriculation || null) as string | null,
      marque: (draft.marque || null) as string | null,
      modele: (draft.modele || null) as string | null,
      energie: (draft.energie || null) as string | null,
      type_vehicule: (draft.type_vehicule || null) as string | null,
      couleur: (draft.couleur || null) as string | null,
      kilometrage: draft.kilometrage ?? null,
      statut: (draft.statut || "actif") as Vehicle["statut"],
      notes: (draft.notes || null) as string | null,
      assurance_expire_le: draft.assurance_expire_le || null,
      controle_technique_expire_le: draft.controle_technique_expire_le || null,
      carte_grise_expire_le: draft.carte_grise_expire_le || null,
      mise_en_circulation: draft.mise_en_circulation || null,
      assurance_cout_annuel: draft.assurance_cout_annuel ?? null,
      prochaine_revision_km: draft.prochaine_revision_km ?? null,
      intervalle_revision_km: draft.intervalle_revision_km ?? 20000,
    };
    let error;
    if (draft.id) {
      ({ error } = await supabase.from("vehicles").update(payload).eq("id", draft.id));
    } else {
      ({ error } = await supabase.from("vehicles").insert(payload));
    }
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setDraft(null);
    await fetchVehicles();
  };

  const archive = async (v: Vehicle) => {
    if (!(await confirmToast(`Archiver le véhicule ${vehicleLabel(v)} ?`))) return;
    await supabase.from("vehicles")
      .update({ statut: "archive", archived_at: new Date().toISOString() })
      .eq("id", v.id);
    fetchVehicles();
  };

  if (!orgId && !orgLoading && !loading) {
    return (
      <div className="rounded-2xl border border-[#eaeaee] bg-white p-8 text-center">
        <Car className="mx-auto mb-3 text-[#a3a4ac]" size={32} />
        <p className="text-[#70727d]">Aucune organisation associée à votre compte.</p>
      </div>
    );
  }

  return (
    <div className="-m-2 rounded-2xl bg-[#f7f7f9] p-4 sm:p-6 font-[Inter,ui-sans-serif,system-ui] text-[#14161c]">
      <div className="mb-6">
        <FleetPageHeader
          breadcrumb="Parc véhicules"
          eyebrow={orgName ? `Parc ${orgName}` : "Gestion de parc"}
          title="Parc"
          highlight="véhicules"
          badge="Flotte partenaire"
          subtitle={`${orgName ? `${orgName} — ` : ""}${actifs.length} véhicule${actifs.length > 1 ? "s" : ""} · documents, entretien et coûts de possession.`}
          stats={[
            { label: "Disponibles", value: kpi.dispo },
            { label: "En mission", value: kpi.enMission, tone: "accent" as const },
            { label: "À surveiller", value: kpi.docs, tone: "warn" as const },
          ]}
          actions={
            canManage ? (
              <FleetHeaderButton onClick={openCreate}>
                <Plus size={14} /> Ajouter un véhicule
              </FleetHeaderButton>
            ) : undefined
          }
        />
      </div>


      {/* Bannière d'alerte */}
      {alerts.length > 0 && (
        <div className="mb-6 flex items-center gap-3.5 rounded-xl border border-[#eaeaee] border-l-[3px] border-l-[#d97706] bg-white px-4 py-3.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#fef3e2]">
            <AlertTriangle size={16} className="text-[#d97706]" />
          </span>
          <div className="min-w-0 flex-1">
            <b className="text-[13px] font-semibold">
              {alerts.length} véhicule{alerts.length > 1 ? "s" : ""} avec des documents à surveiller
            </b>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {alerts.map((v) => (
                <button
                  key={v.id}
                  onClick={() => openDocs(v)}
                  className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition hover:bg-[#f2f2f5] ${
                    worstDocStatus(v) === "expired"
                      ? "border-[#f3bcbc] text-[#dc2626]"
                      : "border-[#f3d9b0] text-[#b45309]"
                  }`}
                >
                  {vehicleLabel(v)} →
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Indicateurs */}
      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#eaeaee] bg-[#eaeaee] sm:grid-cols-4">
        {[
          { k: "Parc total", v: kpi.total, cls: "" },
          { k: "Disponibles", v: kpi.dispo, cls: "" },
          { k: "En mission", v: kpi.enMission, cls: "text-[#2f5fff]" },
          { k: "Documents à surveiller", v: kpi.docs, cls: kpi.docs > 0 ? "text-[#d97706]" : "" },
        ].map((s) => (
          <div key={s.k} className="bg-white px-5 py-5">
            <p className="mb-2.5 text-[11.5px] font-medium text-[#70727d]">{s.k}</p>
            <p className={`text-[30px] font-extrabold leading-none tracking-[-0.02em] ${s.cls}`}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Barre d'outils */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a3a4ac]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une plaque ou un modèle…"
            className="w-full rounded-[9px] border border-[#eaeaee] bg-white py-2.5 pl-9 pr-3 text-[13px] outline-none placeholder:text-[#a3a4ac] focus:border-[#2f5fff]/40"
          />
        </div>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatutFilter(f.id)}
            className={`rounded-lg border px-3.5 py-2 text-[12px] font-medium transition ${
              statutFilter === f.id
                ? "border-[#14161c] bg-[#14161c] text-white"
                : "border-[#eaeaee] bg-white text-[#70727d] hover:text-[#14161c]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grille véhicules */}
      {loading || orgLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-[#2f5fff]" size={24} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#eaeaee] bg-white p-10 text-center">
          <Car className="mx-auto mb-3 text-[#a3a4ac]" size={30} />
          {vehicles.length === 0 ? (
            <>
              <p className="text-[13px] font-semibold">Aucun véhicule dans le parc pour l'instant</p>
              <p className="mt-1 text-[12.5px] text-[#70727d]">
                Ajoutez votre premier véhicule pour suivre ses documents et son entretien.
              </p>
              {canManage && (
                <button
                  onClick={openCreate}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-[9px] bg-[#14161c] px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-black"
                >
                  <Plus size={14} /> Ajouter un véhicule
                </button>
              )}
            </>
          ) : (
            <p className="text-[13px] text-[#70727d]">Aucun véhicule ne correspond à ce filtre.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => {
            const st = STATUS_META[v.statut];
            return (
              <div
                key={v.id}
                role="button"
                tabIndex={0}
                onClick={() => { setPanelTab("general"); setSelected(v); }}
                onKeyDown={(e) => { if (e.key === "Enter") setSelected(v); }}
                className="group cursor-pointer rounded-[14px] border border-[#eaeaee] bg-white p-[18px] transition duration-150 hover:-translate-y-0.5 hover:border-[#dedee4] hover:shadow-[0_8px_20px_rgba(20,22,28,0.06)]"
              >
                <div className="mb-4 flex items-start justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#eaeaee] bg-[#fbfbfc]">
                    <Car size={17} />
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#70727d]">
                      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                    {canManage && (
                      <span className="flex opacity-0 transition group-hover:opacity-100">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(v); }}
                          className="rounded p-1 text-[#a3a4ac] hover:bg-[#f2f2f5] hover:text-[#14161c]"
                          title="Modifier"
                        >
                          <Pencil size={13} />
                        </button>
                        {v.statut !== "archive" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); archive(v); }}
                            className="rounded p-1 text-[#a3a4ac] hover:bg-[#fdeaea] hover:text-[#dc2626]"
                            title="Archiver"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <p className="mb-1 text-[15px] font-bold tracking-[-0.01em]">
                  {[v.marque, v.modele].filter(Boolean).join(" ") || "Véhicule"}
                </p>
                <p className="mb-4 font-mono text-[11px] tracking-[0.02em] text-[#a3a4ac]">
                  {v.immatriculation || v.vin || "—"}
                </p>
                <div className="flex flex-wrap gap-3.5 border-t border-[#eaeaee] pt-3.5">
                  <DocDot label="Assurance" date={v.assurance_expire_le} />
                  <DocDot label="CT" date={v.controle_technique_expire_le} />
                  <DocDot label="Carte grise" date={v.carte_grise_expire_le} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!canManage && (
        <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-[#a3a4ac]">
          <CheckCircle2 size={12} /> Lecture seule — seuls les administrateurs de l'organisation peuvent modifier la flotte.
        </p>
      )}

      {/* Panneau latéral fiche véhicule */}
      <VehicleDetailPanel
        vehicle={selected}
        siteName={selected?.site_id ? sites[selected.site_id] : null}
        canManage={canManage}
        initialTab={panelTab}
        onEdit={(v) => { setSelected(null); openEdit(v); }}
        onClose={() => setSelected(null)}
      />


      {/* Modale édition */}
      {draft && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-6">
          <div className="w-full overflow-hidden rounded-xl bg-white shadow-2xl sm:max-w-2xl">
            <div className="flex items-center justify-between border-b border-[#eaeaee] px-4 py-3">
              <h2 className="font-semibold">{draft.id ? "Modifier le véhicule" : "Ajouter un véhicule"}</h2>
              <button onClick={() => setDraft(null)} className="rounded p-1 hover:bg-[#f2f2f5]">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
              {err && (
                <div className="flex items-start gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{err}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-[#70727d]">Immatriculation</label>
                  <div className="flex gap-2">
                    <input
                      value={draft.immatriculation || ""}
                      onChange={(e) => setDraft({ ...draft, immatriculation: e.target.value.toUpperCase() })}
                      placeholder="AA-123-BB"
                      className="w-full rounded-lg border border-[#eaeaee] px-3 py-2 text-sm uppercase"
                    />
                    <button
                      type="button"
                      onClick={handlePlateLookup}
                      disabled={plateBusy}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1a1c25] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {plateBusy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                      Rechercher
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-[#70727d]">Renseigne automatiquement marque, modèle, VIN et énergie.</p>
                </div>
                <Field label="VIN" value={draft.vin || ""} onChange={(v) => setDraft({ ...draft, vin: v.toUpperCase() })} />
                <Field label="Marque" value={draft.marque || ""} onChange={(v) => setDraft({ ...draft, marque: v })} />
                <Field label="Modèle" value={draft.modele || ""} onChange={(v) => setDraft({ ...draft, modele: v })} />
                <Field label="Énergie" value={draft.energie || ""} onChange={(v) => setDraft({ ...draft, energie: v })} />
                <Field label="Couleur" value={draft.couleur || ""} onChange={(v) => setDraft({ ...draft, couleur: v })} />
                <Field label="Kilométrage" type="number" value={draft.kilometrage?.toString() || ""}
                  onChange={(v) => setDraft({ ...draft, kilometrage: v ? Number(v) : null })} />
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#70727d]">Statut</label>
                  <select
                    value={draft.statut || "actif"}
                    onChange={(e) => setDraft({ ...draft, statut: e.target.value as Vehicle["statut"] })}
                    className="w-full rounded-lg border border-[#eaeaee] px-3 py-2 text-sm"
                  >
                    <option value="actif">Disponible</option>
                    <option value="en_mission">En mission</option>
                    <option value="indispo">Immobilisé</option>
                    <option value="archive">Archivé</option>
                  </select>
                </div>
              </div>

              <p className="pt-1 text-[11px] font-semibold uppercase tracking-wider text-[#a3a4ac]">Documents & entretien</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Assurance expire le" type="date" value={draft.assurance_expire_le || ""}
                  onChange={(v) => setDraft({ ...draft, assurance_expire_le: v || null })} />
                <Field label="Contrôle technique expire le" type="date" value={draft.controle_technique_expire_le || ""}
                  onChange={(v) => setDraft({ ...draft, controle_technique_expire_le: v || null })} />
                <Field label="Carte grise expire le" type="date" value={draft.carte_grise_expire_le || ""}
                  onChange={(v) => setDraft({ ...draft, carte_grise_expire_le: v || null })} />
                <Field label="Mise en circulation" type="date" value={draft.mise_en_circulation || ""}
                  onChange={(v) => setDraft({ ...draft, mise_en_circulation: v || null })} />
                <Field label="Assurance annuelle (€)" type="number" value={draft.assurance_cout_annuel?.toString() || ""}
                  onChange={(v) => setDraft({ ...draft, assurance_cout_annuel: v ? Number(v) : null })} />
                <Field label="Prochaine révision (km)" type="number" value={draft.prochaine_revision_km?.toString() || ""}
                  onChange={(v) => setDraft({ ...draft, prochaine_revision_km: v ? Number(v) : null })} />
                <Field label="Intervalle de révision (km)" type="number" value={draft.intervalle_revision_km?.toString() || ""}
                  onChange={(v) => setDraft({ ...draft, intervalle_revision_km: v ? Number(v) : null })} />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#70727d]">Notes</label>
                <textarea
                  value={draft.notes || ""}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[#eaeaee] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#eaeaee] bg-[#fbfbfc] px-4 py-3">
              <button onClick={() => setDraft(null)} className="rounded-lg border border-[#eaeaee] bg-white px-3 py-2 text-sm">
                Annuler
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#14161c] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocDot({ label, date }: { label: string; date: string | null }) {
  const st = docStatus(date);
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] text-[#70727d]">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLS[st]}`} />
      {label}
    </span>
  );
}

function Field({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[#70727d]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#eaeaee] px-3 py-2 text-sm outline-none focus:border-[#2f5fff]/40"
      />
    </div>
  );
}
