import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  X, MapPin, CalendarDays, Car, User2, Phone, Mail, Banknote, Gavel,
  Send, CheckCircle2, XCircle, Radar, ArrowRightCircle, Ban, Loader2, UserPlus, ExternalLink,
} from "lucide-react";

import { PricingModeBlock } from "@/components/admin/PricingModeBlock";
import { PublishToCatalogueButton } from "@/components/admin/PublishToCatalogueButton";
import { InspectionPreuvesBlock } from "@/components/admin/drawers/InspectionPreuvesBlock";
import { RadarEmptyV6 } from "@/components/admin/dashboard/RadarEmptyV6";
import { convertDemandeToMissions } from "@/lib/admin-demande-conversion.functions";
import { confirmToast } from "@/lib/confirm-toast";
import { sendTransactionalEmail } from "@/lib/email/send";
import type { UnifiedMission } from "./mission-unified-types";
import { notifyDriver } from "@/lib/push/driver-notify";
import { UNIFIED_STATUS } from "./mission-unified-types";

interface Offre {
  id: string;
  convoyeur_id: string;
  prix_propose: number;
  type_offre: string;
  statut: string;
  message: string | null;
  admin_counter_offer?: number | null;
  convoyeur?: { prenom: string; nom: string; telephone: string; email: string } | null;
}

const TABS = ["general", "tarification", "diffusion", "suivi"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  general: "Général",
  tarification: "Tarification",
  diffusion: "Diffusion & offres",
  suivi: "Suivi & EDL",
};

function Line({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[var(--a6-border-soft)] last:border-0">
      <span className="w-8 h-8 rounded-lg bg-[var(--a6-blue-soft)] text-[var(--a6-blue-deep)] flex items-center justify-center shrink-0">
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide font-bold text-[var(--a6-dim)]">{label}</p>
        <p className="text-[13px] text-[var(--a6-text)] font-medium break-words">{value}</p>
      </div>
    </div>
  );
}

export function MissionUnifiedPanel({
  mission,
  onClose,
  onChanged,
}: {
  mission: UnifiedMission;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("general");
  const [offres, setOffres] = useState<Offre[]>([]);
  const [attributionId, setAttributionId] = useState<string | null>(null);
  const [prixSuggere, setPrixSuggere] = useState(mission.prixSuggere?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const convertDemande = useServerFn(convertDemandeToMissions);

  const isTrajet = mission.kind === "trajet";
  const meta = UNIFIED_STATUS[mission.status];

  const loadOffres = useCallback(async () => {
    if (!isTrajet) return;
    const { data } = await supabase
      .from("mission_offres" as never)
      .select("*")
      .eq("trajet_id" as never, mission.id as never)
      .order("prix_propose" as never, { ascending: true } as never);
    const list = (data ?? []) as unknown as Offre[];
    const ids = Array.from(new Set(list.map((o) => o.convoyeur_id)));
    if (ids.length === 0) { setOffres(list); return; }
    const { data: convs } = await supabase.from("convoyeurs").select("id, prenom, nom, telephone, email").in("id", ids);
    const map: Record<string, Offre["convoyeur"]> = {};
    (convs ?? []).forEach((c) => { map[c.id] = { prenom: c.prenom, nom: c.nom, telephone: c.telephone, email: c.email }; });
    setOffres(list.map((o) => ({ ...o, convoyeur: map[o.convoyeur_id] ?? null })));
  }, [isTrajet, mission.id]);

  useEffect(() => {
    setTab("general");
    setPrixSuggere(mission.prixSuggere?.toString() ?? "");
    loadOffres();
    if (!isTrajet) { setAttributionId(null); return; }
    supabase
      .from("attributions")
      .select("id, created_at")
      .eq("trajet_id", mission.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => setAttributionId(data?.[0]?.id ?? null));
  }, [mission.id, isTrajet, mission.prixSuggere, loadOffres]);

  /* ---------- actions ---------- */
  const convert = async () => {
    setBusy(true);
    try {
      await convertDemande({ data: { demandeId: mission.id } });
      toast.success("Demande convertie en mission");
      onChanged();
      onClose();
    } catch {
      toast.error("Impossible de convertir la demande");
    } finally {
      setBusy(false);
    }
  };

  const setStatut = async (statut: string) => {
    const updates: Record<string, unknown> = { statut };
    if (statut === "annule") updates.statut_publication = "brouillon";
    else if (statut === "en_attente") updates.statut_publication = "publie";
    else updates.statut_publication = "attribue";
    const { error } = await supabase.from("trajets").update(updates as never).eq("id", mission.id);
    if (error) { toast.error("Échec mise à jour", { description: error.message }); return; }
    if (statut === "annule") {
      await supabase
        .from("attributions")
        .update({ statut: "annule", etape_courante: null } as never)
        .eq("trajet_id", mission.id)
        .not("statut", "in", "(annule,validee,termine,refusee)");
    }
    if (statut === "termine") {
      try {
        const { data: t } = await supabase
          .from("trajets")
          .select("client_email, client_nom, numero_mission")
          .eq("id", mission.id)
          .maybeSingle();
        if (t?.client_email) {
          await sendTransactionalEmail({
            templateName: "mission-terminee-client",
            recipientEmail: t.client_email,
            idempotencyKey: `mission-terminee-${mission.id}`,
            templateData: { prenom: t.client_nom, numero: t.numero_mission },
          });
        }
      } catch {
        /* email non bloquant */
      }
    }
    toast.success("Statut mis à jour");
    onChanged();
  };

  const cancel = async () => {
    if (!(await confirmToast(`Annuler la mission ${mission.depart} → ${mission.arrivee} ?`))) return;
    await setStatut("annule");
    onClose();
  };

  const diffuser = async () => {
    setBusy(true);
    const updates: Record<string, unknown> = { statut_publication: "publie" };
    if (prixSuggere) updates.prix_suggere = parseFloat(prixSuggere);
    await supabase.from("trajets").update(updates as never).eq("id", mission.id);
    setBusy(false);
    toast.success("Mission diffusée");
    onChanged();
  };

  const validerOffre = async (o: Offre) => {
    if (!(await confirmToast(`Valider ${o.convoyeur?.prenom ?? ""} ${o.convoyeur?.nom ?? ""} à ${o.prix_propose} € ?`))) return;
    const { error } = await supabase.rpc("admin_award_offer", { _offre_id: o.id });
    if (error) { toast.error(error.message); return; }
    notifyDriver({ convoyeurId: o.convoyeur_id ?? undefined, trajetId: mission.id, event: "mission_validee" });
    toast.success("Mission attribuée");
    loadOffres();
    onChanged();
  };

  const refuserOffre = async (o: Offre) => {
    await supabase.from("mission_offres" as never).update({ statut: "refusee" } as never).eq("id" as never, o.id as never);
    loadOffres();
  };

  /* ---------- render ---------- */
  return (
    <>
      <div className="a6-overlay" onClick={onClose} />
      <aside className="a6-panel adm6" role="dialog" aria-label="Détail mission">
        <header className="a6-panel-head">
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="a6-mono text-[10.5px] text-[var(--a6-blue-deep)] font-semibold">{mission.ref}</p>
              <h2 className="font-[Poppins] text-[19px] font-extrabold leading-tight mt-1 text-[var(--a6-text)] break-words">
                {mission.depart} → {mission.arrivee}
              </h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`a6-badge ${meta.cls}`}>{meta.label}</span>
                {mission.isRoundTrip && <span className="a6-badge attribuee">Livraison + Restitution</span>}
                {mission.isTest && <span className="a6-badge annulee">Test</span>}
              </div>
            </div>
            <button onClick={onClose} className="shrink-0 w-9 h-9 rounded-lg bg-white/70 hover:bg-white flex items-center justify-center text-[var(--a6-muted)]">
              <X size={17} />
            </button>
          </div>

          {isTrajet && (
            <div className="flex flex-wrap gap-2 mt-3">
              <Link
                to="/admin/attributions"
                search={{ trajet: mission.id }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold text-white bg-[var(--a6-blue,#2F5FFF)]"
              >
                <UserPlus size={13} /> Attribution
              </Link>
              {attributionId && (
                <Link
                  to="/admin/missions/$missionId"
                  params={{ missionId: attributionId }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold border border-[var(--a6-border)] bg-white text-[var(--a6-text)]"
                >
                  <ExternalLink size={13} /> Fiche mission complète
                </Link>
              )}
            </div>
          )}
        </header>

        <nav className="px-6 border-b border-[var(--a6-border)] flex overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} className={`a6-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </nav>

        <div className="p-6 pb-24">
          {tab === "general" && (
            <div className="a6-view space-y-4">
              <div className="a6-card p-4">
                <Line icon={MapPin} label="Prise en charge" value={mission.depart} />
                <Line icon={MapPin} label="Livraison" value={mission.arrivee} />
                <Line
                  icon={CalendarDays}
                  label="Date souhaitée"
                  value={mission.date ? `${new Date(mission.date).toLocaleDateString("fr-FR")}${mission.heure ? ` · ${mission.heure}` : ""}` : "—"}
                />
                <Line icon={Car} label="Véhicule" value={[mission.marque, mission.modele, mission.immatriculation].filter(Boolean).join(" · ") || "—"} />
              </div>

              <div className="a6-card p-4">
                <Line icon={User2} label="Client" value={mission.clientNom || "—"} />
                <Line icon={Mail} label="Email" value={mission.clientEmail} />
                <Line icon={Phone} label="Téléphone" value={mission.clientTel} />
              </div>

              <div className="flex flex-wrap gap-2">
                {!isTrajet && (
                  <button onClick={convert} disabled={busy} className="a6-btn-primary a6-shine px-4 py-2.5 rounded-xl text-[12.5px] font-bold inline-flex items-center gap-2 disabled:opacity-60">
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRightCircle size={15} />} Convertir en mission
                  </button>
                )}
                {isTrajet && mission.status !== "annulee" && mission.status !== "terminee" && (
                  <>
                    <button onClick={() => setStatut("en_cours")} className="a6-btn-primary px-4 py-2.5 rounded-xl text-[12.5px] font-bold inline-flex items-center gap-2">
                      <Radar size={15} /> Passer en cours
                    </button>
                    <button onClick={() => setStatut("termine")} className="a6-btn-ok px-4 py-2.5 rounded-xl text-[12.5px] font-bold inline-flex items-center gap-2">
                      <CheckCircle2 size={15} /> Marquer terminée
                    </button>
                    <button onClick={cancel} className="px-4 py-2.5 rounded-xl text-[12.5px] font-bold inline-flex items-center gap-2 border border-[var(--a6-border)] text-[var(--a6-red)] bg-white">
                      <Ban size={15} /> Annuler
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {tab === "tarification" && (
            <div className="a6-view space-y-4">
              {!isTrajet ? (
                <p className="text-[12.5px] text-[var(--a6-muted)]">La tarification devient éditable une fois la demande convertie en mission.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="a6-card p-3 text-center">
                      <p className="text-[10px] uppercase font-bold text-[var(--a6-dim)]">Client</p>
                      <p className="a6-num text-[17px] font-bold mt-1">{mission.prix != null ? `${mission.prix} €` : "—"}</p>
                    </div>
                    <div className="a6-card p-3 text-center">
                      <p className="text-[10px] uppercase font-bold text-[var(--a6-dim)]">Convoyeur</p>
                      <p className="a6-num text-[17px] font-bold mt-1 text-[var(--a6-ok)]">{mission.prixConvoyeur != null ? `${mission.prixConvoyeur} €` : "—"}</p>
                    </div>
                    <div className="a6-card p-3 text-center">
                      <p className="text-[10px] uppercase font-bold text-[var(--a6-dim)]">Marge</p>
                      <p className="a6-num text-[17px] font-bold mt-1 text-[var(--a6-gold)]">
                        {mission.prix != null && mission.prixConvoyeur != null
                          ? `${Math.round(((mission.prix - mission.prixConvoyeur) / mission.prix) * 100)} %`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <PricingModeBlock
                    trajetId={mission.id}
                    initial={{
                      pricing_mode: mission.pricingMode ?? "fixe",
                      prix_client_ttc: mission.prixClientTtc,
                      prix_convoyeur_fixe: mission.prixConvoyeurFixe,
                      prix_convoyeur_min: mission.prixConvoyeurMin,
                      prix_convoyeur_max: mission.prixConvoyeurMax,
                      marge_indicative_pct: mission.margeIndicativePct,
                    }}
                    onSaved={() => onChanged()}
                  />
                </>
              )}
            </div>
          )}

          {tab === "diffusion" && (
            <div className="a6-view space-y-4">
              {!isTrajet ? (
                <p className="text-[12.5px] text-[var(--a6-muted)]">Convertissez la demande pour la diffuser aux convoyeurs.</p>
              ) : (
                <>
                  <div className="a6-card p-4 space-y-3">
                    <p className="font-bold text-[13px] inline-flex items-center gap-2">
                      <Gavel size={15} className="text-[var(--a6-blue)]" /> Diffusion
                    </p>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--a6-muted)] mb-1.5">Prix suggéré aux convoyeurs (€)</label>
                      <input
                        type="number"
                        value={prixSuggere}
                        onChange={(e) => setPrixSuggere(e.target.value)}
                        placeholder="ex: 250"
                        className="w-full px-3 py-2 rounded-lg border border-[var(--a6-border)] text-[13px] outline-none focus:border-[var(--a6-blue)]"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <PublishToCatalogueButton trajetId={mission.id} onDone={onChanged} variant="button" label="Publier au catalogue public" />
                      <button
                        onClick={diffuser}
                        disabled={busy || !prixSuggere}
                        className="px-3 py-2 rounded-lg border border-[var(--a6-border)] bg-white text-[12.5px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Send size={14} /> Diffusion restreinte
                      </button>
                    </div>
                  </div>

                  <p className="text-[11.5px] text-[var(--a6-muted)] font-semibold">
                    {offres.length} offre{offres.length > 1 ? "s" : ""} reçue{offres.length > 1 ? "s" : ""}
                  </p>
                  {offres.length === 0 ? (
                    <div className="a6-card p-4">
                      <RadarEmptyV6 title="Aucune offre pour le moment" subtitle="Les candidatures des convoyeurs apparaîtront ici." />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {offres.map((o) => (
                        <div key={o.id} className="a6-card p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-bold text-[13px]">{o.convoyeur?.prenom} {o.convoyeur?.nom}</p>
                              <p className="text-[11px] text-[var(--a6-dim)]">{o.convoyeur?.telephone} · {o.convoyeur?.email}</p>
                              <p className="text-[11px] mt-1 text-[var(--a6-muted)]">
                                {o.type_offre === "acceptation_directe" ? "Accepte le prix suggéré" : "Contre-proposition"}
                              </p>
                              {o.message && <p className="text-[11.5px] italic text-[var(--a6-muted)] mt-1">"{o.message}"</p>}
                            </div>
                            <p className="a6-num font-bold text-[17px] text-[var(--a6-ok)] shrink-0">{o.prix_propose} €</p>
                          </div>
                          {o.statut === "en_attente" && (
                            <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--a6-border-soft)]">
                              <button onClick={() => validerOffre(o)} className="a6-btn-ok flex-1 px-3 py-2 rounded-lg text-[12px] font-bold inline-flex items-center justify-center gap-1.5">
                                <CheckCircle2 size={13} /> Valider
                              </button>
                              <button onClick={() => refuserOffre(o)} className="px-3 py-2 rounded-lg text-[12px] font-semibold border border-[var(--a6-border)] inline-flex items-center gap-1.5">
                                <XCircle size={13} /> Refuser
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "suivi" && (
            <div className="a6-view space-y-4">
              {!attributionId ? (
                <div className="a6-card p-4">
                  <RadarEmptyV6 title="Aucun convoyeur attribué" subtitle="Le suivi GPS et l'état des lieux apparaîtront après attribution." />
                  <Link
                    to="/admin/attributions"
                    search={{ trajet: mission.id }}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[12.5px] font-bold text-white bg-[var(--a6-blue,#2F5FFF)]"
                  >
                    <UserPlus size={14} /> Attribuer cette mission
                  </Link>
                </div>

              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/admin/missions/$missionId"
                      params={{ missionId: attributionId }}
                      className="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[12.5px] font-bold text-white bg-[var(--a6-blue,#2F5FFF)]"
                    >
                      <ExternalLink size={14} /> Ouvrir la fiche mission complète
                    </Link>
                    <Link
                      to="/admin/attributions"
                      search={{ trajet: mission.id }}
                      className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[12.5px] font-bold border border-[var(--a6-border)] bg-white"
                    >
                      <UserPlus size={14} /> Gérer l'attribution
                    </Link>
                  </div>
                  <div className="rounded-2xl bg-[#0b1026] p-4">
                    <InspectionPreuvesBlock attributionId={attributionId} />
                  </div>
                </>
              )}
              <div className="a6-card p-4">
                <p className="font-bold text-[13px] inline-flex items-center gap-2 mb-2">
                  <Banknote size={15} className="text-[var(--a6-gold)]" /> Rémunération convoyeur
                </p>
                <p className="a6-num text-[20px] font-bold">{mission.prixConvoyeur != null ? `${mission.prixConvoyeur} €` : "—"}</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
