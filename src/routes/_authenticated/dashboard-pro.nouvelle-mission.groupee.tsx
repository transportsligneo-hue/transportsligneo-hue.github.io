import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { resolvePersonalizedPrice } from "@/lib/pricing.functions";
import { createGroupedMission } from "@/lib/grouped-mission.functions";
import { calculateBasePrice } from "@/lib/reservation-pricing";
import { ArrowLeft, Check, Search, Loader2, Layers, MapPin, Calendar, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard-pro/nouvelle-mission/groupee")({
  component: GroupedMissionFlow,
});

type Vehicle = {
  id: string;
  immatriculation: string | null;
  marque: string | null;
  modele: string | null;
  energie: string | null;
  statut: "actif" | "en_mission" | "indispo" | "archive";
};

type TimeSlot = "matin" | "apres_midi" | "journee";

type Step = 1 | 2 | 3 | 4;

function GroupedMissionFlow() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const resolvePrice = useServerFn(resolvePersonalizedPrice);
  const createGrouped = useServerFn(createGroupedMission);

  const [step, setStep] = useState<Step>(1);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const [depart, setDepart] = useState("");
  const [commonArrivee, setCommonArrivee] = useState("");
  const [perVehicle, setPerVehicle] = useState(false);
  const [arrivees, setArrivees] = useState<Record<string, string>>({});
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState<TimeSlot>("matin");

  const [prices, setPrices] = useState<Record<string, number>>({});
  const [pricing, setPricing] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ref: string; ids: string[] } | null>(null);

  // Charge le parc de véhicules
  useEffect(() => {
    if (!user) return;
    (async () => {
      // 1) org via profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      let oid = profile?.organization_id as string | null;
      // 2) fallback via membership
      if (!oid) {
        const { data: mems } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1);
        oid = (mems ?? [])[0]?.organization_id as string | undefined ?? null;
      }
      if (!oid) {
        setLoading(false);
        return;
      }
      setOrgId(oid);

      const [{ data: veh }, { data: org }] = await Promise.all([
        supabase
          .from("vehicles")
          .select("id, immatriculation, marque, modele, energie, statut")
          .eq("organization_id", oid)
          .neq("statut", "archive")
          .order("created_at", { ascending: false }),
        supabase.from("organizations").select("address, commercial_name, legal_name").eq("id", oid).maybeSingle(),
      ]);
      setVehicles((veh ?? []) as Vehicle[]);
      const addr = (org as { address?: string | null } | null)?.address;
      if (addr) setDepart(addr);
      setLoading(false);
    })();
  }, [user]);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) =>
      [v.immatriculation, v.marque, v.modele].filter(Boolean).some((s) => s!.toLowerCase().includes(q)),
    );
  }, [vehicles, search]);

  const selectedVehicles = useMemo(
    () => vehicles.filter((v) => selected.has(v.id)),
    [vehicles, selected],
  );

  const toggle = (id: string, disabled: boolean) => {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canGoStep2 = selected.size > 0;
  const canGoStep3 = (() => {
    if (!depart.trim() || !date) return false;
    if (perVehicle) {
      return selectedVehicles.every((v) => (arrivees[v.id] ?? "").trim().length >= 2);
    }
    return commonArrivee.trim().length >= 2;
  })();

  // Calcul prix à l'entrée de l'étape 3
  useEffect(() => {
    if (step !== 3) return;
    void (async () => {
      setPricing(true);
      try {
        const results: Record<string, number> = {};
        for (const v of selectedVehicles) {
          const arr = perVehicle ? (arrivees[v.id] ?? "") : commonArrivee;
          const fallback = calculateBasePrice(depart, arr, "aller_simple").base;
          try {
            const r = await resolvePrice({
              data: { depart, arrivee: arr, isAllerRetour: false, fallbackPrice: fallback },
            });
            results[v.id] = r.price;
          } catch {
            results[v.id] = fallback;
          }
        }
        setPrices(results);
      } finally {
        setPricing(false);
      }
    })();
  }, [step, selectedVehicles, perVehicle, arrivees, commonArrivee, depart, resolvePrice]);

  const total = useMemo(
    () => selectedVehicles.reduce((s, v) => s + (prices[v.id] ?? 0), 0),
    [selectedVehicles, prices],
  );

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await createGrouped({
        data: {
          depart,
          date,
          timeSlot,
          message,
          vehicles: selectedVehicles.map((v) => ({
            vehicleId: v.id,
            immatriculation: v.immatriculation,
            marque: v.marque,
            modele: v.modele,
            energie: v.energie,
            arrivee: perVehicle ? (arrivees[v.id] ?? "") : commonArrivee,
            prixTtc: prices[v.id] ?? 0,
          })),
        },
      });
      setResult({ ref: res.groupReference, ids: res.demandeIds });
      setStep(4);
      toast.success(`Mission groupée créée · ${res.groupReference}`);
    } catch (e) {
      console.error("[grouped-mission] submit failed", e);
      const msg = (e as { message?: string })?.message || String(e);
      toast.error(`Impossible de créer la mission : ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            to="/dashboard-pro/nouvelle-mission"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-[#2f5fff]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Retour au choix
          </Link>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <Layers className="h-6 w-6 text-[#7c5cff]" /> Mission groupée
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {([1, 2, 3, 4] as Step[]).map((n) => (
            <div
              key={n}
              className={`h-8 w-8 rounded-full text-xs font-semibold flex items-center justify-center border transition ${
                step === n
                  ? "bg-[#7c5cff] text-white border-[#7c5cff]"
                  : step > n
                    ? "bg-[#f0ecff] text-[#5334d6] border-[#f0ecff]"
                    : "bg-white text-slate-400 border-slate-200"
              }`}
            >
              {step > n ? <Check className="h-4 w-4" /> : n}
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      )}

      {!loading && !orgId && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Aucune organisation active liée à votre compte. Impossible de créer une mission groupée.
        </div>
      )}

      {!loading && orgId && step === 1 && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par modèle ou plaque…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {filtered.length === 0 && (
                <div className="py-10 text-center text-sm text-slate-500">Aucun véhicule dans votre parc.</div>
              )}
              {filtered.map((v) => {
                const disabled = v.statut === "en_mission" || v.statut === "indispo";
                const checked = selected.has(v.id);
                return (
                  <label
                    key={v.id}
                    className={`flex items-center gap-4 py-3 px-1 ${
                      disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 accent-[#7c5cff]"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(v.id, disabled)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900">
                        {[v.marque, v.modele].filter(Boolean).join(" ") || "Véhicule"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {v.immatriculation ?? "—"} {v.energie ? `· ${v.energie}` : ""}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${
                        v.statut === "actif"
                          ? "bg-emerald-50 text-emerald-700"
                          : v.statut === "en_mission"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {v.statut === "actif" ? "Disponible" : v.statut === "en_mission" ? "En mission" : "Indispo"}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="sticky bottom-4 z-10 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur px-5 py-3 shadow-lg flex items-center justify-between">
            <span className="text-sm text-slate-600">
              <strong className="text-slate-900">{selected.size}</strong> véhicule{selected.size > 1 ? "s" : ""} sélectionné{selected.size > 1 ? "s" : ""}
            </span>
            <button
              disabled={!canGoStep2}
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#7c5cff] px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#6a4bef]"
            >
              Continuer <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {!loading && step === 2 && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Lieu d'enlèvement commun
              </span>
              <input
                value={depart}
                onChange={(e) => setDepart(e.target.value)}
                placeholder="Adresse d'enlèvement"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2f5fff]"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={perVehicle}
                onChange={(e) => setPerVehicle(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-[#7c5cff]"
              />
              Destinations différentes par véhicule
            </label>

            {!perVehicle && (
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Destination commune</span>
                <input
                  value={commonArrivee}
                  onChange={(e) => setCommonArrivee(e.target.value)}
                  placeholder="Adresse de livraison"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2f5fff]"
                />
              </label>
            )}

            {perVehicle && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-600">Une destination par véhicule</div>
                {selectedVehicles.map((v) => (
                  <div key={v.id} className="flex items-center gap-3">
                    <div className="w-32 shrink-0 text-xs text-slate-500">
                      {[v.marque, v.modele].filter(Boolean).join(" ") || v.immatriculation || "Véhicule"}
                    </div>
                    <input
                      value={arrivees[v.id] ?? ""}
                      onChange={(e) => setArrivees((p) => ({ ...p, [v.id]: e.target.value }))}
                      placeholder="Destination"
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2f5fff]"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Date de mission
                </span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2f5fff]"
                />
              </label>
              <div>
                <span className="text-xs font-medium text-slate-600">Créneau</span>
                <div className="mt-1 flex gap-2">
                  {(
                    [
                      ["matin", "Matin"],
                      ["apres_midi", "Après-midi"],
                      ["journee", "Journée"],
                    ] as [TimeSlot, string][]
                  ).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTimeSlot(v)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        timeSlot === v
                          ? "bg-[#7c5cff] text-white border-[#7c5cff]"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" /> Retour
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canGoStep3}
              className="inline-flex items-center gap-2 rounded-lg bg-[#7c5cff] px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-[#6a4bef]"
            >
              Voir le récapitulatif <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {!loading && step === 3 && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 text-sm font-semibold text-slate-900">
              Récapitulatif — {selectedVehicles.length} véhicule{selectedVehicles.length > 1 ? "s" : ""}
            </div>
            <div className="divide-y divide-slate-100">
              {selectedVehicles.map((v) => (
                <div key={v.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900">
                      {[v.marque, v.modele].filter(Boolean).join(" ") || "Véhicule"}
                      <span className="ml-2 text-xs text-slate-500">{v.immatriculation ?? ""}</span>
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {depart} → {perVehicle ? arrivees[v.id] : commonArrivee}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-[#b8862a]">
                    {pricing ? "…" : `${(prices[v.id] ?? 0).toFixed(2)} €`}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-slate-50 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Total estimé TTC</span>
              <span className="text-lg font-semibold text-[#b8862a]">
                {pricing ? "Calcul…" : `${total.toFixed(2)} €`}
              </span>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">Message pour l'équipe (facultatif)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2f5fff]"
            />
          </label>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" /> Modifier
            </button>
            <button
              onClick={submit}
              disabled={submitting || pricing}
              className="inline-flex items-center gap-2 rounded-lg bg-[#7c5cff] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40 hover:bg-[#6a4bef]"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirmer la mission groupée
            </button>
          </div>
        </div>
      )}

      {!loading && step === 4 && result && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="h-7 w-7" />
            </div>
            <h2 className="mt-3 text-lg font-semibold text-emerald-900">
              Mission groupée créée avec succès
            </h2>
            <p className="mt-1 text-sm text-emerald-800">
              Référence : <span className="font-mono font-semibold">{result.ref}</span>
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="text-sm font-semibold text-slate-900 mb-3">Suivi par véhicule</div>
            <div className="grid gap-2">
              {selectedVehicles.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900">
                      {[v.marque, v.modele].filter(Boolean).join(" ") || "Véhicule"}
                    </div>
                    <div className="text-xs text-slate-500">{v.immatriculation ?? ""}</div>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                    En attente
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Link
              to="/dashboard-pro/missions"
              className="inline-flex items-center gap-2 rounded-lg bg-[#2f5fff] px-4 py-2 text-sm font-medium text-white hover:bg-[#1c3fc4]"
            >
              Voir mes missions <ChevronRight className="h-4 w-4" />
            </Link>
            <button
              onClick={() => navigate({ to: "/dashboard-pro/nouvelle-mission" })}
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              Créer une autre mission
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
