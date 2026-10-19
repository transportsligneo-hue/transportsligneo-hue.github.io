import { useEffect } from "react";
import { useState } from "react";
import { Lock, ChevronDown, Smartphone, KeyRound, Search, FileText, ClipboardCheck } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const items = [
    { icon: Smartphone, t: "L'application Driver", d: "Nos convoyeurs reçoivent la mission sur leur téléphone, partent avec l'itinéraire, et vous suivez le trajet en direct sur la carte." },
    { icon: ClipboardCheck, t: "État des lieux photo", d: "À l'enlèvement et à la livraison, le convoyeur photographie le véhicule sous tous les angles. Le PV daté et signé est dans votre espace." },
    { icon: KeyRound, t: "Remise des clés par code", d: "Un code à 4 chiffres est envoyé par SMS (ou e-mail) à la personne qui remet ou reçoit le véhicule. Sans ce code, le convoyeur ne peut pas valider : la clé n'est remise qu'à la bonne personne." },
    { icon: Search, t: "Suivi par plaque + code", d: "Vos clients suivent leur véhicule sur la page « Suivre ma mission » avec la plaque et le code reçu, sans créer de compte." },
    { icon: FileText, t: "Devis, factures, documents", d: "Devis, factures et PV sont générés automatiquement. Ici ils portent la mention « fictif »." },
  ];
  return (
    <div className="mx-4 mt-3 rounded-lg border border-pro-accent/40 bg-pro-accent/10 px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <Lock size={14} aria-hidden />
        <span className="flex-1">
          <strong>Espace flotte de démonstration</strong> — données fictives. Vous pouvez tout explorer ; paiements, signatures et modifications sont désactivés.{" "}
          <a href="/contact" className="underline">Ouvrir mon vrai compte</a>
        </span>
        <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 underline" aria-expanded={open}>
          Comment ça marche <ChevronDown size={14} className={open ? "rotate-180" : ""} />
        </button>
      </div>
      {open && (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {items.map(({ icon: I, t, d }) => (
            <li key={t} className="flex gap-2">
              <I size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span><strong>{t}</strong><br />{d}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
