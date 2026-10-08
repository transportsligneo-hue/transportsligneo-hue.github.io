import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, LogOut } from "lucide-react";
import { getAdminMfaStatus, requestAdminMfaCode, verifyAdminMfaCode } from "@/lib/admin-mfa.functions";
import { useAuth } from "@/hooks/useAuth";
import { LogoLoader } from "@/components/brand/LogoLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Verrou de l'administration : code SMS demandé à chaque nouvelle connexion. */
export function AdminMfaGate({ children }: { children: ReactNode }) {
  const status = useServerFn(getAdminMfaStatus);
  const request = useServerFn(requestAdminMfaCode);
  const verify = useServerFn(verifyAdminMfaCode);
  const { logout } = useAuth();
  const [state, setState] = useState<"loading" | "locked" | "ok">("loading");
  const [masked, setMasked] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const r = await request();
      setMasked(r.maskedPhone); setSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Envoi impossible"); }
    finally { setBusy(false); }
  }, [request]);

  useEffect(() => {
    let alive = true;
    status().then((s) => {
      if (!alive) return;
      setMasked(s.maskedPhone);
      setState(s.verified ? "ok" : "locked");
      if (!s.verified && s.hasPhone) void send();
      if (!s.hasPhone) setError("Aucun numéro enregistré pour ce compte. Contactez le super admin.");
    }).catch((e) => { if (alive) { setState("locked"); setError(e instanceof Error ? e.message : "Vérification impossible"); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await verify({ data: { code } }); setState("ok"); }
    catch (err) { setError(err instanceof Error ? err.message : "Code incorrect"); }
    finally { setBusy(false); }
  };

  if (state === "ok") return <>{children}</>;
  if (state === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-pro-bg"><LogoLoader label="Vérification de sécurité…" /></div>;
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-pro-bg px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-pro-border bg-card p-6 shadow-lg space-y-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Code de sécurité</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {sent && masked ? `Un code à 6 chiffres a été envoyé par SMS au ${masked}.` : "Un code va vous être envoyé par SMS."}
        </p>
        <Input
          inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="text-center text-2xl tracking-[0.5em]" autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>Valider</Button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" className="text-primary underline disabled:opacity-50" onClick={send} disabled={busy}>Renvoyer le code</button>
          <button type="button" className="flex items-center gap-1 text-muted-foreground" onClick={() => logout()}>
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </div>
      </form>
    </div>
  );
}
