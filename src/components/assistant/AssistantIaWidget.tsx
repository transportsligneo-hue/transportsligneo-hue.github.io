import { useCallback, useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MessageCircle, Send, X, Phone } from "lucide-react";

/**
 * Assistant IA flottant (site public).
 * Bulle en bas à droite + panneau de discussion.
 * Aucune donnée sensible n'est stockée localement hormis l'id de conversation.
 */

type ChatMsg = { role: "user" | "assistant"; content: string };

const QUICK_REPLIES = [
  "💰 Combien coûte un convoyage ?",
  "📦 Où en est ma mission ?",
  "🚗 Devenir convoyeur",
];

const WELCOME =
  "Bonjour 👋 Je suis l'assistant Transports Ligneo. Je peux répondre à vos questions sur nos services, nos tarifs, nos délais ou le suivi d'une mission.";

const HIDDEN_PREFIXES = ["/admin", "/convoyeur", "/dashboard", "/scan", "/espace", "/lovable"];

function sessionToken() {
  if (typeof window === "undefined") return "";
  let t = window.sessionStorage.getItem("ligneo_assistant_session");
  if (!t) {
    t = `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.sessionStorage.setItem("ligneo_assistant_session", t);
  }
  return t;
}

export default function AssistantIaWidget() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [notif, setNotif] = useState(true);
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: "assistant", content: WELCOME }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [lead, setLead] = useState({ nom: "", telephone: "" });
  const convId = useRef<string | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const hidden = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, typing, handoff]);

  useEffect(() => {
    if (open) {
      setNotif(false);
      inputRef.current?.focus();
    }
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value || typing) return;
      setInput("");
      setMessages((m) => [...m, { role: "user", content: value }]);
      setTyping(true);
      try {
        const res = await fetch("/api/public/assistant-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_token: sessionToken(),
            conversation_id: convId.current,
            message: value,
            page: typeof window !== "undefined" ? window.location.pathname : undefined,
          }),
        });
        const data = (await res.json()) as {
          conversation_id?: string;
          reply?: string;
          handoff?: boolean;
          error?: string;
        };
        if (data.conversation_id) convId.current = data.conversation_id;
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              data.reply ??
              "Je ne parviens pas à répondre pour le moment. Vous pouvez appeler le 07 82 45 61 81.",
          },
        ]);
        if (data.handoff) setHandoff(true);
      } catch {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "Connexion interrompue. Réessayez dans un instant, ou appelez-nous au 07 82 45 61 81.",
          },
        ]);
        setHandoff(true);
      } finally {
        setTyping(false);
        inputRef.current?.focus();
      }
    },
    [typing],
  );

  const sendLead = useCallback(async () => {
    if (!lead.nom.trim() || !lead.telephone.trim() || typing) return;
    setTyping(true);
    try {
      const res = await fetch("/api/public/assistant-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: sessionToken(),
          conversation_id: convId.current,
          lead: { nom: lead.nom.trim(), telephone: lead.telephone.trim() },
        }),
      });
      const data = (await res.json()) as { conversation_id?: string; reply?: string };
      if (data.conversation_id) convId.current = data.conversation_id;
      setLeadSent(true);
      setHandoff(false);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply ?? "Votre demande de rappel est enregistrée." },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Enregistrement impossible. Appelez-nous au 07 82 45 61 81." },
      ]);
    } finally {
      setTyping(false);
    }
  }, [lead, typing]);

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        className="aiw-bubble"
        aria-label="Ouvrir l'assistant Transports Ligneo"
        onClick={() => setOpen((o) => !o)}
        style={{ display: open ? "none" : undefined }}
      >
        <MessageCircle strokeWidth={2} />
        {notif && <span className="aiw-notif">1</span>}
      </button>

      <div className={`aiw-panel${open ? " aiw-open" : ""}`} role="dialog" aria-label="Assistant Transports Ligneo">
        <div className="aiw-head">
          <div className="aiw-head-info">
            <div className="aiw-name">Assistant Ligneo</div>
            <div className="aiw-status">
              <span className="aiw-dot" />
              En ligne — réponse instantanée
            </div>
          </div>
          <button type="button" className="aiw-close" onClick={() => setOpen(false)} aria-label="Fermer">
            <X size={15} />
          </button>
        </div>

        <div className="aiw-body" ref={bodyRef}>
          {messages.map((m, i) => (
            <div key={i} className={`aiw-msg ${m.role === "user" ? "aiw-user" : "aiw-bot"}`}>
              {m.content}
            </div>
          ))}

          {messages.length === 1 && (
            <div className="aiw-quick">
              {QUICK_REPLIES.map((q) => (
                <button key={q} type="button" className="aiw-quick-btn" onClick={() => void send(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {typing && (
            <div className="aiw-typing">
              <span />
              <span />
              <span />
            </div>
          )}

          {handoff && !leadSent && (
            <div className="aiw-handoff">
              <div className="aiw-handoff-title">Être rappelé(e) par un conseiller</div>
              <input
                className="aiw-field"
                placeholder="Votre nom"
                value={lead.nom}
                onChange={(e) => setLead((l) => ({ ...l, nom: e.target.value }))}
              />
              <input
                className="aiw-field"
                placeholder="Votre téléphone"
                inputMode="tel"
                value={lead.telephone}
                onChange={(e) => setLead((l) => ({ ...l, telephone: e.target.value }))}
              />
              <button type="button" className="aiw-quick-btn" onClick={() => void sendLead()}>
                Demander un rappel
              </button>
              <a className="aiw-call" href="tel:+33782456181">
                <Phone size={13} /> Appeler le 07 82 45 61 81
              </a>
            </div>
          )}
        </div>

        <form
          className="aiw-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            ref={inputRef}
            className="aiw-input"
            placeholder="Écrivez votre message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1200}
          />
          <button type="submit" className="aiw-send" disabled={typing || !input.trim()} aria-label="Envoyer">
            <Send size={15} />
          </button>
        </form>
        <div className="aiw-footer-note">Réponses générées par IA · Transports Ligneo</div>
      </div>
    </>
  );
}
