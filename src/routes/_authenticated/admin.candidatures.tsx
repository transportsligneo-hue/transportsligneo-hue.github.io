import { createFileRoute } from "@tanstack/react-router";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MissionStatusBadge } from "@/components/admin/MissionStatusBadge";
import {
  Loader2, CheckCircle2, XCircle, MessageSquare, Send, Star, Filter, Search,
  Euro, MapPin, Clock, User, TrendingUp,
} from "lucide-react";
import { notifyDriver } from "@/lib/push/driver-notify";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/candidatures")({
  component: AdminCandidatures,
});

interface Offer {
  id: string;
  trajet_id: string;
  convoyeur_id: string;
  prix_propose: number;
  prix_suggere_snapshot: number | null;
  type_offre: string;
  statut: string;
  message: string | null;
  admin_counter_offer: number | null;
  admin_counter_at: string | null;
  created_at: string;
  trajet?: {
    id: string; depart: string; arrivee: string; date_trajet: string | null;
    prix_convoyeur_fixe: number | null; prix_convoyeur: number | null;
    allow_counter_offer: boolean;
    mission_group_id: string | null; leg_type: string | null; prix_suggere: number | null;
  };
  convoyeur?: {
    id: string; nom: string; prenom: string; ville: string | null;
    note_moyenne?: number | null; missions_realisees?: number | null;
  };
}

function AdminCandidatures() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("en_attente");

  const [counterFor, setCounterFor] = useState<Offer | null>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [counterMsg, setCounterMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("mission_offres")
      .select("id,trajet_id,convoyeur_id,prix_propose,prix_suggere_snapshot,type_offre,statut,message,admin_counter_offer,admin_counter_at,created_at, trajet:trajets(id,depart,arrivee,date_trajet,prix_convoyeur_fixe,prix_convoyeur,prix_suggere,allow_counter_offer,mission_group_id,leg_type), convoyeur:convoyeurs(id,nom,prenom,ville)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) { toast.error(error.message); setLoading(false); return; }
    setOffers((data ?? []) as unknown as Offer[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const ch = supabase
      .channel("admin-candidatures")
      .on("postgres_changes", { event: "*", schema: "public", table: "mission_offres" }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return offers.filter((o) => {
      if (statutFilter !== "all" && o.statut !== statutFilter) return false;
      if (s) {
        const hay = `${o.trajet?.depart ?? ""} ${o.trajet?.arrivee ?? ""} ${o.convoyeur?.nom ?? ""} ${o.convoyeur?.prenom ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [offers, search, statutFilter]);

  const groupedByTrajet = useMemo(() => {
    const map: Record<string, Offer[]> = {};
    filtered.forEach((o) => {
      const isAr = o.trajet?.mission_group_id && (o.trajet.leg_type === "aller" || o.trajet.leg_type === "retour");
      const key = isAr ? o.trajet?.mission_group_id ?? o.trajet_id : o.trajet_id;
      (map[key] ||= []).push(o);
    });
    return Object.entries(map);
  }, [filtered]);

  const displayOffersForGroup = (list: Offer[]) => {
    const byDriver = new Map<string, Offer[]>();
    list.forEach((offer) => {
      byDriver.set(offer.convoyeur_id, [...(byDriver.get(offer.convoyeur_id) ?? []), offer]);
    });

    return Array.from(byDriver.values()).map((driverOffers) => {
      const primary =
        driverOffers.find((offer) => offer.trajet?.leg_type === "aller") ?? driverOffers[0];
      return {
        ...primary,
        prix_propose: driverOffers.reduce((sum, offer) => sum + Number(offer.prix_propose ?? 0), 0),
      };
    });
  };

  const suggestedForGroup = (list: Offer[]) => {
    const byTrajet = new Map<string, Offer["trajet"]>();
    list.forEach((offer) => {
      if (offer.trajet) byTrajet.set(offer.trajet.id, offer.trajet);
    });
    return Array.from(byTrajet.values()).reduce(
      (sum, trajet) => sum + Number(trajet?.prix_convoyeur_fixe ?? trajet?.prix_convoyeur ?? trajet?.prix_suggere ?? 0),
      0,
    );
  };

  const stats = useMemo(() => ({
    total: offers.length,
    enAttente: offers.filter((o) => o.statut === "en_attente").length,
    contreOffres: offers.filter((o) => o.type_offre === "contre_proposition" && o.statut === "en_attente").length,
    acceptees: offers.filter((o) => o.statut === "accepte").length,
  }), [offers]);

  const award = async (id: string) => {
    if (!confirm("Attribuer la mission à ce convoyeur ?\nToutes les autres candidatures seront refusées.")) return;
    setBusy(id);
    const { error } = await supabase.rpc("admin_award_offer", { _offre_id: id });
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      const offre = offers.find((o) => o.id === id);
      notifyDriver({
        convoyeurId: (offre as { convoyeur_id?: string } | undefined)?.convoyeur_id,
        trajetId: (offre as { trajet_id?: string } | undefined)?.trajet_id,
        event: "mission_validee",
      });
      toast.success("Mission attribuée !");
      fetchData();
    }
  };
  const reject = async (id: string) => {
    const reason = prompt("Motif du refus (facultatif) :", "");
    setBusy(id);
    const { error } = await supabase.rpc("admin_reject_offer", { _offre_id: id, _reason: reason || undefined });
    setBusy(null);
    if (error) toast.error(error.message); else { toast.success("Candidature refusée"); fetchData(); }
  };
  const sendCounter = async () => {
    if (!counterFor) return;
    const price = Number(counterPrice);
    if (!Number.isFinite(price) || price <= 0) { toast.error("Prix invalide"); return; }
    setBusy(counterFor.id);
    const { error } = await supabase.rpc("admin_counter_offer", {
      _offre_id: counterFor.id, _counter_price: price, _message: counterMsg || undefined,
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Contre-proposition envoyée");
    setCounterFor(null); setCounterPrice(""); setCounterMsg("");
    fetchData();
  };

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        breadcrumb="Candidatures"
        eyebrow="Marketplace convoyeurs"
        title="Marketplace"
        highlight="Missions"
        subtitle="Offres et contre-offres reçues sur les missions publiées à la marketplace."
      />


      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total candidatures", value: stats.total, icon: TrendingUp, tone: "text-blue-600" },
          { label: "En attente", value: stats.enAttente, icon: Clock, tone: "text-amber-600" },
          { label: "Contre-offres", value: stats.contreOffres, icon: Euro, tone: "text-violet-600" },
          { label: "Acceptées", value: stats.acceptees, icon: CheckCircle2, tone: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-xl bg-white border border-pro-border">
            <div className="flex items-center justify-between">
              <s.icon size={18} className={s.tone} />
              <span className="text-2xl font-bold text-pro-text">{s.value}</span>
            </div>
            <div className="text-xs text-pro-text-soft mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-3 flex-wrap items-center p-3 rounded-xl border border-pro-border bg-white">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-pro-muted" />
          <input placeholder="Convoyeur ou trajet…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-pro-border text-sm" />
        </div>
        <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-pro-border text-sm">
          <option value="en_attente">En attente</option>
          <option value="accepte">Acceptées</option>
          <option value="refuse">Refusées</option>
          <option value="contre_offre_admin">Contre-offre admin</option>
          <option value="all">Toutes</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-pro-gold" size={28} /></div>
      ) : groupedByTrajet.length === 0 ? (
        <div className="text-center py-16 text-pro-text-soft rounded-xl border border-dashed border-pro-border bg-white">
          Aucune candidature pour ces critères.
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByTrajet.map(([trajetId, list]) => {
            const t = list[0].trajet;
            const isAr = Boolean(t?.mission_group_id && (t.leg_type === "aller" || t.leg_type === "retour"));
            const displayOffers = displayOffersForGroup(list);
            const suggested = isAr ? suggestedForGroup(list) : t?.prix_convoyeur_fixe ?? t?.prix_convoyeur ?? t?.prix_suggere ?? 0;
            return (
              <div key={trajetId} className="rounded-xl border border-pro-border bg-white overflow-hidden">
                <div className="p-4 bg-pro-bg-soft border-b border-pro-border flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin size={15} className="text-emerald-600" />
                    <span className="font-semibold text-pro-text">{t?.depart}</span>
                    <span className="text-pro-muted">→</span>
                    <span className="font-semibold text-pro-text">{t?.arrivee}</span>
                    
                    {isAr && <span className="text-xs font-bold text-amber-700">· Livraison + Restitution</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-pro-muted">Tarif base :</span>
                    <span className="font-bold text-pro-text">{suggested.toFixed(0)} €</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                      {displayOffers.length} candidature{displayOffers.length > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-pro-border">
                  {displayOffers.map((o) => {
                    const diff = o.prix_propose - suggested;
                    return (
                      <div key={o.id} className="p-4 flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                          <div className="w-9 h-9 rounded-full bg-pro-brand-strip flex items-center justify-center text-white text-xs font-bold">
                            {(o.convoyeur?.prenom?.[0] ?? "?") + (o.convoyeur?.nom?.[0] ?? "")}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-pro-text text-sm truncate">
                              {o.convoyeur?.prenom} {o.convoyeur?.nom}
                            </div>
                            <div className="text-xs text-pro-muted truncate">
                              {o.convoyeur?.ville ?? "—"} · <Clock size={10} className="inline" /> {new Date(o.created_at).toLocaleString("fr-FR")}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-bold text-pro-text">{o.prix_propose.toFixed(0)} €</div>
                          {diff !== 0 && (
                            <div className={`text-[11px] font-semibold ${diff > 0 ? "text-red-600" : "text-emerald-600"}`}>
                              {diff > 0 ? "+" : ""}{diff.toFixed(0)} € vs base
                            </div>
                          )}
                        </div>

                        <div>
                          {o.type_offre === "contre_proposition" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200">Contre-offre</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">Acceptation</span>
                          )}
                        </div>

                        <div>
                          <MissionStatusBadge status={o.statut === "contre_offre_admin" ? "propose" : (o.statut === "en_attente" ? "propose" : o.statut === "accepte" ? "attribue" : o.statut === "refuse" ? "refusee" : o.statut)} short />
                        </div>

                        {o.message && (
                          <div className="w-full text-xs text-pro-text-soft italic px-2 py-1 rounded bg-pro-bg-soft border border-pro-border/60">
                            <MessageSquare size={11} className="inline mr-1" /> {o.message}
                          </div>
                        )}

                        {o.statut === "en_attente" && (
                          <div className="flex gap-2 w-full sm:w-auto">
                            <button disabled={busy === o.id} onClick={() => award(o.id)}
                              className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-50">
                              <CheckCircle2 size={13} /> Attribuer
                            </button>
                            {t?.allow_counter_offer && (
                              <button disabled={busy === o.id}
                                onClick={() => { setCounterFor(o); setCounterPrice(String(o.prix_propose - 5)); }}
                                className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 flex items-center gap-1 disabled:opacity-50">
                                <MessageSquare size={13} /> Contre
                              </button>
                            )}
                            <button disabled={busy === o.id} onClick={() => reject(o.id)}
                              className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-semibold hover:bg-red-100 flex items-center gap-1 disabled:opacity-50">
                              <XCircle size={13} /> Refuser
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal contre-proposition admin */}
      {counterFor && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setCounterFor(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-pro-text mb-1">Contre-proposition</h3>
            <p className="text-sm text-pro-text-soft mb-4">
              À {counterFor.convoyeur?.prenom} {counterFor.convoyeur?.nom} — offre initiale : {counterFor.prix_propose} €
            </p>
            <label className="text-xs font-semibold text-pro-text-soft">Votre prix (€)</label>
            <input type="number" value={counterPrice} onChange={(e) => setCounterPrice(e.target.value)}
              className="w-full mt-1 mb-3 px-3 py-2 rounded-lg border border-pro-border text-lg font-bold" />
            <label className="text-xs font-semibold text-pro-text-soft">Message (facultatif)</label>
            <textarea rows={3} value={counterMsg} onChange={(e) => setCounterMsg(e.target.value)}
              className="w-full mt-1 mb-4 px-3 py-2 rounded-lg border border-pro-border text-sm resize-none" />
            <div className="flex gap-2">
              <button onClick={() => setCounterFor(null)} className="flex-1 px-4 py-2 rounded-lg border border-pro-border text-sm">Annuler</button>
              <button onClick={sendCounter} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 text-white font-semibold text-sm flex items-center justify-center gap-1.5">
                <Send size={14} /> Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
