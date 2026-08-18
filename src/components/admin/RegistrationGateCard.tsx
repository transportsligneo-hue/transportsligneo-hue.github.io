import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Lock, Save, Unlock, UserPlus } from "lucide-react";
import { Card, Button, Badge } from "@/components/admin/AdminUI";
import { getRegistrationGate, type RegistrationGate } from "@/lib/public-content.functions";
import { setRegistrationGate } from "@/lib/registration-gate.functions";

const KINDS: { key: keyof RegistrationGate; label: string; desc: string }[] = [
  { key: "client", label: "Client particulier", desc: "Inscription depuis /inscription-client." },
  { key: "pro", label: "Professionnel", desc: "Garages, concessions, marchands (/inscription-pro)." },
  { key: "flotte", label: "Flotte / B2B", desc: "Grands comptes et loueurs (/inscription-flotte)." },
  {
    key: "convoyeur",
    label: "Convoyeur",
    desc: "Si fermé, la page « Devenir convoyeur » affiche la liste d'attente.",
  },
];

export function RegistrationGateCard() {
  const fetchGate = useServerFn(getRegistrationGate);
  const saveGate = useServerFn(setRegistrationGate);
  const [gate, setGate] = useState<RegistrationGate>({
    client: true,
    pro: true,
    flotte: true,
    convoyeur: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchGate()
      .then((g) => mounted && setGate(g))
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [fetchGate]);

  const toggle = (k: keyof RegistrationGate) => setGate((g) => ({ ...g, [k]: !g[k] }));

  const submit = async () => {
    setSaving(true);
    try {
      await saveGate({ data: gate });
      toast.success("Inscriptions mises à jour");
    } catch {
      toast.error("Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-pro-text flex items-center gap-2">
            <UserPlus size={16} className="text-pro-accent" /> Ouverture des inscriptions
          </h3>
          <p className="text-sm text-pro-text-soft mt-1">
            Activez ou fermez la création de compte par type de profil. Les invitations
            nominatives restent toujours valides.
          </p>
        </div>
        <Button onClick={submit} disabled={saving || loading} icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}>
          Enregistrer
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {KINDS.map((k) => {
          const open = gate[k.key];
          return (
            <button
              key={k.key}
              type="button"
              onClick={() => toggle(k.key)}
              disabled={loading}
              className={`text-left rounded-xl border p-4 transition ${
                open
                  ? "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50"
                  : "border-pro-border bg-pro-bg-soft hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-pro-text">{k.label}</span>
                <Badge variant={open ? "success" : "neutral"}>
                  {open ? (
                    <span className="inline-flex items-center gap-1">
                      <Unlock size={11} /> Ouvertes
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Lock size={11} /> Fermées
                    </span>
                  )}
                </Badge>
              </div>
              <p className="text-xs text-pro-text-soft mt-1.5">{k.desc}</p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
