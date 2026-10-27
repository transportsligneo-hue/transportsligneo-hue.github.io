/**
 * Espace flotte · Ligneo Remarketing : confier un véhicule, valider les devis,
 * suivre les 8 étapes et demander une livraison.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useCurrentOrgAccountType } from "@/hooks/useCurrentOrgAccountType";
import {
  CHANTIER, DEFAULT_SETTINGS, MOTIFS, SHORT, STEPS, dateFr, devisEnAttente, downloadDoc, eur, isDone, rdb, saving,
  type Dossier, type RmkEvent, type RmkSettings,
} from "@/lib/remarketing";
import { supabase } from "@/integrations/supabase/client";
import { DevisBlock, Hero, Ico, Kpi, Overlay, Pill, StatusPill, StepBars, Tabs, Timeline, VehicleTile } from "@/components/remarketing/RemarketingUI";
import { DevisModal, LivraisonModal, NewDossierModal } from "@/components/remarketing/RemarketingModals";
import { ChantierLive, DevisCompareDrawer, DossierFinalDrawer } from "@/components/remarketing/RemarketingV2";

export const Route = createFileRoute("/_authenticated/dashboard-pro/remarketing")({
  component: FlotteRemarketing,
});

type Tab = "all" | "cur" | "dev" | "par" | "liv" | "done" | "doc" | "eco";

function FlotteRemarketing() {
  const { data: org } = useCurrentOrgAccountType();
  const orgId = org?.orgId ?? null;
  const [rows, setRows] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [settings, setSettings] = useState<RmkSettings>(DEFAULT_SETTINGS);
  const [openNew, setOpenNew] = useState(false);
  const [devis, setDevis] = useState<Dossier | null>(null);
  const [liv, setLiv] = useState<Dossier | null>(null);
  const [follow, setFollow] = useState<Dossier | null>(null);
  const [events, setEvents] = useState<RmkEvent[]>([]);
  const [cmp, setCmp] = useState<Dossier | null>(null);
  const [fin, setFin] = useState<Dossier | null>(null);
  const [finEvents, setFinEvents] = useState<RmkEvent[]>([]);
  const [nDevis, setNDevis] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const [{ data }, { data: dv }] = await Promise.all([
      rdb.from("remarketing_dossiers").select("*").order("created_at", { ascending: false }),
      rdb.from("remarketing_devis").select("dossier_id, statut").eq("statut", "recu"),
    ]);
    setRows((data ?? []) as Dossier[]);
    const c: Record<string, number> = {};
    ((dv ?? []) as Array<{ dossier_id: string }>).forEach((x) => { c[x.dossier_id] = (c[x.dossier_id] ?? 0) + 1; });
    setNDevis(c);
    setLoading(false);
  }, []);
  useEffect(() => {
    if (!fin) { setFinEvents([]); return; }
    void (async () => {
      const { data } = await rdb.from("remarketing_events").select("*").eq("dossier_id", fin.id).order("created_at", { ascending: true });
      setFinEvents((data ?? []) as RmkEvent[]);
    })();
  }, [fin]);
  const openDevis = (d: Dossier) => ((nDevis[d.id] ?? 0) > 0 ? setCmp(d) : setDevis(d));
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "remarketing_settings").maybeSingle();
      if (data?.value) setSettings({ ...DEFAULT_SETTINGS, ...(data.value as object) });
    })();
  }, []);
  useEffect(() => {
    if (!follow) { setEvents([]); return; }
    void (async () => {
      const { data } = await rdb.from("remarketing_events").select("*").eq("dossier_id", follow.id).order("created_at", { ascending: false });
      setEvents((data ?? []) as RmkEvent[]);
    })();
  }, [follow]);

  const waiting = rows.filter(devisEnAttente);
  const validated = rows.filter((d) => d.devis_statut === "valide");
  const totalSaved = validated.reduce((x, d) => x + saving(d), 0);

  const list = useMemo(() => rows.filter((d) => {
    if (tab === "cur") return !isDone(d);
    if (tab === "dev") return devisEnAttente(d);
    if (tab === "par") return d.etape === 7 && !isDone(d);
    if (tab === "liv") return d.etape >= 7;
    if (tab === "done") return isDone(d);
    return true;
  }), [rows, tab]);

  const refreshFollow = async () => { await load(); setFollow(null); };
  const max = Math.max(1, ...validated.map((d) => Number(d.devis_classique ?? 0)));

  return (
    <div className="rmkx" style={{ display: "grid", gap: 14 }}>
      <Hero title="Vos véhicules," accent="prêts à repartir" text="Confiez-nous un véhicule, validez les devis et suivez chaque étape en direct.">
        <button type="button" className="btn" onClick={() => setOpenNew(true)}><Ico.Plus />Confier un véhicule</button>
      </Hero>

      <div className="kpis" style={{ margin: 0 }}>
        <Kpi icon={<Ico.Car />} label="Véhicules confiés" value={rows.length} sub={`${rows.filter((d) => !isDone(d)).length} en cours`} />
        <Kpi icon={<Ico.FileText />} label="Devis à valider" value={waiting.length} sub="votre accord est attendu" tone="warn" />
        <Kpi icon={<Ico.ParkingSquare />} label="En parc partenaire" value={rows.filter((d) => d.etape === 7 && !isDone(d)).length} sub="prêts à être livrés" />
        <Kpi icon={<Ico.Euro />} label="Économies réalisées" value={eur(totalSaved)} sub="sur les devis validés" tone="ok" />
      </div>

      {waiting.map((d) => (
        <div className="al" key={d.id}>
          <span>Le devis du <b>{d.modele}</b> ({d.immatriculation}) attend votre validation.{d.devis_ligneo ? ` Vous économisez ${eur(saving(d))}.` : ` ${nDevis[d.id] ?? 0} devis à comparer.`}</span>
          <button type="button" className="btn s" onClick={() => openDevis(d)}>{(nDevis[d.id] ?? 0) > 1 ? `Comparer ${nDevis[d.id]} devis` : "Voir le devis"}</button>
        </div>
      ))}

      <Tabs<Tab> value={tab} onChange={setTab} items={[["all", "Tous"], ["cur", "En cours"], ["dev", "Devis à valider", waiting.length], ["par", "En parc"], ["liv", "Livraisons"], ["done", "Livrés"], ["doc", "Documents"], ["eco", "Économies"]]} />

      {loading ? (
        <div className="card" style={{ textAlign: "center" }}><Loader2 className="animate-spin" style={{ display: "inline" }} /></div>
      ) : tab === "doc" ? (
        <div className="card" style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Dossier</th><th>Document</th><th>Date</th><th /></tr></thead>
            <tbody>
              {rows.flatMap((d) => [
                d.devis_statut ? { d, label: "Devis", kind: "devis" as const } : null,
                d.facture_ref ? { d, label: `Facture ${d.facture_ref}`, kind: "facture" as const } : null,
              ].filter((x): x is { d: Dossier; label: string; kind: "devis" | "facture" } => !!x)).map((x) => (
                <tr key={x.d.id + x.kind}>
                  <td><b>{x.d.ref}</b><br /><small style={{ color: "var(--ink3)" }}>{x.d.modele}</small></td>
                  <td>{x.label}</td><td>{dateFr(x.d.created_at)}</td>
                  <td><button type="button" className="btn o s" onClick={() => downloadDoc(x.d, x.kind)}><Ico.Download />Télécharger</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.some((d) => d.devis_statut) && <p style={{ color: "var(--ink3)", padding: 12 }}>Aucun document pour le moment.</p>}
        </div>
      ) : tab === "eco" ? (
        <div className="two">
          <div className="card">
            <h3>Économies par véhicule</h3>
            {validated.length === 0 && <p style={{ color: "var(--ink3)" }}>Les économies apparaissent dès qu'un devis est validé.</p>}
            {validated.map((d) => (
              <div key={d.id} style={{ margin: "12px 0" }}>
                <div className="ln" style={{ border: 0, padding: 0 }}><span><b>{d.modele}</b> · {d.immatriculation}</span><span style={{ color: "var(--ok)" }}>− {eur(saving(d))}</span></div>
                <div className="gauge" style={{ height: 10 }}><span style={{ width: `${(Number(d.devis_ligneo) / max) * 100}%` }} /></div>
                <small style={{ color: "var(--ink3)" }}>Classique {eur(d.devis_classique)} · via Ligneo {eur(d.devis_ligneo)}</small>
              </div>
            ))}
          </div>
          <div className="card">
            <h3>Total</h3>
            <div className="cmp"><div><small>Classique</small><b>{eur(validated.reduce((x, d) => x + Number(d.devis_classique ?? 0), 0))}</b></div><div className="l"><small>Via Ligneo</small><b>{eur(validated.reduce((x, d) => x + Number(d.devis_ligneo ?? 0), 0))}</b></div></div>
            <div className="sav"><span>Vous économisez</span><span>{eur(totalSaved)}</span></div>
            <p style={{ color: "var(--ink3)", fontSize: 12.5, marginTop: 12 }}>Trajets entre prestataires : à la charge de Ligneo.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {list.length === 0 && <div className="card" style={{ textAlign: "center", color: "var(--ink3)" }}>Aucun véhicule dans cette liste.</div>}
          {list.map((d) => (
            <div key={d.id} className={`fv ${devisEnAttente(d) ? "w" : isDone(d) || d.etape === 7 ? "k" : ""}`}>
              <div className="t">
                <VehicleTile />
                <div><b>{d.modele} <span className="plate" style={{ marginLeft: 6 }}>{d.immatriculation}</span></b><small>{MOTIFS[d.motif] ?? d.motif} · dossier {d.ref} · ouvert le {dateFr(d.created_at)}</small></div>
                <StatusPill d={d} />
              </div>
              <StepBars d={d} />
              {d.chantier_step != null && d.etape >= 4 && d.etape <= 6 && !isDone(d) && (
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                  <span className="live">Chantier en direct</span><b>{CHANTIER[d.chantier_step]}</b>
                  {d.chantier_prevu && <span style={{ color: "var(--ink3)" }}>· livraison prévue {dateFr(d.chantier_prevu)}</span>}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {devisEnAttente(d) && <button type="button" className="btn s" onClick={() => openDevis(d)}>{(nDevis[d.id] ?? 0) > 1 ? `Comparer ${nDevis[d.id]} devis` : "Voir et valider le devis"}</button>}
                {isDone(d) && <button type="button" className="btn g s" onClick={() => setFin(d)}>Dossier final</button>}
                {d.etape === 7 && !isDone(d) && settings.livraison_sur_demande && <button type="button" className="btn g s" onClick={() => setLiv(d)}>Demander une livraison</button>}
                <button type="button" className="btn o s" onClick={() => setFollow(d)}>Suivre le dossier</button>
                {d.devis_statut === "valide" && <span style={{ color: "var(--ok)", fontWeight: 700, fontSize: 13, marginLeft: "auto" }}>Économie {eur(saving(d))}</span>}
                {d.livraison && !isDone(d) && <span style={{ color: "var(--ink3)", fontSize: 12.5 }}>Livraison · {d.livraison.collaborateur}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewDossierModal open={openNew} onClose={() => setOpenNew(false)} organizationId={orgId} onDone={() => void load()} />
      <DevisModal d={devis} onClose={() => setDevis(null)} onDone={() => void load()} />
      <DevisCompareDrawer d={cmp} open={!!cmp} onClose={() => setCmp(null)} onDone={() => void load()} settings={settings} />
      <DossierFinalDrawer d={fin} events={finEvents} open={!!fin} onClose={() => setFin(null)} />
      <LivraisonModal d={liv} tarif={settings.tarif_livraison} onClose={() => setLiv(null)} onDone={() => void load()} />

      <Overlay open={!!follow} onClose={() => setFollow(null)} kind="drawer">
        {follow && (
          <>
            <div className="h"><span className="vt" style={{ background: "rgba(255,255,255,.2)", color: "#fff", margin: 0 }}><Ico.Car /></span><h2>{follow.ref} · {follow.modele}</h2><StatusPill d={follow} /><button type="button" className="x" onClick={() => setFollow(null)}>×</button></div>
            <div className="b">
              <div className="card"><div className="kv"><div><small>Plaque</small><b>{follow.immatriculation}</b></div><div><small>Motif</small><b>{MOTIFS[follow.motif] ?? follow.motif}</b></div><div><small>Ouvert le</small><b>{dateFr(follow.created_at)}</b></div><div><small>Étape</small><b>{follow.etape} / 8 · {SHORT[follow.etape - 1]}</b></div></div></div>
              <div className="card"><h3>Avancement</h3>
                <Timeline d={follow} sub={(i) => ["Dossier ouvert", "Collecte par un chauffeur Ligneo, photos datées", "Bilan des dégâts et devis chiffré avec vous", "Allers-retours entre prestataires : à notre charge", "Réparations chez nos prestataires partenaires", "Contrôle final, lavage, préparation", "Stockage en parc partenaire sécurisé", follow.livraison ? `Demande pour ${follow.livraison.collaborateur}` : "Sur demande · service payant"][i]} />
              </div>
              <ChantierLive d={follow} events={events} />
              {follow.devis_ligneo ? <DevisBlock d={follow} actions={devisEnAttente(follow) ? <div className="act"><button type="button" className="btn g s" onClick={() => { openDevis(follow); setFollow(null); }}>{(nDevis[follow.id] ?? 0) > 1 ? "Comparer les devis" : "Valider le devis"}</button></div> : undefined} /> : devisEnAttente(follow) ? (
                <div className="card"><h3>Devis reçus <Pill tone="w">À comparer</Pill></h3><p style={{ color: "var(--ink2)", fontSize: 13 }}>{nDevis[follow.id] ?? 0} prestataire{(nDevis[follow.id] ?? 0) > 1 ? "s ont" : " a"} chiffré votre véhicule. Comparez-les et validez ligne par ligne.</p>
                  <div className="act"><button type="button" className="btn g s" onClick={() => { openDevis(follow); setFollow(null); }}>Comparer les devis</button></div></div>
              ) : null}
              {follow.dommages.length > 0 && <div className="card"><h3>Dégâts constatés</h3><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{follow.dommages.map((x) => <span key={x} className="pill n">{x}</span>)}</div></div>}
              <div className="card"><h3>Historique</h3>
                {events.length === 0 && <p style={{ color: "var(--ink3)" }}>Aucun évènement pour le moment.</p>}
                {events.map((e) => <div className="mini" key={e.id}><span className="pill n">{dateFr(e.created_at)}</span><div><b>{e.message}</b><small>{e.acteur}</small></div></div>)}
              </div>
              <div className="act"><button type="button" className="btn s" onClick={() => { setFin(follow); setFollow(null); }}>Voir le dossier complet</button><button type="button" className="btn o s" onClick={() => void refreshFollow()}>Fermer</button></div>
            </div>
          </>
        )}
      </Overlay>
    </div>
  );
}
