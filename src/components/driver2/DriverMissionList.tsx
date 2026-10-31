import "@/styles/driver-v2.css";
import { Ic, Plate } from "@/components/driver2/icons";
import { isElectricVehicle } from "@/lib/vehicule-electrique";
import { resolveMissionStatus, type MissionCardData } from "@/components/convoyeur/MissionCard";
import { displayNumero } from "@/lib/mission-number";
import { LgBadge } from "@/components/ui/LgBadge";
import { useLivraisonTimes, livraisonLabel } from "@/lib/livraison-times";

const STATUS: Record<string, { label: string; tone: string; color?: string }> = {
  propose: { label: "Proposée", tone: "amber", color: "#00AEEF" },
  accepte: { label: "Acceptée", tone: "blue", color: "#2F5FFF" },
  en_cours: { label: "En cours", tone: "green", color: "#8B5CF6" },
  en_attente_validation: { label: "En validation", tone: "amber", color: "#EC4899" },
  validee: { label: "Validée", tone: "green", color: "#0EA5A4" },
  refusee: { label: "Refusée", tone: "red", color: "#64748B" },
  termine: { label: "Terminée", tone: "muted", color: "#22C55E" },
  incident: { label: "Incident", tone: "red", color: "#EF4444" },
};

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function dayLabel(date: string | null) {
  if (!date) return { title: "Date à confirmer", rel: "" };
  const d = new Date(`${date}T12:00:00`);
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const t = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const rel = date === ymd(now) ? "Aujourd'hui" : date === ymd(tomorrow) ? "Demain" : "";
  return { title: t, rel };
}

const hhmm = (h: string | null | undefined) => (h ? h.slice(0, 5).replace(":", "h") : "—");

type Item = MissionCardData & { leg_type?: string | null };

export function DriverMissionList({
  missions,
  showTarif,
  activeId,
  onOpen,
}: {
  missions: Item[];
  showTarif: boolean;
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  const livTimes = useLivraisonTimes(missions.map((m) => (m as { trajet_id?: string | null }).trajet_id));
  const groups: { key: string; date: string | null; items: Item[] }[] = [];
  for (const m of missions) {
    const date = m.trajet?.date_trajet ?? null;
    const key = date ?? "none";
    const g = groups[groups.length - 1];
    if (g && g.key === key) g.items.push(m);
    else groups.push({ key, date, items: [m] });
  }

  return (
    <div className="drv2"><div className="dml">
      {groups.map((g) => {
        const { title, rel } = dayLabel(g.date);
        return (
          <section key={g.key} className="dml-day">
            <header className="dml-dayh">
              <span className="dml-dayt">{title}</span>
              {rel && <b className="dml-rel">{rel}</b>}
              <span className="dml-cnt">{g.items.length} mission{g.items.length > 1 ? "s" : ""}</span>
            </header>
            {g.items.map((m) => {
              const t = m.trajet;
              const st = resolveMissionStatus(m.statut, m.etape_courante);
              const meta = STATUS[st] ?? { label: st, tone: "muted" };
              const ev = isElectricVehicle({ marque: t?.marque, modele: t?.modele, energie: (t as { vehicule_energie?: string | null } | null)?.vehicule_energie });
              const num = m.numero_mission ? displayNumero(m.numero_mission) : `MIS-${m.id.slice(0, 8).toUpperCase()}`;
              const duo = m.leg_type === "aller" || m.leg_type === "retour";
              const veh = [t?.marque, t?.modele].filter(Boolean).join(" ");
              const steps = (m.inspectionDepart ? 1 : 0) + (m.inspectionArrivee ? 1 : 0);
              const live = st === "en_cours";
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onOpen(m.id)}
                  className={`dml-card dml-card--${meta.tone}${m.id === activeId ? " is-active" : ""}`}
                >
                  <div className="dml-top">
                    <span className="dml-time"><Ic n="clock" s={13} sw={2.3} />{hhmm(t?.heure_trajet)}</span>
                    <LgBadge color={meta.color ?? "#64748B"}>{meta.label}</LgBadge>
                    <span className="dml-num">{num}</span>
                  </div>

                  <div className="dml-route">
                    <span className="dml-rail"><i className="a" /><u /><i className="b" /></span>
                    <div className="dml-addrs">
                      <p><small>Départ{t?.heure_trajet && <em className="dml-hh">{hhmm(t.heure_trajet)}</em>}</small>{t?.depart ?? "—"}</p>
                      <p><small>Arrivée{(() => { const lv = livraisonLabel(livTimes[(m as { trajet_id?: string | null }).trajet_id ?? ""], t?.date_trajet); return lv ? <em className="dml-hh">{lv}</em> : null; })()}</small>{t?.arrivee ?? "—"}</p>
                    </div>
                  </div>

                  <div className="dml-foot">
                    <div className="dml-veh">
                      {t?.immatriculation && <Plate p={t.immatriculation} />}
                      {veh && <span className="dml-vname">{ev && <Ic n="bolt" s={12} sw={2.6} />}{veh}</span>}
                    </div>
                    <div className="dml-tags">
                      <span className="dml-tag">{duo ? "Restitution et livraison" : "Livraison simple"}</span>
                      {live && steps > 0 && <span className="dml-tag dml-tag--ok">{steps}/2 EDL</span>}
                    </div>
                    <div className="dml-end">
                      {showTarif && t?.tarif_convoyeur != null && (
                        <b className="dml-price">{Math.round(Number(t.tarif_convoyeur))}&nbsp;€</b>
                      )}
                      <span className="dml-go"><Ic n="chev" s={16} sw={2.4} /></span>
                    </div>
                  </div>
                </button>
              );
            })}
          </section>
        );
      })}
    </div></div>
  );
}
