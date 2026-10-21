import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Ic } from "@/components/driver2/icons";
import { CAPACITE_MAX, MULTI_CAPACITE, OUTILS, PERMIS, PERMIS_GROUPES, VEHICULE_TYPES } from "@/lib/driver-materiel";
import { lookupPlate } from "@/lib/plate.functions";
import { useServerFn } from "@tanstack/react-start";
import { displayPlate } from "@/lib/plate-format";

export const Route = createFileRoute("/_authenticated/convoyeur/materiel")({
  component: MaterielPage,
});

// Les tables de ce module sont créées par la migration 20261022000000 (types Supabase pas encore régénérés).
const db = supabase as unknown as { from: (t: string) => any };

interface Vehicule {
  id: string;
  type: string;
  nom: string;
  immatriculation: string | null;
  capacite: number;
}

interface VForm {
  type: string;
  marque: string;
  modele: string;
  plaque: string;
  cap: number;
  cg: File | null;
  ass: File | null;
}

const EMPTY_FORM: VForm = { type: "plateau", marque: "", modele: "", plaque: "", cap: 1, cg: null, ass: null };

function MaterielPage() {
  const { user } = useAuth();
  const [convoyeurId, setConvoyeurId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [outils, setOutils] = useState<string[]>([]);
  const [permis, setPermis] = useState<string[]>([]);
  const [form, setForm] = useState<VForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const lookup = useServerFn(lookupPlate);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data: conv } = await supabase.from("convoyeurs").select("id").eq("user_id", user.id).maybeSingle();
    if (!conv?.id) { setLoading(false); return; }
    setConvoyeurId(conv.id);
    const [{ data: v }, { data: m }] = await Promise.all([
      db.from("convoyeur_vehicules").select("id, type, nom, immatriculation, capacite").eq("convoyeur_id", conv.id).order("created_at"),
      db.from("convoyeur_materiel").select("outils, permis").eq("convoyeur_id", conv.id).maybeSingle(),
    ]);
    setVehicules((v as Vehicule[]) ?? []);
    setOutils((m?.outils as string[]) ?? []);
    setPermis((m?.permis as string[]) ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const toggle = (list: string[], set: (v: string[]) => void, k: string) =>
    set(list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);

  async function saveMateriel() {
    if (!convoyeurId || permis.length === 0) return;
    const { error } = await db.from("convoyeur_materiel").upsert({ convoyeur_id: convoyeurId, outils, permis });
    if (error) toast.error("Enregistrement impossible, réessayez");
    else toast.success("Matériel enregistré");
  }

  async function searchPlate() {
    if (!form) return;
    setSearching(true);
    try {
      const r = await lookup({ data: { plate: form.plaque.trim() } });
      if (!r.ok || !r.data) { toast.error(r.error || "Aucune donnée trouvée, remplissez à la main"); return; }
      const d = r.data;
      setForm((f) => (f ? { ...f, marque: f.marque || d.marque || "", modele: f.modele || d.modele || "" } : f));
      toast.success("Véhicule trouvé");
    } catch {
      toast.error("Recherche indisponible, remplissez à la main");
    } finally {
      setSearching(false);
    }
  }

  async function addVehicule() {
    if (!form || !convoyeurId || !user?.id) return;
    if (!form.marque.trim() && !form.modele.trim() && !form.plaque.trim()) { toast.error("Indiquez la marque, le modèle ou la plaque"); return; }
    if (!form.cg || !form.ass) { toast.error("Ajoutez la carte grise et l'assurance"); return; }
    setSaving(true);
    try {
      const up = async (file: File, tag: string) => {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${user.id}/${crypto.randomUUID()}-${tag}.${ext}`;
        const { error } = await supabase.storage.from("convoyeur-vehicules").upload(path, file, { contentType: file.type || undefined });
        if (error) throw error;
        return path;
      };
      const [cgPath, assPath] = await Promise.all([up(form.cg, "cg"), up(form.ass, "assurance")]);
      const label = VEHICULE_TYPES.find((x) => x.key === form.type)?.label ?? "Véhicule";
      const { error } = await db.from("convoyeur_vehicules").insert({
        convoyeur_id: convoyeurId,
        type: form.type,
        nom: [form.marque.trim(), form.modele.trim()].filter(Boolean).join(" ") || label,
        immatriculation: form.plaque.trim().toUpperCase() || null,
        capacite: MULTI_CAPACITE.includes(form.type) ? form.cap : 1,
        carte_grise_path: cgPath,
        assurance_path: assPath,
      });
      if (error) throw error;
      setForm(null);
      toast.success("Véhicule ajouté");
      await load();
    } catch {
      toast.error("Ajout impossible, réessayez");
    } finally {
      setSaving(false);
    }
  }

  async function removeVehicule(id: string) {
    const { error } = await db.from("convoyeur_vehicules").delete().eq("id", id);
    if (error) toast.error("Suppression impossible");
    else setVehicules((l) => l.filter((v) => v.id !== id));
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={28} /></div>;

  const okPermis = permis.length > 0;
  const pick = (k: "cg" | "ass") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setForm((s) => (s ? { ...s, [k]: f } : s));
  };

  return (
    <div className="drv2">
      <div className="stack">
        <div>
          <h1>Mon matériel</h1>
          <p className="sub">Vos véhicules de transport, votre outillage et vos permis : nous ne vous proposons que les missions que vous pouvez réellement réaliser.</p>
        </div>

        <div className="grp"><span>Mes véhicules de transport</span><i /></div>
        {vehicules.length === 0 && <p className="eqnote">Aucun véhicule déclaré pour le moment.</p>}
        {vehicules.map((v) => {
          const t = VEHICULE_TYPES.find((x) => x.key === v.type) ?? (v.type === "remorque" ? { key: "remorque", label: "Remorque", icon: "link2" } : VEHICULE_TYPES[0]);
          return (
            <div className="vcard" key={v.id}>
              <span className="vc-ic"><Ic n={t.icon} s={20} sw={2.1} /></span>
              <div className="sp">
                <b>{v.nom}</b>
                <small>{t.label} · {v.type === "wg" ? "Circule sans carte grise" : (MULTI_CAPACITE.includes(v.type) ? `${v.capacite} véhicule${v.capacite > 1 ? "s" : ""} par trajet` : "1 véhicule par trajet")}</small>
                {v.immatriculation && <em>{displayPlate(v.immatriculation)}</em>}
                <span className="vc-ok"><Ic n="check2" s={11} sw={3.2} />{v.type === "wg" ? "Certificat" : "Carte grise"}</span>
                <span className="vc-ok"><Ic n="check2" s={11} sw={3.2} />Assurance</span>
              </div>
              <button className="vc-x" onClick={() => void removeVehicule(v.id)} aria-label="Supprimer"><Ic n="x" s={14} sw={2.6} /></button>
            </div>
          );
        })}

        {form ? (
          <div className="vform">
            <b>Nouveau véhicule</b>
            <div className="vf-t">
              {VEHICULE_TYPES.map((x) => (
                <button key={x.key} className={form.type === x.key ? "on" : ""} onClick={() => setForm({ ...form, type: x.key })}>
                  <Ic n={x.icon} s={15} sw={2.2} />{x.label}
                </button>
              ))}
            </div>
            <input className="fld" placeholder="Marque (ex : Iveco)" value={form.marque} onChange={(e) => setForm({ ...form, marque: e.target.value })} />
            <input className="fld" placeholder="Modèle (ex : Daily 35S14)" value={form.modele} onChange={(e) => setForm({ ...form, modele: e.target.value })} />
            <div className="row" style={{ gap: 8 }}>
              <input className="fld" style={{ flex: 1, minWidth: 0 }} placeholder={form.type === "wg" ? "Numéro W Garage (ex : WW 123 37)" : "Plaque (ex : AB-123-CD)"} value={form.plaque} onChange={(e) => setForm({ ...form, plaque: e.target.value })} />
              {form.type !== "wg" && (
                <button type="button" className="btn green" style={{ flex: "0 0 auto", padding: "0 16px" }} disabled={searching || form.plaque.trim().length < 4} onClick={() => void searchPlate()}>
                  {searching ? "…" : "Rechercher"}
                </button>
              )}
            </div>
            {MULTI_CAPACITE.includes(form.type) && (
              <div className="vf-c">
                <span>Véhicules transportables</span>
                <div>
                  {Array.from({ length: CAPACITE_MAX }, (_, i) => i + 1).map((n) => (
                    <button key={n} className={form.cap === n ? "on" : ""} onClick={() => setForm({ ...form, cap: n })}>{n}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="vf-d">
              <span>Documents obligatoires</span>
              <div>
                <label className={`vdoc${form.cg ? " ok" : ""}`}>
                  <Ic n={form.cg ? "check2" : "cam"} s={17} sw={2.4} />
                  <b>{form.type === "wg" ? "Certificat W Garage" : "Carte grise"}</b>
                  <small>{form.cg ? "Ajoutée" : "Photographier"}</small>
                  <input type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={pick("cg")} />
                </label>
                <label className={`vdoc${form.ass ? " ok" : ""}`}>
                  <Ic n={form.ass ? "check2" : "cam"} s={17} sw={2.4} />
                  <b>Assurance</b>
                  <small>{form.ass ? "Ajoutée" : "Photographier"}</small>
                  <input type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={pick("ass")} />
                </label>
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--line)", boxShadow: "none" }} onClick={() => setForm(null)}>Annuler</button>
              <button className="btn green" style={form.cg && form.ass ? undefined : { opacity: 0.5 }} disabled={saving} onClick={() => void addVehicule()}>
                {saving ? "Envoi…" : "Ajouter"}
              </button>
            </div>
          </div>
        ) : (
          <button className="vadd" onClick={() => setForm({ ...EMPTY_FORM })}><Ic n="plusi" s={17} sw={2.6} />Ajouter un véhicule ou une plaque</button>
        )}

        <div className="grp"><span>Outillage</span><i /></div>
        <div className="tgrid">
          {OUTILS.map((t) => {
            const on = outils.includes(t.key);
            return (
              <button key={t.key} className={`tchip${on ? " on" : ""}`} onClick={() => toggle(outils, setOutils, t.key)}>
                <Ic n={t.icon} s={16} sw={2.2} /><span>{t.label}</span>{on && <i><Ic n="check2" s={12} sw={3.2} /></i>}
              </button>
            );
          })}
        </div>

        <div className="grp"><span>Permis</span><i /></div>
        {PERMIS_GROUPES.map(([titre, ks]) => (
          <div className="pg" key={titre}>
            <small>{titre}</small>
            <div className="pgrid">
              {ks.map((k) => {
                const on = permis.includes(k);
                return (
                  <button key={k} className={`pchip${on ? " on" : ""}`} onClick={() => toggle(permis, setPermis, k)}>
                    <b>{PERMIS[k].label}</b><small>{PERMIS[k].sub}</small>{on && <i><Ic n="check2" s={11} sw={3.4} /></i>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {!okPermis && <p className="eqerr">Sélectionnez au moins une catégorie de permis.</p>}
        <button className="btn green" disabled={!okPermis} style={okPermis ? undefined : { opacity: 0.45 }} onClick={() => void saveMateriel()}>Enregistrer</button>
      </div>
    </div>
  );
}
