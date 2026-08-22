import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, MessageSquare, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getUserMessages, sendAdminDirectMessage } from "@/lib/admin-communication.functions";

export type MessageTarget = {
  userId?: string | null;
  email?: string | null;
  prenom?: string | null;
  label?: string;
  role?: "convoyeur" | "client" | null;
};

/** Compteur de messages envoyés à cet utilisateur (badge onglet). */
export function useUserMessagesCount(userId?: string | null) {
  const fetchMessages = useServerFn(getUserMessages);
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) { setCount(0); return; }
    try {
      const res = await fetchMessages({ data: { userId } });
      setCount(res.total ?? 0);
    } catch {
      setCount(0);
    }
  }, [userId, fetchMessages]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { count, refresh };
}

export function UserMessagesPanel({
  target,
  onSent,
}: {
  target: MessageTarget;
  onSent?: () => void;
}) {
  const fetchMessages = useServerFn(getUserMessages);
  const sendMessage = useServerFn(sendAdminDirectMessage);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState("Message Transports Ligneo");
  const [body, setBody] = useState("");
  const [byEmail, setByEmail] = useState(true);
  const [byApp, setByApp] = useState(true);

  const load = useCallback(async () => {
    if (!target.userId) { setItems([]); return; }
    setLoading(true);
    try {
      const res = await fetchMessages({ data: { userId: target.userId } });
      setItems(res.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [target.userId, fetchMessages]);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (!body.trim()) { toast.error("Écrivez un message."); return; }
    if (!byEmail && !byApp) { toast.error("Choisissez au moins un canal."); return; }
    if (byApp && !target.userId) { toast.error("Cet utilisateur n'a pas de compte lié."); return; }
    if (byEmail && !target.email) { toast.error("Aucune adresse email connue."); return; }
    setSending(true);
    try {
      const res = await sendMessage({
        data: {
          userId: target.userId ?? null,
          email: target.email ?? null,
          prenom: target.prenom ?? null,
          title: title.trim() || "Message Transports Ligneo",
          body: body.trim(),
          channels: { email: byEmail, app: byApp },
          role: target.role ?? null,
        },
      });
      const parts: string[] = [];
      if (res.app) parts.push(`compte${res.push ? ` + ${res.push} push` : ""}`);
      if (res.email) parts.push("email");
      if (byEmail && !res.email) toast.warning(`Email non envoyé (${res.emailReason ?? "erreur"})`);
      if (parts.length) toast.success(`Message envoyé : ${parts.join(" & ")}`);
      setBody("");
      await load();
      onSent?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Envoi impossible");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 text-slate-800 font-medium text-sm">
          <MessageSquare size={15} className="text-[#2F5FFF]" />
          Envoyer un message {target.label ? `à ${target.label}` : ""}
        </div>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Objet du message"
          maxLength={120}
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Votre message…"
          rows={5}
          maxLength={2000}
        />

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 mr-1">Envoyer via</span>
          {([
            { key: "email", label: "Email", icon: <Mail size={13} />, disabled: !target.email },
            { key: "app", label: "App Driver", icon: <Smartphone size={13} />, disabled: !target.userId },
            { key: "both", label: "Les deux", icon: <Send size={13} />, disabled: !target.email || !target.userId },
          ] as const).map((opt) => {
            const active =
              opt.key === "both" ? byEmail && byApp : opt.key === "email" ? byEmail && !byApp : byApp && !byEmail;
            return (
              <button
                key={opt.key}
                type="button"
                disabled={opt.disabled}
                onClick={() => {
                  setByEmail(opt.key !== "app");
                  setByApp(opt.key !== "email");
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
                  active
                    ? "border-[#2F5FFF] bg-[#2F5FFF]/10 text-[#2F5FFF]"
                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                {opt.icon} {opt.label}
              </button>
            );
          })}


          <Button
            size="sm"
            onClick={submit}
            disabled={sending}
            className="ml-auto bg-[#2F5FFF] hover:bg-[#2450e0] text-white"
          >
            {sending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Send size={14} className="mr-1" />}
            Envoyer
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-2 text-xs uppercase tracking-wider text-slate-500">
          Historique ({items.length})
        </div>
        {loading ? (
          <div className="p-6 flex justify-center"><Loader2 className="animate-spin text-slate-400" size={18} /></div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">Aucun message envoyé pour l'instant.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">{m.titre}</p>
                  <span className={`text-[10px] rounded-full px-2 py-0.5 ${m.lu ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"}`}>
                    {m.lu ? "Lu" : "Non lu"}
                  </span>
                </div>
                {m.message && <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{m.message}</p>}
                <p className="mt-1 text-[11px] text-slate-400">
                  {new Date(m.created_at).toLocaleString("fr-FR")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
