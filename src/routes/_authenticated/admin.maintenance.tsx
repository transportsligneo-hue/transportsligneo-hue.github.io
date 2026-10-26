/**
 * Admin · Maintenance et mise à jour (Réglages & outils), deux onglets :
 * - Maintenance : bandeau ou page de maintenance pour le site et/ou l'appli Ligneo Driver.
 * - Mise à jour Driver : mise à jour obligatoire de l'appli Ligneo Driver, bouton Google Play.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import { MaintenanceBanner, MaintenanceScreen } from "@/components/maintenance/MaintenanceViews";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_MAINTENANCE, MAINTENANCE_KEY, normalizeMaintenance, type MaintenanceSettings } from "@/lib/maintenance";
import "@/components/maintenance/maintenance-admin.css";
import DriverUpdatesPanel from "@/components/admin/DriverUpdatesPanel";
import driverLogo from "@/assets/driver-v2/logo.png";

export const Route = createFileRoute("/_authenticated/admin/maintenance")({
  validateSearch: (s: Record<string, unknown>): { onglet?: "driver" } => (s.onglet === "driver" ? { onglet: "driver" } : {}),
  component: AdminMaintenance,
});

const REASONS = [
  "Mise à jour de la plateforme",
  "Amélioration des performances",
  "Maintenance de nos serveurs",
  "Nouvelle fonctionnalité en cours d'installation",
];

/** datetime-local ⇄ ISO */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function AdminMaintenance() {
  const [s, setS] = useState<MaintenanceSettings>(DEFAULT_MAINTENANCE);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"site" | "driver">("site");
  const { onglet } = Route.useSearch();
  const [section, setSection] = useState<"maintenance" | "driver">(onglet === "driver" ? "driver" : "maintenance");
  useEffect(() => { if (onglet === "driver") setSection("driver"); }, [onglet]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", MAINTENANCE_KEY).maybeSingle();
      setS(normalizeMaintenance(data?.value));
      setLoaded(true);
    })();
  }, []);

  const set = <K extends keyof MaintenanceSettings>(k: K, v: MaintenanceSettings[K]) => setS((o) => ({ ...o, [k]: v }));

  const save = async (next: MaintenanceSettings, okMsg: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("app_settings").upsert({ key: MAINTENANCE_KEY, value: next as never }, { onConflict: "key" });
      if (error) throw error;
      setS(next);
      window.dispatchEvent(new Event("ligneo:maintenance-changed"));
      toast.success(okMsg);
    } catch (e) {
      toast.error("Enregistrement impossible", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = () => {
    if (!s.enabled && !s.site && !s.driver) { toast.error("Choisis au moins une cible : le site ou l'application Driver."); return; }
    void save({ ...s, enabled: !s.enabled }, s.enabled ? "Maintenance désactivée" : "Maintenance activée");
  };

  return (
    <div className="mtn-adm">
      <AdminSectionHeader
        breadcrumb="Réglages & outils"
        eyebrow="Maintenance et mise à jour"
        title="Maintenance et"
        highlight="mise à jour"
        subtitle="Mettez le site en maintenance, ou obligez les convoyeurs à mettre à jour l'appli Ligneo Driver."
      />
      <div className="mtn-adm-seg" role="tablist" aria-label="Maintenance ou mise à jour">
        <button type="button" role="tab" aria-selected={section === "maintenance"} className={section === "maintenance" ? "on" : ""} onClick={() => setSection("maintenance")}>Maintenance</button>
        <button type="button" role="tab" aria-selected={section === "driver"} className={`g${section === "driver" ? " on" : ""}`} onClick={() => setSection("driver")}><img src={driverLogo} alt="" />Mise à jour Driver</button>
      </div>
      {section === "driver" ? <DriverUpdatesPanel /> : (
      <div className="mtn-adm-panel">
        <div className="mtn-adm-hd">
          <div>
            <b>Maintenance</b>
            <small>{s.enabled ? "Active : les visiteurs la voient maintenant." : "Désactivée : tout fonctionne normalement."}</small>
          </div>
          <span className={`mtn-adm-st${s.enabled ? " on" : ""}`}><i />{s.enabled ? "Activée" : "Désactivée"}</span>
          <button type="button" className={`mtn-adm-sw${s.enabled ? " on" : ""}`} onClick={toggle} disabled={!loaded || saving} aria-label={s.enabled ? "Désactiver la maintenance" : "Activer la maintenance"} aria-pressed={s.enabled} />
        </div>

        <div>
          <label className="mtn-adm-l">Où l'afficher ?</label>
          <div className="mtn-adm-two">
            <label className={`mtn-adm-opt${s.site ? " on" : ""}`}>
              <input type="checkbox" checked={s.site} onChange={(e) => set("site", e.target.checked)} />
              <span><b>Site Transports Ligneo</b><em>Clients, pros, visiteurs · bleu</em></span>
            </label>
            <label className={`mtn-adm-opt green${s.driver ? " on" : ""}`}>
              <input type="checkbox" checked={s.driver} onChange={(e) => set("driver", e.target.checked)} />
              <span><b>Application Ligneo Driver</b><em>Convoyeurs · vert</em></span>
            </label>
          </div>
        </div>

        <div>
          <label className="mtn-adm-l">Type d'affichage</label>
          <div className="mtn-adm-two">
            <button type="button" className={`mtn-adm-opt${s.mode === "banner" ? " on" : ""}`} onClick={() => set("mode", "banner")}>
              <span><b>Bandeau d'information</b><em>Le site reste utilisable, un bandeau s'affiche en haut.</em></span>
            </button>
            <button type="button" className={`mtn-adm-opt${s.mode === "full" ? " on" : ""}`} onClick={() => set("mode", "full")}>
              <span><b>Site en maintenance</b><em>Les visiteurs voient une page dédiée. L'admin garde l'accès.</em></span>
            </button>
          </div>
        </div>

        <div>
          <label className="mtn-adm-l" htmlFor="mtn-why">Raison affichée</label>
          <div className="mtn-adm-chips">
            {REASONS.map((r) => <button type="button" key={r} onClick={() => set("reason", `${r}.`)}>{r}</button>)}
          </div>
          <textarea id="mtn-why" value={s.reason} onChange={(e) => set("reason", e.target.value)} placeholder="Ex. Mise à jour de la plateforme pour améliorer votre expérience." />
        </div>

        <div className="mtn-adm-row">
          <div>
            <label className="mtn-adm-l" htmlFor="mtn-ret">Retour prévu</label>
            <input id="mtn-ret" type="datetime-local" value={toLocalInput(s.return_at)} onChange={(e) => set("return_at", e.target.value ? new Date(e.target.value).toISOString() : null)} />
          </div>
          <div>
            <label className="mtn-adm-l" htmlFor="mtn-ttl">Titre</label>
            <input id="mtn-ttl" type="text" value={s.title} onChange={(e) => set("title", e.target.value)} maxLength={60} />
          </div>
        </div>

        <label className="mtn-adm-chk"><input type="checkbox" checked={s.admin_bypass} onChange={(e) => set("admin_bypass", e.target.checked)} /> Garder l'accès aux comptes administrateurs</label>
        <label className="mtn-adm-chk"><input type="checkbox" checked={s.keep_tracking} onChange={(e) => set("keep_tracking", e.target.checked)} /> Laisser le suivi de mission accessible aux clients</label>

        <div>
          <div className="mtn-adm-tabs">
            <label className="mtn-adm-l">Aperçu en direct</label>
            <div>
              <button type="button" className={tab === "site" ? "on" : ""} onClick={() => setTab("site")}>Site</button>
              <button type="button" className={tab === "driver" ? "on green" : "green"} onClick={() => setTab("driver")}>Driver</button>
            </div>
          </div>
          <div className="mtn-adm-pv">
            <MaintenanceBanner s={s} variant={tab} preview />
            {s.mode === "full" && <MaintenanceScreen s={s} variant={tab} preview />}
          </div>
        </div>

        <div className="mtn-adm-act">
          <button type="button" className="mtn-adm-btn" disabled={!loaded || saving} onClick={() => void save(s, "Réglages de maintenance enregistrés")}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
