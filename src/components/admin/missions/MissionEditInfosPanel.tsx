/**
 * MissionEditInfosPanel — édition admin de la fiche mission (véhicule, itinéraire,
 * contacts, client). Chaque modification passe par le RPC `admin_update_mission_infos`
 * qui trace l'historique et déclenche les notifications (client / convoyeur / admin)
 * selon les réglages de `notification_settings`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, Button, TextInput, Select } from "@/components/admin/AdminUI";
import { Pencil, Loader2, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "date" | "time" | "number" | "textarea" | "select";
  options?: { value: string; label: string }[];
  span?: boolean;
};

const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Planning (date & heure)",
    fields: [
      { key: "date_trajet", label: "Date de mission", type: "date" },
      { key: "heure_trajet", label: "Heure de prise en charge", type: "time" },
      { key: "date_souhaitee", label: "Date souhaitée (client)", type: "date" },
    ],
  },
  {
    title: "Véhicule",
    fields: [
      { key: "marque", label: "Marque" },
      { key: "modele", label: "Modèle" },
      { key: "immatriculation", label: "Plaque (principale)" },
      { key: "vehicule_immatriculation", label: "Plaque véhicule" },
      { key: "vin", label: "VIN" },
      { key: "vehicule_vin", label: "VIN (fiche véhicule)" },
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
    title: "Itinéraire",
    fields: [
      { key: "depart", label: "Adresse de départ", span: true },
      { key: "arrivee", label: "Adresse d'arrivée", span: true },
    ],
  },
  {
    title: "Contact départ",
    fields: [
      { key: "contact_depart_nom", label: "Nom" },
      { key: "contact_depart_tel", label: "Téléphone" },
      { key: "contact_depart_note", label: "Instructions", type: "textarea", span: true },
    ],
  },
  {
    title: "Contact arrivée",
    fields: [
      { key: "arrivee_contact_prenom", label: "Prénom" },
      { key: "arrivee_contact_nom", label: "Nom" },
      { key: "arrivee_contact_societe", label: "Société" },
      { key: "arrivee_contact_telephone", label: "Téléphone" },
      { key: "arrivee_contact_telephone2", label: "Téléphone 2" },
      { key: "arrivee_contact_email", label: "Email" },
      { key: "arrivee_contact_instructions", label: "Instructions", type: "textarea", span: true },
      { key: "contact_arrivee_nom", label: "Contact arrivée (fiche)" },
      { key: "contact_arrivee_tel", label: "Téléphone (fiche)" },
      { key: "contact_arrivee_note", label: "Note (fiche)", type: "textarea", span: true },
    ],
  },
  {
    title: "Client",
    fields: [
      { key: "client_nom", label: "Nom client" },
      { key: "client_telephone", label: "Téléphone" },
      { key: "client_email", label: "Email" },
    ],
  },
];


const ALL_KEYS = SECTIONS.flatMap((s) => s.fields.map((f) => f.key));
const FIELD_TYPES: Record<string, FieldDef["type"]> = Object.fromEntries(
  SECTIONS.flatMap((s) => s.fields.map((f) => [f.key, f.type ?? "text"])),
);

/** Normalise une valeur brute DB vers la valeur attendue par l'input (date / heure). */
function normalizeValue(key: string, raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const s = String(raw);
  const t = FIELD_TYPES[key];
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

export function MissionEditInfosPanel({ trajetId, openKey = 0, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (openKey > 0) setOpen(true);
  }, [openKey]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("trajets").select("*").eq("id", trajetId).maybeSingle();
    setLoading(false);
    if (error || !data) {
      toast.error("Impossible de charger la fiche mission");
      return;
    }
    const row = data as unknown as Record<string, unknown>;
    const next: Record<string, string> = {};
    for (const k of ALL_KEYS) {
      const v = row[k];
      next[k] = v === null || v === undefined ? "" : String(v);
    }
    setInitial(next);
    setForm(next);
  }, [trajetId]);

  useEffect(() => {
    if (open && Object.keys(initial).length === 0) void load();
  }, [open, initial, load]);

  const dirtyKeys = useMemo(
    () => ALL_KEYS.filter((k) => (form[k] ?? "") !== (initial[k] ?? "")),
    [form, initial],
  );

  const save = async () => {
    if (dirtyKeys.length === 0) return;
    setSaving(true);
    try {
      const patch: Record<string, string | null> = {};
      for (const k of dirtyKeys) patch[k] = form[k]?.trim() ? form[k].trim() : null;
      const { error } = await supabase.rpc("admin_update_mission_infos" as never, {
        _trajet_id: trajetId,
        _patch: patch as never,
      } as never);
      if (error) throw error;
      toast.success(`${dirtyKeys.length} champ(s) mis à jour`, {
        description: "Client, convoyeur et admin notifiés selon les réglages.",
      });
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

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Pencil size={15} className="text-pro-accent" />
        <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
          Modifier la fiche mission
        </h3>
        <div className="ml-auto">
          <Button variant={open ? "secondary" : "primary"} onClick={() => setOpen((o) => !o)}>
            <Pencil size={13} /> {open ? "Masquer" : "Modifier les informations"}
          </Button>
        </div>
      </div>

      {!open ? (
        <p className="text-xs text-pro-text-soft">
          Plaque, VIN, véhicule, adresses, date/heure et contacts — modifiables à tout moment, même
          rétroactivement sur une mission terminée. Chaque changement est tracé et notifié
          automatiquement (client, convoyeur, admin).
        </p>
      ) : loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-pro-accent" />
        </div>
      ) : (
        <div className="space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-pro-muted mb-2">
                {section.title}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {section.fields.map((f) => {
                  const changed = (form[f.key] ?? "") !== (initial[f.key] ?? "");
                  return (
                    <div key={f.key} className={f.span ? "sm:col-span-2" : undefined}>
                      <label className="block text-[11px] font-medium text-pro-text-soft mb-1">
                        {f.label}
                        {changed && <span className="ml-1 text-pro-accent">•</span>}
                      </label>
                      {f.type === "textarea" ? (
                        <textarea
                          value={form[f.key] ?? ""}
                          onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                          rows={2}
                          className="w-full rounded-lg border border-pro-border bg-white px-3 py-2 text-sm text-pro-text outline-none focus:border-pro-accent"
                        />
                      ) : f.type === "select" ? (
                        <Select
                          value={form[f.key] ?? ""}
                          onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                        >
                          {f.options?.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </Select>
                      ) : (
                        <TextInput
                          type={f.type === "number" ? "number" : f.type ?? "text"}
                          value={form[f.key] ?? ""}
                          onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2 pt-1 border-t border-pro-border">
            <p className="text-xs text-pro-text-soft mt-3">
              {dirtyKeys.length === 0 ? "Aucune modification" : `${dirtyKeys.length} champ(s) modifié(s)`}
            </p>
            <div className="ml-auto flex items-center gap-2 mt-3">
              <Button variant="secondary" onClick={() => setForm(initial)} disabled={dirtyKeys.length === 0 || saving}>
                <RotateCcw size={14} /> Annuler
              </Button>
              <Button onClick={save} disabled={dirtyKeys.length === 0 || saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Enregistrer & notifier
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
