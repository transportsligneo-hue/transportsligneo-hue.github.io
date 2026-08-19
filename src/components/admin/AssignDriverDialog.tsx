import { useEffect, useState, useMemo } from "react";
import { DriverAvatar } from "@/components/admin/DriverAvatar";
import { supabase } from "@/integrations/supabase/client";
import { Search, MapPin, CheckCircle2, Building2, User, Send, Star } from "lucide-react";
import { Modal, Button, FormField, SearchInput, Badge } from "./AdminUI";
import { confirmToast } from "@/lib/confirm-toast";
import { sendTransactionalEmail } from "@/lib/email/send";

interface Convoyeur {
  id: string;
  prenom: string;
  nom: string;
  ville: string | null;
  telephone: string;
  type_convoyeur: string;
  organization_id: string | null;
  statut: string;
}

interface FleetOrg {
  id: string;
  legal_name: string;
  commercial_name: string | null;
}

interface AssignmentScore {
  available: boolean;
  activeMissions: number;
  sameCity: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Contexte du trajet/mission à assigner */
  trip: {
    id: string;
    depart: string;
    arrivee: string;
    date?: string | null;
    /** Source · détermine quelle table on update */
    source: "trajet" | "b2b_request" | "mission";
  };
  existingAttributionId?: string;
  onAssigned?: (target: { type: "convoyeur" | "fleet"; id: string; label: string }) => void;
}

export function AssignDriverDialog({ open, onClose, trip, existingAttributionId, onAssigned }: Props) {
  const [tab, setTab] = useState<"convoyeur" | "flotte">("convoyeur");
  const [convoyeurs, setConvoyeurs] = useState<Convoyeur[]>([]);
  const [fleets, setFleets] = useState<FleetOrg[]>([]);
  const [scores, setScores] = useState<Record<string, AssignmentScore>>({});
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected("");
    setSearch("");

    // Charger tous les convoyeurs sauf refusés/suspendus
    supabase
      .from("convoyeurs")
      .select("id, prenom, nom, ville, telephone, type_convoyeur, organization_id, statut")
      .not("statut", "in", "(refuse,suspendu)")
      .then(({ data }) => {
        const list = (data ?? []) as Convoyeur[];
        setConvoyeurs(list);
        computeScores(list, trip);
      });


    // Charger organisations flottes (orgs avec rôle flotte_partenaire)
    supabase
      .from("organization_roles")
      .select("organization_id, organizations!inner(id, legal_name, commercial_name)")
      .eq("role", "flotte_partenaire")
      .eq("active", true)
      .then(({ data }) => {
        const list =
          (data ?? [])
            .map((r: { organizations: FleetOrg | null }) => r.organizations)
            .filter(Boolean) as FleetOrg[];
        setFleets(list);
      });
  }, [open, trip.id]);

  async function computeScores(list: Convoyeur[], t: typeof trip) {
    const ids = list.map((c) => c.id);
    if (ids.length === 0) return;
    // Missions actives (attributions non terminées)
    const { data: actives } = await supabase
      .from("attributions")
      .select("convoyeur_id, statut")
      .in("convoyeur_id", ids)
      .in("statut", ["propose", "accepte", "en_cours"]);
    const counts: Record<string, number> = {};
    (actives ?? []).forEach((a) => {
      counts[a.convoyeur_id] = (counts[a.convoyeur_id] ?? 0) + 1;
    });
    // Dispo aujourd'hui (best-effort)
    const today = (t.date ?? new Date().toISOString().split("T")[0]).slice(0, 10);
    const { data: dispos } = await supabase
      .from("disponibilites_convoyeurs")
      .select("convoyeur_id, statut")
      .in("convoyeur_id", ids)
      .eq("date_dispo", today);
    const dispoMap: Record<string, boolean> = {};
    (dispos ?? []).forEach((d) => {
      dispoMap[d.convoyeur_id] = d.statut === "disponible";
    });
    const departLow = (t.depart ?? "").toLowerCase();
    const next: Record<string, AssignmentScore> = {};
    list.forEach((c) => {
      next[c.id] = {
        available: dispoMap[c.id] ?? true, // Par défaut considéré dispo si pas d'info
        activeMissions: counts[c.id] ?? 0,
        sameCity: c.ville ? departLow.includes(c.ville.toLowerCase()) : false,
      };
    });
    setScores(next);
  }

  /** Score numérique : plus c'est haut, mieux c'est */
  function rankScore(c: Convoyeur): number {
    const s = scores[c.id];
    if (!s) return 0;
    let score = 0;
    if (s.available) score += 50;
    if (s.sameCity) score += 30;
    score -= s.activeMissions * 10;
    return score;
  }

  const filteredConvoyeurs = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? convoyeurs.filter(
          (c) =>
            `${c.prenom} ${c.nom}`.toLowerCase().includes(q) ||
            (c.ville ?? "").toLowerCase().includes(q),
        )
      : convoyeurs;
    return [...list].sort((a, b) => rankScore(b) - rankScore(a));
  }, [convoyeurs, search, scores]);

  const filteredFleets = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return fleets;
    return fleets.filter(
      (f) =>
        f.legal_name.toLowerCase().includes(q) ||
        (f.commercial_name ?? "").toLowerCase().includes(q),
    );
  }, [fleets, search]);

  /** Prévient le client qu'un convoyeur / une flotte a été affecté(e) à sa mission. */
  async function notifyClientAssignment(convoyeurLabel: string) {
    try {
      let email: string | null = null;
      let prenom: string | null = null;
      let numero: string | null = null;
      let date: string | null = trip.date ?? null;

      if (trip.source === "trajet") {
        const { data } = await supabase
          .from("trajets")
          .select("client_email, client_nom, numero_mission, date_trajet")
          .eq("id", trip.id)
          .maybeSingle();
        email = data?.client_email ?? null;
        prenom = data?.client_nom ?? null;
        numero = data?.numero_mission ?? null;
        date = data?.date_trajet ?? date;
      } else if (trip.source === "mission") {
        const { data } = await supabase
          .from("missions")
          .select("email, prenom, numero, date_prise_en_charge")
          .eq("id", trip.id)
          .maybeSingle();
        email = data?.email ?? null;
        prenom = data?.prenom ?? null;
        numero = data?.numero ?? null;
        date = data?.date_prise_en_charge ?? date;
      }

      if (!email) return;
      await sendTransactionalEmail({
        templateName: "attribution-convoyeur",
        recipientEmail: email,
        idempotencyKey: `attribution-${trip.source}-${trip.id}-${selected}`,
        templateData: {
          prenom,
          numero,
          convoyeur: convoyeurLabel,
          date: date ? new Date(date).toLocaleDateString("fr-FR") : null,
        },
      });
    } catch {
      /* email non bloquant */
    }
  }

  async function handleAssign() {
    if (!selected) return;
    if (tab === "convoyeur") {
      const c = convoyeurs.find((x) => x.id === selected);
      if (c && c.statut !== "valide" && c.statut !== "actif") {
        const ok = (await confirmToast(
          `Attention : ${c.prenom} ${c.nom} n'a pas encore tous ses documents validés (statut : ${c.statut}).\n\nVoulez-vous quand même lui assigner cette mission ?`
        ));
        if (!ok) return;
      }
    }
    setSubmitting(true);
    try {

      if (tab === "convoyeur") {
        // 1. Update source table
        if (trip.source === "trajet") {
          await supabase
            .from("trajets")
            .update({ statut: "attribue", statut_publication: "attribue" } as never)
            .eq("id", trip.id);

          if (existingAttributionId) {
            await supabase
              .from("attributions")
              .update({ convoyeur_id: selected, statut: "propose", etape_courante: null } as never)
              .eq("id", existingAttributionId);
          } else {
            await supabase.from("attributions").insert({
              trajet_id: trip.id,
              convoyeur_id: selected,
              statut: "propose",
            });
          }
        } else if (trip.source === "b2b_request") {
          await supabase
            .from("b2b_transport_requests")
            .update({
              assigned_convoyeur_id: selected,
              operational_status: "attribue",
            })
            .eq("id", trip.id);
        } else if (trip.source === "mission") {
          await supabase
            .from("missions")
            .update({ statut: "attribuee" })
            .eq("id", trip.id);
        }
        const c = convoyeurs.find((x) => x.id === selected);
        const convoyeurLabel = c ? `${c.prenom} ${c.nom}` : selected;
        onAssigned?.({
          type: "convoyeur",
          id: selected,
          label: convoyeurLabel,
        });
        await notifyClientAssignment(convoyeurLabel);
      } else {
        // Flotte
        if (trip.source === "mission") {
          await supabase
            .from("missions")
            .update({ fleet_organization_id: selected, statut: "attribuee" })
            .eq("id", trip.id);
        } else if (trip.source === "b2b_request") {
          await supabase
            .from("b2b_transport_requests")
            .update({ organization_id: selected, operational_status: "attribue" })
            .eq("id", trip.id);
        }
        const f = fleets.find((x) => x.id === selected);
        onAssigned?.({
          type: "fleet",
          id: selected,
          label: f ? f.commercial_name ?? f.legal_name : selected,
        });
        await notifyClientAssignment(f ? f.commercial_name ?? f.legal_name : "Flotte partenaire");
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Assigner le trajet" size="lg">
      <div className="space-y-4">
        {/* Récap trajet */}
        <div className="px-4 py-3 rounded-xl bg-pro-bg-soft border border-pro-border">
          <p className="text-xs text-pro-muted uppercase tracking-wider font-semibold">Trajet</p>
          <p className="text-sm font-medium text-pro-text mt-1">
            {trip.depart} → {trip.arrivee}
          </p>
          {trip.date && (
            <p className="text-xs text-pro-text-soft mt-0.5">
              {new Date(trip.date).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-pro-bg-soft border border-pro-border w-fit">
          <button
            onClick={() => {
              setTab("convoyeur");
              setSelected("");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === "convoyeur"
                ? "bg-white text-pro-text shadow-sm"
                : "text-pro-text-soft hover:text-pro-text"
            }`}
          >
            <User size={13} /> Convoyeur ({convoyeurs.length})
          </button>
          <button
            onClick={() => {
              setTab("flotte");
              setSelected("");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === "flotte"
                ? "bg-white text-pro-text shadow-sm"
                : "text-pro-text-soft hover:text-pro-text"
            }`}
          >
            <Building2 size={13} /> Flotte partenaire ({fleets.length})
          </button>
        </div>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={tab === "convoyeur" ? "Nom, ville…" : "Nom de l'organisation…"}
        />

        {/* Liste */}
        <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
          {tab === "convoyeur" ? (
            filteredConvoyeurs.length === 0 ? (
              <p className="text-sm text-pro-muted text-center py-8">
                Aucun convoyeur disponible.
              </p>
            ) : (
              filteredConvoyeurs.map((c) => {
                const s = scores[c.id];
                const isSel = selected === c.id;
                const score = rankScore(c);
                const isHot = score >= 70;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSel
                        ? "border-pro-gold bg-pro-gold-soft shadow-sm"
                        : "border-pro-border bg-white hover:border-pro-gold/40 hover:bg-pro-bg-soft/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <DriverAvatar convoyeurId={c.id} name={`${c.prenom} ${c.nom}`} size="sm" />
                          <p className="font-medium text-pro-text">
                            {c.prenom} {c.nom}
                          </p>
                          <Badge tone="neutral">Indépendant</Badge>
                          {c.statut === "valide" || c.statut === "actif" ? (
                            <Badge tone="success">Validé</Badge>
                          ) : c.statut === "en_attente" ? (
                            <Badge tone="warning">Docs en attente</Badge>
                          ) : (
                            <Badge tone="neutral">{c.statut}</Badge>
                          )}
                          {isHot && (
                            <Badge tone="primary" icon={<Star size={10} />}>
                              Recommandé
                            </Badge>
                          )}

                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-pro-text-soft flex-wrap">
                          {c.ville && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={11} /> {c.ville}
                              {s?.sameCity && (
                                <span className="text-emerald-600">· même zone</span>
                              )}
                            </span>
                          )}
                          {s && (
                            <span
                              className={
                                s.available ? "text-emerald-600" : "text-amber-600"
                              }
                            >
                              {s.available ? "● Disponible" : "● Indisponible"}
                            </span>
                          )}
                          {s && (
                            <span className="text-pro-muted">
                              {s.activeMissions} mission{s.activeMissions > 1 ? "s" : ""} active
                              {s.activeMissions > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSel && <CheckCircle2 size={18} className="text-pro-gold shrink-0" />}
                    </div>
                  </button>
                );
              })
            )
          ) : filteredFleets.length === 0 ? (
            <p className="text-sm text-pro-muted text-center py-8">
              Aucune flotte partenaire enregistrée.
            </p>
          ) : (
            filteredFleets.map((f) => {
              const isSel = selected === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setSelected(f.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSel
                      ? "border-pro-gold bg-pro-gold-soft shadow-sm"
                      : "border-pro-border bg-white hover:border-pro-gold/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-pro-text">
                        {f.commercial_name ?? f.legal_name}
                      </p>
                      {f.commercial_name && (
                        <p className="text-xs text-pro-muted mt-0.5">{f.legal_name}</p>
                      )}
                    </div>
                    {isSel && <CheckCircle2 size={18} className="text-pro-gold" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t border-pro-border">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selected || submitting}
            icon={<Send size={14} />}
            className="flex-1"
          >
            {submitting ? "Assignation…" : "Assigner"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
