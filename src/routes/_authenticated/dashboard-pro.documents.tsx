import { createFileRoute } from "@tanstack/react-router";
import FleetPageHeader from "@/components/flotte/FleetPageHeader";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, Loader2, Receipt, CreditCard, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { DevisEmbeddedCheckout } from "@/components/devis/DevisEmbeddedCheckout";
import { markDevisAsProcessed } from "@/lib/devis-mark-processed.functions";

import { FactureEmbeddedCheckout } from "@/components/facture/FactureEmbeddedCheckout";
import { generateFacturePdf, downloadFacturePdf, type FactureData } from "@/lib/facture-pdf";

export const Route = createFileRoute("/_authenticated/dashboard-pro/documents")({
  component: ProDocuments,
});

type DisplayMode = "ttc" | "ht" | "exempt";

interface DevisRow {
  id: string;
  numero: string;
  depart: string;
  arrivee: string;
  prix_estime: number;
  statut: string;
  pdf_url: string | null;
  created_at: string;
  paid_at: string | null;
  accepted_at: string | null;
  locked_at: string | null;
  mission_id: string | null;
  converted_at: string | null;
  refused_at: string | null;
  marque: string | null;
  modele: string | null;
  immatriculation: string | null;
  depart_retour: string | null;
  arrivee_retour: string | null;
  immatriculation_retour: string | null;
  marque_retour: string | null;
  modele_retour: string | null;
  prix_retour: number | null;
}


interface FactureRow {
  id: string;
  numero: string;
  statut: string;
  type_facture: "particulier" | "b2b";
  date_facture: string | null;
  date_paiement: string | null;
  client_nom: string | null;
  client_prenom: string | null;
  client_societe: string | null;
  client_email: string | null;
  client_adresse: string | null;
  client_siret: string | null;
  client_tva: string | null;
  designation: string | null;
  depart: string | null;
  arrivee: string | null;
  distance_km: number | null;
  prix_ht: number;
  tva_taux: number;
  prix_tva: number;
  prix_ttc: number;
  pdf_url: string | null;
  mode_paiement: string | null;
  created_at: string;
}

const devisStatutPill: Record<string, { label: string; cls: string }> = {
  envoye: { label: "Envoyé", cls: "bg-blue-50 text-blue-700" },
  en_attente: { label: "En attente", cls: "bg-blue-50 text-blue-700" },
  accepte: { label: "À régler", cls: "bg-amber-50 text-amber-700" },
  convertit: { label: "Converti", cls: "bg-emerald-50 text-emerald-700" },
  converti: { label: "Converti", cls: "bg-emerald-50 text-emerald-700" },
  refuse: { label: "Refusé", cls: "bg-red-50 text-red-700" },
  annule: { label: "Clôturé", cls: "bg-slate-100 text-slate-600" },
  expire: { label: "Expiré", cls: "bg-slate-100 text-slate-700" },
};


const factureStatutPill: Record<string, { label: string; cls: string }> = {
  brouillon: { label: "Brouillon", cls: "bg-slate-100 text-slate-700" },
  emise: { label: "À régler", cls: "bg-amber-50 text-amber-700" },
  payee: { label: "Payée", cls: "bg-emerald-50 text-emerald-700" },
  en_retard: { label: "En retard", cls: "bg-red-50 text-red-700" },
  annulee: { label: "Annulée", cls: "bg-slate-100 text-slate-500" },
};

const isDeferredPayment = (mode?: string | null) => /virement|diff[ée]r|30|60|90/i.test(mode ?? "");

function ProDocuments() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"devis" | "factures">("devis");
  const [devis, setDevis] = useState<DevisRow[]>([]);
  const [factures, setFactures] = useState<FactureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payingFactureId, setPayingFactureId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("ht");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [closingDevis, setClosingDevis] = useState<DevisRow | null>(null);
  const [closingReason, setClosingReason] = useState<string>("");
  const [closingSubmitting, setClosingSubmitting] = useState<boolean>(false);
  const markProcessed = useServerFn(markDevisAsProcessed);


  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("pricing_display_mode")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setDisplayMode((prof?.pricing_display_mode as DisplayMode) ?? "ht");
      }

      // RLS filtre déjà par user_id OU email (case-insensitive via JWT/profiles).
      // On laisse RLS faire le travail au lieu d'un .or()/.in() côté client
      // qui rate les enregistrements dont l'email a une casse différente.
      const [dRes, fRes] = await Promise.all([
        supabase
          .from("devis")
          .select("id, numero, depart, arrivee, prix_estime, statut, pdf_url, created_at, paid_at, accepted_at, locked_at, mission_id, converted_at, refused_at, marque, modele, immatriculation, depart_retour, arrivee_retour, immatriculation_retour, marque_retour, modele_retour, prix_retour")
          .order("created_at", { ascending: false }),
        supabase
          .from("factures")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;
      setDevis((dRes.data ?? []) as DevisRow[]);
      setFactures((fRes.data ?? []) as FactureRow[]);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user]);

  const years = useMemo(() => {
    const set = new Set<string>();
    factures.forEach(f => {
      const d = f.date_facture ?? f.created_at;
      if (d) set.add(new Date(d).getFullYear().toString());
    });
    return Array.from(set).sort().reverse();
  }, [factures]);

  const filteredFactures = useMemo(() => {
    return factures.filter(f => {
      if (statutFilter !== "all" && f.statut !== statutFilter) return false;
      if (yearFilter !== "all") {
        const d = f.date_facture ?? f.created_at;
        if (!d || new Date(d).getFullYear().toString() !== yearFilter) return false;
      }
      return true;
    });
  }, [factures, statutFilter, yearFilter]);

  const payingDevis = devis.find(d => d.id === payingId);
  const payingFacture = factures.find(f => f.id === payingFactureId);
  const returnUrl = typeof window !== "undefined"
    ? `${window.location.origin}/dashboard-pro/documents?paye=1`
    : "/";

  const canBeClosed = (d: DevisRow) =>
    !d.paid_at &&
    !d.accepted_at &&
    !d.locked_at &&
    !d.mission_id &&
    !d.converted_at &&
    !d.refused_at &&
    d.statut !== "annule" &&
    d.statut !== "converti" &&
    d.statut !== "convertit" &&
    d.statut !== "refuse" &&
    d.statut !== "expire" &&
    d.statut !== "accepte";

  const handleConfirmClose = async () => {
    if (!closingDevis) return;
    const reason = closingReason.trim();
    if (reason.length < 3) {
      toast.error("Merci d'indiquer un motif (3 caractères min).");
      return;
    }
    setClosingSubmitting(true);
    try {
      await markProcessed({ data: { devisId: closingDevis.id, reason } });
      toast.success(`Devis ${closingDevis.numero} clôturé.`);
      setDevis(prev => prev.map(d => d.id === closingDevis.id
        ? { ...d, statut: "annule", refused_at: new Date().toISOString() }
        : d
      ));
      setClosingDevis(null);
      setClosingReason("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Impossible de clôturer ce devis.";
      toast.error(msg);
    } finally {
      setClosingSubmitting(false);
    }
  };



  const handleDownloadFacture = async (f: FactureRow) => {
    setDownloadingId(f.id);
    try {
      if (f.pdf_url) {
        window.open(f.pdf_url, "_blank");
        return;
      }
      const blob = await generateFacturePdf({
        numero: f.numero,
        type_facture: f.type_facture,
        date_facture: f.date_facture ?? undefined,
        date_paiement: f.date_paiement,
        statut: f.statut,
        client_nom: f.client_nom,
        client_prenom: f.client_prenom,
        client_societe: f.client_societe,
        client_email: f.client_email,
        client_adresse: f.client_adresse,
        client_siret: f.client_siret,
        client_tva: f.client_tva,
        designation: f.designation,
        depart: f.depart,
        arrivee: f.arrivee,
        distance_km: f.distance_km,
        prix_ht: Number(f.prix_ht),
        tva_taux: Number(f.tva_taux),
        prix_tva: Number(f.prix_tva),
        prix_ttc: Number(f.prix_ttc),
        mode_paiement: f.mode_paiement,
        client_user_id: user?.id ?? null,
        tva_exempt: displayMode === "exempt",
      } as FactureData);
      downloadFacturePdf(blob, f.numero);
    } catch (e) {
      toast.error("Téléchargement impossible", { description: (e as Error).message });
    } finally {
      setDownloadingId(null);
    }
  };

  const formatAmount = (ht: number, ttc: number) => {
    if (displayMode === "exempt") return { main: ttc, sub: "Non soumis à TVA" };
    if (displayMode === "ht") return { main: ht, sub: `TTC : ${ttc.toFixed(2)} €` };
    return { main: ttc, sub: `HT : ${ht.toFixed(2)} €` };
  };

  return (
    <div className="space-y-5">
      <FleetPageHeader
        breadcrumb="Factures & devis"
        eyebrow="Documents commerciaux"
        title="Factures &"
        highlight="devis"
        subtitle="Tous vos documents commerciaux, au même endroit."
      />
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div />
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
          displayMode === "exempt"
            ? "bg-slate-100 text-slate-700"
            : displayMode === "ht"
              ? "bg-blue-50 text-blue-700"
              : "bg-emerald-50 text-emerald-700"
        }`}>
          {displayMode === "exempt" ? "Non soumis TVA" : displayMode === "ht" ? "Affichage HT" : "Affichage TTC"}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-pro-border">
        {([
          { key: "devis", label: `Devis (${devis.length})`, icon: FileText },
          { key: "factures", label: `Factures (${factures.length})`, icon: Receipt },
        ] as const).map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm flex items-center gap-2 border-b-2 -mb-px transition-colors ${
                active ? "border-pro-accent text-pro-accent font-medium" : "border-transparent text-pro-text-soft hover:text-pro-text"
              }`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "devis" && (
        <div className="bg-white rounded-xl border border-pro-border overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-pro-accent" size={24} /></div>
          ) : devis.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="text-slate-300 mx-auto mb-3" size={36} />
              <p className="text-pro-text-soft text-sm">Aucun devis pour le moment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-pro-bg-soft text-pro-muted text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">N°</th>
                    <th className="text-left px-5 py-3 font-medium">Trajet</th>
                    <th className="text-left px-5 py-3 font-medium">Date</th>
                    <th className="text-left px-5 py-3 font-medium">Statut</th>
                    <th className="text-right px-5 py-3 font-medium">Montant</th>
                    <th className="text-right px-5 py-3 font-medium">PDF</th>
                    <th className="text-right px-5 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {devis.map((d) => {
                    const st = devisStatutPill[d.statut] ?? { label: d.statut, cls: "bg-slate-100 text-slate-700" };
                    return (
                      <tr key={d.id} className="border-t border-pro-border hover:bg-pro-bg-soft/60">
                        <td className="px-5 py-3 text-pro-text-soft font-mono text-xs">{d.numero}</td>
                        <td className="px-5 py-3 text-pro-text">{d.depart} → {d.arrivee}</td>
                        <td className="px-5 py-3 text-pro-text-soft">
                          {new Date(d.created_at).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-pro-text whitespace-nowrap">
                          {Number(d.prix_estime).toFixed(2)} €
                        </td>
                        <td className="px-5 py-3 text-right">
                          {d.pdf_url ? (
                            <a
                              href={d.pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-pro-accent hover:underline text-xs font-medium"
                            >
                              <Download size={13} /> PDF
                            </a>
                          ) : (
                            <span className="text-pro-muted text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex items-center gap-2 justify-end">
                            {d.statut === "accepte" && !d.paid_at ? (
                              <button
                                onClick={() => setPayingId(d.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pro-accent text-white text-xs font-medium rounded hover:opacity-90 transition-opacity"
                              >
                                <CreditCard size={13} /> Payer
                              </button>
                            ) : d.paid_at ? (
                              <span className="text-emerald-600 text-xs font-medium">Payé</span>
                            ) : null}
                            {canBeClosed(d) && (
                              <button
                                onClick={() => { setClosingDevis(d); setClosingReason(""); }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-pro-border text-pro-text-soft text-xs font-medium rounded hover:bg-pro-bg-soft transition-colors"
                                title="Clôturer ce devis obsolète"
                              >
                                <CheckCircle2 size={13} /> Marquer comme traité
                              </button>
                            )}
                            {!canBeClosed(d) && !d.paid_at && d.statut !== "accepte" && (
                              <span className="text-pro-muted text-xs">—</span>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "factures" && (
        <>
          {/* Filtres */}
          <div className="bg-white rounded-xl border border-pro-border p-3 flex flex-wrap gap-2">
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-md bg-pro-bg-soft border border-transparent focus:border-pro-accent outline-none text-pro-text"
            >
              <option value="all">Toutes années</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div className="flex flex-wrap gap-1.5">
              {[
                { v: "all", label: "Tous" },
                { v: "emise", label: "À régler" },
                { v: "payee", label: "Payées" },
                { v: "en_retard", label: "En retard" },
              ].map(s => (
                <button
                  key={s.v}
                  onClick={() => setStatutFilter(s.v)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    statutFilter === s.v
                      ? "bg-pro-accent text-white"
                      : "bg-pro-bg-soft text-pro-text-soft hover:bg-slate-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-pro-border overflow-hidden">
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-pro-accent" size={24} /></div>
            ) : filteredFactures.length === 0 ? (
              <div className="p-12 text-center">
                <Receipt className="text-slate-300 mx-auto mb-3" size={36} />
                <p className="text-pro-text-soft text-sm">
                  {factures.length === 0
                    ? "Aucune facture émise pour le moment."
                    : "Aucune facture ne correspond aux filtres."}
                </p>
                {factures.length === 0 && (
                  <p className="text-pro-muted text-xs mt-1">Les factures apparaissent ici une fois la mission terminée.</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-pro-bg-soft text-pro-muted text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3 font-medium">N°</th>
                      <th className="text-left px-5 py-3 font-medium">Trajet</th>
                      <th className="text-left px-5 py-3 font-medium">Date</th>
                      <th className="text-left px-5 py-3 font-medium">Statut</th>
                      <th className="text-right px-5 py-3 font-medium">Montant</th>
                      <th className="text-right px-5 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFactures.map((f) => {
                      const deferred = f.statut !== "payee" && isDeferredPayment(f.mode_paiement);
                      const st = deferred ? { label: "Virement différé", cls: "bg-blue-50 text-blue-700" } : factureStatutPill[f.statut] ?? { label: f.statut, cls: "bg-slate-100 text-slate-700" };
                      const amt = formatAmount(Number(f.prix_ht), Number(f.prix_ttc));
                      return (
                        <tr key={f.id} className="border-t border-pro-border hover:bg-pro-bg-soft/60">
                          <td className="px-5 py-3 text-pro-text-soft font-mono text-xs">{f.numero}</td>
                          <td className="px-5 py-3 text-pro-text">
                            {f.depart && f.arrivee ? `${f.depart} → ${f.arrivee}` : (f.designation ?? "—")}
                          </td>
                          <td className="px-5 py-3 text-pro-text-soft">
                            {f.date_facture
                              ? new Date(f.date_facture).toLocaleDateString("fr-FR")
                              : new Date(f.created_at).toLocaleDateString("fr-FR")}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right whitespace-nowrap">
                            <div className="font-semibold text-pro-text">{amt.main.toFixed(2)} €</div>
                            <div className="text-[10px] text-pro-muted">{amt.sub}</div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              {(f.statut === "emise" || f.statut === "en_retard") && !deferred && (
                                <button
                                  onClick={() => { window.location.href = `/paiement/facture/${f.id}`; }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pro-accent text-white text-xs font-medium rounded hover:opacity-90 transition-opacity"
                                >
                                  <CreditCard size={13} /> Payer
                                </button>
                              )}
                              <button
                                onClick={() => handleDownloadFacture(f)}
                                disabled={downloadingId === f.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-pro-border text-pro-text text-xs font-medium rounded hover:bg-pro-bg-soft transition-colors disabled:opacity-50"
                              >
                                {downloadingId === f.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                                PDF
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {payingDevis && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 my-8 relative shadow-2xl">
            <button
              onClick={() => setPayingId(null)}
              className="absolute top-4 right-4 text-pro-muted hover:text-pro-text transition-colors"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
            <div className="mb-4">
              <h2 className="font-semibold text-lg text-pro-text">Paiement — {payingDevis.numero}</h2>
              <p className="text-pro-muted text-sm mt-1">{payingDevis.depart} → {payingDevis.arrivee} · {Number(payingDevis.prix_estime).toFixed(2)} €</p>
            </div>
            <DevisEmbeddedCheckout devisId={payingDevis.id} returnUrl={returnUrl} />
          </div>
        </div>
      )}

      {payingFacture && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 my-8 relative shadow-2xl">
            <button
              onClick={() => setPayingFactureId(null)}
              className="absolute top-4 right-4 text-pro-muted hover:text-pro-text transition-colors"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
            <div className="mb-4">
              <h2 className="font-semibold text-lg text-pro-text">Paiement facture — {payingFacture.numero}</h2>
              <p className="text-pro-muted text-sm mt-1">
                {payingFacture.depart && payingFacture.arrivee
                  ? `${payingFacture.depart} → ${payingFacture.arrivee}`
                  : (payingFacture.designation ?? "Prestation")}
                {" · "}
                <span className="font-semibold text-pro-text">{Number(payingFacture.prix_ttc).toFixed(2)} € TTC</span>
              </p>
              {payingFacture.client_societe && (
                <p className="text-pro-muted text-xs mt-1">{payingFacture.client_societe}</p>
              )}
            </div>
            <FactureEmbeddedCheckout
              factureId={payingFacture.id}
              returnUrl={returnUrl.replace("paye=1", "paye_facture=1")}
            />
          </div>
        </div>
      )}

      {closingDevis && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-auto">
          <div className="bg-white rounded-xl max-w-md w-full p-6 my-8 relative shadow-2xl">
            <button
              onClick={() => { if (!closingSubmitting) { setClosingDevis(null); setClosingReason(""); } }}
              className="absolute top-4 right-4 text-pro-muted hover:text-pro-text transition-colors"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-lg text-pro-text">Clôturer ce devis ?</h2>
                <p className="text-pro-muted text-sm mt-1">
                  Devis <span className="font-mono">{closingDevis.numero}</span> — {closingDevis.depart} → {closingDevis.arrivee}
                </p>
                <p className="text-pro-muted text-xs mt-2">
                  Cette action est définitive. Le devis passera au statut « Clôturé » et
                  sera retiré des devis en attente. Un enregistrement d'audit sera créé.
                </p>
              </div>
            </div>

            <label className="block text-sm font-medium text-pro-text mb-1.5" htmlFor="close-reason">
              Motif de clôture <span className="text-red-500">*</span>
            </label>
            <textarea
              id="close-reason"
              value={closingReason}
              onChange={(e) => setClosingReason(e.target.value)}
              placeholder="Ex. Doublon, client injoignable, remplacé par un autre devis…"
              maxLength={500}
              rows={3}
              disabled={closingSubmitting}
              className="w-full px-3 py-2 rounded-md border border-pro-border bg-white text-sm text-pro-text focus:border-pro-accent focus:outline-none focus:ring-1 focus:ring-pro-accent resize-none"
            />
            <p className="text-[11px] text-pro-muted mt-1 text-right">
              {closingReason.trim().length}/500
            </p>

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => { setClosingDevis(null); setClosingReason(""); }}
                disabled={closingSubmitting}
                className="px-4 py-2 rounded-md text-sm font-medium text-pro-text-soft hover:bg-pro-bg-soft transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                disabled={closingSubmitting || closingReason.trim().length < 3}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-pro-text text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {closingSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Confirmer la clôture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}
