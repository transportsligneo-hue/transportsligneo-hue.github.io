/**
 * IncidentDetailPanel — fiche détaillée d'un incident du registre admin.
 * Signalement d'origine, contexte mission/GPS, historique de traitement,
 * commentaires internes et actions rapides.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  X, MapPin, Phone, Loader2, Send, UserCheck, Clock, MessageSquare, ArrowRight, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  formatDuration, graviteMeta, incidentTypeLabel, photosOf, resolutionMinutes, statutMeta,
  type IncidentStatut,
} from "@/lib/incidents";
import type { IncidentRow, AdminOption } from "@/lib/incidents-types";

interface IncidentEvent {
  id: string;
  event_type: string;
  from_statut: string | null;
  to_statut: string | null;
  assigned_to: string | null;
  commentaire: string | null;
  author_id: string | null;
  created_at: string;
}

const STATUTS: IncidentStatut[] = ["ouvert", "en_cours", "resolu", "annule"];

export function IncidentDetailPanel({
  incident, admins, onClose, onChanged,
}: {
  incident: IncidentRow;
  admins: AdminOption[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from("incident_events" as never)
      .select("id, event_type, from_statut, to_statut, assigned_to, commentaire, author_id, created_at")
      .eq("incident_id" as never, incident.id as never)
      .order("created_at", { ascending: false });
    setEvents((data as unknown as IncidentEvent[]) ?? []);
  }, [incident.id]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const adminName = (id: string | null) => {
    if (!id) return "Système";
    const a = admins.find((x) => x.user_id === id);
    return a ? a.label : "Admin";
  };

  const run = async (payload: Record<string, unknown>, okMsg: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_update_incident" as never, {
      _incident_id: incident.id,
      ...payload,
    } as never);
    setBusy(false);
    if (error) { toast.error("Action impossible", { description: error.message }); return; }
    toast.success(okMsg);
    setComment("");
    fetchEvents();
    onChanged();
  };

  const photos = photosOf(incident.photos);
  const gm = graviteMeta(incident.gravite);
  const sm = statutMeta(incident.statut);
  const resolMin = resolutionMinutes(incident.created_at, incident.resolu_at);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="h-full w-full max-w-[560px] overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-[#eaeaee] bg-white px-5 py-4">
          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${gm.dot}`} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${gm.chip}`}>{gm.label}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sm.chip}`}>{sm.label}</span>
              <span className="text-[11px] text-[#70727d]">{incidentTypeLabel(incident.type_incident)}</span>
            </div>
            <h2 className="mt-1 text-[15px] font-bold text-[#14161c]">{incident.titre}</h2>
            <p className="text-[11.5px] text-[#70727d]">
              {new Date(incident.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
              {resolMin != null && ` · résolu en ${formatDuration(resolMin)}`}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#70727d] hover:bg-[#f4f5f8]"><X size={18} /></button>
        </header>

        <div className="space-y-5 px-5 py-5">
          {/* Signalement */}
          <section>
            <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#9598a4]">Description du convoyeur</p>
            <p className="whitespace-pre-wrap rounded-xl bg-[#f7f8fb] p-3 text-[13px] text-[#14161c]">{incident.description}</p>
            {photos.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-[#eaeaee]">
                    <img src={url} alt={`Preuve ${i + 1}`} className="h-24 w-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            )}
          </section>

          {/* Contexte */}
          <section className="rounded-xl border border-[#eaeaee] p-3.5 text-[12.5px]">
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-[#9598a4]">Contexte au signalement</p>
            <div className="space-y-1.5 text-[#4a4d59]">
              <p className="flex items-center gap-2">
                Mission
                <Link
                  to="/admin/missions/$missionId"
                  params={{ missionId: incident.attribution_id }}
                  className="inline-flex items-center gap-1 font-semibold text-[#2f5fff] hover:underline"
                >
                  {incident.numero_mission ?? "Voir la fiche"} <ExternalLink size={11} />
                </Link>
              </p>
              {(incident.depart || incident.arrivee) && (
                <p className="flex items-center gap-1.5"><MapPin size={12} /> {incident.depart} → {incident.arrivee}</p>
              )}
              <p>Statut de la mission à cet instant : <strong>{incident.mission_etape ?? incident.mission_statut ?? "—"}</strong></p>
              <p>
                Convoyeur : <strong>{incident.convoyeur_nom || "—"}</strong>
                {incident.convoyeur_tel && (
                  <a href={`tel:${incident.convoyeur_tel}`} className="ml-2 inline-flex items-center gap-1 font-semibold text-[#2f5fff] hover:underline">
                    <Phone size={11} /> {incident.convoyeur_tel}
                  </a>
                )}
                {incident.convoyeur_id && (
                  <Link
                    to="/admin/convoyeurs/$convoyeurId"
                    params={{ convoyeurId: incident.convoyeur_id }}
                    className="ml-2 text-[11.5px] font-semibold text-[#2f5fff] hover:underline"
                  >
                    fiche
                  </Link>
                )}
              </p>
              <p>
                Client : <strong>{incident.client_nom || "—"}</strong>
                {incident.client_tel && (
                  <a href={`tel:${incident.client_tel}`} className="ml-2 inline-flex items-center gap-1 font-semibold text-[#2f5fff] hover:underline">
                    <Phone size={11} /> {incident.client_tel}
                  </a>
                )}
              </p>
              {incident.latitude != null && incident.longitude != null && (
                <a
                  href={`https://www.google.com/maps?q=${incident.latitude},${incident.longitude}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[#2f5fff] hover:underline"
                >
                  <MapPin size={12} /> Position GPS au signalement
                </a>
              )}
            </div>
          </section>

          {/* Actions rapides */}
          <section className="rounded-xl border border-[#eaeaee] p-3.5">
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-[#9598a4]">Actions rapides</p>
            <div className="flex flex-wrap gap-2">
              {STATUTS.filter((s) => s !== incident.statut).map((s) => (
                <button
                  key={s}
                  disabled={busy}
                  onClick={() => run({ _statut: s }, `Statut : ${statutMeta(s).label}`)}
                  className={`rounded-lg border px-3 py-1.5 text-[11.5px] font-semibold disabled:opacity-60 ${statutMeta(s).chip}`}
                >
                  {statutMeta(s).label}
                </button>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-[12px] text-[#70727d]">
              <UserCheck size={13} /> Assigné à
              <select
                value={incident.assigned_to ?? ""}
                disabled={busy}
                onChange={(e) =>
                  run(
                    e.target.value ? { _assigned_to: e.target.value } : { _clear_assignation: true },
                    "Assignation mise à jour",
                  )
                }
                className="flex-1 rounded-lg border border-[#eaeaee] px-2 py-1.5 text-[12.5px]"
              >
                <option value="">Non assigné</option>
                {admins.map((a) => (
                  <option key={a.user_id} value={a.user_id}>{a.label}</option>
                ))}
              </select>
            </label>
          </section>

          {/* Commentaire interne */}
          <section>
            <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#9598a4]">Commentaire interne</p>
            <div className="flex gap-2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Ex. Appelé le convoyeur à 14h32, véhicule finalement disponible."
                className="flex-1 rounded-lg border border-[#eaeaee] px-3 py-2 text-[12.5px] outline-none focus:border-[#2f5fff]"
              />
              <button
                disabled={busy || !comment.trim()}
                onClick={() => run({ _commentaire: comment }, "Commentaire ajouté")}
                className="h-9 self-end rounded-lg bg-[#2f5fff] px-3 text-white disabled:opacity-50"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </section>

          {/* Historique */}
          <section>
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-[#9598a4]">Historique de traitement</p>
            {events.length === 0 ? (
              <p className="text-[12px] text-[#9598a4]">Aucune action enregistrée pour le moment.</p>
            ) : (
              <ul className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="rounded-lg border border-[#eaeaee] p-2.5 text-[12px]">
                    <p className="flex flex-wrap items-center gap-1.5 text-[#4a4d59]">
                      {e.event_type === "commentaire" ? <MessageSquare size={12} /> : e.event_type === "assignation" ? <UserCheck size={12} /> : <Clock size={12} />}
                      <strong className="text-[#14161c]">{adminName(e.author_id)}</strong>
                      {e.event_type === "statut" && (
                        <span className="inline-flex items-center gap-1">
                          {statutMeta(e.from_statut).label} <ArrowRight size={11} /> {statutMeta(e.to_statut).label}
                        </span>
                      )}
                      {e.event_type === "assignation" && (
                        <span>{e.assigned_to ? `a assigné à ${adminName(e.assigned_to)}` : "a retiré l'assignation"}</span>
                      )}
                      <span className="ml-auto text-[10.5px] text-[#9598a4]">
                        {new Date(e.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </p>
                    {e.commentaire && <p className="mt-1 whitespace-pre-wrap text-[#14161c]">{e.commentaire}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
