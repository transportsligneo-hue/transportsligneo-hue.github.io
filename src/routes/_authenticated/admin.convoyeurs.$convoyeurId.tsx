import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileBadge,
  Truck,
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
import { sendTransactionalEmail } from "@/lib/email/send";

export const Route = createFileRoute("/_authenticated/admin/convoyeurs/$convoyeurId")({
  component: AdminConvoyeurDetail,
});

interface Convoyeur {
  id: string;
  user_id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  ville: string | null;
  disponibilite: string | null;
  permis: string | null;
  message: string | null;
  statut: string;
  type_convoyeur: string;
  created_at: string;
}

interface DocItem {
  id: string;
  type_document: string;
  statut_validation: string | null;
  created_at: string;
}

interface AttribItem {
  id: string;
  statut: string;
  created_at: string;
  trajet: { depart: string; arrivee: string; date_trajet: string | null; tarif_convoyeur: number | null } | null;
}

const statutLabels: Record<string, string> = {
  en_attente: "En attente",
  valide: "Validé",
  refuse: "Refusé",
  suspendu: "Suspendu",
};
const docLabels: Record<string, string> = {
  permis: "Permis",
  identite: "CNI",
  domicile: "Domicile",
  rib: "RIB",
  kbis: "KBIS",
  assurance: "Assurance",
};

function AdminConvoyeurDetail() {
  const { convoyeurId } = Route.useParams();
  const navigate = useNavigate();
  const [conv, setConv] = useState<Convoyeur | null>(null);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [attribs, setAttribs] = useState<AttribItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: c } = await supabase.from("convoyeurs").select("*").eq("id", convoyeurId).maybeSingle();
    setConv(c as Convoyeur | null);
    if (c) {
      const [{ data: d }, { data: a }] = await Promise.all([
        supabase
          .from("documents_convoyeurs")
          .select("id, type_document, statut_validation, created_at")
          .eq("convoyeur_id", convoyeurId),
        supabase
          .from("attributions")
          .select("id, statut, created_at, trajet:trajets(depart, arrivee, date_trajet, tarif_convoyeur)")
          .eq("convoyeur_id", convoyeurId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      setDocs((d as DocItem[]) ?? []);
      setAttribs((a as unknown as AttribItem[]) ?? []);
    }
    setLoading(false);
  }, [convoyeurId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatut = async (statut: string) => {
    if (!conv) return;
    if (statut === "valide" && conv.type_convoyeur === "independant") {
      const required = ["permis", "identite", "domicile", "rib", "kbis", "assurance"];
      const issues = required
        .map((r) => {
          const doc = docs.find((d) => d.type_document === r);
          if (!doc) return `${docLabels[r]} manquant`;
          if (doc.statut_validation !== "approuve") return `${docLabels[r]} non approuvé`;
          return null;
        })
        .filter(Boolean);
      if (issues.length) {
        window.alert(`Validation impossible :\n\n• ${issues.join("\n• ")}`);
        return;
      }
    }
    const wasNotValid = conv.statut !== "valide";
    await supabase.from("convoyeurs").update({ statut }).eq("id", conv.id);
    setConv({ ...conv, statut });
    if (statut === "valide" && wasNotValid) {
      try {
        await sendTransactionalEmail({
          templateName: "convoyeur-validation",
          recipientEmail: conv.email,
          idempotencyKey: `convoyeur-validation-${conv.id}`,
          templateData: { prenom: conv.prenom, nom: conv.nom },
        });
      } catch (e) {
        console.error("[admin.convoyeurs.detail] email error", e);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[color:var(--admin-accent)]" size={28} />
      </div>
    );
  }

  if (!conv) {
    return (
      <div>
        <button onClick={() => navigate({ to: "/admin/convoyeurs" })} className="admin-btn-ghost inline-flex items-center gap-2 mb-4">
          <ArrowLeft size={14} /> Retour
        </button>
        <AdminEmpty title="Convoyeur introuvable" />
      </div>
    );
  }

  const fullName = `${conv.prenom} ${conv.nom}`.trim();
  const terminees = attribs.filter((a) => ["terminee", "livree"].includes(a.statut)).length;
  const docsApprouves = docs.filter((d) => d.statut_validation === "approuve").length;

  const statutTone =
    conv.statut === "valide" ? "success" : conv.statut === "en_attente" ? "warning" : conv.statut === "refuse" ? "danger" : "neutral";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumb={[
          { label: "Admin", to: "/admin" },
          { label: "Convoyeurs", to: "/admin/convoyeurs" },
          { label: fullName },
        ]}
        eyebrow={conv.type_convoyeur === "independant" ? "Convoyeur indépendant" : "Convoyeur salarié"}
        title={fullName}
        subtitle={conv.email}
        status={
          <div className="flex flex-wrap items-center gap-2">
            <AdminBadge label={statutLabels[conv.statut] ?? conv.statut} tone={statutTone} />
            {conv.ville && <AdminBadge label={conv.ville} tone="info" />}
          </div>
        }
        actions={
          <>
            <Link to="/admin/convoyeurs" className="admin-btn-ghost inline-flex items-center gap-2">
              <ArrowLeft size={14} /> Retour
            </Link>
            {conv.statut !== "valide" && (
              <button onClick={() => updateStatut("valide")} className="admin-btn-primary inline-flex items-center gap-2">
                <CheckCircle size={14} /> Valider
              </button>
            )}
            {conv.statut !== "refuse" && conv.statut !== "valide" && (
              <button onClick={() => updateStatut("refuse")} className="admin-btn-ghost inline-flex items-center gap-2 !text-red-600 hover:!bg-red-50 hover:!border-red-200">
                <XCircle size={14} /> Refuser
              </button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard label="Missions totales" value={attribs.length} icon={Truck} />
        <AdminStatCard label="Terminées" value={terminees} icon={CheckCircle} accent="success" />
        <AdminStatCard
          label="Documents approuvés"
          value={`${docsApprouves} / 6`}
          icon={FileBadge}
          accent={docsApprouves === 6 ? "success" : "warning"}
        />
        <AdminStatCard label="Statut" value={statutLabels[conv.statut] ?? conv.statut} accent={statutTone === "success" ? "success" : statutTone === "danger" ? "danger" : "warning"} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <AdminSection title="Coordonnées">
          <div className="space-y-4">
            <AdminField label="Email">
              <a className="inline-flex items-center gap-1.5 text-[color:var(--admin-accent)] hover:underline" href={`mailto:${conv.email}`}>
                <Mail size={14} /> {conv.email}
              </a>
            </AdminField>
            <AdminField label="Téléphone">
              {conv.telephone ? (
                <a className="inline-flex items-center gap-1.5 text-[color:var(--admin-accent)] hover:underline" href={`tel:${conv.telephone}`}>
                  <Phone size={14} /> {conv.telephone}
                </a>
              ) : null}
            </AdminField>
            <AdminField label="Ville">{conv.ville ? <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" />{conv.ville}</span> : null}</AdminField>
            <AdminField label="Disponibilité">{conv.disponibilite}</AdminField>
            <AdminField label="Permis">{conv.permis}</AdminField>
            <AdminField label="Inscrit le">
              <span className="inline-flex items-center gap-1.5"><Calendar size={14} className="text-slate-400" /> {new Date(conv.created_at).toLocaleDateString("fr-FR")}</span>
            </AdminField>
            {conv.message && <AdminField label="Message">{conv.message}</AdminField>}
          </div>
        </AdminSection>

        <div className="lg:col-span-2 space-y-6">
          <AdminSection title="Documents" description={`${docs.length} document${docs.length > 1 ? "s" : ""}`}>
            {docs.length === 0 ? (
              <AdminEmpty icon={FileBadge} title="Aucun document" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {["permis", "identite", "domicile", "rib", "kbis", "assurance"].map((type) => {
                  const d = docs.find((x) => x.type_document === type);
                  const tone =
                    d?.statut_validation === "approuve"
                      ? "success"
                      : d?.statut_validation === "refuse"
                      ? "danger"
                      : d
                      ? "warning"
                      : "neutral";
                  return (
                    <div key={type} className="admin-card-flat p-3 flex flex-col gap-1.5">
                      <p className="admin-label">{docLabels[type]}</p>
                      <AdminBadge
                        label={d ? d.statut_validation ?? "en attente" : "manquant"}
                        tone={tone}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </AdminSection>

          <AdminSection title="Historique missions" description={`${attribs.length} attribution${attribs.length > 1 ? "s" : ""}`}>
            {attribs.length === 0 ? (
              <AdminEmpty icon={Truck} title="Aucune mission attribuée" />
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Trajet</th>
                      <th className="hidden sm:table-cell">Date</th>
                      {conv.type_convoyeur === "independant" && <th className="hidden md:table-cell">Tarif</th>}
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attribs.map((a) => (
                      <tr key={a.id}>
                        <td>{a.trajet ? `${a.trajet.depart} → ${a.trajet.arrivee}` : <span className="text-slate-400">Trajet supprimé</span>}</td>
                        <td className="hidden sm:table-cell text-[color:var(--admin-muted)] text-xs">
                          {a.trajet?.date_trajet
                            ? new Date(a.trajet.date_trajet).toLocaleDateString("fr-FR")
                            : new Date(a.created_at).toLocaleDateString("fr-FR")}
                        </td>
                        {conv.type_convoyeur === "independant" && (
                          <td className="hidden md:table-cell admin-value">
                            {a.trajet?.tarif_convoyeur != null ? `${a.trajet.tarif_convoyeur} €` : "—"}
                          </td>
                        )}
                        <td><AdminBadge label={a.statut.replace(/_/g, " ")} /></td>
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
