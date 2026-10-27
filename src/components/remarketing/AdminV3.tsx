/** Admin Remarketing : vue d'ensemble, devis globaux, planning des chantiers, fiches prestataire et client. */
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CHANTIER, MOTIFS, SHORT, dateFr, dateTimeFr, devisEnAttente, eur, errText, logEvent, rdb, saving, type Dossier, type Prestataire, type RmkEvent, type RmkSettings } from "@/lib/remarketing";
import { Kpi, Overlay, Pill, StatusPill, Ico } from "@/components/remarketing/RemarketingUI";

export interface AdminDevis {
  id: string; dossier_id: string; prestataire_id: string; statut: "demande" | "recu" | "retenu" | "refuse" | "expire";
  total_ht: number | null; total_ttc: number | null; delai_jours: number | null; garantie_mois: number | null;
  date_limite: string | null; repondu_le: string | null; created_at: string;
}
const DAY = 864e5;
const orgOf = (d: Dossier) => d.organizations?.commercial_name || d.organizations?.legal_name || "—";
const sod = (t: number | Date) => { const x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const num1 = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const csv = (name: string, head: string[], lines: Array<Array<string | number>>) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + [head.join(";"), ...lines.map((l) => l.join(";"))].join("\n")], { type: "text/csv;charset=utf-8" }));
  a.download = name; a.click();
};

interface Common { rows: Dossier[]; pres: Prestataire[]; devis: AdminDevis[]; onOpen: (d: Dossier) => void; reload: () => Promise<void> }

/* ---------------- Vue d'ensemble ---------------- */
export function OverviewTab({ rows, pres, devis, parcs, settings, onOpen, goTab }: Omit<Common, "reload"> & { parcs: Array<{ id: string; nom: string; capacite: number; occupees: number }>; settings: RmkSettings; goTab: (t: string) => void }) {
  const now = Date.now();
  const active = rows.filter((d) => d.statut === "en_cours");
  const valid = rows.filter((d) => d.devis_statut === "valide");
  const month = (t: string) => { const x = new Date(t); return x.getFullYear() * 12 + x.getMonth(); };
  const cur = month(new Date().toISOString());
  const caMois = valid.filter((d) => month(d.updated_at) === cur).reduce((x, d) => x + Number(d.devis_ligneo ?? 0), 0);
  const caPrev = valid.filter((d) => month(d.updated_at) === cur - 1).reduce((x, d) => x + Number(d.devis_ligneo ?? 0), 0);
  const trend = caPrev ? Math.round(((caMois - caPrev) / caPrev) * 100) : null;
  const waiting = rows.filter(devisEnAttente);
  const open = devis.filter((q) => q.statut === "demande");
  const toRelance = open.filter((q) => now - new Date(q.created_at).getTime() > 24 * 36e5);
  const late = active.filter((d) => d.chantier_step != null && d.chantier_step < 6 && d.chantier_prevu && sod(d.chantier_prevu) < sod(now));
  const delivered = rows.filter((d) => d.livre_le);
  const avgDays = delivered.length ? Math.round(delivered.reduce((x, d) => x + (new Date(d.livre_le!).getTime() - new Date(d.created_at).getTime()) / DAY, 0) / delivered.length) : null;
  const months = Array.from({ length: 6 }, (_, i) => { const k = cur - 5 + i; const dt = new Date(Math.floor(k / 12), k % 12, 1); return { k, label: dt.toLocaleDateString("fr-FR", { month: "short" }), v: valid.filter((d) => month(d.updated_at) === k).reduce((x, d) => x + Number(d.devis_ligneo ?? 0), 0) }; });
  const maxV = Math.max(1, ...months.map((m) => m.v));
  const motifs = Object.entries(MOTIFS).map(([k, v]) => ({ k, v, n: rows.filter((d) => d.motif === k).length }));
  const answered = devis.filter((q) => q.repondu_le);
  const accepted = devis.filter((q) => q.statut === "retenu").length;
  const avgResp = answered.length ? Math.round(answered.reduce((x, q) => x + (new Date(q.repondu_le!).getTime() - new Date(q.created_at).getTime()) / 36e5, 0) / answered.length) : null;
  const top = pres.map((p) => { const mine = devis.filter((q) => q.prestataire_id === p.id); return { p, n: mine.filter((q) => q.statut === "retenu").length, rep: mine.filter((q) => q.repondu_le).length }; }).sort((a, b) => b.n - a.n || Number(b.p.note ?? 0) - Number(a.p.note ?? 0)).slice(0, 3);
  const alerts: Array<{ tone: string; text: string; d?: Dossier }> = [
    ...late.map((d) => ({ tone: "bad", text: `Chantier en retard : ${d.modele} · ${d.immatriculation} (prévu ${dateFr(d.chantier_prevu)})`, d })),
    ...waiting.filter((d) => now - new Date(d.updated_at).getTime() > settings.delai_relance_h * 36e5).map((d) => ({ tone: "warn", text: `Devis sans réponse du client depuis plus de ${settings.delai_relance_h} h : ${d.modele} (${orgOf(d)})`, d })),
    ...rows.filter((d) => d.statut === "en_cours" && d.etape === 3 && devis.filter((q) => q.dossier_id === d.id && q.statut === "recu").length >= 2 && !d.devis_retenu_id).map((d) => ({ tone: "warn", text: `Devis reçus à comparer : ${d.modele} ${d.immatriculation} (${orgOf(d)})`, d })),
    ...active.filter((d) => d.etape === 1).map((d) => ({ tone: "", text: `À prendre en charge : ${d.modele} ${d.immatriculation} (${orgOf(d)})`, d })),
    ...parcs.filter((p) => pct(p.occupees, Math.max(1, p.capacite)) > 85).map((p) => ({ tone: "", text: `Parc ${p.nom} presque plein (${pct(p.occupees, p.capacite)} %)` })),
  ];
  return (
    <>
      <div className="kpis" style={{ margin: 0 }}>
        <Kpi icon={<Ico.Euro />} label="CA remarketing (mois)" value={eur(caMois)} sub={trend == null ? "devis validés" : `${trend >= 0 ? "+" : ""}${trend} % vs mois précédent`} tone="ok" />
        <Kpi icon={<Ico.Folder />} label="Dossiers en cours" value={active.length} sub={`${active.filter((d) => d.chantier_step != null).length} en chantier`} />
        <Kpi icon={<Ico.FileText />} label="Devis à traiter" value={waiting.length + open.length} sub={`${toRelance.length} à relancer`} tone="warn" />
        <Kpi icon={<Ico.Clock />} label="Chantiers en retard" value={late.length} sub={late.length ? "à relancer" : "tout est dans les temps"} tone={late.length ? "warn" : undefined} />
        <Kpi icon={<Ico.Clock />} label="Délai moyen" value={avgDays != null ? `${avgDays} j` : "—"} sub="confié → livré" />
      </div>
      <div className="two">
        <div className="card"><h3>À traiter maintenant</h3>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {alerts.length === 0 && <p style={{ color: "var(--ink3)" }}>Rien à traiter. Tout est à jour.</p>}
            {alerts.slice(0, 8).map((a, i) => <div className="al" key={i}><span>{a.text}</span>{a.d && <button type="button" className="btn s o" onClick={() => onOpen(a.d!)}>Ouvrir</button>}</div>)}
            {alerts.length > 8 && <button type="button" className="btn s o" onClick={() => goTab("ale")}>Voir les {alerts.length} alertes</button>}
          </div>
        </div>
        <div className="card"><h3>Meilleurs prestataires</h3>
          {top.length === 0 && <p style={{ color: "var(--ink3)" }}>Aucun prestataire.</p>}
          {top.map(({ p, n, rep }) => <div className="mini" key={p.id}><span className="pill n">★ {p.note ?? "—"}</span><div><b>{p.nom}</b><small>{n} devis retenu{n > 1 ? "s" : ""} · {rep} réponse{rep > 1 ? "s" : ""}</small></div></div>)}
        </div>
      </div>
      <div className="two">
        <div className="card"><h3>Chiffre d’affaires validé · 6 mois</h3>
          <div className="bars">{months.map((m) => <div key={m.k}><b>{m.v ? eur(m.v) : "—"}</b><i style={{ height: Math.max(3, Math.round((m.v / maxV) * 110)) }} /><small>{m.label}</small></div>)}</div>
        </div>
        <div className="card"><h3>Répartition par motif</h3>
          <div className="hz" style={{ marginTop: 12 }}>{motifs.map((m) => <div className="r" key={m.k}><span>{m.v}</span><div className="t"><i style={{ width: `${pct(m.n, rows.length)}%` }} /></div><b>{pct(m.n, rows.length)} %</b></div>)}</div>
          <p style={{ color: "var(--ink3)", fontSize: 12, marginTop: 14 }}>Réponse moyenne des prestataires : <b style={{ color: "var(--ink)" }}>{avgResp != null ? `${avgResp} h` : "—"}</b> · Taux d’acceptation des devis : <b style={{ color: "var(--ink)" }}>{answered.length ? `${pct(accepted, answered.length)} %` : "—"}</b></p>
        </div>
      </div>
    </>
  );
}

/* ---------------- Devis globaux ---------------- */
export function DevisTab({ rows, pres, devis, onOpen, reload }: Common) {
  const [f, setF] = useState<"all" | "rel" | "recu" | "ret" | "exp">("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Dossier | null>(null);
  const [limite, setLimite] = useState("");
  const pname = (id: string) => pres.find((p) => p.id === id)?.nom ?? "—";
  const now = Date.now();
  const list = useMemo(() => rows.map((d) => {
    const qs = devis.filter((x) => x.dossier_id === d.id);
    if (!qs.length) return null;
    const recus = qs.filter((x) => x.statut === "recu" || x.statut === "retenu" || x.statut === "refuse");
    const pend = qs.filter((x) => x.statut === "demande");
    const limit = pend.map((x) => x.date_limite).filter(Boolean).sort()[0] ?? null;
    const expired = pend.length > 0 && !!limit && new Date(limit).getTime() < now;
    const best = recus.length ? Math.min(...recus.map((x) => Number(x.total_ht ?? 0))) : null;
    const state = d.devis_retenu_id ? "ret" : expired ? "exp" : pend.length && now - Math.min(...pend.map((x) => new Date(x.created_at).getTime())) > 24 * 36e5 ? "rel" : recus.length ? "recu" : "att";
    return { d, qs, recus, pend, limit, best, state };
  }).filter((x): x is NonNullable<typeof x> => !!x), [rows, devis, now]);
  const view = list.filter((x) => {
    if (f === "rel" && x.state !== "rel") return false;
    if (f === "recu" && x.recus.length === 0) return false;
    if (f === "ret" && x.state !== "ret") return false;
    if (f === "exp" && x.state !== "exp") return false;
    const s = q.trim().toLowerCase();
    return !s || `${x.d.ref} ${x.d.modele} ${x.d.immatriculation} ${orgOf(x.d)} ${x.qs.map((y) => pname(y.prestataire_id)).join(" ")}`.toLowerCase().includes(s);
  });
  const sent = devis.length, got = devis.filter((x) => x.repondu_le).length;
  const spread = list.filter((x) => x.recus.length >= 2).map((x) => { const t = x.recus.map((y) => Number(y.total_ht ?? 0)).filter(Boolean); return t.length > 1 ? 1 - Math.min(...t) / Math.max(...t) : 0; });
  const relancer = async (d: Dossier, ids: string[]) => {
    try { for (const id of ids) await logEvent(d.id, `Relance envoyée à ${pname(devis.find((x) => x.id === id)!.prestataire_id)}`, { kind: "devis", visible: false }); toast.success("Relance enregistrée au journal"); await reload(); } catch (e) { toast.error("Échec", { description: errText(e) }); }
  };
  const prolonger = async (d: Dossier) => {
    if (!limite) { toast.error("Choisis une date."); return; }
    const { error } = await rdb.from("remarketing_devis").update({ date_limite: new Date(limite).toISOString() }).eq("dossier_id", d.id).eq("statut", "demande");
    if (error) { toast.error("Échec", { description: errText(error) }); return; }
    await logEvent(d.id, `Date limite des devis prolongée au ${dateTimeFr(new Date(limite).toISOString())}`, { kind: "devis", visible: false });
    toast.success("Date limite prolongée"); await reload();
  };
  const clore = async (d: Dossier) => {
    const { error } = await rdb.from("remarketing_devis").update({ statut: "expire" }).eq("dossier_id", d.id).eq("statut", "demande");
    if (error) { toast.error("Échec", { description: errText(error) }); return; }
    await logEvent(d.id, "Appel d'offres clos", { kind: "devis", visible: false }); toast.success("Appel d'offres clos"); setSel(null); await reload();
  };
  const tone = (s: string): "b" | "w" | "k" | "x" | "n" => (s === "ret" ? "b" : s === "recu" ? "k" : s === "rel" ? "w" : s === "exp" ? "x" : "n");
  const lab: Record<string, string> = { ret: "Retenu", recu: "Reçus", rel: "À relancer", exp: "Expiré", att: "En attente" };
  return (
    <>
      <div className="kpis" style={{ margin: 0 }}>
        <Kpi icon={<Ico.FileText />} label="Appels d’offres ouverts" value={list.filter((x) => x.pend.length && x.state !== "exp").length} sub={`${new Set(devis.filter((x) => x.statut === "demande").map((x) => x.prestataire_id)).size} prestataires consultés`} />
        <Kpi icon={<Ico.Check />} label="Devis reçus" value={got} sub={`sur ${sent} demandés`} tone="ok" />
        <Kpi icon={<Ico.Clock />} label="À relancer" value={list.filter((x) => x.state === "rel").length} sub="sans réponse > 24 h" tone="warn" />
        <Kpi icon={<Ico.Euro />} label="Écart moyen" value={spread.length ? `${Math.round((spread.reduce((a, b) => a + b, 0) / spread.length) * 100)} %` : "—"} sub="moins cher vs plus cher" />
      </div>
      <div className="card">
        <div className="fl">
          <div className="seg">{([["all", "Tous"], ["rel", "À relancer"], ["recu", "Reçus"], ["ret", "Retenus"], ["exp", "Expirés"]] as const).map(([k, l]) => <button type="button" key={k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}</button>)}</div>
          <input placeholder="Rechercher plaque, client, prestataire…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Véhicule</th><th>Client</th><th>Réponses</th><th>Date limite</th><th>Meilleur HT</th><th>Statut</th><th /></tr></thead>
            <tbody>
              {view.map((x) => (
                <tr key={x.d.id} className="cl" onClick={() => setSel(x.d)}>
                  <td><b>{x.d.modele}</b><br /><small style={{ color: "var(--ink3)" }}>{x.d.immatriculation}</small></td><td>{orgOf(x.d)}</td>
                  <td>{x.recus.length} / {x.qs.length}</td><td>{x.pend.length ? dateTimeFr(x.limit) : "Terminé"}</td><td>{x.best != null ? eur(x.best) : "—"}</td>
                  <td><Pill tone={tone(x.state)}>{lab[x.state]}</Pill></td>
                  <td style={{ textAlign: "right" }}><button type="button" className={`btn s${x.recus.length ? "" : " o"}`} onClick={(e) => { e.stopPropagation(); if (x.recus.length) onOpen(x.d); else setSel(x.d); }}>{x.recus.length ? "Comparer" : "Relancer"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {view.length === 0 && <p style={{ color: "var(--ink3)", padding: 12 }}>Aucun appel d’offres.</p>}
        </div>
      </div>
      <Overlay open={!!sel} onClose={() => setSel(null)} kind="drawer">
        {sel && (
          <>
            <div className="h"><h2>Appel d’offres · {sel.modele} {sel.immatriculation}</h2><button type="button" className="x" onClick={() => setSel(null)}>×</button></div>
            <div className="b">
              <div className="card">
                {devis.filter((x) => x.dossier_id === sel.id).map((x) => (
                  <div className="mini" key={x.id}>
                    <span className={`pill ${x.statut === "demande" ? "w" : x.statut === "retenu" ? "b" : "k"}`}>{x.statut === "demande" ? "En attente" : x.statut === "retenu" ? "Retenu" : x.statut === "expire" ? "Expiré" : x.statut === "refuse" ? "Refusé" : "Reçu"}</span>
                    <div><b>{pname(x.prestataire_id)}</b><small>{x.repondu_le ? `Répondu ${dateTimeFr(x.repondu_le)} · ${eur(x.total_ht)} HT` : `Demandé ${dateTimeFr(x.created_at)}`}</small></div>
                    {x.statut === "demande" && <button type="button" className="btn s" style={{ marginLeft: "auto" }} onClick={() => void relancer(sel, [x.id])}>Relancer</button>}
                  </div>
                ))}
              </div>
              {devis.some((x) => x.dossier_id === sel.id && x.statut === "demande") && (
                <div className="card"><div className="f"><div><label>Prolonger la date limite</label><input type="datetime-local" value={limite} onChange={(e) => setLimite(e.target.value)} /></div></div>
                  <div className="act"><button type="button" className="btn o s" onClick={() => void prolonger(sel)}>Prolonger</button><button type="button" className="btn r s" onClick={() => void clore(sel)}>Clore l’appel d’offres</button></div></div>
              )}
              <div className="act" style={{ marginTop: 0 }}><button type="button" className="btn" onClick={() => { const d = sel; setSel(null); onOpen(d); }}>Ouvrir le dossier et comparer</button></div>
            </div>
          </>
        )}
      </Overlay>
    </>
  );
}

/* ---------------- Planning des chantiers ---------------- */
export function ChantiersTab({ rows, pres, devis, onOpen }: Omit<Common, "reload">) {
  const [f, setF] = useState<"all" | "late" | "week">("all");
  const t0 = sod(Date.now());
  const days = Array.from({ length: 14 }, (_, i) => new Date(t0 + i * DAY));
  const pname = (id: string | null) => pres.find((p) => p.id === id)?.nom ?? "";
  const idx = (t: number) => Math.round((sod(t) - t0) / DAY);
  type Bar = { d: Dossier; from: number; to: number; cls: string; label: string; who: string; late: boolean; end: number };
  const bars: Bar[] = [];
  for (const d of rows.filter((x) => x.statut === "en_cours")) {
    if (d.chantier_step != null && d.chantier_step >= 0 && d.etape >= 5) {
      const end = d.chantier_prevu ? idx(new Date(d.chantier_prevu).getTime()) : idx(Date.now()) + 3;
      const start = idx(new Date(d.chantier_maj ?? d.created_at).getTime());
      const ready = d.chantier_step >= 6;
      const late = !ready && end < 0;
      bars.push({ d, from: Math.max(0, Math.min(start, end)), to: Math.max(0, end), cls: ready ? "ok" : late ? "late" : "", label: ready ? "Prêt · à récupérer" : `${CHANTIER[d.chantier_step] ?? "Chantier"}${late ? ` · retard ${-end} j` : d.chantier_prevu ? ` · prévu ${dateFr(d.chantier_prevu)}` : ""}`, who: pname(d.prestataire_id), late, end });
    } else if (d.etape === 3) {
      const open = devis.filter((q) => q.dossier_id === d.id && q.statut === "demande");
      const lim = open.map((q) => q.date_limite).filter(Boolean).sort()[0];
      if (open.length) bars.push({ d, from: 0, to: Math.max(0, lim ? idx(new Date(lim).getTime()) : 2), cls: "wait", label: "Devis attendus", who: `${open.length} prestataire${open.length > 1 ? "s" : ""}`, late: false, end: 2 });
      else if (devis.some((q) => q.dossier_id === d.id && q.statut === "recu") && !d.devis_retenu_id) bars.push({ d, from: 0, to: 2, cls: "wait", label: "Choix du devis", who: "Ligneo", late: false, end: 2 });
    }
  }
  const view = bars.filter((b) => (f === "late" ? b.late : f === "week" ? b.to <= 7 : true)).sort((a, b) => a.to - b.to);
  const week = bars.filter((b) => b.cls !== "wait" && b.to >= 0 && b.to <= 7);
  const byP = (() => { const m = new Map<string, number>(); bars.filter((b) => b.cls !== "wait" && b.who).forEach((b) => m.set(b.who, (m.get(b.who) ?? 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1])[0]; })();
  return (
    <>
      <div className="kpis" style={{ margin: 0 }}>
        <Kpi icon={<Ico.Folder />} label="Chantiers en cours" value={bars.filter((b) => b.cls !== "wait").length} sub={`${new Set(bars.filter((b) => b.who && b.cls !== "wait").map((b) => b.who)).size} prestataires`} />
        <Kpi icon={<Ico.Clock />} label="En retard" value={bars.filter((b) => b.late).length} sub={bars.filter((b) => b.late).map((b) => b.d.immatriculation).join(", ") || "aucun"} tone={bars.some((b) => b.late) ? "warn" : undefined} />
        <Kpi icon={<Ico.Check />} label="Livraisons sous 7 jours" value={week.length} sub={`dont ${week.filter((b) => b.cls === "ok").length} prête${week.filter((b) => b.cls === "ok").length > 1 ? "s" : ""}`} tone="ok" />
        <Kpi icon={<Ico.Car />} label="Plus chargé" value={byP ? byP[1] : "—"} sub={byP ? byP[0] : "—"} />
      </div>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h3>Planning des chantiers · 2 semaines</h3>
          <div className="seg">{([["all", "Tous"], ["late", "En retard"], ["week", "Cette semaine"]] as const).map(([k, l]) => <button type="button" key={k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}</button>)}</div>
        </div>
        <div className="gt">
          <div className="hd2"><span />{days.map((dd, i) => <span key={i} className={`${i === 0 ? "td" : ""} ${[0, 6].includes(dd.getDay()) ? "we" : ""}`}>{dd.toLocaleDateString("fr-FR", { weekday: "narrow" })} {dd.getDate()}</span>)}</div>
          {view.map((b) => (
            <div className="row" key={b.d.id}>
              <b>{b.d.modele} · {b.d.immatriculation}<small>{b.who || orgOf(b.d)}</small></b>
              <div className={`bar2 ${b.cls}`} style={{ gridColumn: `${b.from + 2} / span ${Math.max(1, Math.min(14 - b.from, b.to - b.from + 1))}`, cursor: "pointer" }} onClick={() => onOpen(b.d)}>{b.label}</div>
            </div>
          ))}
        </div>
        {view.length === 0 && <p style={{ color: "var(--ink3)", padding: 12 }}>Aucun chantier à afficher.</p>}
        <div className="lg2"><span>En cours</span><span className="g">Prêt</span><span className="rd">Retard</span><span className="w">À venir</span></div>
      </div>
    </>
  );
}

/* ---------------- Fiche prestataire ---------------- */
export function PrestaFiche({ p, rows, devis, onOpen, onClose, reload }: { p: Prestataire; rows: Dossier[]; devis: AdminDevis[]; onOpen: (d: Dossier) => void; onClose: () => void; reload: () => Promise<void> }) {
  const mine = devis.filter((q) => q.prestataire_id === p.id);
  const answered = mine.filter((q) => q.repondu_le);
  const won = mine.filter((q) => q.statut === "retenu");
  const fast = answered.filter((q) => new Date(q.repondu_le!).getTime() - new Date(q.created_at).getTime() <= 24 * 36e5).length;
  const ca = won.reduce((x, q) => x + Number(q.total_ht ?? 0), 0);
  const delais = answered.map((q) => q.delai_jours).filter((n): n is number => n != null);
  const hist = rows.filter((d) => d.prestataire_id === p.id || won.some((q) => q.dossier_id === d.id));
  const [notes, setNotes] = useState(p.notes_admin ?? "");
  const save = async () => {
    const { error } = await rdb.from("remarketing_prestataires").update({ notes_admin: notes || null }).eq("id", p.id);
    if (error) toast.error("Échec", { description: errText(error) }); else { toast.success("Notes enregistrées"); await reload(); }
  };
  return (
    <>
      <div className="h"><h2>{p.nom}</h2>{p.user_id && <span className="pill k">Portail relié</span>}<button type="button" className="x" onClick={onClose}>×</button></div>
      <div className="b">
        <div className="kv4"><div><small>Note clients</small><b>★ {p.note ?? "—"}</b></div><div><small>Chiffre d’affaires généré</small><b>{eur(ca)}</b></div><div><small>Acceptation</small><b>{answered.length ? `${pct(won.length, answered.length)} %` : "—"}</b></div><div><small>Chantiers</small><b>{hist.length}</b></div></div>
        <div className="card"><h3>Performance</h3>
          <div className="hz" style={{ marginTop: 10 }}>
            <div className="r"><span>Réponse sous 24 h</span><div className="t"><i style={{ width: `${pct(fast, answered.length)}%` }} /></div><b>{answered.length ? `${pct(fast, answered.length)} %` : "—"}</b></div>
            <div className="r"><span>Devis répondus</span><div className="t"><i style={{ width: `${pct(answered.length, mine.length)}%` }} /></div><b>{answered.length}/{mine.length}</b></div>
          </div>
          <p style={{ color: "var(--ink3)", fontSize: 12.5, marginTop: 10 }}>Délai annoncé moyen : {delais.length ? `${num1(delais.reduce((a, b) => a + b, 0) / delais.length)} j` : "—"}{p.delai_moyen_jours ? ` · délai de référence ${p.delai_moyen_jours} j` : ""}</p>
        </div>
        <div className="card"><h3>Historique des chantiers</h3>
          {hist.length === 0 && <p style={{ color: "var(--ink3)" }}>Aucun chantier pour le moment.</p>}
          {hist.length > 0 && <table><thead><tr><th>Véhicule</th><th>Client</th><th>Montant</th><th>Statut</th></tr></thead><tbody>
            {hist.map((d) => <tr key={d.id} className="cl" onClick={() => onOpen(d)}><td><b>{d.modele}</b><br /><small style={{ color: "var(--ink3)" }}>{d.immatriculation}</small></td><td>{orgOf(d)}</td><td>{d.devis_ligneo != null ? eur(d.devis_ligneo) : "—"}</td><td><StatusPill d={d} /></td></tr>)}
          </tbody></table>}
        </div>
        <div className="card"><h3>Contact</h3>
          <div className="kv"><div><small>E-mail</small><b>{p.contact_email || "—"}</b></div><div><small>Téléphone</small><b>{p.contact_tel || "—"}</b></div><div><small>Rayon</small><b>{p.rayon_km ? `${p.rayon_km} km` : "—"}</b></div><div><small>Garantie</small><b>{p.garantie_mois ? `${p.garantie_mois} mois` : "—"}</b></div></div>
          <div className="f" style={{ marginTop: 12 }}><label>Notes internes (privées, jamais visibles du prestataire)</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex : très réactif, à privilégier pour les urgences." /></div>
          <div className="act"><button type="button" className="btn s" onClick={() => void save()}>Enregistrer</button></div>
        </div>
      </div>
    </>
  );
}

/* ---------------- Clients ---------------- */
export function ClientsTab({ rows, onOpen }: { rows: Dossier[]; onOpen: (d: Dossier) => void }) {
  const [q, setQ] = useState(""); const [sel, setSel] = useState<string | null>(null);
  const groups = useMemo(() => {
    const m = new Map<string, Dossier[]>();
    rows.forEach((d) => m.set(d.organization_id, [...(m.get(d.organization_id) ?? []), d]));
    return [...m.entries()].map(([id, ds]) => {
      const valid = ds.filter((d) => d.devis_statut === "valide"); const liv = ds.filter((d) => d.livre_le);
      return { id, name: orgOf(ds[0]), ds, n: ds.length, enCours: ds.filter((d) => d.statut === "en_cours").length, ca: valid.reduce((x, d) => x + Number(d.devis_ligneo ?? 0), 0), eco: valid.reduce((x, d) => x + saving(d), 0), delai: liv.length ? Math.round(liv.reduce((x, d) => x + (new Date(d.livre_le!).getTime() - new Date(d.created_at).getTime()) / DAY, 0) / liv.length) : null };
    }).sort((a, b) => b.ca - a.ca);
  }, [rows]);
  const view = groups.filter((g) => !q.trim() || g.name.toLowerCase().includes(q.trim().toLowerCase()));
  const cur = groups.find((g) => g.id === sel);
  const exportAll = () => csv("remarketing-clients.csv", ["Client", "Dossiers", "En cours", "CA remarketing", "Économies", "Délai moyen (j)"], view.map((g) => [g.name, g.n, g.enCours, g.ca, g.eco, g.delai ?? ""]));
  const exportOne = () => cur && csv(`remarketing-${cur.name.replace(/\W+/g, "-").toLowerCase()}.csv`, ["Réf", "Plaque", "Modèle", "Motif", "Étape", "Statut", "Montant", "Facture", "Règlement"], cur.ds.map((d) => [d.ref, d.immatriculation, d.modele, MOTIFS[d.motif] ?? d.motif, SHORT[d.etape - 1], d.statut, d.devis_ligneo ?? "", d.facture_ref ?? "", d.facture_statut ?? ""]));
  return (
    <>
      <div className="card">
        <div className="fl"><input placeholder="Rechercher un client…" value={q} onChange={(e) => setQ(e.target.value)} /><button type="button" className="btn s o" onClick={exportAll}><Ico.Download />Exporter CSV</button></div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Client</th><th>Dossiers</th><th>En cours</th><th>CA remarketing</th><th>Économies</th><th>Délai moyen</th><th /></tr></thead>
            <tbody>{view.map((g) => <tr key={g.id} className="cl" onClick={() => setSel(g.id)}><td><b>{g.name}</b></td><td>{g.n}</td><td>{g.enCours}</td><td>{eur(g.ca)}</td><td style={{ color: "var(--ok)" }}>{g.eco ? `− ${eur(g.eco)}` : "—"}</td><td>{g.delai != null ? `${g.delai} j` : "—"}</td><td><button type="button" className="btn s o">Fiche</button></td></tr>)}</tbody>
          </table>
          {view.length === 0 && <p style={{ color: "var(--ink3)", padding: 12 }}>Aucun client.</p>}
        </div>
      </div>
      <Overlay open={!!cur} onClose={() => setSel(null)} kind="drawer">
        {cur && (
          <>
            <div className="h"><h2>{cur.name}</h2><span className="pill b">{cur.n} dossier{cur.n > 1 ? "s" : ""}</span><button type="button" className="x" onClick={() => setSel(null)}>×</button></div>
            <div className="b">
              <div className="kv4"><div><small>Dossiers</small><b>{cur.n}</b></div><div><small>CA remarketing</small><b>{eur(cur.ca)}</b></div><div><small>Économies</small><b>{eur(cur.eco)}</b></div><div><small>En cours</small><b>{cur.enCours}</b></div></div>
              <div className="card"><h3>Dossiers</h3>
                <table><thead><tr><th>Véhicule</th><th>Motif</th><th>Étape</th><th>Montant</th></tr></thead><tbody>
                  {cur.ds.map((d) => <tr key={d.id} className="cl" onClick={() => { setSel(null); onOpen(d); }}><td><b>{d.modele}</b><br /><small style={{ color: "var(--ink3)" }}>{d.immatriculation}</small></td><td>{MOTIFS[d.motif] ?? d.motif}</td><td><StatusPill d={d} /></td><td>{d.devis_ligneo != null ? eur(d.devis_ligneo) : "—"}</td></tr>)}
                </tbody></table>
              </div>
              <div className="card"><h3>Facturation</h3>
                {cur.ds.filter((d) => d.facture_ref).length === 0 && <p style={{ color: "var(--ink3)" }}>Aucune facture émise.</p>}
                {cur.ds.filter((d) => d.facture_ref).map((d) => <div className="ln" key={d.id}><span>{d.facture_ref}</span><span><Pill tone={d.facture_statut === "payee" ? "k" : "w"}>{d.facture_statut === "payee" ? "Payée" : "À régler"}</Pill> {eur(d.devis_ligneo)}</span></div>)}
                <div className="act"><button type="button" className="btn o s" onClick={exportOne}><Ico.Download />Export CSV</button></div>
              </div>
            </div>
          </>
        )}
      </Overlay>
    </>
  );
}
export type { ReactNode };
