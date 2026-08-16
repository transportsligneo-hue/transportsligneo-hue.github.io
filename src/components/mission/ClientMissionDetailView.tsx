import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Calendar, Car, User, Phone, Mail, FileText, Loader2, Receipt, Download, Building2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, missionStatusKind, missionStatusLabel } from "@/components/dashboard/StatusBadge";
import { MissionTrackingPanel } from "@/components/mission/MissionTrackingPanel";
import { generateFacturePdf, downloadFacturePdf } from "@/lib/facture-pdf";
import { generateEdlFinalPdf } from "@/lib/edl-final-pdf";
import { MissionLegBadge } from "@/components/mission/MissionLegBadge";
import { MissionTwinLink } from "@/components/mission/MissionTwinLink";
import { legRef } from "@/lib/mission-number";

interface Mission {
  id: string;
  numero: string;
  ville_depart: string;
  ville_arrivee: string;
  date_prise_en_charge: string;
  type_trajet: string;
  statut: string;
  prix_total: number;
  marque: string | null;
  modele: string | null;
  immatriculation: string | null;
  carburant: string | null;
  vin: string | null;
  carte_grise_recto_url: string | null;
  carte_grise_verso_url: string | null;
  remarques: string | null;

  options: unknown;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  created_at: string;
  mission_group_id: string | null;
  leg_type: string | null;
}

interface ClientMissionDetailViewProps {
  missionId: string;
  backTo: "/dashboard-client/missions" | "/dashboard-pro/missions" | "/flotte/missions";
  backLabel?: string;
}

export function ClientMissionDetailView({ missionId, backTo, backLabel = "Retour aux missions" }: ClientMissionDetailViewProps) {
  const [mission, setMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);
  const [attributionId, setAttributionId] = useState<string | null>(null);
  const [trajetId, setTrajetId] = useState<string | null>(null);
  const [convoyeurId, setConvoyeurId] = useState<string | null>(null);
  const [, setPdfShareEnabled] = useState(false);
  const [hasProofs, setHasProofs] = useState(false);
  const [downloadingEdl, setDownloadingEdl] = useState(false);
  const [facture, setFacture] = useState<{ id: string; numero: string; prix_ttc: number; statut: string; pdf_url: string | null; date_facture: string | null } | null>(null);
  const [downloadingFact, setDownloadingFact] = useState(false);
  const [arrivalContact, setArrivalContact] = useState<{ nom: string | null; prenom: string | null; societe: string | null; telephone: string | null; telephone2: string | null; instructions: string | null; adresse: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadMission = async () => {
      setLoading(true);

      const { data } = await supabase
        .from("missions")
        .select("*")
        .eq("id", missionId)
        .maybeSingle();

      if (cancelled) return;

      const m = data as Mission | null;
      setMission(m);
      setLoading(false);

      if (m) {
        type AttrLite = { id: string; trajet_id?: string | null; pdf_share_client?: boolean | null; convoyeur_id?: string | null };
        let attr: AttrLite | null = null;

        if (m.numero) {
          const { data: byNumero } = await supabase
            .from("attributions")
            .select("id, trajet_id, pdf_share_client, convoyeur_id")
            .eq("numero_mission", m.numero)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (byNumero) attr = byNumero as AttrLite;
        }

        let trajetCandidate: string | null = null;
        if (!attr && m.numero) {
          const { data: tByRef } = await supabase
            .from("trajets")
            .select("id")
            .eq("commande_ref", m.numero)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (tByRef?.id) trajetCandidate = tByRef.id;
        }

        if (!attr && !trajetCandidate) {
          const { data: trajets } = await supabase
            .from("trajets")
            .select("id")
            .ilike("depart", `%${m.ville_depart}%`)
            .ilike("arrivee", `%${m.ville_arrivee}%`)
            .eq("date_trajet", m.date_prise_en_charge)
            .order("created_at", { ascending: false })
            .limit(1);
          if (trajets?.[0]?.id) trajetCandidate = trajets[0].id;
        }

        if (!attr && trajetCandidate) {
          const { data: byTrajet } = await supabase
            .from("attributions")
            .select("id, trajet_id, pdf_share_client, convoyeur_id")
            .eq("trajet_id", trajetCandidate)
            .order("created_at", { ascending: false });
          const list = (byTrajet ?? []) as AttrLite[];
          attr = list.find((a) => a.convoyeur_id) ?? list[0] ?? null;
        }

        if (!cancelled) {
          if (attr) {
            setAttributionId(attr.id);
            setTrajetId(attr.trajet_id ?? trajetCandidate ?? null);
            setConvoyeurId(attr.convoyeur_id ?? null);
            setPdfShareEnabled(Boolean(attr.pdf_share_client));
          } else if (trajetCandidate) {
            setTrajetId(trajetCandidate);
          }
        }

        const finalTrajetId = attr?.trajet_id ?? trajetCandidate ?? null;
        if (finalTrajetId && !cancelled) {
          const { data: tj } = await supabase
            .from("trajets")
            .select("arrivee, arrivee_contact_nom, arrivee_contact_prenom, arrivee_contact_societe, arrivee_contact_telephone, arrivee_contact_telephone2, arrivee_contact_instructions")
            .eq("id", finalTrajetId)
            .maybeSingle();
          if (!cancelled && tj) {
            setArrivalContact({
              nom: tj.arrivee_contact_nom ?? null,
              prenom: tj.arrivee_contact_prenom ?? null,
              societe: tj.arrivee_contact_societe ?? null,
              telephone: tj.arrivee_contact_telephone ?? null,
              telephone2: tj.arrivee_contact_telephone2 ?? null,
              instructions: tj.arrivee_contact_instructions ?? null,
              adresse: tj.arrivee ?? null,
            });
          }
        }
      }

      const { data: fact } = await supabase
        .from("factures")
        .select("id, numero, prix_ttc, statut, pdf_url, date_facture, mode_paiement")
        .eq("mission_id", missionId)
        .order("created_at", { ascending: false })
        .maybeSingle();

      if (!cancelled && fact) setFacture(fact);
    };

    void loadMission();
    return () => {
      cancelled = true;
    };
  }, [missionId]);

  useEffect(() => {
    if (!missionId) return;
    const channel = supabase
      .channel(`mission-${missionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "missions", filter: `id=eq.${missionId}` },
        (payload) => {
          const next = payload.new as Partial<Mission>;
          setMission((prev) => (prev ? { ...prev, ...next } : prev));
          if (next.statut) {
            toast.success("Statut mis à jour", {
              description: missionStatusLabel(next.statut),
            });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [missionId]);

  const handleDownloadFacture = async () => {
    if (!mission || !facture) return;
    setDownloadingFact(true);
    try {
      if (facture.pdf_url) {
        window.open(facture.pdf_url, "_blank");
        return;
      }
      const { data: full } = await supabase.from("factures").select("*").eq("id", facture.id).maybeSingle();
      if (!full) throw new Error("Facture introuvable");
      const blob = await generateFacturePdf({
        numero: full.numero,
        type_facture: (full.type_facture as "particulier" | "b2b") ?? "particulier",
        date_facture: full.date_facture ?? undefined,
        date_paiement: full.date_paiement,
        statut: full.statut,
        client_nom: full.client_nom,
        client_prenom: full.client_prenom,
        client_societe: full.client_societe,
        client_email: full.client_email,
        client_adresse: full.client_adresse,
        client_siret: full.client_siret,
        client_tva: full.client_tva,
        designation: full.designation,
        depart: full.depart,
        arrivee: full.arrivee,
        distance_km: full.distance_km,
        prix_ht: Number(full.prix_ht),
        tva_taux: Number(full.tva_taux),
        prix_tva: Number(full.prix_tva),
        prix_ttc: Number(full.prix_ttc),
        mode_paiement: full.mode_paiement,
        client_user_id: (full as { user_id?: string | null }).user_id ?? (mission as unknown as { user_id?: string | null }).user_id ?? null,
      });
      downloadFacturePdf(blob, full.numero);
    } catch (e) {
      toast.error("Téléchargement impossible", { description: (e as Error).message });
    } finally {
      setDownloadingFact(false);
    }
  };

  const handleDownloadEdl = async () => {
    if (!attributionId || !mission || downloadingEdl) return;
    setDownloadingEdl(true);
    try {
      const { data: attr } = await supabase
        .from("attributions")
        .select("numero_mission, trajet_id, convoyeur_id")
        .eq("id", attributionId)
        .maybeSingle();
      if (!attr) {
        toast.error("PDF non disponible");
        return;
      }

      const [{ data: trajet }, { data: conv }, { data: insps }, { data: sigs }] = await Promise.all([
        supabase.from("trajets").select("*").eq("id", attr.trajet_id).maybeSingle(),
        supabase.from("convoyeurs").select("nom, prenom, telephone").eq("id", attr.convoyeur_id).maybeSingle(),
        supabase.from("inspections").select("id, type, equipements, kilometrage_depart, kilometrage_arrivee").eq("attribution_id" as never, attributionId as never),
        supabase.from("mission_signatures").select("kind, signature_data").eq("attribution_id", attributionId),
      ]);
      const photosDepart: { vue_type: string; url: string }[] = [];
      const photosArrivee: { vue_type: string; url: string }[] = [];
      for (const ins of (insps as { id: string; type: string; equipements?: unknown; kilometrage_depart?: number; kilometrage_arrivee?: number }[]) ?? []) {
        const { data: photos } = await supabase.from("inspection_photos").select("vue_type, url_photo").eq("inspection_id", ins.id);
        for (const p of (photos as { vue_type: string; url_photo: string }[]) ?? []) {
          const { data: signed } = await supabase.storage.from("inspection-photos").createSignedUrl(p.url_photo, 600);
          if (signed?.signedUrl) {
            (ins.type === "arrivee" ? photosArrivee : photosDepart).push({ vue_type: p.vue_type, url: signed.signedUrl });
          }
        }
      }
      const signatures: { kind: string; url?: string | null }[] = ((sigs as { kind: string; signature_data: string | null }[]) ?? [])
        .map((s) => ({ kind: s.kind, url: s.signature_data }));

      const lastIns = (insps as { equipements?: Record<string, unknown>; kilometrage_depart?: number; kilometrage_arrivee?: number }[])?.[0];
      const blob = await generateEdlFinalPdf({
        numero: attr.numero_mission ?? mission.numero,
        date_mission: mission.date_prise_en_charge,
        depart: trajet?.depart ?? mission.ville_depart,
        arrivee: trajet?.arrivee ?? mission.ville_arrivee,
        vehicule: { marque: mission.marque, modele: mission.modele, immatriculation: mission.immatriculation, vin: (trajet as { vin?: string } | null)?.vin ?? null },
        convoyeur: conv ?? null,
        equipements: lastIns?.equipements ?? null,
        kilometrage_depart: lastIns?.kilometrage_depart ?? null,
        kilometrage_arrivee: lastIns?.kilometrage_arrivee ?? null,
        photosDepart, photosArrivee, signatures,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `EDL-${attr.numero_mission ?? mission.numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Téléchargement impossible", { description: (e as Error).message });
    } finally {
      setDownloadingEdl(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin mission-accent" size={28} /></div>;
  if (!mission) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="mission-text-muted text-sm">Mission introuvable.</p>
        <Link to={backTo} className="mission-accent text-xs uppercase tracking-wider hover:opacity-80">
          ← {backLabel}
        </Link>
      </div>
    );
  }

  const options = Array.isArray(mission.options) ? mission.options as Array<{ label: string; price: number }> : [];

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to={backTo} className="inline-flex items-center gap-2 mission-text-muted text-xs uppercase tracking-wider hover:mission-accent transition-colors">
        <ArrowLeft size={14} /> {backLabel}
      </Link>

      <div className="mission-surface p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="mission-text-muted text-[10px] uppercase tracking-wider">{legRef(mission.numero, mission.leg_type, null, mission.leg_type === "aller" || mission.leg_type === "retour")}</p>
              <MissionLegBadge leg={mission.leg_type as "aller" | "retour" | "simple" | null} />
            </div>
            <h1 className="font-heading text-2xl mission-text mt-1 flex items-center gap-2">
              <MapPin size={18} className="mission-accent" />
              {mission.ville_depart} → {mission.ville_arrivee}
            </h1>
            {mission.mission_group_id && mission.leg_type && mission.leg_type !== "simple" ? (
              <div className="mt-2">
                <MissionTwinLink
                  source="missions"
                  groupId={mission.mission_group_id}
                  currentId={mission.id}
                  linkTo={(twinId) => ({ to: `${backTo}/$missionId`, params: { missionId: twinId } })}
                />
              </div>
            ) : null}
          </div>
          <StatusBadge kind={missionStatusKind(mission.statut)} size="md">
            {missionStatusLabel(mission.statut)}
          </StatusBadge>
        </div>
        <div className="flex items-center justify-between border-t mission-divider pt-4">
          <span className="mission-text-soft text-xs uppercase tracking-wider flex items-center gap-1">
            <Calendar size={12} /> {new Date(mission.date_prise_en_charge).toLocaleDateString("fr-FR")}
          </span>
          <span className="font-heading mission-text text-2xl font-semibold">{Number(mission.prix_total).toFixed(2)} €</span>
        </div>
      </div>

      {attributionId && (
        <MissionTrackingPanel
          attributionId={attributionId}
          trajetId={trajetId}
          convoyeurId={convoyeurId}
          onProofsAvailable={setHasProofs}
        />
      )}

      {attributionId && hasProofs && (
        <div className="mission-surface p-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-heading text-sm mission-text tracking-wider">Rapport de mission (PDF unique)</p>
            <p className="mission-text-soft text-xs mt-1">Toutes les preuves (photos, signatures, EDL) consolidées dans un PDF unique.</p>
          </div>
          <button
            onClick={handleDownloadEdl}
            disabled={downloadingEdl}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#00AEEF] text-white font-heading text-xs tracking-[0.15em] uppercase hover:bg-[#0098d1] transition-colors rounded disabled:opacity-50"
          >
            {downloadingEdl ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Télécharger PDF
          </button>
        </div>
      )}

      <div className="mission-surface p-5">
        <h2 className="font-heading text-sm mission-accent tracking-[0.15em] uppercase flex items-center gap-2 mb-4">
          <Car size={16} /> Véhicule
        </h2>
        <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
          <div className="min-w-0">
            <p className="mission-text-muted text-[10px] uppercase tracking-wider">Modèle</p>
            <p className="mission-text text-lg font-semibold mt-1 truncate">
              {[mission.marque, mission.modele].filter(Boolean).join(" ") || " · "}
            </p>
          </div>
          {mission.immatriculation && (
            <div className="shrink-0">
              <p className="mission-text-muted text-[10px] uppercase tracking-wider mb-1 text-right">Plaque</p>
              <span className="inline-flex items-center px-3 py-1.5 rounded-md bg-[#00AEEF] text-white font-mono font-bold tracking-[0.18em] text-sm shadow-md border border-[#00AEEF]">
                {mission.immatriculation}
              </span>
            </div>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t mission-divider">
          <Field label="Marque" value={mission.marque} />
          <Field label="Modèle" value={mission.modele} />
          <Field label="Immatriculation" value={mission.immatriculation} />
          <Field label="Numéro de série (VIN)" value={mission.vin} />
          <Field label="Carburant / Énergie" value={mission.carburant} />
        </div>
        {(mission.carte_grise_recto_url || mission.carte_grise_verso_url) && (
          <div className="pt-4 mt-4 border-t mission-divider">
            <p className="mission-text-muted text-[10px] uppercase tracking-wider mb-2">Carte grise</p>
            <div className="flex flex-wrap gap-2">
              {mission.carte_grise_recto_url && (
                <a
                  href={mission.carte_grise_recto_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#00AEEF]/10 hover:bg-[#00AEEF]/20 mission-accent text-xs font-heading tracking-wider uppercase transition-colors"
                >
                  <FileText size={12} /> Recto
                </a>
              )}
              {mission.carte_grise_verso_url && (
                <a
                  href={mission.carte_grise_verso_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#00AEEF]/10 hover:bg-[#00AEEF]/20 mission-accent text-xs font-heading tracking-wider uppercase transition-colors"
                >
                  <FileText size={12} /> Verso
                </a>
              )}
            </div>
          </div>
        )}
      </div>



      <Section title="Détails du convoyage" icon={<FileText size={16} />}>
        <Field label="Type de trajet" value={mission.type_trajet?.replace(/_/g, " ")} />
        {options.length > 0 && (
          <div className="sm:col-span-2">
            <p className="mission-text-muted text-[10px] uppercase tracking-wider mb-2">Options</p>
            <div className="space-y-1.5">
              {options.map((o, i) => (
                <div key={i} className="flex items-center justify-between text-sm mission-incident-row px-3 py-1.5 rounded">
                  <span className="mission-text-soft">{o.label}</span>
                  <span className="mission-accent text-xs font-semibold">+ {o.price.toFixed(2)} €</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {mission.remarques && (
          <div className="sm:col-span-2">
            <p className="mission-text-muted text-[10px] uppercase tracking-wider mb-1">Remarques</p>
            <p className="mission-text-soft text-sm">{mission.remarques}</p>
          </div>
        )}
      </Section>

      <Section title="Coordonnées du contact" icon={<User size={16} />}>
        <Field label="Nom" value={`${mission.prenom} ${mission.nom}`} />
        <Field label="Email" value={mission.email} icon={<Mail size={11} />} />
        <Field label="Téléphone" value={mission.telephone} icon={<Phone size={11} />} />
      </Section>

      {arrivalContact && (arrivalContact.nom || arrivalContact.prenom || arrivalContact.societe || arrivalContact.telephone || arrivalContact.adresse) && (
        <div className="mission-surface p-5">
          <h2 className="font-heading text-sm mission-accent tracking-[0.15em] uppercase flex items-center gap-2 mb-4">
            <MapPin size={16} /> Coordonnées d'arrivée
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {arrivalContact.adresse && <Field label="Adresse de livraison" value={arrivalContact.adresse} icon={<MapPin size={11} />} />}
            {arrivalContact.societe && <Field label="Société" value={arrivalContact.societe} icon={<Building2 size={11} />} />}
            {arrivalContact.nom && <Field label="Nom" value={arrivalContact.nom} icon={<User size={11} />} />}
            {arrivalContact.prenom && <Field label="Prénom" value={arrivalContact.prenom} icon={<User size={11} />} />}
            {arrivalContact.telephone && (
              <div>
                <p className="mission-text-muted text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Phone size={11} /> Téléphone
                </p>
                <a href={`tel:${arrivalContact.telephone}`} className="mission-text text-sm font-medium hover:mission-accent transition-colors">
                  {arrivalContact.telephone}
                </a>
              </div>
            )}
            {arrivalContact.telephone2 && (
              <div>
                <p className="mission-text-muted text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Phone size={11} /> Téléphone secondaire
                </p>
                <a href={`tel:${arrivalContact.telephone2}`} className="mission-text text-sm font-medium hover:mission-accent transition-colors">
                  {arrivalContact.telephone2}
                </a>
              </div>
            )}
            {arrivalContact.instructions && (
              <div className="sm:col-span-2">
                <p className="mission-text-muted text-[10px] uppercase tracking-wider mb-1">Instructions de livraison</p>
                <p className="mission-text-soft text-sm whitespace-pre-line">{arrivalContact.instructions}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {facture && (
        <div className="mission-surface p-5">
          <h2 className="font-heading text-sm mission-accent tracking-[0.15em] uppercase flex items-center gap-2 mb-4">
            <Receipt size={16} /> Facture
          </h2>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="mission-text-muted text-[10px] uppercase tracking-wider">{facture.numero}</p>
              <p className="mission-text-soft text-sm mt-0.5">
                {facture.date_facture ? new Date(facture.date_facture).toLocaleDateString("fr-FR") : " · "}
                {" · "}
                <span className={facture.statut === "payee" ? "text-[#22C55E] font-semibold" : "text-[#F59E0B] font-semibold"}>
                  {facture.statut === "payee" ? "Payée" : /virement|diff[ée]r|30|60|90/i.test((facture as { mode_paiement?: string | null }).mode_paiement ?? "") ? "Virement différé" : "À régler"}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-heading mission-text text-lg font-semibold">{Number(facture.prix_ttc).toFixed(2)} €</span>
              <button
                onClick={handleDownloadFacture}
                disabled={downloadingFact}
                className="inline-flex items-center gap-2 px-3 py-2 bg-[#00AEEF] text-white font-heading text-xs tracking-[0.15em] uppercase hover:bg-[#0098d1] transition-colors rounded disabled:opacity-50"
              >
                {downloadingFact ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="mission-text-muted text-xs text-center">
        Vous serez notifié par email à chaque évolution du statut de votre mission.
      </p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mission-surface p-5">
      <h2 className="font-heading text-sm mission-accent tracking-[0.15em] uppercase flex items-center gap-2 mb-4">
        {icon} {title}
      </h2>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({ label, value, icon }: { label: string; value: string | null | undefined; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="mission-text-muted text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
        {icon} {label}
      </p>
      <p className="mission-text text-sm font-medium">{value || " · "}</p>
    </div>
  );
}