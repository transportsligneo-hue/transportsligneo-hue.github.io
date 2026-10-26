/**
 * Admin · Onglet « Mise à jour Driver » de la page Maintenance et mise à jour.
 * Publie une mise à jour OBLIGATOIRE de l'appli Ligneo Driver (table driver_app_updates,
 * fonction publish_driver_app_update — inchangées). Le bouton du convoyeur ouvre Google Play.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Pencil, Power, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DriverUpdateCard, DRIVER_PLAY_URL } from "@/components/convoyeur/DriverUpdateGate";
import driverLogo from "@/assets/driver-v2/logo.png";

// Table et fonction créées par la migration 20261026000300 (types Supabase pas encore régénérés).
const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a: object) => Promise<{ error: unknown }> };

interface Row { id: string; version: string; titre: string; message: string; store_url: string; active: boolean; created_at: string }

function PlayIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#00d3ff" d="M3.6 2.3 13.5 12l-9.9 9.7c-.3-.2-.5-.6-.5-1V3.3c0-.4.2-.8.5-1z" />
      <path fill="#00f076" d="m16.8 8.7-3.3 3.3-9.9-9.7c.3-.2.8-.3 1.2-.1z" />
      <path fill="#ff3a44" d="m16.8 15.3-11.9 6.6c-.4.2-.9.1-1.3-.2l9.9-9.7z" />
      <path fill="#ffd400" d="m20.6 13-3.8 2.3-3.3-3.3 3.3-3.3 3.8 2.3c.8.5.8 1.5 0 2z" />
    </svg>
  );
}

export default function DriverUpdatesPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editUrl, setEditUrl] = useState(false);
  const [f, setF] = useState({
    version: "",
    titre: "Nouvelle version disponible",
    message: "Une nouvelle version de l'application Ligneo Driver est disponible. Mettez-la à jour pour continuer.",
    store_url: DRIVER_PLAY_URL,
  });

  const load = useCallback(async () => {
    const { data, error } = await db.from("driver_app_updates").select("id, version, titre, message, store_url, active, created_at").order("created_at", { ascending: false }).limit(30);
    if (error) toast.error("Chargement impossible");
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const valid = /^[0-9]+(\.[0-9]+){0,2}$/.test(f.version.trim());
  const active = rows.find((r) => r.active);
  const url = f.store_url.trim() || DRIVER_PLAY_URL;

  async function publish() {
    setConfirming(false);
    setSaving(true);
    const { error } = await db.rpc("publish_driver_app_update", { p_version: f.version.trim(), p_titre: f.titre.trim(), p_message: f.message.trim(), p_store_url: url });
    setSaving(false);
    if (error) { toast.error("Publication impossible"); return; }
    toast.success("Mise à jour publiée aux convoyeurs");
    void load();
  }
  async function toggle(r: Row) {
    if (!r.active) await db.from("driver_app_updates").update({ active: false }).eq("active", true);
    const { error } = await db.from("driver_app_updates").update({ active: !r.active }).eq("id", r.id);
    if (error) toast.error("Mise à jour impossible"); else void load();
  }
  async function remove(r: Row) {
    if (!window.confirm(`Supprimer la mise à jour ${r.version} ?`)) return;
    const { error } = await db.from("driver_app_updates").delete().eq("id", r.id);
    if (error) toast.error("Suppression impossible"); else void load();
  }

  return (
    <div className="mtn-adm-panel mtn-upd">
      <div className="mtn-upd-cur">
        <img src={driverLogo} alt="" />
        <div><b>Ligneo Driver</b><small>{active ? "Version exigée en ce moment · obligatoire" : "Aucune mise à jour obligatoire en ce moment"}</small></div>
        <span>{active ? `v${active.version}` : "—"}</span>
      </div>

      <div className="mtn-upd-grid">
        <div className="mtn-upd-form">
          <div>
            <label className="mtn-adm-l" htmlFor="mj-v">Nouvelle version</label>
            <input id="mj-v" type="text" inputMode="decimal" placeholder="Ex : 2.4.0" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} />
            <p className="mtn-upd-hint">Le même numéro que la version publiée sur Google Play. Les téléphones avec une version plus ancienne sont bloqués jusqu'à la mise à jour.</p>
          </div>
          <div>
            <label className="mtn-adm-l" htmlFor="mj-t">Titre</label>
            <input id="mj-t" type="text" value={f.titre} onChange={(e) => setF({ ...f, titre: e.target.value })} />
          </div>
          <div>
            <label className="mtn-adm-l" htmlFor="mj-m">Message</label>
            <textarea id="mj-m" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
          </div>
          <div>
            <span className="mtn-adm-l">Lien de mise à jour</span>
            <div className="mtn-upd-play">
              <PlayIcon />
              <div><b>Google Play · Ligneo Driver</b><code>{url.replace(/^https?:\/\//, "")}</code></div>
              <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Tester le lien Google Play"><ExternalLink size={15} /> Tester</a>
              <button type="button" onClick={() => setEditUrl((v) => !v)} aria-label="Modifier le lien"><Pencil size={15} /></button>
            </div>
            {editUrl && (
              <input id="mj-u" type="text" value={f.store_url} onChange={(e) => setF({ ...f, store_url: e.target.value })} style={{ marginTop: 8 }} />
            )}
            <p className="mtn-upd-hint">Rempli tout seul avec le lien officiel. Le bouton du convoyeur ouvre directement cette page Google Play.</p>
          </div>
          <button type="button" className="mtn-adm-btn mtn-upd-send" disabled={saving || !valid} onClick={() => setConfirming(true)}>
            <Send size={17} /> {saving ? "Envoi…" : "Envoyer aux convoyeurs"}
          </button>
        </div>

        <div>
          <span className="mtn-adm-l">Ce que verra le convoyeur</span>
          <div className="mtn-upd-pv">
            <DriverUpdateCard preview native update={{ version: f.version.trim(), titre: f.titre, message: f.message, store_url: url }} />
          </div>
        </div>
      </div>

      <div>
        <span className="mtn-adm-l">Historique</span>
        {loading && <div className="mtn-upd-bar" aria-label="Chargement"><i /></div>}
        {!loading && rows.length === 0 && <p className="mtn-upd-hint">Aucune mise à jour publiée.</p>}
        <div className="mtn-upd-hist">
          {rows.map((r) => (
            <div key={r.id} className="mtn-upd-row">
              <span className="mtn-upd-v">v{r.version}</span>
              <div><b>{r.titre}</b><small>{new Date(r.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</small></div>
              <span className={`mtn-upd-st${r.active ? " on" : ""}`}>{r.active ? "Active" : "Désactivée"}</span>
              <button type="button" onClick={() => void toggle(r)} title={r.active ? "Désactiver" : "Réactiver"} aria-label={r.active ? "Désactiver" : "Réactiver"}><Power size={16} /></button>
              <button type="button" onClick={() => void remove(r)} title="Supprimer" aria-label="Supprimer" className="is-del"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </div>

      {confirming && (
        <div className="mtn-upd-scrim" onClick={(e) => { if (e.target === e.currentTarget) setConfirming(false); }}>
          <div className="mtn-upd-conf" role="alertdialog" aria-modal="true" aria-labelledby="mtn-upd-ct">
            <h3 id="mtn-upd-ct">Publier la version {f.version.trim()} ?</h3>
            <p>Tous les convoyeurs avec une version plus ancienne verront la fenêtre de mise à jour avec le bouton Google Play, et seront bloqués jusqu'à la mise à jour.</p>
            <button type="button" className="mtn-adm-btn" onClick={() => void publish()}>Publier la mise à jour</button>
            <button type="button" className="mtn-upd-cancel" onClick={() => setConfirming(false)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
