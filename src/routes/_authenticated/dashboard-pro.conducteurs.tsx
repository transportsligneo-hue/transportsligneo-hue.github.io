import { createFileRoute, redirect } from "@tanstack/react-router";
import FleetPageHeader from "@/components/flotte/FleetPageHeader";
import AddDriverModal, { type OrgSiteOption } from "@/components/flotte/AddDriverModal";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Users, Loader2, Mail, Phone, MapPin, Search, UserPlus, Building2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard-pro/conducteurs")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
  },
  component: ConducteursPage,
});

type DriverStatus = "actif" | "invitee" | "a_valider" | "inactif";

interface DriverCard {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  ville: string | null;
  type_convoyeur: string | null;
  status: DriverStatus;
  statusLabel: string;
  siteId: string | null;
  missions: number;
}

const STATUS_STYLES: Record<DriverStatus, string> = {
  actif: "bg-emerald-50 text-emerald-700 border-emerald-200",
  invitee: "bg-amber-50 text-amber-700 border-amber-200",
  a_valider: "bg-amber-50 text-amber-700 border-amber-200",
  inactif: "bg-slate-100 text-slate-600 border-slate-200",
};

function ConducteursPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<DriverCard[]>([]);
  const [sites, setSites] = useState<OrgSiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: mem } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (!mem) { setLoading(false); return; }
    const orgId = mem.organization_id as string;

    const [convRes, invRes, sitesRes] = await Promise.all([
      supabase
        .from("convoyeurs")
        .select("id, user_id, prenom, nom, email, telephone, ville, type_convoyeur, statut, site_id")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      supabase
        .from("fleet_driver_invitations")
        .select("id, prenom, nom, email, telephone, status, site_id, created_at")
        .eq("organization_id", orgId)
        .in("status", ["invitee", "a_valider"])
        .order("created_at", { ascending: false }),
      supabase
        .from("organization_sites")
        .select("id, nom")
        .eq("organization_id", orgId)
        .eq("actif", true)
        .order("nom"),
    ]);

    const convoyeurs = (convRes.data ?? []) as Array<Record<string, unknown>>;

    // Nombre de missions effectuées pour cette flotte
    const convoyeurIds = convoyeurs.map((c) => c["id"] as string).filter(Boolean);
    const counts: Record<string, number> = {};
    if (convoyeurIds.length) {
      const { data: attributions } = await supabase
        .from("attributions")
        .select("convoyeur_id")
        .in("convoyeur_id", convoyeurIds);
      for (const a of (attributions ?? []) as Array<{ convoyeur_id: string | null }>) {
        if (a.convoyeur_id) counts[a.convoyeur_id] = (counts[a.convoyeur_id] ?? 0) + 1;
      }
    }

    const fromConvoyeurs: DriverCard[] = convoyeurs.map((c) => {
      const statut = String(c["statut"] ?? "");
      const active = statut === "actif" || statut === "valide";
      const pending = statut === "en_attente" || statut === "a_valider";
      const status: DriverStatus = active ? "actif" : pending ? "a_valider" : "inactif";
      return {
        id: c["id"] as string,
        prenom: (c["prenom"] as string) ?? "",
        nom: (c["nom"] as string) ?? "",
        email: (c["email"] as string) ?? "",
        telephone: (c["telephone"] as string) ?? null,
        ville: (c["ville"] as string) ?? null,
        type_convoyeur: (c["type_convoyeur"] as string) ?? null,
        status,
        statusLabel: active ? "Actif" : pending ? "À valider" : "Inactif",
        siteId: (c["site_id"] as string) ?? null,
        missions: counts[c["id"] as string] ?? 0,
      };
    });

    const fromInvites: DriverCard[] = ((invRes.data ?? []) as Array<Record<string, unknown>>).map((i) => ({
      id: `inv-${i["id"] as string}`,
      prenom: (i["prenom"] as string) ?? "",
      nom: (i["nom"] as string) ?? "",
      email: (i["email"] as string) ?? "",
      telephone: (i["telephone"] as string) ?? null,
      ville: null,
      type_convoyeur: null,
      status: i["status"] === "invitee" ? "invitee" : "a_valider",
      statusLabel: i["status"] === "invitee" ? "Invitation envoyée" : "À valider",
      siteId: (i["site_id"] as string) ?? null,
      missions: 0,
    }));

    setSites(((sitesRes.data ?? []) as Array<{ id: string; nom: string }>).map((s) => ({ id: s.id, nom: s.nom })));
    setRows([...fromInvites, ...fromConvoyeurs]);
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return `${r.prenom} ${r.nom} ${r.email} ${r.ville ?? ""}`.toLowerCase().includes(s);
  });

  const actifs = rows.filter((r) => r.status === "actif").length;
  const enAttente = rows.filter((r) => r.status === "invitee" || r.status === "a_valider").length;
  const siteName = (id: string | null) => (id ? sites.find((s) => s.id === id)?.nom ?? null : null);

  return (
    <div className="space-y-5">
      <FleetPageHeader
        breadcrumb="Conducteurs"
        eyebrow="Convoyeurs rattachés"
        title="Mes"
        highlight="conducteurs"
        badge="Flotte partenaire"
        subtitle="Convoyeurs rattachés à votre flotte, prêts à prendre des missions Ligneo."
        actions={
          <button onClick={() => setModalOpen(true)} className="fleet-btn-violet">
            <UserPlus size={15} />
            Ajouter un conducteur
          </button>
        }
        stats={[
          { label: "Conducteurs", value: rows.length },
          { label: "Actifs", value: actifs, tone: "accent" as const },
          { label: "En attente", value: enAttente, tone: "warn" as const },
        ]}
      />

      {/* Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-pro-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un conducteur, une ville…"
            className="w-full pl-9 pr-3 py-2 bg-white border border-pro-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
          />
        </div>
        <button onClick={() => setModalOpen(true)} className="fleet-btn-violet sm:hidden">
          <UserPlus size={15} />
          Ajouter
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-violet-600" size={26} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-pro-border rounded-xl p-12 text-center">
          <Users className="mx-auto text-pro-muted mb-3" size={32} />
          <p className="text-pro-text-soft text-sm">
            {rows.length === 0 ? "Aucun conducteur rattaché à votre flotte." : "Aucun résultat pour cette recherche."}
          </p>
          {rows.length === 0 && (
            <button onClick={() => setModalOpen(true)} className="fleet-btn-violet mx-auto mt-4">
              <UserPlus size={15} />
              Ajouter un conducteur
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((r) => {
            const initials = `${r.prenom?.[0] ?? ""}${r.nom?.[0] ?? ""}`.toUpperCase() || "?";
            const site = siteName(r.siteId);
            return (
              <div
                key={r.id}
                className="group bg-white rounded-xl border border-pro-border p-4 hover:border-violet-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center font-semibold text-sm shrink-0 shadow-sm">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-pro-text truncate">{r.prenom} {r.nom}</p>
                      <span className="text-[11px] text-pro-muted whitespace-nowrap shrink-0">
                        {r.missions} mission{r.missions > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <span
                        className={`text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded border ${STATUS_STYLES[r.status]}`}
                      >
                        {r.status === "invitee" && <Clock size={9} className="inline mr-1 -mt-0.5" />}
                        {r.statusLabel}
                      </span>
                      {r.type_convoyeur && (
                        <Badge
                          variant="secondary"
                          className="bg-violet-50 text-violet-700 border border-violet-200 text-[10px] uppercase tracking-wide"
                        >
                          {r.type_convoyeur}
                        </Badge>
                      )}
                      {sites.length > 1 && site && (
                        <span className="text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
                          <Building2 size={9} className="inline mr-1 -mt-0.5" />
                          {site}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-pro-text-soft">
                    <Mail size={13} className="text-pro-muted shrink-0" />
                    <a href={`mailto:${r.email}`} className="truncate hover:text-violet-700">{r.email}</a>
                  </div>
                  {r.telephone && (
                    <div className="flex items-center gap-2 text-pro-text-soft">
                      <Phone size={13} className="text-pro-muted shrink-0" />
                      <a href={`tel:${r.telephone}`} className="truncate hover:text-violet-700">{r.telephone}</a>
                    </div>
                  )}
                  {(r.ville || site) && (
                    <div className="flex items-center gap-2 text-pro-text-soft">
                      <MapPin size={13} className="text-pro-muted shrink-0" />
                      <span className="truncate">{r.ville ?? site}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddDriverModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sites={sites}
        onCreated={() => void load()}
      />
    </div>
  );
}
