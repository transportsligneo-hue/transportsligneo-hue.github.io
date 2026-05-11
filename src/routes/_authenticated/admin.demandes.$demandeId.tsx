import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  ArrowRightCircle,
  Trash2,
  Mail,
  Phone,
  Car,
  MapPin,
  Calendar,
  Loader2,
  FileText,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminSection,
  AdminField,
  AdminBadge,
  AdminEmpty,
} from "@/components/admin/ui";
import { PriceBlock } from "@/components/admin/PriceBlock";
import { quoteFromDemande } from "@/lib/pricing-engine";

export const Route = createFileRoute("/_authenticated/admin/demandes/$demandeId")({
  component: AdminDemandeDetail,
});

interface Demande {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  email: string;
  depart: string;
  arrivee: string;
  date_souhaitee: string | null;
  heure_souhaitee: string | null;
  marque: string | null;
  modele: string | null;
  immatriculation: string | null;
  carburant: string | null;
  options: string | null;
  message: string | null;
  statut: string;
  created_at: string;
}

const statuts = ["nouvelle", "a_traiter", "convertie", "attribuee", "terminee", "annulee"];
const statutLabels: Record<string, string> = {
  nouvelle: "Nouvelle",
  a_traiter: "À traiter",
  convertie: "Convertie",
  attribuee: "Attribuée",
  terminee: "Terminée",
  annulee: "Annulée",
};
const statutTones: Record<string, "success" | "warning" | "danger" | "info" | "accent" | "neutral"> = {
  nouvelle: "accent",
  a_traiter: "warning",
  convertie: "info",
  attribuee: "info",
  terminee: "success",
  annulee: "danger",
};

function AdminDemandeDetail() {
  const { demandeId } = Route.useParams();
  const navigate = useNavigate();
  const [d, setD] = useState<Demande | null>(null);
  const [trajetId, setTrajetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("demandes_convoyage").select("*").eq("id", demandeId).maybeSingle();
    setD(data as Demande | null);
    const { data: traj } = await supabase
      .from("trajets")
      .select("id")
      .eq("demande_id", demandeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setTrajetId((traj as { id?: string } | null)?.id ?? null);
    setLoading(false);
  }, [demandeId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatut = async (statut: string) => {
    if (!d) return;
    await supabase.from("demandes_convoyage").update({ statut }).eq("id", d.id);
    setD({ ...d, statut });
  };

  const convertToTrajet = async () => {
    if (!d) return;
    setConverting(true);
    try {
      const { error } = await supabase.from("trajets").insert({
        demande_id: d.id,
        depart: d.depart,
        arrivee: d.arrivee,
        date_trajet: d.date_souhaitee,
        heure_trajet: d.heure_souhaitee ?? "",
        marque: d.marque ?? "",
        modele: d.modele ?? "",
        immatriculation: d.immatriculation ?? "",
        client_nom: `${d.prenom} ${d.nom}`,
        client_email: d.email,
        client_telephone: d.telephone ?? "",
        statut: "en_attente",
      });
      if (!error) {
        await updateStatut("convertie");
        await load();
      }
    } finally {
      setConverting(false);
    }
  };

  const remove = async () => {
    if (!d) return;
    if (!window.confirm("Supprimer cette demande ?")) return;
    await supabase.from("demandes_convoyage").delete().eq("id", d.id);
    navigate({ to: "/admin/demandes" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[color:var(--admin-accent)]" size={28} />
      </div>
    );
  }

  if (!d) {
    return (
      <div>
        <button onClick={() => navigate({ to: "/admin/demandes" })} className="admin-btn-ghost inline-flex items-center gap-2 mb-4">
          <ArrowLeft size={14} /> Retour
        </button>
        <AdminEmpty title="Demande introuvable" />
      </div>
    );
  }

  const fullName = `${d.prenom} ${d.nom}`.trim();
  const quote = quoteFromDemande(d);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumb={[
          { label: "Admin", to: "/admin" },
          { label: "Demandes", to: "/admin/demandes" },
          { label: fullName },
        ]}
        eyebrow="Demande convoyage"
        title={`${d.depart} → ${d.arrivee}`}
        subtitle={`${fullName} · ${new Date(d.created_at).toLocaleString("fr-FR")}`}
        status={<AdminBadge label={statutLabels[d.statut] ?? d.statut} tone={statutTones[d.statut] ?? "neutral"} />}
        actions={
          <>
            <Link to="/admin/demandes" className="admin-btn-ghost inline-flex items-center gap-2">
              <ArrowLeft size={14} /> Retour
            </Link>
            {d.statut !== "convertie" && d.statut !== "terminee" && !trajetId && (
              <button onClick={convertToTrajet} disabled={converting} className="admin-btn-primary inline-flex items-center gap-2 disabled:opacity-60">
                <ArrowRightCircle size={14} /> {converting ? "Conversion…" : "Convertir en trajet"}
              </button>
            )}
            <button onClick={remove} className="admin-btn-ghost inline-flex items-center gap-2 !text-red-600 hover:!bg-red-50 hover:!border-red-200">
              <Trash2 size={14} /> Supprimer
            </button>
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <AdminSection title="Client">
            <div className="grid sm:grid-cols-2 gap-4">
              <AdminField label="Nom complet"><span className="admin-value-strong">{fullName}</span></AdminField>
              <AdminField label="Email">
                <a className="inline-flex items-center gap-1.5 text-[color:var(--admin-accent)] hover:underline" href={`mailto:${d.email}`}>
                  <Mail size={14} /> {d.email}
                </a>
              </AdminField>
              <AdminField label="Téléphone">
                {d.telephone ? (
                  <a className="inline-flex items-center gap-1.5 text-[color:var(--admin-accent)] hover:underline" href={`tel:${d.telephone}`}>
                    <Phone size={14} /> {d.telephone}
                  </a>
                ) : null}
              </AdminField>
            </div>
          </AdminSection>

          <AdminSection title="Trajet">
            <div className="grid sm:grid-cols-2 gap-4">
              <AdminField label="Départ"><span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" />{d.depart}</span></AdminField>
              <AdminField label="Arrivée"><span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" />{d.arrivee}</span></AdminField>
              <AdminField label="Date souhaitée">
                {d.date_souhaitee ? (
                  <span className="inline-flex items-center gap-1.5"><Calendar size={14} className="text-slate-400" />{new Date(d.date_souhaitee).toLocaleDateString("fr-FR")}</span>
                ) : null}
              </AdminField>
              <AdminField label="Heure">{d.heure_souhaitee}</AdminField>
            </div>
          </AdminSection>

          <AdminSection title="Véhicule">
            <div className="grid sm:grid-cols-2 gap-4">
              <AdminField label="Marque / Modèle">
                <span className="inline-flex items-center gap-1.5"><Car size={14} className="text-slate-400" />{[d.marque, d.modele].filter(Boolean).join(" ") || "—"}</span>
              </AdminField>
              <AdminField label="Immatriculation"><span className="font-mono text-xs">{d.immatriculation}</span></AdminField>
              <AdminField label="Carburant">{d.carburant}</AdminField>
              <AdminField label="Options">{d.options}</AdminField>
            </div>
          </AdminSection>

          {d.message && (
            <AdminSection title="Message client">
              <p className="whitespace-pre-wrap text-sm text-[color:var(--admin-text-soft)]">{d.message}</p>
            </AdminSection>
          )}
        </div>

        <div className="space-y-6">
          <AdminSection title="Estimation">
            <PriceBlock quote={quote} title="Estimation" />
          </AdminSection>

          <AdminSection title="Statut">
            <select
              value={d.statut}
              onChange={(e) => updateStatut(e.target.value)}
              className="w-full admin-btn-ghost text-sm"
            >
              {statuts.map((s) => (
                <option key={s} value={s}>{statutLabels[s]}</option>
              ))}
            </select>
          </AdminSection>

          {trajetId && (
            <AdminSection title="Trajet lié">
              <Link
                to="/admin/trajets"
                className="admin-card-flat block p-4 hover:bg-[color:var(--admin-accent-soft)] transition-colors"
              >
                <p className="admin-label">Trajet créé</p>
                <p className="admin-value inline-flex items-center gap-1.5 mt-1"><FileText size={14} className="text-[color:var(--admin-accent)]" /> Voir le trajet</p>
              </Link>
            </AdminSection>
          )}
        </div>
      </div>
    </div>
  );
}
