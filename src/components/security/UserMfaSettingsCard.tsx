import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { confirmMfaEnrollment, disableUserMfa, getUserMfaStatus, requestMfaEnrollment } from "@/lib/user-mfa.functions";

/** Carte des paramètres : activer ou désactiver la double authentification SMS. */
export function UserMfaSettingsCard({ defaultPhone = "" }: { defaultPhone?: string }) {
  const status = useServerFn(getUserMfaStatus);
  const enroll = useServerFn(requestMfaEnrollment);
  const confirm = useServerFn(confirmMfaEnrollment);
  const disable = useServerFn(disableUserMfa);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [masked, setMasked] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "phone" | "code">("idle");
  const [phone, setPhone] = useState(defaultPhone);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => { setPhone((p) => p || defaultPhone); }, [defaultPhone]);
  useEffect(() => {
    status().then((s) => { setEnabled(s.enabled); setMasked(s.maskedPhone); }).catch(() => { setLoadError(true); toast.error("Impossible de lire vos réglages de sécurité. Rechargez la page."); }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Action impossible"); }
    finally { setBusy(false); }
  };

  return (
    <section className="rounded-xl border border-pro-border bg-pro-surface p-5 space-y-4" data-tour="mfa-settings">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pro-accent/10 text-pro-accent">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <div className="flex-1">
          <h2 className="font-semibold text-pro-text">Double authentification par SMS</h2>
          <p className="text-sm text-pro-text-soft">
            Un code à 6 chiffres vous est demandé à chaque nouvelle connexion, en plus du mot de passe.
          </p>
        </div>
        {!loading && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${enabled ? "bg-emerald-500/15 text-emerald-600" : "bg-pro-border text-pro-text-soft"}`}>
            {enabled ? "Active" : "Désactivée"}
          </span>
        )}
      </div>

      {loadError ? <p role="alert" className="text-sm text-destructive">Réglages indisponibles. Rechargez la page pour réessayer.</p> : loading ? <Loader2 className="h-5 w-5 animate-spin text-pro-accent" /> : enabled ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-pro-text">Protection SMS active sur le <strong>{masked}</strong></p>
          <Button type="button" disabled={busy} className="rounded-lg border border-pro-border px-4 py-2 text-sm font-medium text-pro-text hover:border-pro-accent"
            onClick={() => run(async () => { await disable(); setEnabled(false); setStep("idle"); toast.success("Double authentification désactivée"); })}>
            Désactiver
          </Button>
        </div>
      ) : step === "idle" ? (
        <Button type="button" className="rounded-lg bg-pro-accent px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={() => setStep("phone")}>
          Activer la protection SMS
        </Button>
      ) : step === "phone" ? (
        <div className="flex flex-wrap gap-2">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Numéro de téléphone pour la protection SMS" placeholder="06 12 34 56 78"
            className="flex-1 min-w-[200px] rounded-lg border border-pro-border bg-transparent px-3 py-2 text-pro-text" />
          <Button type="button" disabled={busy || !phone} className="rounded-lg bg-pro-accent px-4 py-2 text-sm font-semibold text-primary-foreground"
            onClick={() => run(async () => { const r = await enroll({ data: { phone } }); setMasked(r.maskedPhone); setStep("code"); toast.success(`Code envoyé au ${r.maskedPhone}`); })}>
            Recevoir un code
          </Button>
          <Button type="button" className="px-3 py-2 text-sm text-pro-text-soft" onClick={() => setStep("idle")}>Annuler</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-pro-text-soft">Saisissez le code reçu au {masked} pour confirmer votre numéro.</p>
          <div className="flex flex-wrap gap-2">
            <input aria-label="Code SMS d’activation" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-40 rounded-lg border border-pro-border bg-transparent px-3 py-2 font-mono tracking-[0.3em] text-pro-text" />
            <Button type="button" disabled={busy || code.length !== 6} className="rounded-lg bg-pro-accent px-4 py-2 text-sm font-semibold text-primary-foreground"
              onClick={() => run(async () => { const r = await confirm({ data: { code } }); setEnabled(true); setMasked(r.maskedPhone); setCode(""); setStep("idle"); toast.success("Double authentification activée"); })}>
              Activer
            </Button>
            <Button type="button" className="px-3 py-2 text-sm text-pro-text-soft" onClick={() => setStep("phone")}>Changer de numéro</Button>
          </div>
        </div>
      )}
    </section>
  );
}
