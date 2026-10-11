import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Send, FileText, Loader2, Check, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ChatViewer = "admin" | "client" | "convoyeur";
type Attachment = { path: string; name: string; type: string; size: number };
type Msg = {
  id: string;
  sender_type: string;
  sender_id: string | null;
  body: string;
  attachments: Attachment[] | null;
  created_at: string;
  read_at: string | null;
};

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

const LABELS: Record<string, string> = {
  admin: "Transports Ligneo",
  client: "Client",
  convoyeur: "Convoyeur",
  visiteur: "Visiteur",
  systeme: "Information",
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function AttachmentItem({ a }: { a: Attachment }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.storage.from("chat-attachments").createSignedUrl(a.path, 600).then(({ data }) => {
      if (alive) setUrl(data?.signedUrl ?? null);
    });
    return () => { alive = false; };
  }, [a.path]);
  if (a.type.startsWith("image/") && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="lgc-att-img">
        <img src={url} alt={a.name} loading="lazy" />
      </a>
    );
  }
  return (
    <a href={url ?? undefined} target="_blank" rel="noreferrer" className="lgc-att-file">
      <FileText size={16} aria-hidden="true" />
      <span>{a.name}</span>
    </a>
  );
}

/**
 * Fil de discussion humain partagé (admin, client, convoyeur).
 * L'expéditeur réel est déterminé côté base : le client ne choisit jamais son rôle.
 */
export function ChatThread({
  conversationId,
  viewer,
  accent = "blue",
  quickReplies,
  emptyText = "Aucun message pour le moment. Écrivez le premier.",
  height = 460,
}: {
  conversationId: string;
  viewer: ChatViewer;
  accent?: "blue" | "green";
  quickReplies?: string[];
  emptyText?: string;
  height?: number;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const markRead = useCallback(() => {
    void supabase.rpc("chat_mark_read", { _conv: conversationId });
  }, [conversationId]);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => alive && setUid(data.user?.id ?? null));
    setLoading(true);
    supabase
      .from("chat_messages")
      .select("id, sender_type, sender_id, body, attachments, created_at, read_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(300)
      .then(({ data }) => {
        if (!alive) return;
        setMsgs((data as unknown as Msg[]) ?? []);
        setLoading(false);
        markRead();
      });
    const ch = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        (p) => {
          const row = p.new as Msg;
          if (!row?.id) return;
          setMsgs((prev) => {
            const i = prev.findIndex((m) => m.id === row.id);
            if (i >= 0) { const n = [...prev]; n[i] = row; return n; }
            return [...prev, row];
          });
          if (p.eventType === "INSERT") markRead();
        },
      )
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [conversationId, markRead]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [msgs.length]);

  const pickFiles = (list: FileList | null) => {
    if (!list) return;
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      if (!ALLOWED.includes(f.type)) { toast.error(`${f.name} : format non accepté (photo ou PDF).`); continue; }
      if (f.size > MAX_SIZE) { toast.error(`${f.name} dépasse 10 Mo.`); continue; }
      ok.push(f);
    }
    setFiles((prev) => [...prev, ...ok].slice(0, 5));
  };

  const send = async (override?: string) => {
    const body = (override ?? text).trim();
    if ((!body && files.length === 0) || sending || !uid) return;
    setSending(true);
    try {
      const attachments: Attachment[] = [];
      for (const f of files) {
        const safe = f.name.replace(/[^\w.\-]+/g, "_").slice(-80);
        const path = `${conversationId}/${crypto.randomUUID()}-${safe}`;
        const { error } = await supabase.storage.from("chat-attachments").upload(path, f, { contentType: f.type });
        if (error) throw error;
        attachments.push({ path, name: f.name, type: f.type, size: f.size });
      }
      const msgId = crypto.randomUUID();
      const { error } = await supabase.from("chat_messages").insert({
        id: msgId,
        conversation_id: conversationId,
        sender_id: uid,
        body,
        attachments: attachments as never,
      });
      if (error) throw error;
      void import("@/lib/chat-notify.functions").then((m) => m.notifyChatMessage({ data: { messageId: msgId } })).catch(() => {});
      setText("");
      setFiles([]);
    } catch {
      toast.error("Le message n'a pas pu être envoyé. Réessayez.");
    } finally {
      setSending(false);
    }
  };

  const mineType = viewer;
  return (
    <div className={`lgc-thread lgc-accent-${accent}`} style={{ height }}>
      <div className="lgc-body" ref={bodyRef} role="log" aria-live="polite">
        {loading ? (
          <div className="lgc-empty"><Loader2 className="animate-spin" size={18} /> Chargement…</div>
        ) : msgs.length === 0 ? (
          <div className="lgc-empty">{emptyText}</div>
        ) : (
          msgs.map((m) => {
            const mine = m.sender_type === mineType || (!!uid && m.sender_id === uid);
            if (m.sender_type === "systeme") {
              return <div key={m.id} className="lgc-system">{m.body}<span>{fmtTime(m.created_at)}</span></div>;
            }
            return (
              <div key={m.id} className={`lgc-row${mine ? " lgc-mine" : ""}`}>
                <div className={`lgc-bubble lgc-from-${m.sender_type}`}>
                  {!mine && <div className="lgc-author">{LABELS[m.sender_type] ?? m.sender_type}</div>}
                  {m.body && <div className="lgc-text">{m.body}</div>}
                  {(m.attachments ?? []).map((a) => <AttachmentItem key={a.path} a={a} />)}
                  <div className="lgc-meta">
                    {fmtTime(m.created_at)}
                    {mine && (m.read_at ? <CheckCheck size={13} aria-label="Lu" /> : <Check size={13} aria-label="Envoyé" />)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {quickReplies && quickReplies.length > 0 && (
        <div className="lgc-quick">
          {quickReplies.map((q) => (
            <button key={q} type="button" onClick={() => void send(q)} disabled={sending}>{q}</button>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="lgc-files">
          {files.map((f, i) => (
            <button key={i} type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} title="Retirer">
              {f.name} ×
            </button>
          ))}
        </div>
      )}

      <form className="lgc-input" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input ref={fileRef} type="file" hidden multiple accept="image/*,application/pdf" onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }} />
        <button type="button" className="lgc-icon" onClick={() => fileRef.current?.click()} aria-label="Joindre une photo ou un PDF">
          <Paperclip size={18} />
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder="Écrivez votre message…"
          rows={1}
          maxLength={4000}
          aria-label="Votre message"
        />
        <button type="submit" className="lgc-send" disabled={sending || (!text.trim() && files.length === 0)} aria-label="Envoyer">
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
}
