import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Users, Loader2, Mail, Phone, MapPin, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard-pro/conducteurs")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
  },
  component: ConducteursPage,
});

interface ConducteurRow {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  ville: string | null;
  type_convoyeur: string;
  statut: string;
}

function ConducteursPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ConducteurRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: mem } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (!mem) { setLoading(false); return; }
      const { data } = await supabase
        .from("convoyeurs")
        .select("id, prenom, nom, email, telephone, ville, type_convoyeur, statut")
        .eq("organization_id", mem.organization_id)
        .order("created_at", { ascending: false });
      setRows((data ?? []) as ConducteurRow[]);
      setLoading(false);
    })();
  }, [user]);

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return `${r.prenom} ${r.nom} ${r.email} ${r.ville ?? ""}`.toLowerCase().includes(s);
  });

  const actifs = rows.filter((r) => r.statut === "actif" || r.statut === "valide").length;

  return (
    <div className="space-y-5">
      {/* Hero violet */}
      <div className="relative overflow-hidden rounded-2xl border border-pro-border bg-white">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-white" aria-hidden="true" />
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-violet-200/40 blur-3xl" aria-hidden="true" />
        <div className="relative p-5 sm:p-6 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Users size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-violet-700 bg-violet-100 border border-violet-200 rounded-full px-2 py-0.5">
                Flotte partenaire
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-pro-text mt-1.5">Mes conducteurs</h1>
            <p className="text-pro-muted text-sm mt-0.5">
              Convoyeurs rattachés à votre flotte, prêts à prendre des missions Ligneo.
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end shrink-0">
            <span className="text-3xl font-semibold text-pro-text leading-none">{rows.length}</span>
            <span className="text-[11px] uppercase tracking-wider text-pro-muted mt-1">
              conducteur{rows.length > 1 ? "s" : ""}
            </span>
            {actifs > 0 && (
              <span className="text-[11px] text-violet-700 mt-1">{actifs} actif{actifs > 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-pro-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un conducteur, une ville…"
          className="w-full pl-9 pr-3 py-2 bg-white border border-pro-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
        />
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
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((r) => {
            const initials = `${r.prenom?.[0] ?? ""}${r.nom?.[0] ?? ""}`.toUpperCase() || "?";
            const isActive = r.statut === "actif" || r.statut === "valide";
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
                    <p className="font-semibold text-pro-text truncate">{r.prenom} {r.nom}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <Badge
                        variant="secondary"
                        className="bg-violet-50 text-violet-700 border border-violet-200 text-[10px] uppercase tracking-wide"
                      >
                        {r.type_convoyeur}
                      </Badge>
                      <span
                        className={`text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded ${
                          isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {r.statut}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-pro-text-soft">
                    <Mail size={13} className="text-pro-muted shrink-0" />
                    <a href={`mailto:${r.email}`} className="truncate hover:text-violet-700">{r.email}</a>
                  </div>
                  <div className="flex items-center gap-2 text-pro-text-soft">
                    <Phone size={13} className="text-pro-muted shrink-0" />
                    <a href={`tel:${r.telephone}`} className="truncate hover:text-violet-700">{r.telephone}</a>
                  </div>
                  {r.ville && (
                    <div className="flex items-center gap-2 text-pro-text-soft">
                      <MapPin size={13} className="text-pro-muted shrink-0" />
                      <span className="truncate">{r.ville}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
