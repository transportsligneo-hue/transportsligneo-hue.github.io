import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Car, Plus, Search, Loader2, Pencil, Trash2, X, Save, AlertCircle, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard-pro/flotte")({
  component: FleetPage,
});

type Vehicle = {
  id: string;
  organization_id: string;
  vin: string | null;
  immatriculation: string | null;
  marque: string | null;
  modele: string | null;
  energie: string | null;
  type_vehicule: string | null;
  couleur: string | null;
  kilometrage: number | null;
  statut: "actif" | "en_mission" | "indispo" | "archive";
  notes: string | null;
  archived_at: string | null;
  created_at: string;
};

const STATUT_LABEL: Record<Vehicle["statut"], { label: string; cls: string }> = {
  actif:      { label: "Actif",      cls: "bg-emerald-100 text-emerald-700" },
  en_mission: { label: "En mission", cls: "bg-blue-100 text-blue-700" },
  indispo:    { label: "Indispo",    cls: "bg-amber-100 text-amber-700" },
  archive:    { label: "Archivé",    cls: "bg-slate-200 text-slate-700" },
};

const EMPTY: Partial<Vehicle> = {
  vin: "", immatriculation: "", marque: "", modele: "",
  energie: "", type_vehicule: "", couleur: "", kilometrage: null,
  statut: "actif", notes: "",
};

function FleetPage() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgRole, setOrgRole] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("tous");
  const [draft, setDraft] = useState<Partial<Vehicle> | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Récupère l'organisation principale de l'utilisateur
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: mems } = await supabase
        .from("organization_members")
        .select("organization_id, member_role")
        .eq("user_id", user.id)
        .limit(1);
      const row = (mems ?? [])[0] as { organization_id: string; member_role: string } | undefined;
      if (row) {
        setOrgId(row.organization_id);
        setOrgRole(row.member_role);
      }
    })();
  }, [user]);

  const fetchVehicles = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    if (!error && data) setVehicles(data as Vehicle[]);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { void fetchVehicles(); }, [fetchVehicles]);

  // Realtime
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (statutFilter !== "tous" && v.statut !== statutFilter) return false;
      if (!q) return true;
      return [v.vin, v.immatriculation, v.marque, v.modele]
        .filter(Boolean).some((x) => String(x).toLowerCase().includes(q));
    });
  }, [vehicles, search, statutFilter]);

  const kpi = useMemo(() => {
    const total = vehicles.length;
    const actifs = vehicles.filter((v) => v.statut === "actif").length;
    const enMission = vehicles.filter((v) => v.statut === "en_mission").length;
    const indispo = vehicles.filter((v) => v.statut === "indispo").length;
    return { total, actifs, enMission, indispo };
  }, [vehicles]);

  const canManage = orgRole === "admin" || orgRole === "owner";

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
    if (!(await confirmToast(`Archiver le véhicule ${v.immatriculation || v.vin || "?"} ?`))) return;
    await supabase.from("vehicles")
      .update({ statut: "archive", archived_at: new Date().toISOString() })
      .eq("id", v.id);
    fetchVehicles();
  };

  if (!orgId && !loading) {
    return (
      <div className="bg-white border border-pro-border rounded-xl p-8 text-center">
        <Car className="mx-auto text-pro-muted mb-3" size={32} />
        <p className="text-pro-text-soft">Aucune organisation associée à votre compte.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-pro-text flex items-center gap-2">
            <Car size={22} className="text-pro-accent" /> Ma flotte
          </h1>
          <p className="text-pro-muted text-sm mt-1">
            Gérez vos véhicules d'entreprise (VIN, immatriculations, état).
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-pro-text text-white text-sm font-medium hover:opacity-90"
          >
            <Plus size={16} /> Ajouter un véhicule
          </button>
        )}
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: kpi.total, cls: "text-pro-text" },
          { label: "Actifs", value: kpi.actifs, cls: "text-emerald-700" },
          { label: "En mission", value: kpi.enMission, cls: "text-blue-700" },
          { label: "Indispo", value: kpi.indispo, cls: "text-amber-700" },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-pro-border rounded-xl p-4">
            <p className="text-xs text-pro-muted uppercase tracking-wider">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-pro-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher VIN, immat, marque…"
            className="w-full pl-9 pr-3 py-2 bg-white border border-pro-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pro-accent/30"
          />
        </div>
        <select
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-pro-border rounded-lg text-sm"
        >
          <option value="tous">Tous statuts</option>
          <option value="actif">Actifs</option>
          <option value="en_mission">En mission</option>
          <option value="indispo">Indispo</option>
          <option value="archive">Archivés</option>
        </select>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-pro-accent" size={26} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-pro-border rounded-xl p-10 text-center">
          <Car className="mx-auto text-pro-muted mb-3" size={32} />
          <p className="text-pro-text-soft">Aucun véhicule.</p>
        </div>
      ) : (
        <div className="bg-white border border-pro-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-pro-bg-soft text-pro-text-soft">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Immat.</th>
                  <th className="text-left px-3 py-2 font-medium">VIN</th>
                  <th className="text-left px-3 py-2 font-medium">Marque / Modèle</th>
                  <th className="text-left px-3 py-2 font-medium">Km</th>
                  <th className="text-left px-3 py-2 font-medium">Statut</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id} className="border-t border-pro-border hover:bg-pro-bg-soft/40">
                    <td className="px-3 py-2 font-medium">{v.immatriculation || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{v.vin || "—"}</td>
                    <td className="px-3 py-2">{[v.marque, v.modele].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-3 py-2">{v.kilometrage != null ? `${v.kilometrage.toLocaleString("fr-FR")} km` : "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${STATUT_LABEL[v.statut].cls}`}>
                        {STATUT_LABEL[v.statut].label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {canManage && (
                        <>
                          <button
                            onClick={() => openEdit(v)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-pro-text-soft hover:bg-pro-bg-soft"
                            title="Modifier"
                          >
                            <Pencil size={14} />
                          </button>
                          {v.statut !== "archive" && (
                            <button
                              onClick={() => archive(v)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-red-600 hover:bg-red-50"
                              title="Archiver"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawer édition */}
      {draft && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-2 sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-xl shadow-pro-elevated overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-pro-border">
              <h2 className="font-semibold text-pro-text">
                {draft.id ? "Modifier le véhicule" : "Ajouter un véhicule"}
              </h2>
              <button onClick={() => setDraft(null)} className="p-1 rounded hover:bg-pro-bg-soft">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {err && (
                <div className="flex items-start gap-2 px-3 py-2 bg-red-50 text-red-700 rounded text-sm">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{err}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Immatriculation" value={draft.immatriculation || ""} onChange={(v) => setDraft({ ...draft, immatriculation: v })} />
                <Field label="VIN" value={draft.vin || ""} onChange={(v) => setDraft({ ...draft, vin: v.toUpperCase() })} />
                <Field label="Marque" value={draft.marque || ""} onChange={(v) => setDraft({ ...draft, marque: v })} />
                <Field label="Modèle" value={draft.modele || ""} onChange={(v) => setDraft({ ...draft, modele: v })} />
                <Field label="Énergie" value={draft.energie || ""} onChange={(v) => setDraft({ ...draft, energie: v })} />
                <Field label="Couleur" value={draft.couleur || ""} onChange={(v) => setDraft({ ...draft, couleur: v })} />
                <Field
                  label="Kilométrage"
                  type="number"
                  value={draft.kilometrage?.toString() || ""}
                  onChange={(v) => setDraft({ ...draft, kilometrage: v ? Number(v) : null })}
                />
                <div>
                  <label className="block text-xs font-medium text-pro-text-soft mb-1">Statut</label>
                  <select
                    value={draft.statut || "actif"}
                    onChange={(e) => setDraft({ ...draft, statut: e.target.value as Vehicle["statut"] })}
                    className="w-full px-3 py-2 border border-pro-border rounded-lg text-sm"
                  >
                    <option value="actif">Actif</option>
                    <option value="en_mission">En mission</option>
                    <option value="indispo">Indispo</option>
                    <option value="archive">Archivé</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-pro-text-soft mb-1">Notes</label>
                <textarea
                  value={draft.notes || ""}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-pro-border rounded-lg text-sm resize-none"
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-pro-border flex justify-end gap-2 bg-pro-bg-soft">
              <button onClick={() => setDraft(null)} className="px-3 py-2 rounded-lg bg-white border border-pro-border text-sm">
                Annuler
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-pro-text text-white text-sm font-medium disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {!canManage && (
        <p className="text-xs text-pro-muted flex items-center gap-1.5">
          <CheckCircle2 size={12} /> Lecture seule — seuls les administrateurs de l'organisation peuvent modifier la flotte.
        </p>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-pro-text-soft mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-pro-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pro-accent/30"
      />
    </div>
  );
}
