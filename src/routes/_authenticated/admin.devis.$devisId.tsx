import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Download, Loader2, ArrowRightCircle, Trash2, Mail, Phone,
  MapPin, Car, FileText, Calendar, PenLine, ShieldCheck, Eye, XCircle, KeyRound, Clock, Link2,
} from "lucide-react";
import { generateDevisPdf, downloadDevisPdf, devisRowToPdfData, type DevisData } from "@/lib/devis-pdf";
import { ValidateDevisButton } from "@/components/admin/ValidateDevisButton";
import { SendDocumentByEmail } from "@/components/admin/SendDocumentByEmail";
import {
  PageHeader, Card, Badge, Button, IconButton, Select, devisStatutTone,
} from "@/components/admin/AdminUI";
import { ClientLogo } from "@/components/admin/ClientLogo";
import { AdminOrgContextBanner, type OrgContextKind } from "@/components/admin/AdminOrgContextBanner";
import { EditableNumero } from "@/components/admin/EditableNumero";
import { VehiculesPrixDialog } from "@/components/admin/VehiculesPrixDialog";
import { convertDevisToMission } from "@/lib/admin-devis-conversion.functions";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
import { PoLinkCard } from "@/components/admin/PoLinkCard";

export const Route = createFileRoute("/_authenticated/admin/devis/$devisId")({
  component: AdminDevisDetailPage,
});

const STATUTS = [
  { value: "envoye", label: "Envoyé" },
  { value: "accepte", label: "Accepté" },
  { value: "refuse", label: "Refusé" },
  { value: "convertit", label: "Converti en mission" },
];

function AdminDevisDetailPage() {
  const { devisId } = Route.useParams();
  const navigate = useNavigate();
  const convertDevis = useServerFn(convertDevisToMission);
  const [devis, setDevis] = useState<any | null>(null);
  const [acceptation, setAcceptation] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [otpEvents, setOtpEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [prixVehiculesOpen, setPrixVehiculesOpen] = useState(false);


  const buildDevisData = (row: any): DevisData =>
    devisRowToPdfData(row as Record<string, unknown>, {
      societe: row._profile?.societe ?? null,
      siret: row._profile?.siret ?? null,
      tva_intra: row._profile?.tva_intra ?? null,
      logo_url: row._profile?.logo_url ?? null,
      adresse: row._profile?.adresse_facturation ?? row._profile?.adresse ?? null,
    });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("devis").select("*").eq("id", devisId).maybeSingle();
    if (error || !data) {
      toast.error("Devis introuvable");
      setLoading(false);
      return;
    }
    // Enrich with company info from profile (by user_id or email)
    let profile: any = null;
    if (data.user_id) {
      const { data: p } = await supabase
        .from("profiles")
        .select("user_id, societe, siret, tva_intra, logo_url, adresse, adresse_facturation, type_client" as never)
        .eq("user_id", data.user_id)
        .maybeSingle();
      profile = p;
    }
    if (!profile && data.email) {
      const { data: p } = await supabase
        .from("profiles")
        .select("user_id, societe, siret, tva_intra, logo_url, adresse, adresse_facturation, type_client" as never)
        .eq("email", data.email)
        .maybeSingle();
      profile = p;
    }
    const enriched = { ...data, _profile: profile };
    setDevis(enriched);
    setPriceInput(enriched.prix_estime != null ? String(enriched.prix_estime) : "");


    // Load acceptance signature / signed PDF if available
    if (enriched.locked_at) {
      const { data: acc } = await supabase
        .from("devis_acceptations")
        .select("*")
        .eq("devis_id", enriched.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (acc) {
        const signedUrls: any = {};
        if (acc.signature_url) {
          const { data: sig } = await supabase.storage
            .from("devis-acceptes")
            .createSignedUrl(acc.signature_url, 300);
          if (sig?.signedUrl) signedUrls.signature = sig.signedUrl;
        }
        if (acc.pdf_url) {
          const { data: pdf } = await supabase.storage
            .from("devis-acceptes")
            .createSignedUrl(acc.pdf_url, 300);
          if (pdf?.signedUrl) signedUrls.pdf = pdf.signedUrl;
        }
        setAcceptation({ ...acc, _signedUrls: signedUrls });
      } else {
        setAcceptation(null);
      }
    } else {
      setAcceptation(null);
    }

    // Historique (statuts) + envois OTP — non bloquant
    try {
      const [{ data: hist }, { data: otp }] = await Promise.all([
        supabase
          .from("devis_status_history")
          .select("id, old_statut, new_statut, note, created_at")
          .eq("devis_id", enriched.id)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("devis_otp_challenges")
          .select("id, email, method, attempts, expires_at, consumed_at, created_at, ip_address")
          .eq("devis_id", enriched.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      setHistory(hist ?? []);
      setOtpEvents(otp ?? []);
    } catch {
      setHistory([]); setOtpEvents([]);
    }

    setLoading(false);
    try {
      const blob = await generateDevisPdf(buildDevisData(enriched));
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error("PDF preview error", e);
    }
  };

  useEffect(() => {
    load();
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devisId]);

  const handleDownload = async () => {
    if (!devis) return;
    setGenerating(true);
    try {
      const blob = await generateDevisPdf(buildDevisData(devis));
      downloadDevisPdf(blob, devis.numero);
    } finally { setGenerating(false); }
  };

  const updateStatut = async (statut: string) => {
    if (!devis) return;
    await supabase.from("devis").update({ statut }).eq("id", devis.id);
    setDevis({ ...devis, statut });
    toast.success("Statut mis à jour");
  };

  const handleUpdatePrice = async () => {
    if (!devis) return;
    const n = parseFloat(priceInput.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Montant TTC invalide");
      return;
    }
    setSavingPrice(true);
    try {
      const { error } = await supabase
        .from("devis")
        .update({ prix_estime: n, prix_manuel: true, prix_aller: null, prix_retour: null } as never)
        .eq("id", devis.id);
      if (error) throw error;
      const next = { ...devis, prix_estime: n };
      setDevis(next);
      try {
        const blob = await generateDevisPdf(buildDevisData(next));
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(URL.createObjectURL(blob));
      } catch (e) {
        console.error("PDF regen error", e);
      }
      toast.success("Prix mis à jour", { description: `${n.toFixed(2)} € TTC · PDF régénéré` });
    } catch (e) {
      toast.error("Impossible de modifier le prix", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSavingPrice(false);
    }
  };


  const handleConvert = async () => {
    if (!devis || devis.mission_id) return;
    if (!(await confirmToast(`Convertir ${devis.numero} en mission ?`))) return;
    setConverting(true);
    try {
      const mission = await convertDevis({ data: { devisId: devis.id } });
      toast.success(mission.alreadyConverted ? "Devis déjà converti" : "Mission créée", { description: mission.numero });
      setDevis({ ...devis, statut: "convertit", mission_id: mission.missionId });
    } catch (e) {
      toast.error("Échec conversion", { description: e instanceof Error ? e.message : "" });
    } finally { setConverting(false); }
  };

  const handleDelete = async () => {
    if (!devis) return;
    if (!(await confirmToast("Supprimer définitivement ce devis ?"))) return;
    await supabase.from("devis").delete().eq("id", devis.id);
    toast.success("Devis supprimé");
    navigate({ to: "/admin/devis" });
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-pro-accent" size={32} /></div>;
  }
  if (!devis) {
    return (
      <div className="py-16 text-center">
        <p className="text-pro-text-soft mb-4">Devis introuvable.</p>
        <Link to="/admin/devis"><Button icon={<ArrowLeft size={14} />}>Retour</Button></Link>
      </div>
    );
  }

  const statut = STATUTS.find((s) => s.value === devis.statut) || STATUTS[0];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link to="/admin/devis">
          <IconButton title="Retour"><ArrowLeft size={16} /></IconButton>
        </Link>
        <PageHeader
          title={`Devis ${devis.numero}`}
          subtitle={`Créé le ${new Date(devis.created_at).toLocaleDateString("fr-FR")}`}
          logo={
            <ClientLogo
              src={devis._profile?.logo_url ?? null}
              name={devis._profile?.societe || `${devis.prenom ?? ""} ${devis.nom ?? ""}`.trim() || devis.email}
              isCompany={!!devis._profile?.societe}
              size="md"
            />
          }
        />
      </div>

      <div className="mb-5">
        <AdminOrgContextBanner
          clientId={devis._profile?.user_id ?? undefined}
          name={devis._profile?.societe || `${devis.prenom ?? ""} ${devis.nom ?? ""}`.trim() || devis.email}
          kind={
            (devis._profile?.type_client === "flotte"
              ? "flotte"
              : devis._profile?.type_client === "b2b" || !!devis._profile?.societe
                ? "b2b"
                : "particulier") as OrgContextKind
          }
          email={devis.email}
          phone={devis.telephone}
          logoUrl={devis._profile?.logo_url ?? null}
          societe={devis._profile?.societe ?? null}
        />
      </div>


      <div className="mb-5">
        <PoLinkCard devisId={devis.id} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: details */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="font-mono text-pro-accent text-sm font-semibold">{devis.numero}</span>
              <EditableNumero
                table="devis"
                id={devis.id}
                value={devis.numero}
                onSaved={(next: string) => setDevis((d: any) => (d ? { ...d, numero: next } : d))}
              />
              <Badge tone={devisStatutTone[devis.statut] ?? "neutral"}>{statut.label}</Badge>
              {devis.email_envoye && <Badge tone="success">Email envoyé</Badge>}
              {devis.mission_id && <Badge tone="info">Mission</Badge>}
            </div>
            <p className="text-pro-text font-medium text-lg">{devis.prenom} {devis.nom}</p>
            <div className="mt-2 space-y-1 text-xs text-pro-text-soft">
              <p className="flex items-center gap-2"><Mail size={12} />{devis.email}</p>
              {devis.telephone && <p className="flex items-center gap-2"><Phone size={12} />{devis.telephone}</p>}
            </div>
          </Card>

          <Card>
            <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-3">Trajet</p>
            <div className="space-y-2 text-sm">
              <p className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 text-pro-accent shrink-0" /><span><span className="text-pro-muted text-xs block">Départ</span>{devis.depart}</span></p>
              <p className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 text-pro-accent shrink-0" /><span><span className="text-pro-muted text-xs block">Arrivée</span>{devis.arrivee}</span></p>
              <div className="flex gap-4 text-xs text-pro-text-soft pt-2 border-t border-pro-border">
                <span>{devis.distance_km ?? "—"} km</span>
                {devis.duree_estimee && <span>{devis.duree_estimee}</span>}
                <span className="capitalize">{devis.option_trajet}</span>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-3">Véhicule</p>
            <div className="space-y-1 text-sm">
              <p className="flex items-center gap-2"><Car size={14} className="text-pro-accent" />{[devis.marque, devis.modele].filter(Boolean).join(" ") || devis.type_vehicule || "—"}</p>
              {devis.carburant && <p className="text-xs text-pro-text-soft">{devis.carburant}</p>}
            </div>
          </Card>

          {(devis.date_souhaitee || devis.heure_souhaitee) && (
            <Card>
              <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-3">Date souhaitée</p>
              <p className="flex items-center gap-2 text-sm">
                <Calendar size={14} className="text-pro-accent" />
                {devis.date_souhaitee ? new Date(devis.date_souhaitee).toLocaleDateString("fr-FR") : "—"}
                {devis.heure_souhaitee && <span className="text-pro-text-soft"> à {devis.heure_souhaitee}</span>}
              </p>
            </Card>
          )}

          <Card>
            <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-2">Montant</p>
            <p className="text-3xl font-semibold text-pro-text">{devis.prix_estime} €</p>
            <p className="text-[10px] text-pro-muted uppercase tracking-wider">TTC</p>
            {devis.tarif_label && <p className="text-xs text-pro-text-soft mt-2">{devis.tarif_label}</p>}

            {Array.isArray(devis.vehicules) && devis.vehicules.length > 1 && (
              <div className="mt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPrixVehiculesOpen(true)}
                  icon={<Car size={12} />}
                >
                  Prix par véhicule ({devis.vehicules.length})
                </Button>
              </div>
            )}



            {devis.locked_at ? (
              <p className="mt-3 text-[11px] text-pro-muted">Devis signé/verrouillé : le montant n'est plus modifiable.</p>
            ) : (
              <div className="mt-4 pt-3 border-t border-pro-border">
                <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-2">Corriger le prix</p>
                <div className="flex gap-2">
                  <input
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    inputMode="decimal"
                    placeholder="Montant TTC"
                    className="w-full rounded-lg border border-pro-border bg-white px-3 py-2 text-sm text-pro-text focus:border-pro-accent focus:outline-none focus:ring-2 focus:ring-pro-accent/20"
                  />
                  <Button
                    onClick={handleUpdatePrice}
                    disabled={savingPrice}
                    icon={savingPrice ? <Loader2 size={12} className="animate-spin" /> : <PenLine size={12} />}
                  >
                    Régénérer
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-pro-muted">Le PDF est régénéré avec le nouveau montant.</p>
              </div>
            )}
          </Card>


          {acceptation && (
            <Card>
              <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-3 flex items-center gap-2">
                <ShieldCheck size={12} /> Preuves de signature
              </p>
              <div className="flex items-center gap-2 mb-3">
                <Badge tone="success">Signé</Badge>
                {acceptation.validation_method === "email_otp" ? (
                  <Badge tone="info"><KeyRound size={10} className="inline mr-1" />Code e-mail</Badge>
                ) : (
                  <Badge tone="neutral"><PenLine size={10} className="inline mr-1" />Signature manuscrite</Badge>
                )}
              </div>
              <dl className="space-y-1.5 text-xs text-pro-text-soft mb-3">
                <div className="flex justify-between gap-3"><dt className="text-pro-muted">Date</dt><dd className="text-pro-text text-right">{new Date(acceptation.accepted_at).toLocaleString("fr-FR")}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-pro-muted">E-mail vérifié</dt><dd className="text-pro-text text-right break-all">{acceptation.client_email || "—"}</dd></div>
                {acceptation.otp_sent_at && (
                  <div className="flex justify-between gap-3"><dt className="text-pro-muted">Code envoyé</dt><dd className="text-pro-text text-right">{new Date(acceptation.otp_sent_at).toLocaleString("fr-FR")}</dd></div>
                )}
                {acceptation.otp_verified_at && (
                  <div className="flex justify-between gap-3"><dt className="text-pro-muted">Code vérifié</dt><dd className="text-pro-text text-right">{new Date(acceptation.otp_verified_at).toLocaleString("fr-FR")}</dd></div>
                )}
                <div className="flex justify-between gap-3"><dt className="text-pro-muted">Adresse IP</dt><dd className="text-pro-text text-right font-mono">{acceptation.ip_address || "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-pro-muted">Navigateur</dt><dd className="text-pro-text text-right truncate max-w-[180px]" title={acceptation.user_agent ?? undefined}>{acceptation.user_agent ? acceptation.user_agent.slice(0, 40) + (acceptation.user_agent.length > 40 ? "…" : "") : "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-pro-muted">Montant accepté</dt><dd className="text-pro-text text-right">{Number(acceptation.montant_accepte).toFixed(2)} €</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-pro-muted">CGV</dt><dd className="text-pro-text text-right">{acceptation.cgv_version || "—"}</dd></div>
              </dl>
              {acceptation._signedUrls?.signature && (
                <img src={acceptation._signedUrls.signature} alt="Signature client" className="max-h-24 mb-3 border border-pro-border rounded" />
              )}
              <div className="flex gap-2">
                {acceptation._signedUrls?.pdf && (
                  <Button icon={<Eye size={12} />} className="flex-1" onClick={() => window.open(acceptation._signedUrls.pdf, "_blank")}>
                    PDF signé
                  </Button>
                )}
                {acceptation._signedUrls?.signature && (
                  <Button icon={<Download size={12} />} className="flex-1" onClick={() => window.open(acceptation._signedUrls.signature, "_blank")}>
                    Signature
                  </Button>
                )}
              </div>
            </Card>
          )}

          {devis.statut === "refuse" && (
            <Card>
              <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-3 flex items-center gap-2">
                <XCircle size={12} className="text-red-500" /> Devis refusé
              </p>
              <div className="space-y-1.5 text-xs text-pro-text-soft">
                {devis.refused_at && (
                  <p><span className="text-pro-muted">Refusé le </span><span className="text-pro-text">{new Date(devis.refused_at).toLocaleString("fr-FR")}</span></p>
                )}
                {devis.refus_motif ? (
                  <p className="italic text-pro-text mt-2 p-2 rounded bg-red-500/5 border border-red-500/20">"{devis.refus_motif}"</p>
                ) : (
                  <p className="text-pro-muted">Aucun motif communiqué.</p>
                )}
              </div>
            </Card>
          )}

          {(otpEvents.length > 0 || history.length > 0) && (
            <Card>
              <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-3 flex items-center gap-2">
                <Clock size={12} /> Historique
              </p>
              <ul className="space-y-2 text-xs">
                {history.map((h) => (
                  <li key={`h-${h.id}`} className="flex items-start gap-2">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-pro-accent shrink-0" />
                    <div className="flex-1">
                      <p className="text-pro-text">Statut : <span className="font-medium">{h.new_statut}</span>{h.old_statut ? ` (depuis ${h.old_statut})` : ""}</p>
                      <p className="text-pro-muted">{new Date(h.created_at).toLocaleString("fr-FR")}</p>
                      {h.note && <p className="italic text-pro-text-soft mt-0.5">"{h.note}"</p>}
                    </div>
                  </li>
                ))}
                {otpEvents.map((o) => (
                  <li key={`o-${o.id}`} className="flex items-start gap-2">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-pro-text">
                        Code {o.method} envoyé à <span className="font-mono">{o.email}</span>
                        {o.consumed_at ? " · vérifié" : o.attempts > 0 ? ` · ${o.attempts} tentative(s)` : ""}
                      </p>
                      <p className="text-pro-muted">{new Date(o.created_at).toLocaleString("fr-FR")}{o.ip_address ? ` · ${o.ip_address}` : ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {devis.message && (
            <Card>
              <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-2">Message client</p>
              <p className="text-sm italic text-pro-text-soft">"{devis.message}"</p>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-3">Actions</p>
            <div className="space-y-2">
              <ValidateDevisButton
                devisId={devis.id}
                numero={devis.numero}
                locked={!!devis.locked_at}
                className="w-full"
                onValidated={load}
              />
              <Select value={devis.statut} onChange={(e) => updateStatut(e.target.value)} className="w-full text-xs">
                {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
              <Button onClick={handleDownload} disabled={generating} icon={generating ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} className="w-full">
                Télécharger PDF
              </Button>
              <Button onClick={handleConvert} disabled={converting || !!devis.mission_id} icon={converting ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightCircle size={12} />} className="w-full">
                {devis.mission_id ? "Mission créée" : "Convertir en mission"}
              </Button>
              <button
                onClick={handleDelete}
                className="w-full text-xs text-red-400 hover:text-red-300 py-2 flex items-center justify-center gap-2 border border-red-500/20 rounded hover:bg-red-500/5 transition"
              >
                <Trash2 size={12} /> Supprimer
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-pro-border">
              <SendDocumentByEmail
                kind="devis"
                numero={devis.numero}
                documentId={devis.id}
                defaultEmail={devis.email}
                buildPdf={() => generateDevisPdf(buildDevisData(devis))}
                templateData={{
                  prenom: devis.prenom,
                  nom: devis.nom,
                  depart: devis.depart,
                  arrivee: devis.arrivee,
                  distance: devis.distance_km,
                  prix: devis.prix_estime != null ? Number(devis.prix_estime).toFixed(2) : undefined,
                  optionTrajet: devis.option_trajet,
                }}
              />
            </div>
          </Card>

        </div>

        {/* Right: PDF preview */}
        <div className="lg:col-span-2">
          <Card padded={false} className="overflow-hidden">
            <div className="px-4 py-3 border-b border-pro-border flex items-center gap-2">
              <FileText size={14} className="text-pro-accent" />
              <span className="text-xs uppercase tracking-wider text-pro-muted font-medium">Aperçu PDF</span>
            </div>
            {pdfUrl ? (
              <iframe src={pdfUrl} className="w-full" style={{ height: "min(85vh, 1100px)" }} title={`Devis ${devis.numero}`} />
            ) : (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-pro-accent" size={24} /></div>
            )}
          </Card>
        </div>
      </div>

      <VehiculesPrixDialog
        open={prixVehiculesOpen}
        onClose={() => setPrixVehiculesOpen(false)}
        devisId={devisId}
        title={`Prix par véhicule — devis ${devis.numero ?? ""}`}
        onSaved={() => void load()}
      />
    </div>

  );
}
