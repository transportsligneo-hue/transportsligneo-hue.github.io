/**
 * MissionEditInfosPanel — édition admin de la fiche mission (véhicule, itinéraire,
 * contacts, client). Chaque modification passe par le RPC `admin_update_mission_infos`
 * qui trace l'historique et déclenche les notifications (client / convoyeur / admin)
 * selon les réglages de `notification_settings`.
 *
 * Ergonomie : navigation par onglets, champs compacts, barre d'action collante.
 * Les champs miroirs (ex. `immatriculation` / `vehicule_immatriculation`) sont
 * fusionnés en une seule saisie pour éviter les doublons à l'écran.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, Button, TextInput, Select } from "@/components/admin/AdminUI";
import { Pencil, Loader2, Save, RotateCcw, CalendarClock, Car, MapPin, Users } from "lucide-react";
import { toast } from "sonner";

type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "date" | "time" | "number" | "textarea" | "select";
  options?: { value: string; label: string }[];
  span?: boolean;
  /** Colonnes secondaires alimentées avec la même valeur (évite les doublons UI). */
  mirrors?: string[];
  placeholder?: string;
  hint?: string;
};

type SectionDef = { id: string; title: string; icon: typeof Car; fields: FieldDef[] };

const SECTIONS: SectionDef[] = [
  {
    id: "planning",
    title: "Planning",
    icon: CalendarClock,
    fields: [
      { key: "date_trajet", label: "Date de mission", type: "date" },
      { key: "heure_trajet", label: "Heure de prise en charge", type: "time" },
      { key: "date_souhaitee", label: "Date souhaitée (client)", type: "date" },
    ],
  },
  {
    id: "vehicule",
    title: "Véhicule",
    icon: Car,
    fields: [
      { key: "marque", label: "Marque", placeholder: "RENAULT" },
      { key: "modele", label: "Modèle", placeholder: "MEGANE" },
      {
        key: "immatriculation",
        label: "Immatriculation",
        mirrors: ["vehicule_immatriculation"],
        placeholder: "AA-123-BB",
        hint: "Synchronisée sur la fiche véhicule et les documents.",
      },
      { key: "vin", label: "VIN / N° de série", mirrors: ["vehicule_vin"], placeholder: "VF1..." },
      {
        key: "vehicule_energie",
        label: "Énergie",
        type: "select",
        options: [
          { value: "", label: "—" },
          { value: "essence", label: "Essence" },
          { value: "diesel", label: "Diesel" },
          { value: "hybride", label: "Hybride" },
          { value: "electrique", label: "Électrique" },
          { value: "gpl", label: "GPL" },
        ],
      },
      { key: "vehicule_type", label: "Type / gabarit" },
      { key: "vehicule_couleur", label: "Couleur" },
      { key: "vehicule_km", label: "Kilométrage", type: "number" },
      { key: "vehicule_notes", label: "Notes véhicule", type: "textarea", span: true },
    ],
  },
  {
    id: "itineraire",
    title: "Itinéraire",
    icon: MapPin,
    fields: [
      { key: "depart", label: "Adresse de départ", span: true },
      { key: "arrivee", label: "Adresse d'arrivée", span: true },
    ],
  },
  {
    id: "contacts",
    title: "Contacts & client",
    icon: Users,
    fields: [
      { key: "client_nom", label: "Nom client" },
      { key: "client_telephone", label: "Téléphone client" },
      { key: "client_email", label: "Email client", span: true },
      { key: "contact_depart_nom", label: "Contact départ · nom" },
      { key: "contact_depart_tel", label: "Contact départ · téléphone" },
      { key: "contact_depart_note", label: "Instructions départ", type: "textarea", span: true },
      { key: "arrivee_contact_prenom", label: "Contact arrivée · prénom" },
      { key: "arrivee_contact_nom", label: "Contact arrivée · nom", mirrors: ["contact_arrivee_nom"] },
      { key: "arrivee_contact_societe", label: "Société" },
      {
        key: "arrivee_contact_telephone",
        label: "Contact arrivée · téléphone",
        mirrors: ["contact_arrivee_tel"],
      },
      { key: "arrivee_contact_telephone2", label: "Téléphone secondaire" },
      { key: "arrivee_contact_email", label: "Email arrivée" },
      {
        key: "arrivee_contact_instructions",
        label: "Instructions arrivée",
        type: "textarea",
        span: true,
        mirrors: ["contact_arrivee_note"],
      },
    ],
  },
];

const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);
const ALL_KEYS = ALL_FIELDS.map((f) => f.key);
const FIELD_BY_KEY: Record<string, FieldDef> = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, f]));

/** Normalise une valeur brute DB vers la valeur attendue par l'input (date / heure). */
function normalizeValue(key: string, raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const s = String(raw);
  const t = FIELD_BY_KEY[key]?.type ?? "text";
  if (t === "date") return s.slice(0, 10);
  if (t === "time") return s.slice(0, 5);
  return s;
}

interface Props {
  trajetId: string;
  /** Incrémenter pour ouvrir le panneau depuis l'extérieur (bouton « Modifier »). */
  openKey?: number;
  onChanged?: () => void;
}

type DevisVehicule = Record<string, unknown>;

/** Champs éditables pour les véhicules additionnels d'un devis groupé. */
const VEH_FIELDS: FieldDef[] = [
  { key: "marque", label: "Marque", placeholder: "RENAULT" },
  { key: "modele", label: "Modèle", placeholder: "KANGOO" },
  { key: "immatriculation", label: "Immatriculation", placeholder: "AA-123-BB" },
  { key: "vin", label: "VIN / N° de série", placeholder: "VF1..." },
  {
    key: "energie",
    label: "Énergie",
    type: "select",
    options: [
      { value: "", label: "—" },
      { value: "essence", label: "Essence" },
      { value: "diesel", label: "Diesel" },
      { value: "hybride", label: "Hybride" },
      { value: "electrique", label: "Électrique" },
      { value: "gpl", label: "GPL" },
    ],
  },
  { key: "categorie", label: "Type / gabarit" },
  { key: "couleur", label: "Couleur" },
  { key: "prix", label: "Prix (€)", type: "number" },
  { key: "arrivee", label: "Adresse d'arrivée", span: true },
  { key: "notes", label: "Notes véhicule", type: "textarea", span: true },
];

export function MissionEditInfosPanel({ trajetId, openKey = 0, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<string>(SECTIONS[0].id);
  // Devis groupé : plusieurs véhicules dans une seule mission
  const [devisId, setDevisId] = useState<string | null>(null);
  const [vehInitial, setVehInitial] = useState<DevisVehicule[]>([]);
  const [vehForm, setVehForm] = useState<DevisVehicule[]>([]);
  const [vehIndex, setVehIndex] = useState(0);

  useEffect(() => {
    if (openKey > 0) setOpen(true);
  }, [openKey]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("trajets").select("*").eq("id", trajetId).maybeSingle();
    if (error || !data) {
      setLoading(false);
      toast.error("Impossible de charger la fiche mission");
      return;
    }
    const row = data as unknown as Record<string, unknown>;
    const next: Record<string, string> = {};
    for (const f of ALL_FIELDS) {
      let raw = row[f.key];
      if ((raw === null || raw === undefined || raw === "") && f.mirrors) {
        for (const m of f.mirrors) {
          if (row[m] !== null && row[m] !== undefined && row[m] !== "") { raw = row[m]; break; }
        }
      }
      next[f.key] = normalizeValue(f.key, raw);
    }
    setInitial(next);
    setForm(next);

    // Véhicules additionnels (devis groupé)
    const dId = (row["devis_id"] as string | null) ?? null;
    setDevisId(dId);
    if (dId) {
      const { data: devis } = await supabase.from("devis").select("vehicules").eq("id", dId).maybeSingle();
      const list = (devis as { vehicules?: unknown } | null)?.vehicules;
      const arr = Array.isArray(list) ? (list as DevisVehicule[]) : [];
      setVehInitial(arr);
      setVehForm(arr.map((v) => ({ ...v })));
    } else {
      setVehInitial([]);
      setVehForm([]);
    }
    setVehIndex(0);
    setLoading(false);
  }, [trajetId]);

  useEffect(() => {
    if (open && Object.keys(initial).length === 0) void load();
  }, [open, initial, load]);


  const dirtyKeys = useMemo(
    () => ALL_KEYS.filter((k) => (form[k] ?? "") !== (initial[k] ?? "")),
    [form, initial],
  );

  const dirtyBySection = useMemo(() => {
    const m: Record<string, number> = {};
    SECTIONS.forEach((s) => {
      m[s.id] = s.fields.filter((f) => (form[f.key] ?? "") !== (initial[f.key] ?? "")).length;
    });
    return m;
  }, [form, initial]);

  const isGrouped = vehForm.length > 1;
  const vehDirty = useMemo(
    () => JSON.stringify(vehForm) !== JSON.stringify(vehInitial),
    [vehForm, vehInitial],
  );
  const vehDirtyCount = useMemo(
    () => vehForm.reduce((n, v, i) => (JSON.stringify(v) !== JSON.stringify(vehInitial[i] ?? {}) ? n + 1 : n), 0),
    [vehForm, vehInitial],
  );

  const save = async () => {
    if (dirtyKeys.length === 0 && !vehDirty) return;
    setSaving(true);
    try {
      if (dirtyKeys.length > 0) {
        const patch: Record<string, string | null> = {};
        for (const k of dirtyKeys) {
          const value = form[k]?.trim() ? form[k].trim() : null;
          patch[k] = value;
          FIELD_BY_KEY[k]?.mirrors?.forEach((m) => { patch[m] = value; });
        }
        const { error } = await supabase.rpc("admin_update_mission_infos" as never, {
          _trajet_id: trajetId,
          _patch: patch as never,
        } as never);
        if (error) throw error;
      }

      if (vehDirty && devisId) {
        const cleaned = vehForm.map((v) => {
          const out: DevisVehicule = { ...v };
          if (typeof out.prix === "string") out.prix = out.prix === "" ? null : Number(out.prix);
          return out;
        });
        const { error: vErr } = await supabase
          .from("devis")
          .update({ vehicules: cleaned as never })
          .eq("id", devisId);
        if (vErr) throw vErr;
      }

      toast.success(
        `${dirtyKeys.length + (vehDirty ? vehDirtyCount : 0)} modification(s) enregistrée(s)`,
        { description: "Client, convoyeur et admin notifiés selon les réglages." },
      );
      setInitial({});
      await load();
      onChanged?.();
    } catch (err) {
      toast.error("Modification impossible", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setSaving(false);
    }
  };

  const setVehField = (idx: number, key: string, value: string) => {
    setVehForm((prev) => prev.map((v, i) => (i === idx ? { ...v, [key]: value } : v)));
  };

  const renderVehField = (f: FieldDef, idx: number) => {
    const raw = vehForm[idx]?.[f.key];
    const value = raw === null || raw === undefined ? "" : String(raw);
    const rawInit = vehInitial[idx]?.[f.key];
    const initValue = rawInit === null || rawInit === undefined ? "" : String(rawInit);
    const changed = value !== initValue;
    return (
      <div key={f.key} className={f.span ? "sm:col-span-2" : undefined}>
        <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-pro-text-soft">
          {f.label}
          {changed && <span className="h-1.5 w-1.5 rounded-full bg-pro-accent" aria-label="modifié" />}
        </label>
        {f.type === "textarea" ? (
          <textarea
            value={value}
            rows={2}
            onChange={(e) => setVehField(idx, f.key, e.target.value)}
            className="w-full rounded-lg border border-pro-border bg-white px-3 py-2 text-sm text-pro-text outline-none focus:border-pro-accent"
          />
        ) : f.type === "select" ? (
          <Select value={value} onChange={(e) => setVehField(idx, f.key, e.target.value)}>
            {f.options?.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        ) : (
          <TextInput
            type={f.type === "number" ? "number" : "text"}
            value={value}
            placeholder={f.placeholder}
            onChange={(e) => setVehField(idx, f.key, e.target.value)}
          />
        )}
      </div>
    );
  };


  const active = SECTIONS.find((s) => s.id === tab) ?? SECTIONS[0];

  const renderField = (f: FieldDef) => {
    const changed = (form[f.key] ?? "") !== (initial[f.key] ?? "");
    const set = (v: string) => setForm((p) => ({ ...p, [f.key]: v }));
    return (
      <div key={f.key} className={f.span ? "sm:col-span-2" : undefined}>
        <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-pro-text-soft">
          {f.label}
          {changed && <span className="h-1.5 w-1.5 rounded-full bg-pro-accent" aria-label="modifié" />}
        </label>
        {f.type === "textarea" ? (
          <textarea
            value={form[f.key] ?? ""}
            onChange={(e) => set(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-pro-border bg-white px-3 py-2 text-sm text-pro-text outline-none focus:border-pro-accent"
          />
        ) : f.type === "select" ? (
          <Select value={form[f.key] ?? ""} onChange={(e) => set(e.target.value)}>
            {f.options?.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        ) : (
          <TextInput
            type={f.type === "number" ? "number" : f.type ?? "text"}
            value={form[f.key] ?? ""}
            placeholder={f.placeholder}
            onChange={(e) => set(e.target.value)}
          />
        )}
        {f.hint && <p className="mt-1 text-[10px] text-pro-muted">{f.hint}</p>}
      </div>
    );
  };

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pencil size={15} className="text-pro-accent" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-pro-text">
          Modifier la fiche mission
        </h3>
        {dirtyKeys.length > 0 && (
          <span className="rounded-full bg-pro-accent/10 px-2 py-0.5 text-[10px] font-bold text-pro-accent">
            {dirtyKeys.length} modif.
          </span>
        )}
        <div className="ml-auto">
          <Button variant={open ? "secondary" : "primary"} onClick={() => setOpen((o) => !o)}>
            <Pencil size={13} /> {open ? "Masquer" : "Modifier"}
          </Button>
        </div>
      </div>

      {!open ? (
        <p className="text-xs text-pro-text-soft">
          Plaque, VIN, véhicule, adresses, date/heure et contacts — modifiables à tout moment, même
          rétroactivement. Chaque changement est tracé et notifié automatiquement.
        </p>
      ) : loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-pro-accent" />
        </div>
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap gap-1.5 rounded-xl bg-pro-bg p-1">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = s.id === active.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setTab(s.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? "bg-pro-accent text-white shadow-sm"
                      : "text-pro-text-soft hover:bg-white hover:text-pro-text"
                  }`}
                >
                  <Icon size={13} />
                  {s.title}
                  {dirtyBySection[s.id] > 0 && (
                    <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-white" : "bg-pro-accent"}`} />
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {active.fields.map(renderField)}
          </div>

          <div className="sticky bottom-0 -mx-1 mt-5 flex flex-wrap items-center gap-2 border-t border-pro-border bg-white/95 px-1 py-3 backdrop-blur">
            <p className="text-xs text-pro-text-soft">
              {dirtyKeys.length === 0 ? "Aucune modification" : `${dirtyKeys.length} champ(s) modifié(s)`}
            </p>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" onClick={() => setForm(initial)} disabled={dirtyKeys.length === 0 || saving}>
                <RotateCcw size={14} /> Annuler
              </Button>
              <Button onClick={save} disabled={dirtyKeys.length === 0 || saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
