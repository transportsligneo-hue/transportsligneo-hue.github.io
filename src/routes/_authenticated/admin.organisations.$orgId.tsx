import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, Building2, Users, Truck, FileText, History as HistoryIcon, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/organisations/$orgId")({
  component: OrgDetail,
});

const roleLabels: Record<string, string> = {
  client_b2b: "Client B2B",
  flotte_partenaire: "Flotte partenaire",
  sous_traitant: "Sous-traitant",
  client_particulier: "Client particulier",
  prospect: "Prospect",
};

function OrgDetail() {
  const { orgId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [b2bRequests, setB2bRequests] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function load() {
    setLoading(true);
    try {
      const [orgRes, rolesRes, membersRes, missionsRes, b2bRes, activityRes] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", orgId).maybeSingle(),
        supabase.from("organization_roles").select("role, active").eq("organization_id", orgId),
        supabase.from("organization_members").select("user_id, member_role, status, joined_at").eq("organization_id", orgId),
        supabase.from("missions").select("id, numero, ville_depart, ville_arrivee, statut, prix_total, date_prise_en_charge").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(50),
        supabase.from("b2b_transport_requests").select("id, numero, pickup_address, dropoff_address, scheduled_date, payment_status, operational_status, estimated_price_ttc").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(50),
        supabase.from("activity_logs").select("id, action, entity_type, actor_label, metadata, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
      ]);
      setOrg(orgRes.data);
      setRoles((rolesRes.data ?? []).filter((r) => r.active).map((r) => r.role));
      setMembers(membersRes.data ?? []);
      setMissions(missionsRes.data ?? []);
      setB2bRequests(b2bRes.data ?? []);
      setActivity(activityRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-pro-accent" size={28} />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="text-center py-20">
        <p className="text-pro-muted">Organisation introuvable.</p>
        <Link to="/admin/organisations" className="text-pro-accent hover:underline text-sm mt-2 inline-block">
          ← Retour
        </Link>
      </div>
    );
  }

  const totalMissions = missions.length;
  const totalRevenue = [...missions.map((m) => Number(m.prix_total) || 0), ...b2bRequests.filter((r) => r.payment_status === "paid").map((r) => Number(r.estimated_price_ttc) || 0)].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <Link to="/admin/organisations" className="inline-flex items-center gap-2 text-sm text-pro-muted hover:text-pro-text">
        <ArrowLeft size={14} /> Retour aux organisations
      </Link>

      {/* Header */}
      <header className="bg-white border border-pro-border rounded-xl p-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-pro-accent/10 flex items-center justify-center">
            <Building2 className="text-pro-accent" size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-pro-text">{org.legal_name}</h1>
            {org.commercial_name && <p className="text-sm text-pro-muted">{org.commercial_name}</p>}
            <div className="flex flex-wrap gap-1 mt-2">
              {roles.map((r) => (
                <Badge key={r} variant="outline">{roleLabels[r] ?? r}</Badge>
              ))}
              <Badge variant="outline">{org.status}</Badge>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-pro-muted">Score</p>
          <p className="text-2xl font-semibold text-pro-text">{org.score}</p>
          <Badge variant="outline" className="mt-1">{org.score_category}</Badge>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Membres" value={members.length} icon={Users} />
        <Kpi label="Missions" value={totalMissions} icon={Truck} />
        <Kpi label="Demandes B2B" value={b2bRequests.length} icon={FileText} />
        <Kpi label="CA total" value={`${totalRevenue.toFixed(0)} €`} icon={Building2} />
      </div>

      {/* Infos */}
      <div className="bg-white border border-pro-border rounded-xl p-6 grid md:grid-cols-3 gap-4 text-sm">
        <Info label="SIRET" value={org.siret} />
        <Info label="TVA" value={org.vat_number} />
        <Info label="Secteur" value={org.sector} />
        <Info label="Taille" value={org.size} />
        <Info label="Site web" value={org.website} />
        <Info label="Email facturation" value={org.billing_email} />
        <Info label="Contact" value={org.primary_contact_name} />
        <Info label="Email contact" value={org.primary_contact_email} />
        <Info label="Téléphone" value={org.primary_contact_phone} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="missions">
        <TabsList>
          <TabsTrigger value="missions">Missions ({missions.length})</TabsTrigger>
          <TabsTrigger value="b2b">Demandes B2B ({b2bRequests.length})</TabsTrigger>
          <TabsTrigger value="members">Membres ({members.length})</TabsTrigger>
          <TabsTrigger value="activity">Historique ({activity.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="missions" className="bg-white border border-pro-border rounded-xl p-4">
          {missions.length === 0 ? <Empty icon={Truck} text="Aucune mission" /> : (
            <div className="divide-y">
              {missions.map((m) => (
                <div key={m.id} className="py-2 flex justify-between text-sm">
                  <div>
                    <span className="font-medium">{m.numero}</span>
                    <span className="text-pro-muted ml-2">{m.ville_depart} → {m.ville_arrivee}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{m.statut}</Badge>
                    <span>{Number(m.prix_total).toFixed(0)} €</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="b2b" className="bg-white border border-pro-border rounded-xl p-4">
          {b2bRequests.length === 0 ? <Empty icon={FileText} text="Aucune demande B2B" /> : (
            <div className="divide-y">
              {b2bRequests.map((r) => (
                <div key={r.id} className="py-2 flex justify-between text-sm">
                  <div>
                    <span className="font-medium">{r.numero}</span>
                    <div className="text-xs text-pro-muted">{r.pickup_address} → {r.dropoff_address}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{r.payment_status}</Badge>
                    <Badge variant="outline">{r.operational_status}</Badge>
                    <span>{r.estimated_price_ttc ? `${Number(r.estimated_price_ttc).toFixed(0)} €` : "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="members" className="bg-white border border-pro-border rounded-xl p-4">
          {members.length === 0 ? <Empty icon={Users} text="Aucun membre" /> : (
            <div className="divide-y">
              {members.map((m) => (
                <div key={m.user_id} className="py-2 flex justify-between text-sm">
                  <span className="font-mono text-xs">{m.user_id.slice(0, 8)}…</span>
                  <div className="flex gap-2">
                    <Badge variant="outline">{m.member_role}</Badge>
                    <Badge variant="outline">{m.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="bg-white border border-pro-border rounded-xl p-4">
          {activity.length === 0 ? <Empty icon={HistoryIcon} text="Aucune activité" /> : (
            <div className="divide-y">
              {activity.map((a) => (
                <div key={a.id} className="py-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{a.action}</span>
                    <span className="text-xs text-pro-muted">{new Date(a.created_at).toLocaleString("fr-FR")}</span>
                  </div>
                  <div className="text-xs text-pro-muted">{a.entity_type} · {a.actor_label ?? "système"}</div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="bg-white border border-pro-border rounded-xl p-4">
          <div className="text-sm">
            <Label>Notes internes</Label>
            <p className="mt-2 text-pro-text-soft whitespace-pre-wrap">{org.notes_internes || <span className="text-pro-muted italic">Aucune note pour le moment.</span>}</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof Users }) {
  return (
    <div className="bg-white border border-pro-border rounded-xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-pro-muted">{label}</p>
        <Icon size={16} className="text-pro-muted" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-pro-text">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-pro-muted">{label}</p>
      <p className="text-pro-text mt-1">{value || "—"}</p>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof StickyNote; text: string }) {
  return (
    <div className="text-center py-8 text-pro-muted">
      <Icon size={28} className="mx-auto mb-2 opacity-50" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-wider text-pro-muted">{children}</p>;
}
