import { PageSkeleton } from "@/components/driver2/PageSkeleton";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Ic } from "@/components/driver2/icons";
import {
  decomposer, downloadFile, toCsv,
  type Ajustement, type PaiementConvoyeur, type Remuneration,
} from "@/lib/finances-convoyeurs";
import "@/styles/driver-v2.css";

export const Route = createFileRoute("/_authenticated/convoyeur/finances")({
  component: FinancesPage,
});

const MONTHS_SHORT = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
const MONTHS_FULL = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const fmtE = (v: number) =>
  (Math.round(v * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " €";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const shortDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, "0")} ${MONTHS_SHORT[x.getMonth()]}.`;
};
const maskIban = (iban: string) => {
  const c = iban.replace(/\s+/g, "").toUpperCase();
  return c.length < 8 ? c : `${c.slice(0, 4)} •••• •••• •••• ${c.slice(-7)}`;
};

type Tab = "all" | "paid" | "pending";
type Route = { depart: string; arrivee: string };
const city = (x: string) => String(x).split(",").pop()!.trim();

function FinancesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [remus, setRemus] = useState<Remuneration[]>([]);
  const [ajust, setAjust] = useState<Ajustement[]>([]);
  const [paiements, setPaiements] = useState<PaiementConvoyeur[]>([]);
  const [routes, setRoutes] = useState<Record<string, Route>>({});
  const [tab, setTab] = useState<Tab>("all");
  const [iban, setIban] = useState(() => {
    try { return localStorage.getItem("convoyeur_iban") ?? ""; } catch { return ""; }
  });
  const [editIban, setEditIban] = useState(false);
  const [ibanDraft, setIbanDraft] = useState("");

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: rows } = await supabase
        .from("remunerations_missions").select("*").order("date_mission", { ascending: false }).limit(300);
      const list = (rows ?? []) as unknown as Remuneration[];
      setRemus(list);
      if (list.length) {
        const [{ data: aj }, { data: tr }] = await Promise.all([
          supabase.from("remuneration_ajustements").select("*").in("remuneration_id", list.map((r) => r.id)),
          supabase.from("trajets_assigned_safe" as never).select("id,depart,arrivee" as never).in("id" as never, list.map((r) => r.trajet_id) as never),
        ]);
        setAjust((aj ?? []) as unknown as Ajustement[]);
        const m: Record<string, Route> = {};
        ((tr ?? []) as unknown as Array<{ id: string; depart: string; arrivee: string }>).forEach((t) => { m[t.id] = t; });
        setRoutes(m);
      }
      const { data: pays } = await supabase
        .from("paiements_convoyeurs").select("*").order("created_at", { ascending: false }).limit(60);
      setPaiements((pays ?? []) as unknown as PaiementConvoyeur[]);
      setLoading(false);
    })();
  }, [user]);

  const payById = useMemo(() => new Map(paiements.map((p) => [p.id, p])), [paiements]);
  const live = useMemo(() => remus.filter((r) => r.statut !== "annule"), [remus]);
  const isPaid = (r: Remuneration) => r.statut === "paye";

  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth();
  const inMonth = (r: Remuneration, yy: number, mm: number) => {
    const d = r.date_mission ? new Date(r.date_mission) : null;
    return !!d && d.getFullYear() === yy && d.getMonth() === mm;
  };
  const month = live.filter((r) => inMonth(r, y, mo));
  const sum = (a: Remuneration[]) => a.reduce((s, r) => s + Number(r.montant_total), 0);
  const monthPaid = month.filter(isPaid), monthPend = month.filter((r) => !isPaid(r));
  const prev = mo === 0 ? { y: y - 1, m: 11 } : { y, m: mo - 1 };
  const prevTotal = sum(live.filter((r) => inMonth(r, prev.y, prev.m)));
  const delta = prevTotal > 0 ? Math.round(((sum(month) - prevTotal) / prevTotal) * 100) : null;

  const nextTransfer = useMemo(() => {
    const future = paiements
      .filter((p) => (p.statut === "prepare" || p.statut === "envoye") && p.date_execution)
      .map((p) => p.date_execution as string).sort();
    return future[0] ? shortDate(future[0]) : "À venir";
  }, [paiements]);

  const bars = useMemo(() => {
    const out: { label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, mo - i, 1);
      out.push({ label: MONTHS_SHORT[d.getMonth()], total: sum(live.filter((r) => inMonth(r, d.getFullYear(), d.getMonth()))) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);
  const maxBar = Math.max(1, ...bars.map((b) => b.total));

  const list = (tab === "all" ? month : tab === "paid" ? monthPaid : monthPend);

  const stmts = useMemo(() => {
    const out: { y: number; m: number; total: number }[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(y, mo - i, 1);
      const t = sum(live.filter((r) => inMonth(r, d.getFullYear(), d.getMonth())));
      if (t > 0) out.push({ y: d.getFullYear(), m: d.getMonth(), total: t });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const downloadStatement = (yy: number, mm: number) => {
    const rows = live.filter((r) => inMonth(r, yy, mm)).map((r) => ({
      mission: r.numero_mission ?? "", date: r.date_mission ?? "", statut: r.statut, total: String(r.montant_total),
    }));
    downloadFile(toCsv(rows, ["mission", "date", "statut", "total"]), `releve-${yy}-${String(mm + 1).padStart(2, "0")}.csv`);
  };

  const saveIban = () => {
    const c = ibanDraft.replace(/\s+/g, "").toUpperCase();
    try { localStorage.setItem("convoyeur_iban", c); } catch { /* ignore */ }
    setIban(c);
    setEditIban(false);
  };

  if (loading) return <PageSkeleton />;

  const line = (l: string, v: number, cls?: "pos" | "neg") =>
    v ? (
      <div className={`fl-l ${cls ?? ""}`}><span>{l}</span><b>{(cls === "neg" ? "− " : cls === "pos" && v > 0 ? "+ " : "") + fmtE(Math.abs(v))}</b></div>
    ) : null;

  return (
    <div className="drv2">
      <div className="stack fin">
        <div className="row">
          <div className="sp"><h1>Espace Finances</h1><p className="sub">Chaque euro expliqué, mission par mission.</p></div>
          <span className="rv-mo fmo">{cap(MONTHS_FULL[mo])} {y}</span>
        </div>

        <div className="fh">
          <div className="fh-t">
            <small>Total du mois</small><b>{fmtE(sum(month))}</b>
            {delta !== null && <span className="delta">{delta >= 0 ? "↗ +" : "↘ "}{delta} % vs {MONTHS_FULL[prev.m]}</span>}
          </div>
          <div className="fh-bar"><i style={{ width: `${sum(month) ? Math.round((sum(monthPaid) / sum(month)) * 100) : 0}%` }} /></div>
          <div className="fh-g">
            <div><small>Déjà versé</small><b>{fmtE(sum(monthPaid))}</b></div>
            <div><small>En attente</small><b>{fmtE(sum(monthPend))}</b></div>
            <div><small>Prochain virement</small><b>{nextTransfer}</b></div>
          </div>
        </div>

        <div className="ftabs">
          {([["all", "Toutes", month.length], ["paid", "Payées", monthPaid.length], ["pending", "En attente", monthPend.length]] as const).map(([k, l, n]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}<em>{n}</em></button>
          ))}
        </div>

        {list.length === 0 && <p className="mut" style={{ textAlign: "center", padding: "18px 0" }}>Aucune mission à afficher ce mois-ci.</p>}
        {list.map((r) => {
          const rt = routes[r.trajet_id];
          const pay = r.paiement_id ? payById.get(r.paiement_id) : undefined;
          const lignes = decomposer(r, ajust.filter((a) => a.remuneration_id === r.id));
          const bonus = ajust.filter((a) => a.remuneration_id === r.id && !a.annule && Number(a.montant) > 0 && a.categorie !== "frais");
          const malus = ajust.filter((a) => a.remuneration_id === r.id && !a.annule && Number(a.montant) < 0);
          const paid = isPaid(r);
          const validated = paid || r.statut === "valide";
          const steps: [string, string][] = [
            ["Mission clôturée", shortDate(r.date_mission)],
            ["Validée par Ligneo", validated ? "Fait" : "En cours"],
            [paid ? "Virement effectué" : "Virement prévu", shortDate(pay?.date_execution ?? (paid ? r.date_mission : null)) === "—" ? "À venir" : shortDate(pay?.date_execution)],
          ];
          return (
            <details className="fm" key={r.id}>
              <summary>
                <div className="fm-i"><Ic n={paid ? "check" : "clock"} s={16} sw={2.4} /></div>
                <div className="sp">
                  <b>{rt ? `${city(rt.depart)} → ${city(rt.arrivee)}` : "Mission"}</b>
                  <small>{shortDate(r.date_mission)} · Mission {r.numero_mission ?? "—"}</small>
                </div>
                <div className="fm-r"><b>{fmtE(Number(r.montant_total))}</b><span className={`st ${paid ? "ok" : "todo"}`}>{paid ? "Payée" : "En attente"}</span></div>
                <span className="fm-ch"><Ic n="chevd" s={15} sw={2.4} /></span>
              </summary>
              <div className="fm-b">
                <div className="fl-t">Détail de la rémunération</div>
                {lignes.length === 0 && <p className="tiny mut">Détail en cours de calcul.</p>}
                {lignes.map((l, i) => (
                  <div key={i} className={`fl-l ${l.montant < 0 ? "neg" : l.label.startsWith("Frais") || l.label.startsWith("Prime") ? "pos" : ""}`}>
                    <span>{l.label}{l.detail ? <small style={{ display: "block", opacity: 0.6 }}>{l.detail}</small> : null}</span>
                    <b>{(l.montant < 0 ? "− " : l.label.startsWith("Frais") || l.label.startsWith("Prime") ? "+ " : "") + fmtE(Math.abs(l.montant))}</b>
                  </div>
                ))}
                {bonus.length + malus.length === 0 && null}
                <div className="fl-l tot"><span>Net à percevoir</span><b>{fmtE(Number(r.montant_total))}</b></div>
                <div className="fl-t" style={{ marginTop: 14 }}>Suivi du paiement</div>
                <div className="fl-s">
                  {steps.map((x, i) => (
                    <div key={i} className={paid || (i < 2 && x[1] !== "En cours") ? "ok" : i === 1 && x[1] === "En cours" ? "cur" : ""}>
                      <i /><span>{x[0]}</span><small>{x[1]}</small>
                    </div>
                  ))}
                </div>
                <div className="row" style={{ gap: 8, marginTop: 12 }}>
                  {pay?.facture_url
                    ? <a className="fl-btn" href={pay.facture_url} target="_blank" rel="noreferrer"><Ic n="file" s={14} sw={2.2} />Relevé PDF</a>
                    : <button className="fl-btn" onClick={() => downloadStatement(new Date(r.date_mission ?? Date.now()).getFullYear(), new Date(r.date_mission ?? Date.now()).getMonth())}><Ic n="file" s={14} sw={2.2} />Relevé</button>}
                  <a className="fl-btn" href="mailto:contact@transportsligneo.fr?subject=Question%20r%C3%A9mun%C3%A9ration"><Ic n="phone" s={14} sw={2.2} />Une question ?</a>
                </div>
              </div>
            </details>
          );
        })}

        <div className="card">
          <p className="brex-label-xs">Évolution sur 6 mois</p>
          <div className="bars" style={{ margin: "8px 0 22px" }}>
            {bars.map((b, i) => <div key={i} style={{ height: `${Math.max(6, Math.round((b.total / maxBar) * 100))}%` }}><small>{b.label}</small></div>)}
          </div>
        </div>

        <div className="card">
          <div className="row"><p className="sm bold sp">Moyen de paiement</p>{iban && <span className="st ok"><Ic n="check2" s={11} sw={3.2} /> Enregistré</span>}</div>
          {editIban ? (
            <div style={{ marginTop: 10 }}>
              <input className="fld" autoFocus placeholder="FR76 1234 5678 9012 3456 7890 123" value={ibanDraft} onChange={(e) => setIbanDraft(e.target.value.toUpperCase())} />
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                <button className="btn" onClick={saveIban}>Enregistrer</button>
                <button className="btn ghost" onClick={() => setEditIban(false)}>Annuler</button>
              </div>
            </div>
          ) : (
            <div className="fiban">
              <Ic n="wallet" s={18} sw={2.1} />
              <div className="sp"><b>{iban ? maskIban(iban) : "Non configuré"}</b><small>Virement sous 2 à 5 jours après validation</small></div>
              <button className="nlink" onClick={() => { setIbanDraft(iban); setEditIban(true); }}>Modifier</button>
            </div>
          )}
        </div>

        <div className="card">
          <p className="sm bold" style={{ marginBottom: 6 }}>Relevés mensuels</p>
          {stmts.length === 0 && <p className="tiny mut">Vos relevés apparaîtront ici après votre premier mois complet.</p>}
          {stmts.map((s) => (
            <div className="docrow" key={`${s.y}-${s.m}`}>
              <Ic n="file" s={16} /><span className="sp">Relevé {cap(MONTHS_FULL[s.m])} {s.y} · {fmtE(s.total)}</span>
              <button className="hbtn" onClick={() => downloadStatement(s.y, s.m)} aria-label="Télécharger"><Ic n="up" s={14} /></button>
            </div>
          ))}
        </div>

        <div className="fnote">
          <Ic n="shield" s={16} sw={2.2} />
          <p><b>Comment c'est calculé ?</b> Votre rémunération = tarif de la mission + frais remboursés sur justificatifs (carburant, péages) + bonus − pénalités éventuelles. Rien n'est retenu sans être détaillé ici.</p>
        </div>
      </div>
    </div>
  );
}
