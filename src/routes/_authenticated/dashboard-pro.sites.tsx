import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, MapPin, Plus, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrgAccountType } from "@/hooks/useCurrentOrgAccountType";

export const Route = createFileRoute("/_authenticated/dashboard-pro/sites")({
  head: () => ({
    meta: [
      { title: "Sites & agences — Espace pro Transports Ligneo" },
      { name: "description", content: "Gérez vos sites, agences et dépôts, et répartissez vos véhicules." },
    ],
  }),
  component: SitesPage,
});

type Site = { id: string; nom: string; adresse: string | null; code_postal: string | null; ville: string | null; contact_nom: string | null; contact_telephone: string | null; est_siege: boolean; actif: boolean };
const EMPTY = { nom: "", adresse: "", code_postal: "", ville: "", contact_nom: "", contact_telephone: "" };

function SitesPage() {
  const { data: org } = useCurrentOrgAccountType();
  const orgId = org?.orgId ?? null;
  const [sites, setSites] = useState<Site[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    const [{ data: s }, { data: v }] = await Promise.all([
      supabase.from("organization_sites").select("id,nom,adresse,code_postal,ville,contact_nom,contact_telephone,est_siege,actif").eq("organization_id", orgId).order("est_siege", { ascending: false }).order("nom"),
      supabase.from("vehicles").select("site_id").eq("organization_id", orgId),
    ]);
    setSites((s ?? []) as Site[]);
    const c: Record<string, number> = {};
    (v ?? []).forEach((r: { site_id: string | null }) => { if (r.site_id) c[r.site_id] = (c[r.site_id] ?? 0) + 1; });
    setCounts(c);
  }, [orgId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!orgId || !form.nom.trim()) return toast.error("Indiquez le nom du site.");
    setBusy(true);
    const { error } = await supabase.from("organization_sites").insert({
      organization_id: orgId, nom: form.nom.trim(), adresse: form.adresse || null, code_postal: form.code_postal || null,
      ville: form.ville || null, contact_nom: form.contact_nom || null, contact_telephone: form.contact_telephone || null,
      est_siege: sites.length === 0,
    });
    setBusy(false);
    if (error) return toast.error("Ajout impossible : " + error.message);
    toast.success("Site ajouté");
    setForm(EMPTY); load();
  };
  const setSiege = async (id: string) => {
    await supabase.from("organization_sites").update({ est_siege: false }).eq("organization_id", orgId!);
    await supabase.from("organization_sites").update({ est_siege: true }).eq("id", id);
    load();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("organization_sites").delete().eq("id", id);
    if (error) toast.error("Suppression impossible : " + error.message); else { toast.success("Site supprimé"); load(); }
  };

  const input = "w-full rounded-lg border border-pro-border bg-transparent px-3 py-2 text-sm";
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-2">
      <div>
        <h1 className="text-2xl font-bold">Sites <span className="text-pro-accent">& agences</span></h1>
        <p className="text-sm opacity-70">Vos agences, dépôts et établissements. Rattachez ensuite vos véhicules et missions à un site depuis le parc.</p>
      </div>

      <div className="rounded-2xl border border-pro-border p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><Plus size={16} /> Ajouter un site</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input className={input} placeholder="Nom du site *" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          <input className={`${input} sm:col-span-2`} placeholder="Adresse" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
          <input className={input} placeholder="Code postal" value={form.code_postal} onChange={(e) => setForm({ ...form, code_postal: e.target.value })} />
          <input className={input} placeholder="Ville" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
          <input className={input} placeholder="Contact sur place" value={form.contact_nom} onChange={(e) => setForm({ ...form, contact_nom: e.target.value })} />
          <input className={input} placeholder="Téléphone du site" value={form.contact_telephone} onChange={(e) => setForm({ ...form, contact_telephone: e.target.value })} />
        </div>
        <button disabled={busy} onClick={add} className="mt-4 rounded-lg bg-pro-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Ajout…" : "Ajouter le site"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sites.length === 0 && <p className="text-sm opacity-70">Aucun site pour l'instant.</p>}
        {sites.map((s) => (
          <div key={s.id} className="rounded-2xl border border-pro-border p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold"><Building2 size={16} className="text-pro-accent" /> {s.nom}
                {s.est_siege && <span className="rounded-full bg-pro-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase text-pro-accent">Siège</span>}
              </div>
              <span className="text-xs opacity-70">{counts[s.id] ?? 0} véhicule(s)</span>
            </div>
            {(s.adresse || s.ville) && <p className="mt-2 flex items-center gap-1 text-sm opacity-80"><MapPin size={13} /> {[s.adresse, s.code_postal, s.ville].filter(Boolean).join(", ")}</p>}
            {s.contact_nom && <p className="mt-1 text-sm opacity-80">{s.contact_nom}{s.contact_telephone ? ` · ${s.contact_telephone}` : ""}</p>}
            <div className="mt-3 flex gap-2">
              {!s.est_siege && <button onClick={() => setSiege(s.id)} className="inline-flex items-center gap-1 rounded-lg border border-pro-border px-2.5 py-1 text-xs"><Star size={12} /> Définir comme siège</button>}
              <button onClick={() => remove(s.id)} className="inline-flex items-center gap-1 rounded-lg border border-pro-border px-2.5 py-1 text-xs text-destructive"><Trash2 size={12} /> Supprimer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
