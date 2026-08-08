import { useState } from "react";
import { Mail, Loader2, Check } from "lucide-react";
import { subscribeNewsletter } from "@/lib/public-content.functions";

/** Formulaire d'inscription newsletter (footer). */
export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) || value.length > 255) {
      setState("error");
      return;
    }
    setState("loading");
    try {
      await subscribeNewsletter({ data: { email: value, source: "footer" } });
      setState("done");
      setEmail("");
    } catch {
      setState("error");
    }
  };

  return (
    <div>
      <p className="mb-3 text-[13.5px] text-[#9aa6c9]">
        Nos actualités convoyage, une fois par mois. Sans spam.
      </p>
      {state === "done" ? (
        <p className="flex items-center gap-2 text-[13.5px] font-semibold text-[#4f8cff]">
          <Check size={15} /> Inscription confirmée, merci !
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="newsletter-email" className="sr-only">
            Votre e-mail
          </label>
          <div className="relative flex-1">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4f8cff]" />
            <input
              id="newsletter-email"
              type="email"
              value={email}
              maxLength={255}
              onChange={(e) => {
                setEmail(e.target.value);
                if (state === "error") setState("idle");
              }}
              placeholder="votre@email.fr"
              className="w-full rounded-full border border-[#7aa3ff]/25 bg-white/[0.04] py-2.5 pl-9 pr-3 text-[13px] text-white placeholder:text-[#6f7ba0] focus:border-[#4f8cff] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={state === "loading"}
            className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[12.5px] font-bold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(120deg,#2f5fff,#2450e0 60%,#4f8cff)" }}
          >
            {state === "loading" && <Loader2 size={14} className="animate-spin" />}
            S'inscrire
          </button>
        </form>
      )}
      {state === "error" && (
        <p className="mt-2 text-[12px] text-[#ffb4b4]">
          Adresse invalide ou inscription impossible. Réessayez.
        </p>
      )}
    </div>
  );
}
