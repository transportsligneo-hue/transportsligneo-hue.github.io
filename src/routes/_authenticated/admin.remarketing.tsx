/** Admin · Ligneo Remarketing : dossiers, planning, prestataires, parcs, économies, facturation, alertes, journal, réglages. */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_SETTINGS, MOTIFS, SHORT, STEPS, dateFr, dateTimeFr, devisEnAttente, downloadDoc, eur, isDone, logEvent, rdb, saving,
  type Dossier, type DevisLigne, type Parc, type Prestataire, type RmkEvent, type RmkSettings,
} from "@/lib/remarketing";
import { DevisBlock, Hero, Ico, Kpi, Overlay, Prog, StatusPill, Tabs, Timeline, VehicleTile } from "@/components/remarketing/RemarketingUI";
import { NewDossierModal } from "@/components/remarketing/RemarketingModals";

export const Route = createFileRoute("/_authenticated/admin/remarketing")({ component: AdminRemarketing });

type Tab = "dos" | "plan" | "pre" | "parc" | "eco" | "fac" | "ale" | "jou" | "set";
const errMsg = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Erreur");
const orgName = (d: Dossier) => d.organizations?.commercial_name || d.organizations?.legal_name || "—";

function AdminRemarketing() {
  const [tab, setTab] = useState<Tab>("dos");
  const [rows, setRows] = useState<Dossier[]>([]);
  const [pres, setPres] = useState<Prestataire[]>([]);
  const [parcs, setParcs] = useState<Parc[]>([]);
  const [events, setEvents] = useState<RmkEvent[]>([]);
  const [orgs, setOrgs] = useState<Array<{ id: string; label: string }>>([]);
  const [settings, setSettings] = useState<RmkSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(""); const [fMotif, setFMotif] = useState(""); const [fEtape, setFEtape] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [sel, setSel] = useState<Dossier | null>(null);

  const load = useCallback(async () => {
    const [d, p, pa, ev, og, st] = await Promise.all([
      rdb.from("remarketing_dossiers").select("*, organizations(legal_name, commercial_name)").order("created_at", { ascending: false }),
      rdb.from("remarketing_prestataires").select("*").order("nom"),
      rdb.from("remarketing_parcs").select("*").order("nom"),
      rdb.from("remarketing_events").select("*, remarketing_dossiers(ref, modele, immatriculation)").order("created_at", { ascending: false }).limit(200),
      supabase.from("organizations").select("id, legal_name, commercial_name").order("legal_name"),
      supabase.from("app_settings").select("value").eq("key", "remarketing_settings").maybeSingle(),
    ]);
    const list = (d.data ?? []) as Dossier[];
    setRows(list); setPres((p.data ?? []) as Prestataire[]); setParcs((pa.data ?? []) as Parc[]); setEvents((ev.data ?? []) as RmkEvent[]);
    setOrgs(((og.data ?? []) as Array<{ id: string; legal_name: string; commercial_name: string | null }>).map((o) => ({ id: o.id, label: o.commercial_name || o.legal_name })));
    if (st.data?.value) setSettings({ ...DEFAULT_SETTINGS, ...(st.data.value as object) });
    setSel((s) => (s ? list.find((x) => x.id === s.id) ?? null : s));
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const active = rows.filter((d) => d.statut === "en_cours");
  const waiting = rows.filter(devisEnAttente);
  const inParc = rows.filter((d) => d.etape === 7 && d.statut === "en_cours");
  const validated = rows.filter((d) => d.devis_statut === "valide");
  const totalSaved = validated.reduce((x, d) => x + saving(d), 0);
  const delivered = rows.filter((d) => d.livre_le);
  const avgDays = delivered.length ? Math.round(delivered.reduce((x, d) => x + (new Date(d.livre_le!).getTime() - new Date(d.created_at).getTime()) / 864e5, 0) / delivered.length) : null;

  const filtered = useMemo(() => rows.filter((d) => {
    const s = q.trim().toLowerCase();
    if (s && !`${d.ref} ${d.modele} ${d.immatriculation} ${orgName(d)}`.toLowerCase().includes(s)) return false;
    if (fMotif && d.motif !== fMotif) return false;
    if (fEtape && String(d.etape) !== fEtape) return false;
    return true;
  }), [rows, q, fMotif, fEtape]);

  const parcFill = (p: Parc) => Math.round((p.occupees / Math.max(1, p.capacite)) * 100);
  const alerts = [
    ...waiting.filter((d) => Date.now() - new Date(d.updated_at).getTime() > settings.delai_relance_h * 36e5).map((d) => ({ k: `d${d.id}`, text: `Devis sans réponse depuis plus de ${settings.delai_relance_h} h : ${d.modele} (${orgName(d)})`, d })),
    ...parcs.filter((p) => parcFill(p) > 85).map((p) => ({ k: `p${p.id}`, text: `Parc ${p.nom} presque plein (${parcFill(p)} %)`, d: null as Dossier | null })),
    ...active.filter((d) => d.etape === 1).map((d) => ({ k: `e${d.id}`, text: `À prendre en charge : ${d.modele} ${d.immatriculation} (${orgName(d)})`, d })),
  ];

  const act = async (fn: () => Promise<void>, ok?: string) => {
    try { await fn(); if (ok) toast.success(ok); await load(); } catch (e) { toast.error("Action impossible", { description: errMsg(e) }); }
  };
  const patch = async (d: Dossier, p: Record<string, unknown>, log?: string) => {
    const { error } = await rdb.from("remarketing_dossiers").update(p).eq("id", d.id);
    if (error) throw error;
    if (log) await logEvent(d.id, log);
  };
  const advance = (d: Dossier) => act(async () => {
    if (devisEnAttente(d)) throw new Error("Le devis attend la validation du client.");
    if (d.etape === 3 && !d.devis_statut && settings.devis_obligatoire) throw new Error("Envoie d'abord le devis au client.");
    if (d.etape >= 8) { await patch(d, { statut: "livre", livre_le: new Date().toISOString() }, "Véhicule livré"); return; }
    await patch(d, { etape: d.etape + 1 }, `Étape ${d.etape + 1} : ${STEPS[d.etape]}`);
  }, "Dossier mis à jour");

  const exportCsv = () => {
    const head = ["Réf", "Client", "Plaque", "Modèle", "Motif", "Étape", "Statut", "Devis Ligneo", "Économie"];
    const lines = rows.map((d) => [d.ref, orgName(d), d.immatriculation, d.modele, MOTIFS[d.motif] ?? d.motif, SHORT[d.etape - 1], d.statut, d.devis_ligneo ?? "", saving(d)].join(";"));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + [head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = "remarketing.csv"; a.click();
  };

  if (loading) return <div className="rmkx"><div className="card" style={{ textAlign: "center" }}><Loader2 className="animate-spin" style={{ display: "inline" }} /></div></div>;

  return (
    <div className="rmkx" style={{ display: "grid", gap: 14 }}>
      <Hero title="Pilotez tout le" accent="Remarketing" text="Dossiers, devis, prestataires, parcs et facturation au même endroit.">
        <button type="button" className="btn o" onClick={exportCsv}><Ico.Download />Exporter</button>
        <button type="button" className="btn" onClick={() => setOpenNew(true)}><Ico.Plus />Nouveau dossier</button>
      </Hero>

      <div className="kpis" style={{ margin: 0 }}>
        <Kpi icon={<Ico.Folder />} label="Dossiers en cours" value={active.length} sub={`${rows.length} au total`} />
        <Kpi icon={<Ico.FileText />} label="Devis en attente" value={waiting.length} sub="validation client" tone="warn" />
        <Kpi icon={<Ico.ParkingSquare />} label="Véhicules en parc" value={inParc.length} sub={`${parcs.reduce((x, p) => x + p.occupees, 0)} places occupées`} />
        <Kpi icon={<Ico.Euro />} label="Économies clients" value={eur(totalSaved)} sub={`${validated.length} devis validés`} tone="ok" />
        <Kpi icon={<Ico.Clock />} label="Délai moyen" value={avgDays != null ? `${avgDays} j` : "—"} sub="confié → livré" />
      </div>

      <Tabs<Tab> value={tab} onChange={setTab} items={[["dos", "Dossiers", active.length], ["plan", "Planning"], ["pre", "Prestataires"], ["parc", "Parcs"], ["eco", "Économies"], ["fac", "Facturation"], ["ale", "Alertes", alerts.length], ["jou", "Journal"], ["set", "Réglages"]]} />

      {tab === "dos" && (
        <>
          <div className="pipe">
            {STEPS.map((s, i) => (
              <button type="button" key={s} className={fEtape === String(i + 1) ? "on" : ""} onClick={() => setFEtape(fEtape === String(i + 1) ? "" : String(i + 1))}>
                <b>{active.filter((d) => d.etape === i + 1).length}</b><span>{SHORT[i]}</span>
              </button>
            ))}
          </div>
          <div className="card">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <input placeholder="Rechercher plaque, modèle, client…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
              <select value={fMotif} onChange={(e) => setFMotif(e.target.value)}><option value="">Tous les motifs</option>{Object.entries(MOTIFS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <select value={fEtape} onChange={(e) => setFEtape(e.target.value)}><option value="">Toutes les étapes</option>{STEPS.map((s, i) => <option key={s} value={i + 1}>{i + 1}. {s}</option>)}</select>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead><tr><th>Véhicule</th><th>Client</th><th>Motif</th><th>Avancement</th><th>Statut</th></tr></thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id} onClick={() => setSel(d)} style={{ cursor: "pointer" }}>
                      <td><div style={{ display: "flex", gap: 10, alignItems: "center" }}><VehicleTile /><div><b>{d.modele}</b><br /><small style={{ color: "var(--ink3)" }}>{d.immatriculation} · {d.ref}</small></div></div></td>
                      <td>{orgName(d)}</td><td>{MOTIFS[d.motif] ?? d.motif}</td><td style={{ minWidth: 150 }}><Prog d={d} /><small style={{ color: "var(--ink3)" }}>{SHORT[d.etape - 1]}</small></td><td><StatusPill d={d} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <p style={{ color: "var(--ink3)", padding: 12 }}>Aucun dossier.</p>}
            </div>
          </div>
        </>
      )}

      {tab === "plan" && <PlanningTab events={events} rows={rows} onChange={load} />}
      {tab === "pre" && <PrestatairesTab list={pres} onChange={load} />}
      {tab === "parc" && <ParcsTab list={parcs} onChange={load} fill={parcFill} />}

      {tab === "eco" && (
        <div className="two">
          <div className="card"><h3>Économies par dossier</h3>
            {validated.length === 0 && <p style={{ color: "var(--ink3)" }}>Aucun devis validé pour le moment.</p>}
            {validated.map((d) => (
              <div key={d.id} className="ln"><span><b>{d.modele}</b> · {orgName(d)}</span><span style={{ color: "var(--ok)" }}>− {eur(saving(d))}</span></div>
            ))}
          </div>
          <div className="card"><h3>Synthèse</h3>
            <div className="cmp"><div><small>Classique</small><b>{eur(validated.reduce((x, d) => x + Number(d.devis_classique ?? 0), 0))}</b></div><div className="l"><small>Via Ligneo</small><b>{eur(validated.reduce((x, d) => x + Number(d.devis_ligneo ?? 0), 0))}</b></div></div>
            <div className="sav"><span>Économies totales</span><span>{eur(totalSaved)}</span></div>
          </div>
        </div>
      )}

      {tab === "fac" && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Dossier</th><th>Client</th><th>Montant</th><th>Facture</th><th /></tr></thead>
            <tbody>
              {rows.filter((d) => d.devis_statut === "valide").map((d) => (
                <tr key={d.id}>
                  <td><b>{d.ref}</b><br /><small style={{ color: "var(--ink3)" }}>{d.modele}</small></td><td>{orgName(d)}</td><td>{eur(d.devis_ligneo)}</td>
                  <td>{d.facture_ref ? <>{d.facture_ref} <span className={`pill ${d.facture_statut === "payee" ? "k" : "w"}`}>{d.facture_statut === "payee" ? "Payée" : "À régler"}</span></> : <span style={{ color: "var(--ink3)" }}>Non émise</span>}</td>
                  <td style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    {!d.facture_ref && <button type="button" className="btn s" onClick={() => void act(() => patch(d, { facture_ref: `FAC-${d.ref}`, facture_statut: "a_regler" }, `Facture FAC-${d.ref} émise`), "Facture émise")}>Émettre</button>}
                    {d.facture_ref && d.facture_statut !== "payee" && <button type="button" className="btn g s" onClick={() => void act(() => patch(d, { facture_statut: "payee" }, "Facture payée"), "Facture payée")}>Marquer payée</button>}
                    {d.facture_ref && <button type="button" className="btn o s" onClick={() => downloadDoc(d, "facture")}><Ico.Download />PDF</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.some((d) => d.devis_statut === "valide") && <p style={{ color: "var(--ink3)", padding: 12 }}>Aucun devis validé à facturer.</p>}
        </div>
      )}

      {tab === "ale" && (
        <div style={{ display: "grid", gap: 10 }}>
          {alerts.length === 0 && <div className="card" style={{ textAlign: "center", color: "var(--ink3)" }}>Aucune alerte. Tout est à jour.</div>}
          {alerts.map((a) => (
            <div className="al" key={a.k}><span>{a.text}</span>{a.d && <button type="button" className="btn s" onClick={() => setSel(a.d)}>Ouvrir</button>}</div>
          ))}
        </div>
      )}

      {tab === "jou" && (
        <div className="card">
          {events.length === 0 && <p style={{ color: "var(--ink3)" }}>Le journal est vide.</p>}
          {events.map((e) => (
            <div className="mini" key={e.id}><span className="pill n">{dateTimeFr(e.created_at)}</span>
              <div><b>{e.message}</b><small>{e.remarketing_dossiers ? `${e.remarketing_dossiers.ref} · ${e.remarketing_dossiers.modele} · ` : ""}{e.acteur}</small></div></div>
          ))}
        </div>
      )}

      {tab === "set" && <SettingsTab value={settings} onSaved={(s) => setSettings(s)} />}

      <NewDossierModal admin open={openNew} onClose={() => setOpenNew(false)} orgs={orgs} onDone={() => void load()} />

      <Overlay open={!!sel} onClose={() => setSel(null)} kind="drawer">
        {sel && <DossierDrawer d={sel} pres={pres} parcs={parcs} events={events.filter((e) => e.dossier_id === sel.id)} settings={settings} onClose={() => setSel(null)} act={act} patch={patch} advance={advance} />}
      </Overlay>
    </div>
  );
}

function DossierDrawer({ d, pres, parcs, events, settings, onClose, act, patch, advance }: {
  d: Dossier; pres: Prestataire[]; parcs: Parc[]; events: RmkEvent[]; settings: RmkSettings; onClose: () => void;
  act: (fn: () => Promise<void>, ok?: string) => Promise<void>; patch: (d: Dossier, p: Record<string, unknown>, log?: string) => Promise<void>; advance: (d: Dossier) => Promise<void>;
}) {
  const [lignes, setLignes] = useState<DevisLigne[]>(d.devis_lignes?.length ? d.devis_lignes : d.dommages.map((x) => ({ label: x, montant: 0 })));
  const [classique, setClassique] = useState(String(d.devis_classique ?? ""));
  const [notes, setNotes] = useState(d.notes_internes ?? "");
  const total = lignes.reduce((x, l) => x + Number(l.montant || 0), 0);
  const canQuote = d.etape === 3 && d.statut === "en_cours" && (!d.devis_statut || d.devis_statut === "refuse");
  const sendQuote = () => act(async () => {
    if (!lignes.length || total <= 0) throw new Error("Ajoute au moins une ligne chiffrée.");
    if (!Number(classique)) throw new Error("Indique le prix de remise en état classique.");
    await patch(d, { devis_lignes: lignes, devis_ligneo: total, devis_classique: Number(classique), devis_statut: "en_attente" }, "Devis envoyé au client");
  }, "Devis envoyé au client");
  const validateFor = () => act(async () => {
    const { error } = await rdb.rpc("remarketing_valider_devis", { p_id: d.id });
    if (error) throw error;
    await logEvent(d.id, "Devis validé par l'admin pour le client", { kind: "devis" });
  }, "Devis validé");
  const last = d.etape >= 8;

  return (
    <>
      <div className="h"><span className="vt" style={{ background: "rgba(255,255,255,.2)", color: "#fff", margin: 0 }}><Ico.Car /></span><h2>{d.ref} · {d.modele}</h2><StatusPill d={d} /><button type="button" className="x" onClick={onClose}>×</button></div>
      <div className="b">
        <div className="card"><div className="kv">
          <div><small>Client</small><b>{orgName(d)}</b></div><div><small>Plaque</small><b>{d.immatriculation}</b></div>
          <div><small>Motif</small><b>{MOTIFS[d.motif] ?? d.motif}</b></div><div><small>Enlèvement</small><b>{d.adresse_enlevement || "—"}{d.date_enlevement ? ` · ${dateFr(d.date_enlevement)}` : ""}</b></div>
          <div><small>Contact</small><b>{d.contact_site || "—"}</b></div><div><small>Remarques</small><b>{d.remarques || "—"}</b></div>
        </div></div>

        <div className="card"><h3>Avancement</h3>
          <Timeline d={d} sub={(i) => (i === 3 && settings.trajets_charge_ligneo ? "Trajets à notre charge" : i + 1 === d.etape ? "Étape en cours" : "")} />
          {d.statut === "en_cours" && <div className="act"><button type="button" className="btn" onClick={() => void advance(d)}>{last ? "Marquer comme livré" : `Passer à : ${STEPS[d.etape]}`}</button></div>}
        </div>

        {canQuote && (
          <div className="card"><h3>Devis</h3>
            <div className="f">
              {lignes.map((l, i) => (
                <div className="r2" key={i}>
                  <input value={l.label} placeholder="Intervention" onChange={(e) => setLignes(lignes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <input type="number" value={l.montant || ""} placeholder="Montant €" onChange={(e) => setLignes(lignes.map((x, j) => (j === i ? { ...x, montant: Number(e.target.value) } : x)))} />
                </div>
              ))}
              <button type="button" className="btn o s" onClick={() => setLignes([...lignes, { label: "", montant: 0 }])}>+ Ajouter une ligne</button>
              <div><label>Remise en état classique (€)</label><input type="number" value={classique} onChange={(e) => setClassique(e.target.value)} /></div>
              <div className="ln"><span>Total via Ligneo</span><b>{eur(total)}</b></div>
            </div>
            <div className="act"><button type="button" className="btn" onClick={() => void sendQuote()}>Envoyer au client</button></div>
          </div>
        )}
        <DevisBlock d={d} actions={devisEnAttente(d) ? <div className="act"><button type="button" className="btn g s" onClick={() => void validateFor()}>Valider pour le client</button></div> : undefined} />

        <div className="card"><h3>Affectation</h3>
          <div className="f">
            <div><label>Prestataire</label>
              <select value={d.prestataire_id ?? ""} onChange={(e) => void act(() => patch(d, { prestataire_id: e.target.value || null }, "Prestataire affecté"))}><option value="">— Aucun —</option>{pres.filter((p) => p.actif).map((p) => <option key={p.id} value={p.id}>{p.nom}{p.ville ? ` · ${p.ville}` : ""}</option>)}</select></div>
            <div><label>Parc partenaire</label>
              <select value={d.parc_id ?? ""} onChange={(e) => void act(() => patch(d, { parc_id: e.target.value || null }, "Parc affecté"))}><option value="">— Aucun —</option>{parcs.filter((p) => p.actif).map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.occupees}/{p.capacite})</option>)}</select></div>
          </div>
        </div>

        {d.livraison && <div className="card"><h3>Livraison demandée</h3><div className="kv">{Object.entries(d.livraison).map(([k, v]) => <div key={k}><small>{k}</small><b>{String(v)}</b></div>)}</div></div>}

        <div className="card"><h3>Notes internes</h3>
          <div className="f"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Visible uniquement par l'équipe" /></div>
          <div className="act"><button type="button" className="btn o s" onClick={() => void act(() => patch(d, { notes_internes: notes || null }), "Note enregistrée")}>Enregistrer</button></div>
        </div>

        <div className="card"><h3>Historique</h3>
          {events.length === 0 && <p style={{ color: "var(--ink3)" }}>Aucun évènement.</p>}
          {events.map((e) => <div className="mini" key={e.id}><span className="pill n">{dateFr(e.created_at)}</span><div><b>{e.message}</b><small>{e.acteur}</small></div></div>)}
        </div>
        {d.statut === "en_cours" && <div className="act"><button type="button" className="btn r s" onClick={() => { if (confirm("Annuler ce dossier ?")) void act(() => patch(d, { statut: "annule" }, "Dossier annulé"), "Dossier annulé"); }}>Annuler le dossier</button></div>}
      </div>
    </>
  );
}

function PlanningTab({ events, rows, onChange }: { events: RmkEvent[]; rows: Dossier[]; onChange: () => Promise<void> }) {
  const [f, setF] = useState({ dossier: "", date: "", lieu: "", message: "" });
  const planned = events.filter((e) => e.planifie_le).sort((a, b) => +new Date(a.planifie_le!) - +new Date(b.planifie_le!));
  const add = async () => {
    if (!f.date || !f.message.trim()) { toast.error("Date et intitulé obligatoires."); return; }
    try { await logEvent(f.dossier || null, f.message.trim(), { kind: "planning", planifie_le: new Date(f.date).toISOString(), lieu: f.lieu || null }); setF({ dossier: "", date: "", lieu: "", message: "" }); toast.success("Ajouté au planning"); await onChange(); }
    catch (e) { toast.error("Échec", { description: errMsg(e) }); }
  };
  return (
    <div className="two">
      <div className="card"><h3>À venir</h3>
        {planned.length === 0 && <p style={{ color: "var(--ink3)" }}>Rien de planifié.</p>}
        {planned.map((e) => <div className="mini" key={e.id}><span className="pill b">{dateTimeFr(e.planifie_le)}</span><div><b>{e.message}</b><small>{e.remarketing_dossiers ? `${e.remarketing_dossiers.modele} · ` : ""}{e.lieu ?? ""}</small></div></div>)}
      </div>
      <div className="card"><h3>Planifier</h3>
        <div className="f">
          <div><label>Dossier</label><select value={f.dossier} onChange={(e) => setF({ ...f, dossier: e.target.value })}><option value="">— Général —</option>{rows.filter((d) => d.statut === "en_cours").map((d) => <option key={d.id} value={d.id}>{d.ref} · {d.modele}</option>)}</select></div>
          <div><label>Intitulé</label><input value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Enlèvement, livraison…" /></div>
          <div className="r2"><div><label>Date et heure</label><input type="datetime-local" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div><div><label>Lieu</label><input value={f.lieu} onChange={(e) => setF({ ...f, lieu: e.target.value })} /></div></div>
        </div>
        <div className="act"><button type="button" className="btn" onClick={() => void add()}>Ajouter</button></div>
      </div>
    </div>
  );
}

function PrestatairesTab({ list, onChange }: { list: Prestataire[]; onChange: () => Promise<void> }) {
  const empty = { nom: "", specialite: "", ville: "", delai_moyen_jours: "", contact_email: "", contact_tel: "" };
  const [f, setF] = useState(empty); const [open, setOpen] = useState(false);
  const save = async () => {
    if (!f.nom.trim()) { toast.error("Nom obligatoire."); return; }
    const { error } = await rdb.from("remarketing_prestataires").insert({ nom: f.nom.trim(), specialite: f.specialite || null, ville: f.ville || null, delai_moyen_jours: f.delai_moyen_jours ? Number(f.delai_moyen_jours) : null, contact_email: f.contact_email || null, contact_tel: f.contact_tel || null });
    if (error) { toast.error("Échec", { description: errMsg(error) }); return; }
    toast.success("Prestataire ajouté"); setF(empty); setOpen(false); await onChange();
  };
  const toggle = async (p: Prestataire) => { await rdb.from("remarketing_prestataires").update({ actif: !p.actif }).eq("id", p.id); await onChange(); };
  const del = async (p: Prestataire) => { if (!confirm(`Supprimer ${p.nom} ?`)) return; const { error } = await rdb.from("remarketing_prestataires").delete().eq("id", p.id); if (error) toast.error("Suppression impossible", { description: errMsg(error) }); await onChange(); };
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="btn s" onClick={() => setOpen(true)}><Ico.Plus />Ajouter un prestataire</button></div>
      <div className="grid">
        {list.map((p) => (
          <div className="card" key={p.id} style={{ opacity: p.actif ? 1 : 0.55 }}>
            <h3>{p.nom} {!p.actif && <span className="pill n">Inactif</span>}</h3>
            <div className="kv"><div><small>Spécialité</small><b>{p.specialite || "—"}</b></div><div><small>Ville</small><b>{p.ville || "—"}</b></div><div><small>Délai moyen</small><b>{p.delai_moyen_jours ? `${p.delai_moyen_jours} j` : "—"}</b></div><div><small>Contact</small><b>{p.contact_tel || p.contact_email || "—"}</b></div></div>
            <div className="act"><button type="button" className="btn o s" onClick={() => void toggle(p)}>{p.actif ? "Désactiver" : "Activer"}</button><button type="button" className="btn r s" onClick={() => void del(p)}>Supprimer</button></div>
          </div>
        ))}
        {list.length === 0 && <div className="card" style={{ color: "var(--ink3)" }}>Aucun prestataire.</div>}
      </div>
      <Overlay open={open} onClose={() => setOpen(false)} kind="modal">
        <h2>Nouveau prestataire</h2>
        <div className="f">
          <div><label>Nom</label><input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></div>
          <div className="r2"><div><label>Spécialité</label><input value={f.specialite} onChange={(e) => setF({ ...f, specialite: e.target.value })} placeholder="Carrosserie…" /></div><div><label>Ville</label><input value={f.ville} onChange={(e) => setF({ ...f, ville: e.target.value })} /></div></div>
          <div className="r2"><div><label>Délai moyen (jours)</label><input type="number" value={f.delai_moyen_jours} onChange={(e) => setF({ ...f, delai_moyen_jours: e.target.value })} /></div><div><label>Téléphone</label><input value={f.contact_tel} onChange={(e) => setF({ ...f, contact_tel: e.target.value })} /></div></div>
          <div><label>E-mail</label><input value={f.contact_email} onChange={(e) => setF({ ...f, contact_email: e.target.value })} /></div>
        </div>
        <div className="act"><button type="button" className="btn o s" onClick={() => setOpen(false)}>Annuler</button><button type="button" className="btn" onClick={() => void save()}>Enregistrer</button></div>
      </Overlay>
    </>
  );
}

function ParcsTab({ list, onChange, fill }: { list: Parc[]; onChange: () => Promise<void>; fill: (p: Parc) => number }) {
  const empty = { nom: "", ville: "", capacite: "20", cameras: true };
  const [f, setF] = useState(empty); const [open, setOpen] = useState(false);
  const save = async () => {
    if (!f.nom.trim()) { toast.error("Nom obligatoire."); return; }
    const { error } = await rdb.from("remarketing_parcs").insert({ nom: f.nom.trim(), ville: f.ville || null, capacite: Number(f.capacite) || 1, cameras: f.cameras });
    if (error) { toast.error("Échec", { description: errMsg(error) }); return; }
    toast.success("Parc ajouté"); setF(empty); setOpen(false); await onChange();
  };
  const setOcc = async (p: Parc, n: number) => { await rdb.from("remarketing_parcs").update({ occupees: Math.min(p.capacite, Math.max(0, n)) }).eq("id", p.id); await onChange(); };
  const del = async (p: Parc) => { if (!confirm(`Supprimer ${p.nom} ?`)) return; const { error } = await rdb.from("remarketing_parcs").delete().eq("id", p.id); if (error) toast.error("Suppression impossible", { description: errMsg(error) }); await onChange(); };
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="btn s" onClick={() => setOpen(true)}><Ico.Plus />Ajouter un parc</button></div>
      <div className="grid">
        {list.map((p) => (
          <div className="card" key={p.id}>
            <h3>{p.nom} {p.cameras && <span className="pill k">Caméras</span>}</h3>
            <small style={{ color: "var(--ink3)" }}>{p.ville || "—"}</small>
            <div className="gauge" style={{ margin: "12px 0 6px" }}><span style={{ width: `${fill(p)}%`, background: fill(p) > 85 ? "var(--warn)" : undefined }} /></div>
            <div className="ln" style={{ border: 0, padding: 0 }}><span>{p.occupees} / {p.capacite} places</span><b>{fill(p)} %</b></div>
            <div className="act"><button type="button" className="btn o s" onClick={() => void setOcc(p, p.occupees - 1)}>−</button><button type="button" className="btn o s" onClick={() => void setOcc(p, p.occupees + 1)}>+</button><button type="button" className="btn r s" onClick={() => void del(p)}>Supprimer</button></div>
          </div>
        ))}
        {list.length === 0 && <div className="card" style={{ color: "var(--ink3)" }}>Aucun parc.</div>}
      </div>
      <Overlay open={open} onClose={() => setOpen(false)} kind="modal">
        <h2>Nouveau parc partenaire</h2>
        <div className="f">
          <div><label>Nom</label><input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></div>
          <div className="r2"><div><label>Ville</label><input value={f.ville} onChange={(e) => setF({ ...f, ville: e.target.value })} /></div><div><label>Capacité</label><input type="number" value={f.capacite} onChange={(e) => setF({ ...f, capacite: e.target.value })} /></div></div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={f.cameras} onChange={(e) => setF({ ...f, cameras: e.target.checked })} />Vidéosurveillance</label>
        </div>
        <div className="act"><button type="button" className="btn o s" onClick={() => setOpen(false)}>Annuler</button><button type="button" className="btn" onClick={() => void save()}>Enregistrer</button></div>
      </Overlay>
    </>
  );
}

function SettingsTab({ value, onSaved }: { value: RmkSettings; onSaved: (s: RmkSettings) => void }) {
  const [s, setS] = useState(value);
  useEffect(() => setS(value), [value]);
  const save = async () => {
    const { error } = await supabase.from("app_settings").upsert({ key: "remarketing_settings", value: s } as never, { onConflict: "key" });
    if (error) { toast.error("Enregistrement impossible", { description: errMsg(error) }); return; }
    onSaved(s); toast.success("Réglages enregistrés");
  };
  const sw = (k: keyof RmkSettings, label: string, hint: string) => (
    <div className="set"><div><b>{label}</b><small>{hint}</small></div>
      <button type="button" className={`sw${s[k] ? " on" : ""}`} aria-pressed={!!s[k]} onClick={() => setS({ ...s, [k]: !s[k] })}><i /></button></div>
  );
  return (
    <div className="card">
      {sw("trajets_charge_ligneo", "Trajets à la charge de Ligneo", "Affiché au client sur les devis et le suivi.")}
      {sw("devis_obligatoire", "Devis obligatoire avant réparations", "Bloque l'étape tant que le devis n'est pas envoyé.")}
      {sw("livraison_sur_demande", "Livraison sur demande", "Le client peut demander une livraison depuis son espace.")}
      {sw("relance_devis", "Relance automatique des devis", "Alerte l'équipe quand un devis reste sans réponse.")}
      {sw("notif_etapes", "Notifier le client à chaque étape", "Message envoyé à chaque changement d'étape.")}
      <div className="f" style={{ marginTop: 14 }}>
        <div className="r2"><div><label>Tarif de livraison</label><input value={s.tarif_livraison} onChange={(e) => setS({ ...s, tarif_livraison: e.target.value })} /></div>
          <div><label>Délai de relance (heures)</label><input type="number" value={s.delai_relance_h} onChange={(e) => setS({ ...s, delai_relance_h: Number(e.target.value) || 48 })} /></div></div>
      </div>
      <div className="act"><button type="button" className="btn" onClick={() => void save()}>Enregistrer</button></div>
    </div>
  );
}
