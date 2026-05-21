import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Calendar, Car, User, Phone, Mail, FileText, Loader2, Receipt, Download } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, missionStatusKind, missionStatusLabel } from "@/components/dashboard/StatusBadge";
import { MissionLiveTracker } from "@/components/mission/MissionLiveTracker";
import { generateFacturePdf, downloadFacturePdf } from "@/lib/facture-pdf";
import { generateEdlFinalPdf } from "@/lib/edl-final-pdf";

export const Route = createFileRoute("/_authenticated/dashboard-client/missions/$missionId")({
  component: MissionDetail,
});

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
  remarques: string | null;
  options: unknown;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  created_at: string;
}

function MissionDetail() {
  const { missionId } = Route.useParams();
  const { user } = useAuth();
  const [mission, setMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);
  const [attributionId, setAttributionId] = useState<string | null>(null);
  const [pdfShareEnabled, setPdfShareEnabled] = useState(false);
  const [downloadingEdl, setDownloadingEdl] = useState(false);
  const [facture, setFacture] = useState<{ id: string; numero: string; prix_ttc: number; statut: string; pdf_url: string | null; date_facture: string | null } | null>(null);
  const [downloadingFact, setDownloadingFact] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("missions")
      .select("*")
      .eq("id", missionId)
      .maybeSingle()
      .then(async ({ data }) => {
        if (cancelled) return;
        const m = data as Mission | null;
        setMission(m);
        setLoading(false);

        // Résolution best-effort de l'attribution liée (via trajet correspondant)
        if (m) {
          const { data: trajets } = await supabase
            .from("trajets")
            .select("id")
            .eq("depart", m.ville_depart)
            .eq("arrivee", m.ville_arrivee)
            .eq("date_trajet", m.date_prise_en_charge)
            .limit(1);
          const trajetId = trajets?.[0]?.id;
          if (trajetId) {
            const { data: attr } = await supabase
              .from("attributions")
              .select("id, pdf_share_client")
              .eq("trajet_id", trajetId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (!cancelled && attr) {
              setAttributionId(attr.id);
              setPdfShareEnabled(Boolean((attr as { pdf_share_client?: boolean }).pdf_share_client));
            }
          }
        }

        // Facture liée
        const { data: fact } = await supabase
          .from("factures")
          .select("id, numero, prix_ttc, statut, pdf_url, date_facture")
          .eq("mission_id", missionId)
          .order("created_at", { ascending: false })
          .maybeSingle();
        if (!cancelled && fact) setFacture(fact);
      });
    return () => { cancelled = true; };
  }, [missionId, user]);

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
      });
      downloadFacturePdf(blob, full.numero);
    } catch (e) {
      toast.error("Téléchargement impossible", { description: (e as Error).message });
    } finally {
      setDownloadingFact(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={28} /></div>;
  if (!mission) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-cream/60 text-sm">Mission introuvable.</p>
        <Link to="/dashboard-client/missions" className="text-primary text-xs uppercase tracking-wider hover:text-gold-light">
          ← Retour aux missions
        </Link>
      </div>
    );
  }

  const options = Array.isArray(mission.options) ? mission.options as Array<{ label: string; price: number }> : [];

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/dashboard-client/missions" className="inline-flex items-center gap-2 text-cream/60 text-xs uppercase tracking-wider hover:text-primary transition-colors">
        <ArrowLeft size={14} /> Retour aux missions
      </Link>

      {/* Header */}
      <div className="card-premium p-6 rounded">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <p className="text-cream/40 text-[10px] uppercase tracking-wider">{mission.numero}</p>
            <h1 className="font-heading text-2xl text-cream mt-1 flex items-center gap-2">
              <MapPin size={18} className="text-primary" />
              {mission.ville_depart} → {mission.ville_arrivee}
            </h1>
          </div>
          <StatusBadge kind={missionStatusKind(mission.statut)} size="md">
            {missionStatusLabel(mission.statut)}
          </StatusBadge>
        </div>
        <div className="flex items-center justify-between border-t border-primary/10 pt-4">
          <span className="text-cream/50 text-xs uppercase tracking-wider flex items-center gap-1">
            <Calendar size={12} /> {new Date(mission.date_prise_en_charge).toLocaleDateString("fr-FR")}
          </span>
          <span className="font-heading text-primary text-2xl">{Number(mission.prix_total).toFixed(2)} €</span>
        </div>
      </div>

      {/* Suivi temps réel — apparaît dès qu'une attribution est rattachée */}
      {attributionId && <MissionLiveTracker attributionId={attributionId} />}

      {/* Vehicule */}
      <Section title="Véhicule" icon={<Car size={16} />}>
        <Field label="Marque" value={mission.marque} />
        <Field label="Modèle" value={mission.modele} />
        <Field label="Immatriculation" value={mission.immatriculation} />
        <Field label="Carburant" value={mission.carburant} />
      </Section>

      {/* Type & options */}
      <Section title="Détails du convoyage" icon={<FileText size={16} />}>
        <Field label="Type de trajet" value={mission.type_trajet?.replace(/_/g, " ")} />
        {options.length > 0 && (
          <div className="sm:col-span-2">
            <p className="text-cream/40 text-[10px] uppercase tracking-wider mb-2">Options</p>
            <div className="space-y-1.5">
              {options.map((o, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-navy/40 px-3 py-1.5 rounded border border-primary/10">
                  <span className="text-cream/80">{o.label}</span>
                  <span className="text-primary text-xs">+ {o.price.toFixed(2)} €</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {mission.remarques && (
          <div className="sm:col-span-2">
            <p className="text-cream/40 text-[10px] uppercase tracking-wider mb-1">Remarques</p>
            <p className="text-cream/80 text-sm">{mission.remarques}</p>
          </div>
        )}
      </Section>

      {/* Coordonnées */}
      <Section title="Coordonnées du contact" icon={<User size={16} />}>
        <Field label="Nom" value={`${mission.prenom} ${mission.nom}`} />
        <Field label="Email" value={mission.email} icon={<Mail size={11} />} />
        <Field label="Téléphone" value={mission.telephone} icon={<Phone size={11} />} />
      </Section>

      {/* Facture liée */}
      {facture && (
        <div className="card-premium p-5 rounded">
          <h2 className="font-heading text-sm text-primary tracking-[0.15em] uppercase flex items-center gap-2 mb-4">
            <Receipt size={16} /> Facture
          </h2>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-cream/40 text-[10px] uppercase tracking-wider">{facture.numero}</p>
              <p className="text-cream/80 text-sm mt-0.5">
                {facture.date_facture ? new Date(facture.date_facture).toLocaleDateString("fr-FR") : "—"}
                {" · "}
                <span className={facture.statut === "payee" ? "text-emerald-300" : "text-amber-300"}>
                  {facture.statut === "payee" ? "Payée" : "À régler"}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-heading text-primary text-lg">{Number(facture.prix_ttc).toFixed(2)} €</span>
              <button
                onClick={handleDownloadFacture}
                disabled={downloadingFact}
                className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-navy font-heading text-xs tracking-[0.15em] uppercase hover:bg-gold-light transition-colors rounded disabled:opacity-50"
              >
                {downloadingFact ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-cream/30 text-xs text-center">
        Vous serez notifié par email à chaque évolution du statut de votre mission.
      </p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card-premium p-5 rounded">
      <h2 className="font-heading text-sm text-primary tracking-[0.15em] uppercase flex items-center gap-2 mb-4">
        {icon} {title}
      </h2>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({ label, value, icon }: { label: string; value: string | null | undefined; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-cream/40 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
        {icon} {label}
      </p>
      <p className="text-cream/85 text-sm">{value || "—"}</p>
    </div>
  );
}
