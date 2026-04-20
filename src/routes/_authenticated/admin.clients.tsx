import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Eye, X, Ban, CheckCircle, Search, UserRound } from "lucide-react";
import { StatusBadge, missionStatusKind, missionStatusLabel } from "@/components/dashboard/StatusBadge";

export const Route = createFileRoute("/_authenticated/admin/clients")({
  component: AdminClients,
});

interface ClientRow {
  user_id: string;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  created_at: string;
  actif: boolean;
  missions_count: number;
}

interface MissionItem {
  id: string;
  numero: string;
  ville_depart: string;
  ville_arrivee: string;
  date_prise_en_charge: string;
  statut: string;
  prix_total: number;
}

function AdminClients() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ClientRow | null>(null);
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);

    // 1. Récupérer tous les user_roles "client"
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, actif, created_at")
      .eq("role", "client");

    if (!roles || roles.length === 0) {
      setClients([]);
      setLoading(false);
      return;
    }

    const userIds = roles.map((r) => r.user_id);
    const actifMap = new Map(roles.map((r) => [r.user_id, r.actif]));

    // 2. Récupérer profils correspondants
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, prenom, nom, email, telephone, created_at")
      .in("user_id", userIds);

    // 3. Récupérer comptes missions par user
    const { data: missionsRaw } = await supabase
      .from("missions")
      .select("user_id")
      .in("user_id", userIds);

    const countMap = new Map<string, number>();
    (missionsRaw ?? []).forEach((m) => {
      countMap.set(m.user_id, (countMap.get(m.user_id) ?? 0) + 1);
    });

    const rows: ClientRow[] = (profiles ?? []).map((p) => ({
      user_id: p.user_id,
      prenom: p.prenom ?? "",
      nom: p.nom ?? "",
      email: p.email,
      telephone: p.telephone,
      created_at: p.created_at,
      actif: actifMap.get(p.user_id) ?? true,
      missions_count: countMap.get(p.user_id) ?? 0,
    }));

    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setClients(rows);
    setLoading(false);
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  // Charger missions du client sélectionné
  useEffect(() => {
    if (!selected) { setMissions([]); return; }
    let cancelled = false;
    setLoadingMissions(true);
    supabase
      .from("missions")
      .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total")
      .eq("user_id", selected.user_id)
      .order("date_prise_en_charge", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!cancelled) {
          setMissions((data as MissionItem[]) ?? []);
          setLoadingMissions(false);
        }
      });
    return () => { cancelled = true; };
  }, [selected]);

  const toggleActif = async (userId: string, nextActif: boolean) => {
    if (!nextActif && !window.confirm("Suspendre ce client ? Il ne pourra plus se connecter à son espace.")) return;
    await supabase.from("user_roles").update({ actif: nextActif }).eq("user_id", userId).eq("role", "client");
    await fetchClients();
    if (selected?.user_id === userId) setSelected((prev) => prev ? { ...prev, actif: nextActif } : null);
  };

  const filtered = clients.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.prenom.toLowerCase().includes(q) ||
      c.nom.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.telephone ?? "").includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Clients</h1>
          <p className="text-cream/50 text-sm mt-1">
            {clients.length} client{clients.length > 1 ? "s" : ""} inscrit{clients.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="pl-9 pr-3 py-2 bg-navy/60 border border-primary/20 rounded text-cream text-sm focus:border-primary/60 focus:outline-none w-64 max-w-full"
            />
          </div>
          <button onClick={fetchClients} className="p-2 text-cream/50 hover:text-primary transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card-premium p-8 rounded text-center text-cream/40">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="card-premium p-8 rounded text-center text-cream/40">
          {search ? "Aucun client correspond à la recherche." : "Aucun client inscrit pour le moment."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm card-premium rounded">
            <thead>
              <tr className="text-cream/50 text-xs uppercase tracking-wider border-b border-primary/10">
                <th className="text-left py-3 px-4">Client</th>
                <th className="text-left py-3 px-4 hidden sm:table-cell">Contact</th>
                <th className="text-left py-3 px-4 hidden md:table-cell">Missions</th>
                <th className="text-left py-3 px-4 hidden md:table-cell">Inscrit le</th>
                <th className="text-left py-3 px-4">Statut</th>
                <th className="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.user_id} className="border-b border-primary/5 text-cream/80 hover:bg-primary/5 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium flex items-center gap-2">
                      <UserRound size={14} className="text-primary/60" />
                      {c.prenom} {c.nom}
                    </div>
                    <div className="text-cream/40 text-xs sm:hidden">{c.email}</div>
                  </td>
                  <td className="py-3 px-4 text-cream/60 hidden sm:table-cell">
                    <div>{c.email}</div>
                    {c.telephone && <div className="text-xs text-cream/40">{c.telephone}</div>}
                  </td>
                  <td className="py-3 px-4 text-cream/60 hidden md:table-cell">{c.missions_count}</td>
                  <td className="py-3 px-4 text-cream/40 hidden md:table-cell text-xs">
                    {new Date(c.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge kind={c.actif ? "success" : "danger"}>
                      {c.actif ? "Actif" : "Suspendu"}
                    </StatusBadge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button onClick={() => setSelected(c)} className="text-cream/50 hover:text-primary transition-colors" title="Voir">
                        <Eye size={16} />
                      </button>
                      {c.actif ? (
                        <button onClick={() => toggleActif(c.user_id, false)} className="text-cream/50 hover:text-destructive transition-colors" title="Suspendre">
                          <Ban size={16} />
                        </button>
                      ) : (
                        <button onClick={() => toggleActif(c.user_id, true)} className="text-cream/50 hover:text-green-400 transition-colors" title="Réactiver">
                          <CheckCircle size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setSelected(null)}>
          <div className="card-premium rounded-lg p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg text-primary">{selected.prenom} {selected.nom}</h3>
              <button onClick={() => setSelected(null)} className="text-cream/50 hover:text-cream">
                <X size={18} />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm mb-5">
              <DetailRow label="Email" value={selected.email} />
              <DetailRow label="Téléphone" value={selected.telephone} />
              <DetailRow label="Missions" value={String(selected.missions_count)} />
              <DetailRow label="Inscrit le" value={new Date(selected.created_at).toLocaleDateString("fr-FR")} />
            </div>

            <div className="flex items-center justify-between gap-3 pb-4 border-b border-primary/10">
              <StatusBadge kind={selected.actif ? "success" : "danger"} size="md">
                {selected.actif ? "Compte actif" : "Compte suspendu"}
              </StatusBadge>
              {selected.actif ? (
                <button
                  onClick={() => toggleActif(selected.user_id, false)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-destructive/15 text-destructive border border-destructive/30 rounded text-xs uppercase tracking-wider hover:bg-destructive/25 transition-colors"
                >
                  <Ban size={14} /> Suspendre
                </button>
              ) : (
                <button
                  onClick={() => toggleActif(selected.user_id, true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600/15 text-green-300 border border-green-500/30 rounded text-xs uppercase tracking-wider hover:bg-green-600/25 transition-colors"
                >
                  <CheckCircle size={14} /> Réactiver
                </button>
              )}
            </div>

            {/* Historique missions */}
            <div className="mt-4">
              <h4 className="text-cream/40 text-xs uppercase tracking-wider mb-3">
                Historique missions {missions.length > 0 && <span className="text-cream/30">({missions.length})</span>}
              </h4>
              {loadingMissions ? (
                <p className="text-cream/40 text-xs">Chargement…</p>
              ) : missions.length === 0 ? (
                <p className="text-cream/40 text-xs">Ce client n'a pas encore de mission.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {missions.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded bg-card/40 border border-primary/10 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="text-cream truncate">
                          {m.ville_depart} → {m.ville_arrivee}
                        </div>
                        <div className="text-cream/40">
                          {m.numero} · {new Date(m.date_prise_en_charge).toLocaleDateString("fr-FR")}
                          {m.prix_total > 0 && ` · ${m.prix_total} €`}
                        </div>
                      </div>
                      <StatusBadge kind={missionStatusKind(m.statut)}>
                        {missionStatusLabel(m.statut)}
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-cream/40 text-[10px] uppercase tracking-wider">{label}</p>
      <p className="text-cream text-sm">{value || "—"}</p>
    </div>
  );
}
