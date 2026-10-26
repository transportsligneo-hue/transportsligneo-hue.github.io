import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Overlay, DevisBlock } from "./RemarketingUI";
import { MOTIFS, rdb, logEvent, saving, eur, type Dossier } from "@/lib/remarketing";

const err = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Erreur");

export function NewDossierModal({ open, onClose, organizationId, orgs, onDone, admin }: {
  open: boolean; onClose: () => void; organizationId?: string | null; orgs?: Array<{ id: string; label: string }>; onDone: () => void; admin?: boolean;
}) {
  const [f, setF] = useState({ immatriculation: "", modele: "", motif: "fin_leasing", adresse: "", date: "", contact: "", remarques: "", org: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((o) => ({ ...o, [k]: v }));
  const submit = async () => {
    const org = admin ? f.org : organizationId;
    if (!org) { toast.error(admin ? "Choisis le client." : "Société introuvable."); return; }
    if (!f.immatriculation.trim() || !f.modele.trim()) { toast.error("Plaque et modèle sont obligatoires."); return; }
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await rdb.from("remarketing_dossiers").insert({
        organization_id: org, immatriculation: f.immatriculation.trim().toUpperCase(), modele: f.modele.trim(), motif: f.motif,
        adresse_enlevement: f.adresse || null, date_enlevement: f.date || null, contact_site: f.contact || null, remarques: f.remarques || null,
        created_by: auth.user?.id ?? null,
      }).select("id, ref").single();
      if (error) throw error;
      await logEvent(data.id, "Dossier ouvert", { acteur: admin ? "Admin" : "Client", kind: "dossier" });
      toast.success(`Dossier ${data.ref} créé`);
      setF({ immatriculation: "", modele: "", motif: "fin_leasing", adresse: "", date: "", contact: "", remarques: "", org: "" });
      onDone(); onClose();
    } catch (e) { toast.error("Création impossible", { description: err(e) }); } finally { setBusy(false); }
  };
  return (
    <Overlay open={open} onClose={onClose} kind="modal">
      <h2>{admin ? "Nouveau dossier Remarketing" : "Confier un véhicule"}</h2>
      <p className="sub">Fin de leasing, nouveau collaborateur ou remise en vente : nous venons le chercher.</p>
      <div className="f">
        {admin && (
          <div><label>Client</label>
            <select value={f.org} onChange={(e) => set("org", e.target.value)}><option value="">— Choisir —</option>{orgs?.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
        )}
        <div className="r2">
          <div><label>Plaque</label><input value={f.immatriculation} onChange={(e) => set("immatriculation", e.target.value)} placeholder="AB-123-CD" /></div>
          <div><label>Modèle</label><input value={f.modele} onChange={(e) => set("modele", e.target.value)} placeholder="Peugeot 308" /></div>
        </div>
        <div><label>Motif</label>
          <select value={f.motif} onChange={(e) => set("motif", e.target.value)}>{Object.entries(MOTIFS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label>Adresse d'enlèvement</label><input value={f.adresse} onChange={(e) => set("adresse", e.target.value)} placeholder="Adresse du véhicule" /></div>
        <div className="r2">
          <div><label>Date d'enlèvement</label><input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></div>
          <div><label>Contact sur place</label><input value={f.contact} onChange={(e) => set("contact", e.target.value)} placeholder="Nom · téléphone" /></div>
        </div>
        <div><label>Remarques (dégâts connus…)</label><textarea value={f.remarques} onChange={(e) => set("remarques", e.target.value)} /></div>
      </div>
      <div className="act"><button type="button" className="btn o s" onClick={onClose}>Annuler</button><button type="button" className="btn" disabled={busy} onClick={() => void submit()}>{busy ? "Création…" : "Créer le dossier"}</button></div>
    </Overlay>
  );
}

export function DevisModal({ d, onClose, onDone }: { d: Dossier | null; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const run = async (fn: "remarketing_valider_devis" | "remarketing_refuser_devis", ok: string) => {
    if (!d) return;
    setBusy(true);
    const { error } = await rdb.rpc(fn, { p_id: d.id });
    setBusy(false);
    if (error) { toast.error("Action impossible", { description: err(error) }); return; }
    toast.success(ok); onDone(); onClose();
  };
  return (
    <Overlay open={!!d} onClose={onClose} kind="modal">
      {d && (
        <>
          <h2>Devis · {d.modele}</h2>
          <p className="sub">{d.immatriculation} · {MOTIFS[d.motif] ?? d.motif}. Aucune intervention ne démarre avant votre accord.</p>
          <DevisBlock d={d} />
          <div className="act">
            <button type="button" className="btn r s" disabled={busy} onClick={() => void run("remarketing_refuser_devis", "Devis refusé · un conseiller vous rappelle")}>Refuser</button>
            <button type="button" className="btn g" disabled={busy} onClick={() => void run("remarketing_valider_devis", `Devis validé · vous économisez ${eur(saving(d))}`)}>Valider le devis</button>
          </div>
        </>
      )}
    </Overlay>
  );
}

export function LivraisonModal({ d, onClose, onDone, tarif }: { d: Dossier | null; onClose: () => void; onDone: () => void; tarif: string }) {
  const [f, setF] = useState({ collaborateur: "", telephone: "", adresse: "", date: "", creneau: "Matin" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((o) => ({ ...o, [k]: v }));
  const submit = async () => {
    if (!d) return;
    if (!f.collaborateur.trim() || !f.adresse.trim()) { toast.error("Indique le collaborateur et l'adresse de livraison."); return; }
    setBusy(true);
    const { error } = await rdb.rpc("remarketing_demander_livraison", { p_id: d.id, p_payload: { ...f, tarif } });
    setBusy(false);
    if (error) { toast.error("Demande impossible", { description: err(error) }); return; }
    toast.success("Livraison demandée"); onDone(); onClose();
  };
  return (
    <Overlay open={!!d} onClose={onClose} kind="modal">
      {d && (
        <>
          <h2>Livrer à un collaborateur</h2>
          <p className="sub">{d.modele} · {d.immatriculation}. Service sur demande : le tarif est affiché avant confirmation.</p>
          <div className="f">
            <div className="r2">
              <div><label>Collaborateur</label><input value={f.collaborateur} onChange={(e) => set("collaborateur", e.target.value)} placeholder="Nom et prénom" /></div>
              <div><label>Téléphone</label><input value={f.telephone} onChange={(e) => set("telephone", e.target.value)} placeholder="06 00 00 00 00" /></div>
            </div>
            <div><label>Adresse de livraison</label><input value={f.adresse} onChange={(e) => set("adresse", e.target.value)} placeholder="Adresse complète" /></div>
            <div className="r2">
              <div><label>Date souhaitée</label><input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></div>
              <div><label>Créneau</label><select value={f.creneau} onChange={(e) => set("creneau", e.target.value)}><option>Matin</option><option>Après-midi</option></select></div>
            </div>
          </div>
          <div className="sav" style={{ background: "var(--accbg)", color: "var(--acc)" }}><span>Tarif de la livraison</span><span>à partir de {tarif}</span></div>
          <div className="act"><button type="button" className="btn o s" onClick={onClose}>Annuler</button><button type="button" className="btn g" disabled={busy} onClick={() => void submit()}>{busy ? "Envoi…" : "Confirmer la demande"}</button></div>
        </>
      )}
    </Overlay>
  );
}
