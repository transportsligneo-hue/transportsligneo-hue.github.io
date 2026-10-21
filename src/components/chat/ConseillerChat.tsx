import "@/styles/chat-v2.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChatThread } from "./ChatThread";
import { startVisitorChat, listVisitorMessages, sendVisitorMessage } from "@/lib/chat-visitor.functions";

const TOKEN_KEY = "ligneo_conseiller_token";

type VMsg = { id: string; sender_type: string; body: string; created_at: string };

function useAdvisorStatus() {
  const [s, setS] = useState<{ available: boolean; offline: string } | null>(null);
  useEffect(() => {
    supabase.from("chat_settings").select("advisor_available, offline_message").maybeSingle().then(({ data }) => {
      if (data) setS({ available: data.advisor_available, offline: data.offline_message });
    });
  }, []);
  return s;
}

/** Onglet « Conseiller » de Vroomy : conversation avec une personne de l'équipe Ligneo. */
export function ConseillerChat({ summary, mode = "visitor" }: { summary?: string; mode?: "visitor" | "client" }) {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const status = useAdvisorStatus();

  useEffect(() => {
    // Site public : toujours formulaire visiteur (une session oubliée ne doit pas lier le chat à un compte).
    if (mode === "visitor") { setUid(null); return; }
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, [mode]);

  return (
    <div className="lgc-conseiller">
      <div className={`lgc-avail${status?.available ? " on" : ""}`}>
        <span aria-hidden="true" />
        {status?.available ? "Un conseiller est disponible" : status?.offline ?? "Conseillers Ligneo"}
      </div>
      {uid === undefined ? (
        <div className="lgc-empty"><Loader2 size={18} className="animate-spin" /></div>
      ) : uid ? (
        <SignedInConseiller uid={uid} summary={summary} />
      ) : (
        <VisitorConseiller summary={summary} />
      )}
    </div>
  );
}

function SignedInConseiller({ uid, summary }: { uid: string; summary?: string }) {
  const [convId, setConvId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const summaryRef = useRef(summary);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("chat_conversations")
          .select("id")
          .eq("kind", "conseiller")
          .eq("client_user_id", uid)
          .neq("status", "resolue")
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (data?.id) { if (alive) setConvId(data.id); return; }
        // Id généré côté navigateur : pas de relecture immédiate (bloquée par la règle d'accès).
        const id = crypto.randomUUID();
        const s = summaryRef.current;
        const { error: insErr } = await supabase
          .from("chat_conversations")
          .insert({ id, kind: "conseiller", client_user_id: uid, source: s ? "vroomy" : "client_connecte", vroomy_summary: s || null });
        if (insErr) throw insErr;
        if (alive) setConvId(id);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [uid]);
  if (failed) return <div className="lgc-empty">Impossible d'ouvrir la conversation. Rechargez la page ou appelez le 07 82 45 61 81.</div>;
  if (!convId) return <div className="lgc-empty"><Loader2 size={18} className="animate-spin" /></div>;
  return (
    <>
      <p className="lgc-waiting">Un conseiller va bientôt vous répondre.</p>
      <ChatThread conversationId={convId} viewer="client" height={340} emptyText="Posez votre question, un conseiller va bientôt vous répondre." />
    </>
  );
}

function VisitorConseiller({ summary }: { summary?: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<VMsg[]>([]);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setToken(window.localStorage.getItem(TOKEN_KEY)); }, []);

  const refresh = useCallback(async (t: string) => {
    try {
      const r = await listVisitorMessages({ data: { token: t } });
      setMsgs(r.messages as VMsg[]);
    } catch {
      window.localStorage.removeItem(TOKEN_KEY);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void refresh(token);
    const id = window.setInterval(() => void refresh(token), 6000);
    return () => window.clearInterval(id);
  }, [token, refresh]);

  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight }); }, [msgs.length]);

  if (!token) {
    return (
      <form
        className="lgc-visitor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true); setErr(null);
          try {
            const r = await startVisitorChat({ data: { ...form, summary } });
            window.localStorage.setItem(TOKEN_KEY, r.token);
            setToken(r.token);
          } catch (x) {
            setErr(x instanceof Error ? x.message : "Erreur, réessayez.");
          } finally { setBusy(false); }
        }}
      >
        <p>Laissez vos coordonnées : un conseiller Ligneo vous répond ici et par email.</p>
        <input required placeholder="Votre nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
        <input required type="email" placeholder="Votre email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
        <textarea required placeholder="Votre question" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        {err && <div className="lgc-err" role="alert">{err}</div>}
        <button type="submit" disabled={busy}>{busy ? "Envoi…" : "Contacter un conseiller"}</button>
      </form>
    );
  }

  return (
    <>
    <p className="lgc-waiting">Un conseiller va bientôt vous répondre.</p>
    <div className="lgc-thread lgc-accent-blue" style={{ height: 340 }}>
      <div className="lgc-body" ref={bodyRef} role="log" aria-live="polite">
        {msgs.map((m) => (
          <div key={m.id} className={`lgc-row${m.sender_type === "visiteur" ? " lgc-mine" : ""}`}>
            <div className={`lgc-bubble lgc-from-${m.sender_type}`}>
              {m.sender_type !== "visiteur" && <div className="lgc-author">Transports Ligneo</div>}
              <div className="lgc-text">{m.body}</div>
              <div className="lgc-meta">{new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          </div>
        ))}
      </div>
      <form
        className="lgc-input"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = text.trim();
          if (!body || busy) return;
          setBusy(true);
          try { await sendVisitorMessage({ data: { token, body } }); setText(""); await refresh(token); }
          catch (x) { setErr(x instanceof Error ? x.message : "Erreur"); }
          finally { setBusy(false); }
        }}
      >
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Votre message…" rows={1} aria-label="Votre message" />
        <button type="submit" className="lgc-send" disabled={busy || !text.trim()} aria-label="Envoyer"><Send size={18} /></button>
      </form>
    </div>
    </>
  );
}
