import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquareText, RefreshCw } from "lucide-react";
import { smsCreditsGet, type SmsCredits } from "@/lib/sms-credits.functions";

/** Compteur de SMS restants (forfait Brevo). Passe en orange sous 100, rouge sous 30. */
export function SmsCreditsCard() {
  const get = useServerFn(smsCreditsGet);
  const [r, setR] = useState<SmsCredits | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => { setBusy(true); get().then(setR).catch(() => setR({ ok: false, error: "Indisponible" })).finally(() => setBusy(false)); };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const n = r && r.ok ? r.credits : null;
  const tone = n == null ? "text-pro-text-soft" : n < 30 ? "text-red-600" : n < 100 ? "text-amber-600" : "text-emerald-600";
  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-pro-border bg-white px-4 py-2.5 shadow-sm">
      <div className="h-9 w-9 rounded-lg bg-[#eaf0ff] text-[#2f5fff] grid place-items-center"><MessageSquareText size={18} /></div>
      <div className="leading-tight">
        <div className="text-[11px] uppercase tracking-wider text-pro-text-soft">SMS restants (forfait)</div>
        <div className={"text-xl font-semibold " + tone}>
          {!r ? "…" : r.ok ? (n == null ? "Aucun forfait SMS" : n.toLocaleString("fr-FR")) : <span className="text-sm font-medium text-pro-text-soft">{r.error}</span>}
        </div>
        {n != null && n < 100 && <div className="text-[11px] text-pro-text-soft">Pensez à recharger sur Brevo.</div>}
      </div>
      <button onClick={load} disabled={busy} title="Actualiser" className="p-1.5 rounded-lg text-pro-text-soft hover:bg-pro-bg-soft"><RefreshCw size={14} className={busy ? "animate-spin" : ""} /></button>
    </div>
  );
}
