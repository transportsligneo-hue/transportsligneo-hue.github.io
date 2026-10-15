import { useEffect } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";

export const DEMO_ACCOUNT_EMAIL = "demo-flotte@transportsligneo.fr";

/** Bandeau du compte flotte fictif : les écritures sont refusées en base, on l'explique au prospect. */
export function DemoAccountBanner() {
  useEffect(() => {
    const orig = window.fetch;
    let last = 0;
    window.fetch = async (...args) => {
      const res = await orig(...args);
      const init = args[1] as RequestInit | undefined;
      const method = (init?.method ?? "GET").toUpperCase();
      if (method !== "GET" && (res.status === 401 || res.status === 403) && Date.now() - last > 3000) {
        last = Date.now();
        toast.info("Mode démonstration : cette action est désactivée. Contactez Transports Ligneo pour ouvrir votre vrai compte.");
      }
      return res;
    };
    return () => { window.fetch = orig; };
  }, []);
  return (
    <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-pro-accent/40 bg-pro-accent/10 px-3 py-2 text-sm">
      <Lock size={14} aria-hidden />
      <span>
        <strong>Espace flotte de démonstration</strong> — données fictives. Vous pouvez tout explorer ; les commandes et modifications sont désactivées.{" "}
        <a href="/contact" className="underline">Ouvrir mon vrai compte</a>
      </span>
    </div>
  );
}
