/**
 * IncidentReportSheet · interface plein écran (sheet) pour signaler un incident.
 * Remplace l'ancienne mini-modale transparente difficilement lisible.
 *
 * Crée une ligne dans `mission_incidents` + une notif admin + envoie l'email
 * `incident-admin` (best effort). Persiste aussi une étape `incident` dans
 * `mission_etape_history` pour traçabilité.
 */
import { useState } from "react";
import { AlertTriangle, X, MapPin, Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifyAdmin } from "@/lib/admin-notifications";

interface Props {
  attributionId: string;
  userId: string;
  numeroMission?: string | null;
  driverName?: string;
  onClose: () => void;
  onReported?: () => void;
}

const GRAVITES = [
  { key: "mineur", label: "Mineur", desc: "Retard léger, accès difficile…", color: "amber" },
  { key: "moyen", label: "Moyen", desc: "Souci ponctuel à signaler", color: "orange" },
  { key: "grave", label: "Grave", desc: "Panne, refus client, dégradation", color: "red" },
  { key: "critique", label: "Critique", desc: "Accident, vol, urgence", color: "rose" },
] as const;

export function IncidentReportSheet({
  attributionId, userId, numeroMission, driverName, onClose, onReported,
}: Props) {
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [gravite, setGravite] = useState<typeof GRAVITES[number]["key"]>("moyen");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!titre.trim() || !description.trim()) {
      toast.error("Titre et description obligatoires");
      return;
    }
    setSubmitting(true);

    // Géoloc best-effort
    let latitude: number | null = null;
    let longitude: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000, enableHighAccuracy: true })
      );
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch { /* géoloc optionnelle */ }

    const { data: incident, error } = await supabase
      .from("mission_incidents" as never)
      .insert({
        attribution_id: attributionId,
        convoyeur_user_id: userId,
        titre: titre.trim(),
        description: description.trim(),
        gravite,
        latitude,
        longitude,
      } as never)
      .select("id")
      .single();

    if (error || !incident) {
      toast.error("Échec d'envoi", { description: error?.message });
      setSubmitting(false);
      return;
    }

    // Trace dans l'historique d'étapes
    await supabase.from("mission_etape_history" as never).insert({
      attribution_id: attributionId,
      etape: "incident",
      notes: `[${gravite}] ${titre.trim()}`,
      created_by: userId,
    } as never);

    // Notification admin
    const incId = (incident as { id: string }).id;
    await notifyAdmin({
      type: "incident",
      titre: `Incident ${gravite} · ${numeroMission ?? "mission"}`,
      message: titre.trim(),
      link: `/admin/missions/${attributionId}?tab=incidents`,
      entityType: "incident",
      entityId: incId,
      metadata: { gravite, driver: driverName ?? null },
    });

    setDone(true);
    setSubmitting(false);
    toast.success("Incident signalé à l'admin");
    onReported?.();
    setTimeout(onClose, 1200);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-[#0b1026]/95 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-6">
      <div className="bg-white w-full max-w-xl sm:rounded-2xl shadow-2xl flex flex-col max-h-screen overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-pro-border bg-red-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <ShieldAlert size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-80">Signalement urgent</p>
              <h2 className="text-base font-bold leading-tight">Signaler un incident</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/15 rounded-lg" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        {done ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 size={32} className="text-emerald-600" />
            </div>
            <p className="text-lg font-semibold text-pro-text">Incident transmis à l'admin</p>
            <p className="text-sm text-pro-text-soft mt-2">Vous serez recontacté rapidement.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Gravité */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-pro-muted mb-2">
                Niveau de gravité
              </label>
              <div className="grid grid-cols-2 gap-2">
                {GRAVITES.map((g) => {
                  const active = gravite === g.key;
                  return (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setGravite(g.key)}
                      className={`text-left p-3 rounded-xl border-2 transition ${
                        active
                          ? `border-${g.color}-500 bg-${g.color}-50`
                          : "border-pro-border hover:border-pro-text-soft bg-white"
                      }`}
                    >
                      <p className={`font-bold text-sm ${active ? `text-${g.color}-700` : "text-pro-text"}`}>
                        {g.label}
                      </p>
                      <p className="text-[11px] text-pro-text-soft mt-0.5 leading-tight">{g.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Titre */}
            <div>
              <label htmlFor="inc-titre" className="block text-xs font-bold uppercase tracking-wider text-pro-muted mb-2">
                Titre <span className="text-red-600">*</span>
              </label>
              <input
                id="inc-titre"
                type="text"
                value={titre}
                onChange={(e) => setTitre(e.target.value.slice(0, 120))}
                placeholder="Ex : Panne moteur sur autoroute"
                className="w-full px-4 py-3 border border-pro-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="inc-desc" className="block text-xs font-bold uppercase tracking-wider text-pro-muted mb-2">
                Description détaillée <span className="text-red-600">*</span>
              </label>
              <textarea
                id="inc-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 1500))}
                rows={6}
                placeholder="Décrivez le contexte, ce qui s'est passé, où vous êtes actuellement, et ce dont vous avez besoin…"
                className="w-full px-4 py-3 border border-pro-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none bg-white"
              />
              <p className="text-[11px] text-pro-muted mt-1">{description.length}/1500</p>
            </div>

            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
              <MapPin size={14} className="shrink-0 mt-0.5" />
              <p>Votre position GPS sera transmise à l'admin pour intervention rapide.</p>
            </div>
          </div>
        )}

        {/* Footer */}
        {!done && (
          <div className="border-t border-pro-border p-4 flex gap-2 bg-white">
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-3 rounded-xl border border-pro-border text-pro-text font-medium hover:bg-pro-bg-soft transition"
            >
              Annuler
            </button>
            <button
              onClick={submit}
              disabled={submitting || !titre.trim() || !description.trim()}
              className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 active:scale-[0.98] transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <AlertTriangle size={16} />}
              Envoyer à l'admin
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
