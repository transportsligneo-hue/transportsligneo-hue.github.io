/**
 * Panneau de test des notifications push (app driver Capacitor + web).
 * Permet à un admin de cibler un ou plusieurs convoyeurs, de voir les
 * appareils enregistrés et d'envoyer une notification de test.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Loader2, Smartphone, Globe, RefreshCw, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { listDriverPushDevices, sendTestPushToDrivers } from "@/lib/push/notify.functions";

type Driver = {
  userId: string;
  nom: string;
  email: string | null;
  statut: string | null;
  native: number;
  platforms: string[];
  web: number;
};

const PRESETS = [
  { label: "Nouvelle mission", title: "Nouvelle mission disponible 🚗", body: "Une mission vient d'être publiée dans le catalogue.", url: "/convoyeur/catalogue" },
  { label: "Mission attribuée", title: "Mission attribuée ✓", body: "Une mission vous a été attribuée. Consultez vos missions.", url: "/convoyeur/missions" },
  { label: "Rappel départ", title: "Départ imminent ⏱", body: "Votre mission démarre bientôt. Pensez à l'état des lieux.", url: "/convoyeur/missions" },
  { label: "Test simple", title: "Test notification Ligneo", body: "Ceci est une notification de test.", url: "/convoyeur" },
];

export function PushTestPanel() {
  const load = useServerFn(listDriverPushDevices);
  const send = useServerFn(sendTestPushToDrivers);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [fcmOk, setFcmOk] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState(PRESETS[0].title);
  const [body, setBody] = useState(PRESETS[0].body);
  const [url, setUrl] = useState(PRESETS[0].url);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res: any = await load({ data: {} });
      setDrivers(res.drivers ?? []);
      setFcmOk(!!res.fcmConfigured);
    } catch (e: any) {
      toast.error(e?.message || "Chargement impossible");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const doSend = async (all: boolean) => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    if (!all && selected.length === 0) { toast.error("Sélectionnez au moins un convoyeur"); return; }
    setSending(true);
    try {
      const res: any = await send({
        data: {
          all,
          userIds: all ? [] : selected,
          payload: { title: title.trim(), body: body.trim() || undefined, url: url.trim() || "/convoyeur" },
        },
      });
      const msg = `${res.totalSent} envoi(s) — ${res.nativeSent} app mobile · ${res.webSent} navigateur (${res.targets} convoyeur(s))`;
      setLastResult(msg);
      toast.success(msg);
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'envoi");
    } finally {
      setSending(false);
    }
  };

  const withDevices = drivers.filter((d) => d.native + d.web > 0);

  return (
    <div className="space-y-5">
      {!fcmOk && (
        <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Push natif (app Android/iOS) non configuré</p>
            <p className="mt-0.5">
              Les notifications navigateur fonctionnent. Pour l'app Ligneo Driver, ajoutez le compte de service
              Firebase (secret <code>FIREBASE_SERVICE_ACCOUNT</code>) : les envois natifs seront alors actifs sans autre changement.
            </p>
          </div>
        </div>
      )}

      {/* Message */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Titre</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Lien d'ouverture (interne)</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/convoyeur"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Message</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={500}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p.label} type="button"
            onClick={() => { setTitle(p.title); setBody(p.body); setUrl(p.url); }}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-[#2F5FFF] hover:text-[#2F5FFF]">
            {p.label}
          </button>
        ))}
      </div>

      {/* Convoyeurs */}
      <div className="rounded-xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <p className="text-sm font-semibold text-slate-800">
            Convoyeurs <span className="text-slate-400">({withDevices.length} avec appareil sur {drivers.length})</span>
          </p>
          <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#2F5FFF]">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
          {loading && <div className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>}
          {!loading && drivers.length === 0 && <p className="p-4 text-sm text-slate-500">Aucun convoyeur avec un compte utilisateur.</p>}
          {drivers.map((d) => (
            <label key={d.userId} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
              <input type="checkbox" checked={selected.includes(d.userId)} onChange={() => toggle(d.userId)}
                className="h-4 w-4 rounded border-slate-300 accent-[#2F5FFF]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">{d.nom}</span>
                {d.email && <span className="block truncate text-xs text-slate-500">{d.email}</span>}
              </span>
              <span className="flex items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${d.native ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                  <Smartphone className="h-3 w-3" />{d.native}{d.platforms.length ? ` ${d.platforms.join("/")}` : ""}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${d.web ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-400"}`}>
                  <Globe className="h-3 w-3" />{d.web}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={sending} onClick={() => void doSend(false)}
          className="inline-flex items-center gap-2 rounded-full bg-[#2F5FFF] px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#2551e0] disabled:opacity-60">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Envoyer à la sélection ({selected.length})
        </button>
        <button type="button" disabled={sending} onClick={() => void doSend(true)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-[#2F5FFF] hover:text-[#2F5FFF] disabled:opacity-60">
          <Bell className="h-4 w-4" /> Envoyer à tous les convoyeurs
        </button>
        {lastResult && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> {lastResult}
          </span>
        )}
      </div>
    </div>
  );
}

export default PushTestPanel;
