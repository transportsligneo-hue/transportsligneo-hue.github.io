import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Ban,
  CheckCircle,
  Mail,
  Phone,
  Building2,
  MapPin,
  Calendar,
  Receipt,
  Truck,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminSection,
  AdminField,
  AdminBadge,
  AdminStatCard,
  AdminEmpty,
} from "@/components/admin/ui";

export const Route = createFileRoute("/_authenticated/admin/clients/$clientId")({
  component: AdminClientDetail,
});

interface Profile {
  user_id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  societe: string | null;
  siret: string | null;
  type_client: string | null;
  statut: string | null;
  created_at: string;
}

interface MissionItem {
  id: string;
  numero: string | null;
  ville_depart: string | null;
  ville_arrivee: string | null;
  date_prise_en_charge: string | null;
  statut: string;
  prix_total: number | null;
}

function AdminClientDetail() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [actif, setActif] = useState(true);
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: role }, { data: m }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", clientId).maybeSingle(),
      supabase
        .from("user_roles")
        .select("actif")
        .eq("user_id", clientId)
        .eq("role", "client")
        .maybeSingle(),
      supabase
        .from("missions")
        .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total")
        .eq("user_id", clientId)
        .order("date_prise_en_charge", { ascending: false })
        .limit(100),
    ]);
    setProfile(p as Profile | null);
    setActif((role as { actif?: boolean } | null)?.actif ?? true);
    setMissions((m as MissionItem[]) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActif = async () => {
    const next = !actif;
    if (!next && !window.confirm("Suspendre ce client ? Il ne pourra plus se connecter.")) return;
    await supabase
      .from("user_roles")
      .update({ actif: next })
      .eq("user_id", clientId)
      .eq("role", "client");
    setActif(next);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[color:var(--admin-accent)]" size={28} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <button
          onClick={() => navigate({ to: "/admin/clients" })}
          className="admin-btn-ghost inline-flex items-center gap-2 mb-4"
        >
          <ArrowLeft size={14} /> Retour
        </button>
        <AdminEmpty title="Client introuvable" description="Ce profil n'existe pas ou a été supprimé." />
      </div>
    );
  }

  const fullName = `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || "Client";
  const totalCA = missions.reduce((s, m) => s + (m.prix_total ?? 0), 0);
  const termineCount = missions.filter((m) => ["terminee", "livree"].includes(m.statut)).length;
  const enCoursCount = missions.filter((m) => ["en_cours", "confirmee", "en_attente"].includes(m.statut)).length;
  const isB2B = profile.type_client === "b2b" || !!profile.societe;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumb={[
          { label: "Admin", to: "/admin" },
          { label: "Clients", to: "/admin/clients" },
          { label: fullName },
        ]}
        eyebrow={isB2B ? "Client professionnel" : "Client particulier"}
        title={fullName}
        subtitle={profile.email ?? undefined}
        status={
          <div className="flex flex-wrap items-center gap-2">
            <AdminBadge label={actif ? "Actif" : "Suspendu"} tone={actif ? "success" : "danger"} />
            {isB2B && profile.societe && <AdminBadge label={profile.societe} tone="accent" />}
          </div>
        }
        actions={
          <>
            <Link to="/admin/clients" className="admin-btn-ghost inline-flex items-center gap-2">
              <ArrowLeft size={14} /> Retour
            </Link>
            <button
              onClick={toggleActif}
              className={`admin-btn-ghost inline-flex items-center gap-2 ${
                actif ? "!text-red-600 hover:!bg-red-50 hover:!border-red-200" : "!text-emerald-700 hover:!bg-emerald-50"
              }`}
            >
              {actif ? <Ban size={14} /> : <CheckCircle size={14} />}
              {actif ? "Suspendre" : "Réactiver"}
            </button>
          </>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard label="Missions totales" value={missions.length} icon={Truck} />
        <AdminStatCard label="Terminées" value={termineCount} icon={CheckCircle} accent="success" />
        <AdminStatCard label="En cours" value={enCoursCount} icon={AlertTriangle} accent="info" />
        <AdminStatCard
          label="CA cumulé TTC"
          value={`${totalCA.toLocaleString("fr-FR")} €`}
          icon={Receipt}
          accent="warning"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Coordonnées */}
        <AdminSection title="Coordonnées">
          <div className="space-y-4">
            <AdminField label="Email">
              {profile.email ? (
                <a className="inline-flex items-center gap-1.5 text-[color:var(--admin-accent)] hover:underline" href={`mailto:${profile.email}`}>
                  <Mail size={14} /> {profile.email}
                </a>
              ) : null}
            </AdminField>
            <AdminField label="Téléphone">
              {profile.telephone ? (
                <a className="inline-flex items-center gap-1.5 text-[color:var(--admin-accent)] hover:underline" href={`tel:${profile.telephone}`}>
                  <Phone size={14} /> {profile.telephone}
                </a>
              ) : null}
            </AdminField>
            <AdminField label="Société">
              {profile.societe ? (
                <span className="inline-flex items-center gap-1.5"><Building2 size={14} className="text-slate-400" /> {profile.societe}</span>
              ) : null}
            </AdminField>
            <AdminField label="SIRET">{profile.siret}</AdminField>
            <AdminField label="Inscrit le">
              <span className="inline-flex items-center gap-1.5"><Calendar size={14} className="text-slate-400" /> {new Date(profile.created_at).toLocaleDateString("fr-FR")}</span>
            </AdminField>
          </div>
        </AdminSection>

        {/* Historique missions */}
        <div className="lg:col-span-2">
          <AdminSection
            title="Historique missions"
            description={`${missions.length} mission${missions.length > 1 ? "s" : ""}`}
          >
            {missions.length === 0 ? (
              <AdminEmpty icon={Truck} title="Aucune mission" description="Ce client n'a pas encore réservé." />
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Numéro</th>
                      <th>Trajet</th>
                      <th className="hidden sm:table-cell">Date</th>
                      <th className="hidden md:table-cell">Prix</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missions.map((m) => (
                      <tr key={m.id} className="admin-row-link" onClick={() => navigate({ to: "/admin/missions/$missionId", params: { missionId: m.id } })}>
                        <td className="font-mono text-xs">{m.numero ?? "—"}</td>
                        <td>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin size={12} className="text-slate-400" />
                            {m.ville_depart ?? "?"} → {m.ville_arrivee ?? "?"}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell text-[color:var(--admin-muted)] text-xs">
                          {m.date_prise_en_charge ? new Date(m.date_prise_en_charge).toLocaleDateString("fr-FR") : "—"}
                        </td>
                        <td className="hidden md:table-cell admin-value">
                          {m.prix_total ? `${m.prix_total.toLocaleString("fr-FR")} €` : "—"}
                        </td>
                        <td>
                          <AdminBadge label={m.statut.replace(/_/g, " ")} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminSection>
        </div>
      </div>
    </div>
  );
}
