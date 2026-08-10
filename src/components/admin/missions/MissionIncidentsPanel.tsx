/**
 * MissionIncidentsPanel — vue admin des incidents signalés par le convoyeur.
 *
 * Liste temps réel des incidents d'une mission, avec photos, position GPS,
 * traitement (en cours / résolu + réponse admin) et actions suggérées selon
 * le type d'incident (ex. véhicule non disponible → passage à vide).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle, Loader2, MapPin, CheckCircle2, Clock, FilePlus2, ShieldAlert,
} from "lucide-react";
import { Card, Badge, Button } from "@/components/admin/AdminUI";

interface IncidentRow {
  id: string;
  titre: string;
  description: string;
  gravite: string;
  statut: string;
  type_incident: string | null;
  latitude: number | null;
  longitude: number | null;
  photos: unknown;
  reponse_admin: string | null;
  resolu_at: string | null;
  created_at: string;
}

interface Props {
  attributionId: string;
  /** Ouvre le formulaire "passage à vide" pré-rempli avec ce motif. */
  onPassageAVide?: (motif: string) => void;
}

const GRAVITE_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = {
  critique: "danger",
  grave: "danger",
  moyen: "warning",
  mineur: "info",
};

const TYPE_LABEL: Record<string, string> = {
  retard: "Retard",
  vehicule_non_dispo: "Véhicule non disponible",
  vehicule_non_roulant: "Véhicule non roulant",
  probleme_vehicule: "Problème véhicule",
  client_injoignable: "Client injoignable",
  acces_difficile: "Accès difficile",
  accident: "Accident",
  vol_securite: "Vol / Sécurité",
};

/** Types d'incident justifiant un trajet à vide facturable. */
const PV_TYPES = new Set(["vehicule_non_dispo", "vehicule_non_roulant"]);

function typeLabelOf(t: string | null): string {
  if (!t) return "Incident";
  if (t.startsWith("autre:")) return t.slice(6);
  return TYPE_LABEL[t] ?? t;
}

function photosOf(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((p): p is string => typeof p === "string");
  return [];
}

export function MissionIncidentsPanel({ attributionId, onPassageAVide }: Props) {
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("mission_incidents")
      .select("id, titre, description, gravite, statut, type_incident, latitude, longitude, photos, reponse_admin, resolu_at, created_at")
      .eq("attribution_id", attributionId)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as unknown as IncidentRow[]);
    setLoading(false);
  }, [attributionId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`mission-incidents-${attributionId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "mission_incidents", filter: `attribution_id=eq.${attributionId}` },
        () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [attributionId, load]);

  const openCount = useMemo(() => rows.filter((r) => r.statut !== "resolu").length, [rows]);

  const setStatut = async (row: IncidentRow, statut: string) => {
    setBusy(row.id);
    try {
      const payload: Record<string, unknown> = { statut };
      const reponse = drafts[row.id]?.trim();
      if (reponse) payload["reponse_admin"] = reponse;
      if (statut === "resolu") payload["resolu_at"] = new Date().toISOString();
      const { error } = await supabase
        .from("mission_incidents")
        .update(payload as never)
        .eq("id", row.id);
      if (error) throw error;
      toast.success(statut === "resolu" ? "Incident résolu" : "Incident pris en charge");
      await load();
    } catch (e) {
      toast.error("Mise à jour impossible", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={15} className={openCount > 0 ? "text-red-500" : "text-pro-accent"} />
        <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
          Incidents ({rows.length})
        </h3>
        {openCount > 0 && <Badge tone="danger">{openCount} à traiter</Badge>}
      </div>

      {loading ? (
        <div className="flex justify-center py-5"><Loader2 size={18} className="animate-spin text-pro-accent" /></div>
      ) : rows.length === 0 ? (
        <p className="text-pro-text-soft text-xs">Aucun incident signalé sur cette mission.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const photos = photosOf(row.photos);
            const resolved = row.statut === "resolu";
            const suggestPv = PV_TYPES.has(row.type_incident ?? "");
            return (
              <div
                key={row.id}
                className={`rounded-xl border p-3 ${resolved ? "border-pro-border bg-pro-bg-soft" : "border-red-500/40 bg-red-500/5"}`}
              >
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <Badge tone={GRAVITE_TONE[row.gravite] ?? "neutral"}>{row.gravite}</Badge>
                  <Badge tone="neutral">{typeLabelOf(row.type_incident)}</Badge>
                  {resolved
                    ? <Badge tone="success">Résolu</Badge>
                    : row.statut === "en_cours"
                      ? <Badge tone="warning">En traitement</Badge>
                      : <Badge tone="danger">Ouvert</Badge>}
                  <span className="ml-auto text-pro-text-soft text-[11px]">
                    {new Date(row.created_at).toLocaleString("fr-FR")}
                  </span>
                </div>

                <p className="text-pro-text text-sm font-semibold">{row.titre}</p>
                <p className="text-pro-text-soft text-xs mt-0.5 whitespace-pre-wrap">{row.description}</p>

                {(row.latitude != null && row.longitude != null) && (
                  <a
                    href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-pro-accent mt-1.5 hover:underline"
                  >
                    <MapPin size={12} /> Position du signalement
                  </a>
                )}

                {photos.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {photos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img
                          src={url}
                          alt={`Preuve ${i + 1}`}
                          loading="lazy"
                          className="w-full aspect-square object-cover rounded-md border border-pro-border"
                        />
                      </a>
                    ))}
                  </div>
                )}

                {row.reponse_admin && (
                  <p className="text-pro-text-soft text-[11px] mt-2 italic">Réponse admin : {row.reponse_admin}</p>
                )}

                {suggestPv && (
                  <button
                    type="button"
                    onClick={() => onPassageAVide?.(
                      `${typeLabelOf(row.type_incident)} — ${row.titre}`,
                    )}
                    className="mt-2 w-full flex items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-800"
                  >
                    <FilePlus2 size={14} />
                    Générer un passage à vide (véhicule indisponible)
                  </button>
                )}

                {!resolved && (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={drafts[row.id] ?? ""}
                      onChange={(e) => setDrafts((p) => ({ ...p, [row.id]: e.target.value }))}
                      placeholder="Réponse / décision admin (optionnel)"
                      rows={2}
                      className="w-full rounded-lg border border-pro-border bg-white px-3 py-2 text-xs text-pro-text outline-none"
                    />
                    <div className="flex gap-2">
                      {row.statut !== "en_cours" && (
                        <Button variant="secondary" onClick={() => void setStatut(row, "en_cours")} disabled={busy === row.id}>
                          <Clock size={13} /> Prendre en charge
                        </Button>
                      )}
                      <Button onClick={() => void setStatut(row, "resolu")} disabled={busy === row.id}>
                        {busy === row.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        Marquer résolu
                      </Button>
                    </div>
                  </div>
                )}

                {row.gravite === "critique" && !resolved && (
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-red-600">
                    <ShieldAlert size={12} /> Incident critique — contacter le convoyeur immédiatement.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
