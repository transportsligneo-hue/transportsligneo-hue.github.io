import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileDown, Wallet, TrendingUp, Gavel } from "lucide-react";
import { Card, KpiCard, Badge, Button, Table, THead, TH, TR, TD, EmptyState, Select } from "@/components/admin/AdminUI";
import { RemunerationDetailModal } from "./RemunerationDetailModal";
import {
  AJUSTEMENT_LABEL,
  REMU_STATUT_LABEL,
  REMU_STATUT_TONE,
  PAIEMENT_STATUT_LABEL,
  PAIEMENT_STATUT_TONE,
  eur,
  dateFr,
  toCsv,
  downloadFile,
  type Ajustement,
  type PaiementConvoyeur,
  type Remuneration,
} from "@/lib/finances-convoyeurs";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h3 className="text-sm font-semibold text-pro-text mb-3">{title}</h3>
      {children}
    </Card>
  );
}

/** Onglet « Finances » d'un convoyeur : solde, missions, pénalités, paiements. */
export function ConvoyeurFinancesPanel({ convoyeurId, nom }: { convoyeurId: string; nom?: string }) {
  const [loading, setLoading] = useState(true);
  const [remus, setRemus] = useState<Remuneration[]>([]);
  const [ajust, setAjust] = useState<Ajustement[]>([]);
  const [paiements, setPaiements] = useState<PaiementConvoyeur[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [annee, setAnnee] = useState<string>(String(new Date().getFullYear()));

  const load = useCallback(async () => {
    setLoading(true);
    const [rRes, pRes] = await Promise.all([
      supabase
        .from("remunerations_missions")
        .select("*")
        .eq("convoyeur_id", convoyeurId)
        .order("date_mission", { ascending: false }),
      supabase
        .from("paiements_convoyeurs")
        .select("*")
        .eq("convoyeur_id", convoyeurId)
        .order("created_at", { ascending: false }),
    ]);
    const list = (rRes.data ?? []) as unknown as Remuneration[];
    setRemus(list);
    setPaiements((pRes.data ?? []) as unknown as PaiementConvoyeur[]);
    if (list.length) {
      const { data: aj } = await supabase
        .from("remuneration_ajustements")
        .select("*")
        .in("remuneration_id", list.map((r) => r.id));
      setAjust((aj ?? []) as unknown as Ajustement[]);
    } else {
      setAjust([]);
    }
    setLoading(false);
  }, [convoyeurId]);

  useEffect(() => {
    void load();
  }, [load]);

  const annees = useMemo(() => {
    const s = new Set<string>([String(new Date().getFullYear())]);
    remus.forEach((r) => r.date_mission && s.add(r.date_mission.slice(0, 4)));
    return Array.from(s).sort().reverse();
  }, [remus]);

  const filtered = remus.filter((r) => (r.date_mission ?? "").startsWith(annee));
  const filteredAjust = ajust.filter(
    (a) => !a.annule && filtered.some((r) => r.id === a.remuneration_id),
  );

  const solde = remus
    .filter((r) => ["en_attente", "valide"].includes(r.statut))
    .reduce((s, r) => s + Number(r.montant_total), 0);
  const brut = filtered.reduce((s, r) => s + Number(r.montant_base), 0);
  const totalAjust = filteredAjust.reduce((s, a) => s + Number(a.montant), 0);
  const penalitesList = filteredAjust.filter((a) => a.categorie === "penalite");

  function exportCsv() {
    const rows = filtered.map((r) => ({
      mission: r.numero_mission ?? "",
      date: r.date_mission ?? "",
      base: Number(r.montant_base).toFixed(2),
      ajustements: Number(r.total_ajustements).toFixed(2),
      total: Number(r.montant_total).toFixed(2),
      statut: REMU_STATUT_LABEL[r.statut],
    }));
    downloadFile(
      toCsv(rows, ["mission", "date", "base", "ajustements", "total", "statut"]),
      `remunerations-${(nom ?? "convoyeur").replace(/\s+/g, "-")}-${annee}.csv`,
    );
  }

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="animate-spin text-pro-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-4 gap-3">
        <KpiCard label="Solde dû" value={eur(solde)} icon={Wallet} />
        <KpiCard label={`Brut missions ${annee}`} value={eur(brut)} icon={TrendingUp} />
        <KpiCard
          label={`Ajustements ${annee}`}
          value={eur(totalAjust)}
          icon={Gavel}
        />
        <KpiCard label={`Net ${annee}`} value={eur(brut + totalAjust)} icon={Wallet} />
      </div>

      <div className="flex items-center gap-2">
        <Select value={annee} onChange={(e) => setAnnee(e.target.value)} className="max-w-[140px]">
          {annees.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Button variant="secondary" onClick={exportCsv}>
          <FileDown size={14} /> Export CSV
        </Button>
      </div>

      <Section title={`Rémunérations ${annee}`}>
        {filtered.length === 0 ? (
          <EmptyState title="Aucune rémunération sur cette période" />
        ) : (
          <Table>
            <THead>
              <TH>Mission</TH>
              <TH>Date</TH>
              <TH>Base</TH>
              <TH>Ajustements</TH>
              <TH>Total</TH>
              <TH>Statut</TH>
            </THead>
            <tbody>
              {filtered.map((r) => (
                <TR key={r.id} onClick={() => setDetailId(r.id)}>
                  <TD>{r.numero_mission ?? "—"}</TD>
                  <TD>{dateFr(r.date_mission)}</TD>
                  <TD>{eur(r.montant_base)}</TD>
                  <TD>
                    <span className={Number(r.total_ajustements) < 0 ? "text-red-600" : ""}>
                      {eur(r.total_ajustements)}
                    </span>
                  </TD>
                  <TD>
                    <strong>{eur(r.montant_total)}</strong>
                  </TD>
                  <TD>
                    <Badge tone={REMU_STATUT_TONE[r.statut]}>{REMU_STATUT_LABEL[r.statut]}</Badge>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      <Section title={`Pénalités appliquées (${penalitesList.length})`}>
        {penalitesList.length === 0 ? (
          <EmptyState title="Aucune pénalité sur cette période" />
        ) : (
          <Table>
            <THead>
              <TH>Pénalité</TH>
              <TH>Motif</TH>
              <TH>Article</TH>
              <TH>Date</TH>
              <TH>Montant</TH>
            </THead>
            <tbody>
              {penalitesList.map((a) => (
                <TR key={a.id} onClick={() => setDetailId(a.remuneration_id)}>
                  <TD>{a.libelle}</TD>
                  <TD>{a.motif}</TD>
                  <TD>{a.article_reference ?? "—"}</TD>
                  <TD>{dateFr(a.created_at)}</TD>
                  <TD>
                    <span className="text-red-600 font-medium">{eur(a.montant)}</span>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      <Section title="Autres ajustements">
        {filteredAjust.filter((a) => a.categorie !== "penalite").length === 0 ? (
          <EmptyState title="Aucun ajustement libre sur cette période" />
        ) : (
          <ul className="space-y-1 text-sm">
            {filteredAjust
              .filter((a) => a.categorie !== "penalite")
              .map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3">
                  <span className="text-pro-muted">
                    {AJUSTEMENT_LABEL[a.categorie]} — {a.libelle} · {a.motif}
                  </span>
                  <span className={Number(a.montant) < 0 ? "text-red-600" : "text-pro-text"}>{eur(a.montant)}</span>
                </li>
              ))}
          </ul>
        )}
      </Section>

      <Section title="Paiements reçus">
        {paiements.length === 0 ? (
          <EmptyState title="Aucun paiement enregistré" />
        ) : (
          <Table>
            <THead>
              <TH>Référence</TH>
              <TH>Date</TH>
              <TH>Missions</TH>
              <TH>Montant</TH>
              <TH>Statut</TH>
            </THead>
            <tbody>
              {paiements.map((p) => (
                <TR key={p.id}>
                  <TD>{p.numero ?? "—"}</TD>
                  <TD>{dateFr(p.date_execution ?? p.created_at)}</TD>
                  <TD>{p.nb_missions}</TD>
                  <TD>{eur(p.montant_total)}</TD>
                  <TD>
                    <Badge tone={PAIEMENT_STATUT_TONE[p.statut]}>{PAIEMENT_STATUT_LABEL[p.statut]}</Badge>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      <RemunerationDetailModal
        remunerationId={detailId}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        onChanged={() => void load()}
      />
    </div>
  );
}
