/**
 * NotificationSettingsPanel — contrôle global des notifications de la plateforme.
 * Chaque notification peut être activée/désactivée par destinataire (Admin, Client,
 * Convoyeur) et pour le push web. Lecture/écriture réservées aux admins (RLS).
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, BellRing } from "lucide-react";
import { toast } from "sonner";

interface SettingRow {
  key: string;
  label: string;
  description: string | null;
  groupe: string;
  enabled_admin: boolean;
  enabled_client: boolean;
  enabled_convoyeur: boolean;
  enabled_push: boolean;
}

const GROUP_LABELS: Record<string, string> = {
  missions: "Missions",
  exploitation: "Exploitation",
  commercial: "Commercial",
  comptes: "Comptes",
  general: "Général",
};

const CHANNELS: { key: keyof SettingRow; label: string }[] = [
  { key: "enabled_admin", label: "Admin" },
  { key: "enabled_client", label: "Client" },
  { key: "enabled_convoyeur", label: "Convoyeur" },
  { key: "enabled_push", label: "Push" },
];

export function NotificationSettingsPanel() {
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("notification_settings" as never)
      .select("*")
      .order("groupe")
      .order("label");
    if (error) toast.error("Chargement impossible", { description: error.message });
    setRows((data as unknown as SettingRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchRows(); }, [fetchRows]);

  const toggle = async (row: SettingRow, channel: keyof SettingRow) => {
    const next = !(row[channel] as boolean);
    setBusy(`${row.key}-${String(channel)}`);
    setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, [channel]: next } : r)));
    const { error } = await supabase
      .from("notification_settings" as never)
      .update({ [channel]: next } as never)
      .eq("key" as never, row.key as never);
    setBusy(null);
    if (error) {
      toast.error("Mise à jour impossible", { description: error.message });
      setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, [channel]: !next } : r)));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-pro-gold" size={24} />
      </div>
    );
  }

  const groups = Array.from(new Set(rows.map((r) => r.groupe)));

  return (
    <div className="space-y-4">
      <div className="bg-white border border-pro-border rounded-xl p-4 flex items-start gap-3">
        <BellRing size={18} className="text-pro-gold mt-0.5 shrink-0" />
        <p className="text-xs text-pro-text-soft">
          Décochez une case pour ne plus envoyer cette notification au destinataire concerné.
          « Push » contrôle l'envoi des notifications web/mobile pour cet événement.
        </p>
      </div>

      {groups.map((g) => (
        <div key={g} className="bg-white border border-pro-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-pro-border">
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-pro-muted">
              {GROUP_LABELS[g] ?? g}
            </p>
          </div>
          <ul className="divide-y divide-pro-border">
            {rows.filter((r) => r.groupe === g).map((row) => (
              <li key={row.key} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-pro-text">{row.label}</p>
                  {row.description && (
                    <p className="text-xs text-pro-text-soft mt-0.5">{row.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {CHANNELS.map((c) => (
                    <label
                      key={String(c.key)}
                      className="flex items-center gap-1.5 text-xs text-pro-text-soft cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(row[c.key])}
                        disabled={busy === `${row.key}-${String(c.key)}`}
                        onChange={() => { void toggle(row, c.key); }}
                        className="accent-[#2F5FFF]"
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
