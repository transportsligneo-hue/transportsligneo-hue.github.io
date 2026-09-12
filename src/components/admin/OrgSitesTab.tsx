import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Plus, Save, Trash2, UserRound, ArrowRightLeft, X } from "lucide-react";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";

interface Site {
  id: string;
  nom: string;
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
  siret_etablissement: string | null;
  est_siege: boolean;
  actif: boolean;
}

interface SiteContact {
  id: string;
  site_id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  role: string;
}

interface TransferRow {
  id: string;
  entity_type: string;
  entity_label: string | null;
  from_site_id: string | null;
  to_site_id: string | null;
  created_at: string;
}

type Movable = { id: string; label: string; site_id: string | null; kind: "vehicle" | "conducteur" | "membre" };

const EMPTY_SITE = { nom: "", adresse: "", ville: "", code_postal: "", siret_etablissement: "", est_siege: false };

export function OrgSitesTab({ organizationId, facturationMode }: { organizationId: string; facturationMode: string }) {
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<Site[]>([]);
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [movables, setMovables] = useState<Movable[]>([]);
  const [billing, setBilling] = useState(facturationMode || "consolidee");
  const [draft, setDraft] = useState<typeof EMPTY_SITE | null>(null);
  const [saving, setSaving] = useState(false);
  const [contactDraft, setContactDraft] = useState<Partial<SiteContact> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [sitesRes, transfersRes] = await Promise.all([
      supabase.from("organization_sites").select("*").eq("organization_id", organizationId).order("nom"),
      supabase.from("site_transfers").select("id, entity_type, entity_label, from_site_id, to_site_id, created_at")
        .eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(50),
    ]);
    const siteRows = (sitesRes.data ?? []) as unknown as Site[];
    setSites(siteRows);
    setTransfers((transfersRes.data ?? []) as unknown as TransferRow[]);

    const siteIds = siteRows.map((s) => s.id);
    if (siteIds.length) {
      const { data } = await supabase.from("site_contacts").select("*").in("site_id", siteIds).order("role");
      setContacts((data ?? []) as unknown as SiteContact[]);
    } else {
      setContacts([]);
    }

    const [vehRes, condRes, memRes] = await Promise.all([
      supabase.from("vehicles").select("id, immatriculation, marque, modele, site_id").eq("organization_id", organizationId),
      supabase.from("conducteurs_flotte").select("id, prenom, nom, site_id").eq("organization_id", organizationId),
      supabase.from("organization_members").select("id, user_id").eq("organization_id", organizationId),
    ]);
    const memberIds = ((memRes.data ?? []) as Array<{ id: string }>).map((m) => m.id);
    const memberSites = memberIds.length
      ? ((await supabase.from("organization_member_sites").select("member_id, site_id").in("member_id", memberIds)).data ?? [])
      : [];
    const memberSiteMap = new Map(
      (memberSites as Array<{ member_id: string; site_id: string }>).map((r) => [r.member_id, r.site_id]),
    );
    setMovables([
      ...((vehRes.data ?? []) as Array<Record<string, string | null>>).map((v) => ({
        kind: "vehicle" as const,
        id: v["id"] as string,
        label: v["immatriculation"] || [v["marque"], v["modele"]].filter(Boolean).join(" ") || "Véhicule",
        site_id: v["site_id"] ?? null,
      })),
      ...((condRes.data ?? []) as Array<Record<string, string | null>>).map((c) => ({
        kind: "conducteur" as const,
        id: c["id"] as string,
        label: [c["prenom"], c["nom"]].filter(Boolean).join(" ") || "Conducteur",
        site_id: c["site_id"] ?? null,
      })),
      ...((memRes.data ?? []) as Array<{ id: string; user_id: string }>).map((m) => ({
        kind: "membre" as const,
        id: m.id,
        label: `Utilisateur ${m.user_id.slice(0, 8)}…`,
        site_id: memberSiteMap.get(m.id) ?? null,
      })),
    ]);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  const siteName = (id: string | null) => (id ? sites.find((s) => s.id === id)?.nom ?? "—" : "Non rattaché");

  const saveSite = async () => {
    if (!draft?.nom.trim()) { toast.error("Le nom du site est obligatoire"); return; }
    setSaving(true);
    const { error } = await supabase.from("organization_sites").insert({
      organization_id: organizationId,
      nom: draft.nom.trim(),
      adresse: draft.adresse || null,
      ville: draft.ville || null,
      code_postal: draft.code_postal || null,
      siret_etablissement: draft.siret_etablissement || null,
      est_siege: draft.est_siege,
      actif: true,
    } as never);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Site créé");
    setDraft(null);
    void load();
  };

  const deleteSite = async (s: Site) => {
    if (!(await confirmToast(`Supprimer le site « ${s.nom} » ? L'organisation et les autres sites sont conservés.`))) return;
    const { error } = await supabase.from("organization_sites").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Site supprimé");
    void load();
  };

  const saveContact = async () => {
    if (!contactDraft?.site_id || !contactDraft.nom?.trim()) { toast.error("Nom et site obligatoires"); return; }
    const existing = contacts.filter((c) => c.site_id === contactDraft.site_id);
    if (!contactDraft.id && existing.length >= 2) { toast.error("Deux contacts maximum par site"); return; }
    const payload = {
      site_id: contactDraft.site_id,
      nom: contactDraft.nom.trim(),
      prenom: contactDraft.prenom || null,
      email: contactDraft.email || null,
      telephone: contactDraft.telephone || null,
      role: contactDraft.role || "principal",
    };
    const { error } = contactDraft.id
      ? await supabase.from("site_contacts").update(payload as never).eq("id", contactDraft.id)
      : await supabase.from("site_contacts").insert(payload as never);
    if (error) { toast.error(error.message); return; }
    toast.success("Contact enregistré");
    setContactDraft(null);
    void load();
  };

  const deleteContact = async (c: SiteContact) => {
    if (!(await confirmToast(`Supprimer le contact ${c.prenom ?? ""} ${c.nom} ?`))) return;
    await supabase.from("site_contacts").delete().eq("id", c.id);
    void load();
  };

  const transfer = async (m: Movable, toSiteId: string) => {
    const fromSiteId = m.site_id;
    if (fromSiteId === toSiteId) return;
    let error = null as { message: string } | null;
    if (m.kind === "vehicle") {
      ({ error } = await supabase.from("vehicles").update({ site_id: toSiteId } as never).eq("id", m.id));
    } else if (m.kind === "conducteur") {
      ({ error } = await supabase.from("conducteurs_flotte").update({ site_id: toSiteId } as never).eq("id", m.id));
    } else {
      await supabase.from("organization_member_sites").delete().eq("member_id", m.id);
      ({ error } = await supabase.from("organization_member_sites").insert({ member_id: m.id, site_id: toSiteId } as never));
    }
    if (error) { toast.error(error.message); return; }
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from("site_transfers").insert({
      organization_id: organizationId,
      entity_type: m.kind,
      entity_id: m.id,
      entity_label: m.label,
      from_site_id: fromSiteId,
      to_site_id: toSiteId,
      moved_by: auth.user?.id ?? null,
    } as never);
    toast.success(`${m.label} rattaché à ${siteName(toSiteId)}`);
    void load();
  };

  const saveBilling = async (mode: string) => {
    setBilling(mode);
    const { error } = await supabase.from("organizations").update({ facturation_mode: mode } as never).eq("id", organizationId);
    if (error) toast.error(error.message);
    else toast.success(mode === "consolidee" ? "Facturation consolidée" : "Facturation par site");
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-pro-accent" size={24} /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Sites */}
      <div className="bg-white border border-pro-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-pro-text flex items-center gap-2"><MapPin size={15} /> Sites ({sites.length})</h3>
          <button
            onClick={() => setDraft({ ...EMPTY_SITE })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2f5fff] px-3 py-1.5 text-xs font-semibold text-white"
          >
            <Plus size={13} /> Ajouter un site
          </button>
        </div>
        {sites.length === 0 ? (
          <p className="text-sm text-pro-muted py-6 text-center">Aucun site pour cette organisation.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {sites.map((s) => {
              const siteContacts = contacts.filter((c) => c.site_id === s.id);
              return (
                <div key={s.id} className="rounded-xl border border-pro-border p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-pro-text truncate">{s.nom}</p>
                      <p className="text-xs text-pro-muted truncate">
                        {[s.adresse, s.code_postal, s.ville].filter(Boolean).join(" ") || "Adresse non renseignée"}
                      </p>
                      {s.siret_etablissement && <p className="text-[11px] text-pro-muted mt-0.5">SIRET {s.siret_etablissement}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {s.est_siege && <Badge variant="outline">Siège</Badge>}
                      <button onClick={() => deleteSite(s)} className="rounded p-1 text-pro-muted hover:text-red-600" title="Supprimer">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-pro-border pt-2.5 space-y-1.5">
                    {siteContacts.length === 0 && <p className="text-xs text-pro-muted">Aucun contact pour ce site.</p>}
                    {siteContacts.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate">
                          <UserRound size={11} className="inline mr-1 -mt-0.5 text-pro-muted" />
                          <b>{[c.prenom, c.nom].filter(Boolean).join(" ")}</b>
                          <span className="text-pro-muted"> · {c.role === "secondaire" ? "Secondaire" : "Principal"}</span>
                          {c.email && <span className="text-pro-muted"> · {c.email}</span>}
                          {c.telephone && <span className="text-pro-muted"> · {c.telephone}</span>}
                        </span>
                        <span className="flex shrink-0 gap-1">
                          <button onClick={() => setContactDraft(c)} className="text-pro-muted hover:text-pro-text">Modifier</button>
                          <button onClick={() => deleteContact(c)} className="text-pro-muted hover:text-red-600">Supprimer</button>
                        </span>
                      </div>
                    ))}
                    {siteContacts.length < 2 && (
                      <button
                        onClick={() => setContactDraft({ site_id: s.id, role: siteContacts.length ? "secondaire" : "principal" })}
                        className="text-xs font-medium text-[#2f5fff]"
                      >
                        + Ajouter un contact
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Facturation */}
      <div className="bg-white border border-pro-border rounded-xl p-4">
        <h3 className="font-semibold text-pro-text mb-2">Facturation</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "consolidee", label: "Consolidée (une facture pour tous les sites)" },
            { id: "par_site", label: "Une facture par site" },
          ].map((o) => (
            <button
              key={o.id}
              onClick={() => saveBilling(o.id)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                billing === o.id ? "border-[#2f5fff] bg-[#2f5fff]/5 text-[#2f5fff]" : "border-pro-border text-pro-muted"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transferts */}
      {sites.length > 0 && (
        <div className="bg-white border border-pro-border rounded-xl p-4">
          <h3 className="font-semibold text-pro-text mb-3 flex items-center gap-2"><ArrowRightLeft size={15} /> Rattachements</h3>
          {movables.length === 0 ? (
            <p className="text-sm text-pro-muted">Aucun véhicule, conducteur ou utilisateur à rattacher.</p>
          ) : (
            <div className="divide-y">
              {movables.map((m) => (
                <div key={`${m.kind}-${m.id}`} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    <Badge variant="outline" className="mr-2 capitalize">{m.kind === "membre" ? "utilisateur" : m.kind === "vehicle" ? "véhicule" : m.kind}</Badge>
                    {m.label}
                  </span>
                  <select
                    value={m.site_id ?? ""}
                    onChange={(e) => transfer(m, e.target.value)}
                    className="shrink-0 rounded-lg border border-pro-border px-2 py-1.5 text-xs"
                  >
                    <option value="">Non rattaché</option>
                    {sites.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Historique */}
      <div className="bg-white border border-pro-border rounded-xl p-4">
        <h3 className="font-semibold text-pro-text mb-2">Historique des rattachements</h3>
        {transfers.length === 0 ? (
          <p className="text-sm text-pro-muted">Aucun transfert enregistré.</p>
        ) : (
          <div className="divide-y">
            {transfers.map((t) => (
              <div key={t.id} className="py-2 flex justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <b>{t.entity_label ?? t.entity_type}</b> : {siteName(t.from_site_id)} → {siteName(t.to_site_id)}
                </span>
                <span className="text-xs text-pro-muted shrink-0">{new Date(t.created_at).toLocaleString("fr-FR")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modale site */}
      {draft && (
        <Modal title="Nouveau site" onClose={() => setDraft(null)}>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Nom du site" value={draft.nom} onChange={(v) => setDraft({ ...draft, nom: v })} span />
            <TextField label="Adresse" value={draft.adresse} onChange={(v) => setDraft({ ...draft, adresse: v })} span />
            <TextField label="Code postal" value={draft.code_postal} onChange={(v) => setDraft({ ...draft, code_postal: v })} />
            <TextField label="Ville" value={draft.ville} onChange={(v) => setDraft({ ...draft, ville: v })} />
            <TextField label="SIRET établissement (optionnel)" value={draft.siret_etablissement} onChange={(v) => setDraft({ ...draft, siret_etablissement: v })} span />
            <label className="col-span-2 flex items-center gap-2 text-sm text-pro-text">
              <input type="checkbox" checked={draft.est_siege} onChange={(e) => setDraft({ ...draft, est_siege: e.target.checked })} />
              Marquer ce site comme siège (facultatif)
            </label>
          </div>
          <button
            onClick={saveSite}
            disabled={saving}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#2f5fff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Créer le site
          </button>
        </Modal>
      )}

      {/* Modale contact */}
      {contactDraft && (
        <Modal title="Contact du site" onClose={() => setContactDraft(null)}>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Prénom" value={contactDraft.prenom ?? ""} onChange={(v) => setContactDraft({ ...contactDraft, prenom: v })} />
            <TextField label="Nom" value={contactDraft.nom ?? ""} onChange={(v) => setContactDraft({ ...contactDraft, nom: v })} />
            <TextField label="Email" value={contactDraft.email ?? ""} onChange={(v) => setContactDraft({ ...contactDraft, email: v })} />
            <TextField label="Téléphone" value={contactDraft.telephone ?? ""} onChange={(v) => setContactDraft({ ...contactDraft, telephone: v })} />
            <div className="col-span-2">
              <p className="text-xs uppercase tracking-wider text-pro-muted mb-1">Rôle</p>
              <select
                value={contactDraft.role ?? "principal"}
                onChange={(e) => setContactDraft({ ...contactDraft, role: e.target.value })}
                className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm"
              >
                <option value="principal">Contact principal</option>
                <option value="secondaire">Contact secondaire</option>
              </select>
            </div>
          </div>
          <button onClick={saveContact} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#2f5fff] px-4 py-2 text-sm font-semibold text-white">
            <Save size={14} /> Enregistrer
          </button>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, span }: { label: string; value: string; onChange: (v: string) => void; span?: boolean }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <p className="text-xs uppercase tracking-wider text-pro-muted mb-1">{label}</p>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm" />
    </div>
  );
}

export default OrgSitesTab;
