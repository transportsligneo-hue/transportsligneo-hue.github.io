import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, LogOut } from "lucide-react";
import { getUserMfaStatus, requestLoginMfaCode, verifyLoginMfaCode } from "@/lib/user-mfa.functions";
import { useAuth } from "@/hooks/useAuth";
import { LogoLoader } from "@/components/brand/LogoLoader";
import { LIGNEO_BRAND_LOGO } from "@/lib/brand-assets";

/** Verrou SMS optionnel des espaces client, pro, flotte et convoyeur. */
export function UserMfaGate({ children, label = "Votre espace" }: { children: ReactNode; label?: string }) {
  const status = useServerFn(getUserMfaStatus);
  const request = useServerFn(requestLoginMfaCode);
  const verify = useServerFn(verifyLoginMfaCode);
  const { logout } = useAuth();
  const [state, setState] = useState<"loading" | "locked" | "ok">("loading");
  const [masked, setMasked] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    setBusy(true); setError(null);
    try { const r = await request(); setMasked(r.maskedPhone); setSent(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Envoi impossible"); }
    finally { setBusy(false); }
  }, [request]);

  useEffect(() => {
    let alive = true;
    status().then((s) => {
      if (!alive) return;
      setMasked(s.maskedPhone);
      setState(s.verified ? "ok" : "locked");
      if (!s.verified) void send();
    }).catch(() => { if (alive) { setState("locked"); setError("Vérification de sécurité indisponible. Rechargez la page pour réessayer."); } });
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
    return <div className="amfa-screen"><div className="amfa-loading flex flex-col items-center gap-4"><LogoLoader label="Vérification de sécurité…" /></div></div>;
  }
  return (
    <div className="amfa-screen">
      <form onSubmit={submit} className="amfa-card">
        <img src={LIGNEO_BRAND_LOGO} alt="Transports Ligneo" className="amfa-logo" />
        <p className="amfa-eyebrow">{label}</p>
        <h1 className="amfa-title">Code de sécurité</h1>
        <p className="amfa-sub">
          {sent && masked ? <>Un code à 6 chiffres a été envoyé par SMS au <strong>{masked}</strong>.</> : "Un code va vous être envoyé par SMS."}
        </p>
        <div className="amfa-shield"><ShieldCheck className="h-5 w-5" aria-hidden /></div>
        <input aria-label="Code de sécurité SMS" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="amfa-input" autoFocus />
        {error && <p className="amfa-error">{error}</p>}
        <Button type="submit" className="amfa-btn" disabled={busy || code.length !== 6}>Valider</Button>
        <div className="amfa-links">
          <Button type="button" className="amfa-resend" onClick={send} disabled={busy}>Renvoyer le code</Button>
          <Button type="button" className="amfa-logout" onClick={() => logout()}><LogOut className="h-4 w-4" aria-hidden /> Déconnexion</Button>
        </div>
      </form>
    </div>
  );
}
