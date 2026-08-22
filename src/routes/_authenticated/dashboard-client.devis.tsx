import { createFileRoute } from "@tanstack/react-router";
import ClientPageHeader from "@/components/dashboard/ClientPageHeader";
import { useEffect, useState } from "react";
import { Loader2, CreditCard, FileText, X, FileCheck2, Download, Receipt, PenLine, History } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DevisEmbeddedCheckout } from "@/components/devis/DevisEmbeddedCheckout";
import { VehiculeDocsStep } from "@/components/devis/VehiculeDocsStep";
import { DevisAcceptationStep } from "@/components/devis/DevisAcceptationStep";
import { generateFacturePdf, downloadFacturePdf, type FactureData } from "@/lib/facture-pdf";
import { generateDevisPdf, downloadDevisPdf, type DevisData } from "@/lib/devis-pdf";
import { getDevisAcceptationStatus } from "@/lib/devis-acceptation.functions";
import { useServerFn } from "@tanstack/react-start";
import { LogoLoader } from "@/components/brand/LogoLoader";

type DevisRow = {
  id: string;
  numero: string;
  depart: string;
  arrivee: string;
  prix_estime: number;
  statut: string;
  paid_at: string | null;
  created_at: string;
  date_souhaitee: string | null;
  vin: string | null;
  carte_grise_recto_url: string | null;
  carte_grise_verso_url: string | null;
  vehicule_docs_completed: boolean;
  version: number | null;
  locked_at: string | null;
  accepted_at: string | null;
  expires_at: string | null;
  archived_at: string | null;
} & Record<string, unknown>;

type FactureRow = {
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
};

type HistoryRow = {
  id: string;
  old_statut: string | null;
  new_statut: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/dashboard-client/devis")({
  component: MesFacturesEtDevis,
});

const STATUT_LABELS: Record<string, { label: string; cls: string }> = {
  brouillon: { label: "Brouillon", cls: "bg-cream/10 text-cream/70 border-cream/20" },
  genere: { label: "Généré", cls: "bg-cream/10 text-cream border-cream/30" },
  envoye: { label: "En attente d'acceptation", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  en_attente: { label: "En attente d'acceptation", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  accepte: { label: "Accepté — à payer", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  convertit: { label: "Transformé en mission", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  refuse: { label: "Refusé", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  expire: { label: "Expiré", cls: "bg-cream/10 text-cream/60 border-cream/20" },
};

const FACT_STATUT_LABELS: Record<string, { label: string; cls: string }> = {
  emise: { label: "À régler", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  payee: { label: "Payée", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  en_retard: { label: "En retard", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  annulee: { label: "Annulée", cls: "bg-cream/10 text-cream/60 border-cream/20" },
};

function isExpired(d: DevisRow): boolean {
  if (d.statut === "expire") return true;
  if (!d.expires_at || d.paid_at || d.locked_at) return false;
  return ["genere", "envoye", "en_attente"].includes(d.statut) && new Date(d.expires_at) < new Date();
}

function MesFacturesEtDevis() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"devis" | "factures">("devis");
  const [devis, setDevis] = useState<DevisRow[]>([]);
  const [factures, setFactures] = useState<FactureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [step, setStep] = useState<"acceptation" | "docs" | "pay">("acceptation");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<DevisRow | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const getStatus = useServerFn(getDevisAcceptationStatus);

  const refresh = async () => {
    if (!user) return;
    // RLS gère le filtrage (user_id OU email case-insensitive via profiles/JWT).
    // On évite les filtres .or()/.in() côté client qui sont case-sensitive et
    // rateraient les factures/devis dont l'email a une casse différente.
    const [dRes, fRes] = await Promise.all([
      supabase
        .from("devis")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("factures")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);
    setDevis((dRes.data ?? []) as DevisRow[]);
    setFactures((fRes.data ?? []) as FactureRow[]);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Realtime : rafraîchit dès que le statut ou la signature d'un devis change.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`devis-client-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "devis", filter: `user_id=eq.${user.id}` },
        () => { refresh(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "devis_acceptations", filter: `client_user_id=eq.${user.id}` },
        () => { refresh(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const active = devis.find(d => d.id === activeId);
  const returnUrl = typeof window !== "undefined"
    ? `${window.location.origin}/dashboard-client/devis?paye=1`
    : "/";

  const openFlow = async (d: DevisRow) => {
    setActiveId(d.id);
    try {
      const status = await getStatus({ data: { devisId: d.id } });
      if (status.requiresAcceptation) {
        setStep("acceptation");
      } else {
        setStep(d.vehicule_docs_completed ? "pay" : "docs");
      }
    } catch {
      setStep(d.locked_at ? (d.vehicule_docs_completed ? "pay" : "docs") : "acceptation");
    }
  };

  const handleDownloadDevis = async (d: DevisRow) => {
    setDownloadingId(d.id);
    try {
      // Si un PDF figé signé existe, on le télécharge en priorité
      if (d.locked_at && user) {
        const { data: acc } = await supabase
          .from("devis_acceptations")
          .select("pdf_url")
          .eq("devis_id", d.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (acc?.pdf_url) {
          const { data: signed } = await supabase.storage
            .from("devis-acceptes")
            .createSignedUrl(acc.pdf_url, 300);
          if (signed?.signedUrl) {
            window.open(signed.signedUrl, "_blank");
            return;
          }
        }
      }
      const blob = await generateDevisPdf({
        ...(d as unknown as DevisData),
        version: d.version ?? 1,
      });
      downloadDevisPdf(blob, d.numero);
    } catch (e) {
      toast.error("Téléchargement impossible", { description: (e as Error).message });
    } finally {
      setDownloadingId(null);
    }
  };

  const openHistory = async (d: DevisRow) => {
    setHistoryFor(d);
    setHistory(null);
    const { data } = await supabase
      .from("devis_status_history")
      .select("id, old_statut, new_statut, created_at")
      .eq("devis_id", d.id)
      .order("created_at", { ascending: false });
    setHistory((data ?? []) as HistoryRow[]);
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
      } as FactureData);
      downloadFacturePdf(blob, f.numero);
    } catch (e) {
      toast.error("Téléchargement impossible", { description: (e as Error).message });
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><LogoLoader label="Chargement de vos devis…" /></div>;
  }

  return (
    <div className="space-y-6">
      <ClientPageHeader
        breadcrumb="Factures & devis"
        eyebrow="Documents commerciaux"
        title="Mes devis &"
        highlight="factures"
        subtitle="Historique complet — vos devis et factures restent visibles en permanence."
      />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-primary/15">
        {([
          { key: "devis", label: `Mes devis (${devis.length})`, icon: FileText },
          { key: "factures", label: `Mes factures (${factures.length})`, icon: Receipt },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-xs uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${
              tab === t.key
                ? "text-primary border-primary"
                : "text-cream/60 border-transparent hover:text-cream/90"
            }`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "devis" && (
        devis.length === 0 ? (
          <div className="card-premium rounded p-8 text-center">
            <FileText className="mx-auto text-cream/30 mb-3" size={40} />
            <p className="text-cream/70">Aucun devis pour le moment.</p>
            <p className="text-cream/50 text-xs mt-1">Vos demandes de devis apparaîtront ici dès leur création.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {devis.map((d) => {
              const expired = isExpired(d);
              const statutKey = expired ? "expire" : d.statut;
              const status = STATUT_LABELS[statutKey] ?? { label: d.statut, cls: "bg-cream/10 text-cream/70 border-cream/20" };
              const signable = !d.locked_at && !d.paid_at && !expired && !["refuse", "expire", "convertit"].includes(d.statut);
              const payable = d.statut === "accepte" && !d.paid_at && !expired;
              return (
                <div key={d.id} className="card-premium rounded p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded border bg-primary/15 text-primary border-primary/40 font-heading tracking-wider uppercase">Devis</span>
                      <span className="text-cream/70 text-xs uppercase tracking-wider font-medium">{d.numero}</span>
                      {(d.version ?? 1) > 1 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border bg-cream/10 text-cream/70 border-cream/20">v{d.version}</span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded border ${status.cls}`}>{status.label}</span>
                      {d.locked_at && (
                        <span className="text-xs px-2 py-1 rounded border bg-emerald-500/15 text-emerald-300 border-emerald-500/30 inline-flex items-center gap-1">
                          <PenLine size={10} /> Signé
                        </span>
                      )}
                      {d.paid_at && <span className="text-xs px-2 py-1 rounded border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Payé</span>}
                    </div>
                    <p className="text-cream font-heading text-base mt-1 truncate">{d.depart} → {d.arrivee}</p>
                    <p className="text-cream/60 text-xs mt-1">
                      Créé le {new Date(d.created_at).toLocaleDateString("fr-FR")}
                      {d.date_souhaitee ? ` · souhaité le ${new Date(d.date_souhaitee).toLocaleDateString("fr-FR")}` : ""}
                      {d.expires_at && !d.locked_at && !d.paid_at ? ` · valable jusqu'au ${new Date(d.expires_at).toLocaleDateString("fr-FR")}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <p className="font-heading text-xl text-primary whitespace-nowrap mr-1">{Number(d.prix_estime).toFixed(2)} €</p>
                    <button
                      onClick={() => openHistory(d)}
                      title="Historique du devis"
                      className="p-2 rounded border border-cream/20 text-cream/70 hover:text-cream hover:border-cream/40 transition-colors"
                    >
                      <History size={14} />
                    </button>
                    <button
                      onClick={() => handleDownloadDevis(d)}
                      disabled={downloadingId === d.id}
                      title="Télécharger le PDF"
                      className="p-2 rounded border border-cream/20 text-cream/70 hover:text-cream hover:border-cream/40 transition-colors disabled:opacity-50"
                    >
                      {downloadingId === d.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    </button>
                    {signable && (
                      <button
                        onClick={() => openFlow(d)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-navy font-heading text-xs tracking-[0.15em] uppercase hover:bg-gold-light transition-colors rounded"
                      >
                        <PenLine size={14} /> Signer le devis
                      </button>
                    )}
                    {payable && (
                      <button
                        onClick={() => openFlow(d)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-navy font-heading text-xs tracking-[0.15em] uppercase hover:bg-gold-light transition-colors rounded"
                      >
                        {d.vehicule_docs_completed ? <CreditCard size={14} /> : <FileCheck2 size={14} />}
                        {d.vehicule_docs_completed ? "Payer" : "Compléter & payer"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === "factures" && (
        factures.length === 0 ? (
          <div className="card-premium rounded p-8 text-center">
            <Receipt className="mx-auto text-cream/30 mb-3" size={40} />
            <p className="text-cream/70">Aucune facture émise pour le moment.</p>
            <p className="text-cream/50 text-xs mt-1">Une facture est générée dès qu'un convoyage est confirmé.</p>
            <p className="text-cream/50 text-xs mt-1">Les factures apparaissent ici une fois la mission terminée.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {factures.map((f) => {
              const st = FACT_STATUT_LABELS[f.statut] ?? { label: f.statut, cls: "bg-cream/10 text-cream/70 border-cream/20" };
              return (
                <div key={f.id} className="card-premium rounded p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded border bg-emerald-500/15 text-emerald-300 border-emerald-500/40 font-heading tracking-wider uppercase">Facture</span>
                      <span className="text-cream/70 text-xs uppercase tracking-wider font-medium">{f.numero}</span>
                      <span className={`text-xs px-2 py-1 rounded border ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-cream font-heading text-base mt-1 truncate">{f.depart} → {f.arrivee}</p>
                    <p className="text-cream/60 text-xs mt-1">
                      {f.date_facture ? new Date(f.date_facture).toLocaleDateString("fr-FR") : "—"}
                      {f.distance_km ? ` · ${f.distance_km} km` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-heading text-xl text-primary">{Number(f.prix_ttc).toFixed(2)} €</p>
                      <p className="text-cream/50 text-[10px]">TTC ({Number(f.prix_ht).toFixed(2)} € HT)</p>
                    </div>
                    <button
                      onClick={() => handleDownloadFacture(f)}
                      disabled={downloadingId === f.id}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-navy font-heading text-xs tracking-[0.15em] uppercase hover:bg-gold-light transition-colors rounded disabled:opacity-50"
                    >
                      {downloadingId === f.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      PDF
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Historique modal */}
      {historyFor && (
        <div className="fixed inset-0 bg-navy/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-navy-dark border border-primary/30 rounded-xl max-w-md w-full p-6 relative max-h-[80vh] overflow-auto">
            <button
              onClick={() => setHistoryFor(null)}
              className="absolute top-4 right-4 text-cream/60 hover:text-cream"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
            <h2 className="font-heading text-lg text-primary tracking-wider mb-1">Historique — {historyFor.numero}</h2>
            <p className="text-cream/60 text-xs mb-4">{historyFor.depart} → {historyFor.arrivee}</p>
            {history === null ? (
              <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" size={20} /></div>
            ) : history.length === 0 ? (
              <p className="text-cream/60 text-sm">Aucun événement enregistré.</p>
            ) : (
              <div className="space-y-2">
                {history.map(h => {
                  const to = STATUT_LABELS[h.new_statut]?.label ?? h.new_statut;
                  const from = h.old_statut ? (STATUT_LABELS[h.old_statut]?.label ?? h.old_statut) : null;
                  return (
                    <div key={h.id} className="flex items-start gap-3 p-2.5 rounded border border-cream/10 bg-navy/40">
                      <History size={13} className="text-primary shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="text-cream">{from ? `${from} → ${to}` : `Créé (${to})`}</p>
                        <p className="text-cream/50 mt-0.5">{new Date(h.created_at).toLocaleString("fr-FR")}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {active && (
        <div className="fixed inset-0 bg-navy/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-auto">
          <div className="bg-navy-dark border border-primary/30 rounded-xl max-w-2xl w-full p-6 my-8 relative">
            <button
              onClick={() => setActiveId(null)}
              className="absolute top-4 right-4 text-cream/60 hover:text-cream transition-colors"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
            <div className="mb-4">
              <h2 className="font-heading text-xl text-primary tracking-wider">
                {step === "acceptation" ? "Acceptation du devis" : step === "docs" ? "Documents véhicule" : "Paiement"} — {active.numero}
              </h2>
              <p className="text-cream/70 text-sm mt-1">{active.depart} → {active.arrivee} · {Number(active.prix_estime).toFixed(2)} €</p>

              <div className="flex items-center gap-1.5 mt-4 text-[10px] uppercase tracking-wider">
                {(["acceptation", "docs", "pay"] as const).map((s, i) => {
                  const labels = { acceptation: "Signature", docs: "Documents", pay: "Paiement" };
                  const order = ["acceptation", "docs", "pay"];
                  const currentIdx = order.indexOf(step);
                  const done = i < currentIdx;
                  const isCurrent = i === currentIdx;
                  return (
                    <div key={s} className="flex items-center gap-1.5 flex-1">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${isCurrent ? "bg-primary text-navy" : done ? "bg-emerald-500/20 text-emerald-300" : "bg-cream/10 text-cream/40"}`}>
                        {done ? "✓" : i + 1}
                      </span>
                      <span className={isCurrent ? "text-primary" : done ? "text-emerald-400" : "text-cream/40"}>{labels[s]}</span>
                      {i < 2 && <div className="h-px flex-1 bg-cream/10" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {step === "acceptation" ? (
              <DevisAcceptationStep
                devisId={active.id}
                numero={active.numero}
                depart={active.depart}
                arrivee={active.arrivee}
                prixTtc={Number(active.prix_estime)}
                dateSouhaitee={active.date_souhaitee}
                onAccepted={() => {
                  setStep(active.vehicule_docs_completed ? "pay" : "docs");
                  refresh();
                }}
                onCancel={() => setActiveId(null)}
              />
            ) : step === "docs" ? (
              <VehiculeDocsStep
                devisId={active.id}
                initialVin={active.vin}
                initialRectoUrl={active.carte_grise_recto_url}
                initialVersoUrl={active.carte_grise_verso_url}
                onCompleted={() => {
                  setStep("pay");
                  refresh();
                }}
              />
            ) : (
              <>
                <AvoirRedemption
                  devisId={active.id}
                  prixTtc={Number(active.prix_estime)}
                  dejaApplique={Number((active as Record<string, unknown>)["avoir_applique"] ?? 0)}
                  onApplied={() => refresh()}
                />
                <DevisEmbeddedCheckout devisId={active.id} returnUrl={returnUrl} />
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
