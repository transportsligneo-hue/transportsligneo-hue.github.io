import { useCallback, useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Send, X, Phone } from "lucide-react";

/**
 * Vroomy 🚗 — assistant IA flottant de Transports Ligneo (site public).
 * Même backend/API que l'assistant précédent : /api/public/assistant-chat.
 * Seuls le nom, la mascotte et le ton changent.
 */

type ChatMsg = { role: "user" | "assistant"; content: string };

const QUICK_REPLIES: Array<{ icon: string; label: string }> = [
  { icon: "💰", label: "Combien coûte un convoyage ?" },
  { icon: "📦", label: "Où en est ma mission ?" },
  { icon: "🚗", label: "Devenir convoyeur" },
];

const WELCOME =
  "Vrooom, bonjour 👋 Moi c'est Vroomy, le copilote de Transports Ligneo ! Je peux vous aider sur nos services, nos tarifs, nos délais ou le suivi d'une mission.";

const HIDDEN_PREFIXES = ["/admin", "/convoyeur", "/dashboard", "/scan", "/espace", "/lovable"];

/** Face de Vroomy : carrosserie arrondie, phares-yeux, calandre-sourire, deux roues. */
function VroomyFace({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x="4" y="12" width="24" height="12" rx="5" fill="#ffffff" />
      <rect x="8" y="8" width="16" height="8" rx="4" fill="#ffffff" />
      <circle cx="11" cy="17" r="2.4" fill="#182655" />
      <circle cx="21" cy="17" r="2.4" fill="#182655" />
      <path d="M12.5 20.6 Q16 23.4 19.5 20.6" stroke="#182655" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.75" />
      <circle cx="9" cy="25.5" r="2.2" fill="#182655" />
      <circle cx="23" cy="25.5" r="2.2" fill="#182655" />
    </svg>
  );
}

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
              "Panne sèche de mon côté 😅 Je ne parviens pas à répondre pour le moment. Vous pouvez appeler le 07 82 45 61 81.",
          },
        ]);
        if (data.handoff) setHandoff(true);
      } catch {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "Connexion interrompue en pleine route. Réessayez dans un instant, ou appelez-nous au 07 82 45 61 81.",
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
        className="vrm-launcher"
        aria-label="Ouvrir Vroomy, l'assistant Transports Ligneo"
        onClick={() => setOpen((o) => !o)}
        style={{ display: open ? "none" : undefined }}
      >
        <VroomyFace size={34} />
        {notif && <span className="vrm-badge">1</span>}
      </button>

      <div className={`vrm-panel${open ? " vrm-open" : ""}`} role="dialog" aria-label="Vroomy, assistant Transports Ligneo">
        <div className="vrm-head">
          <div className="vrm-speed" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="vrm-head-row">
            <div className="vrm-id">
              <div className="vrm-avatar">
                <VroomyFace size={28} />
              </div>
              <div>
                <h2 className="vrm-title">Vroomy 🚗</h2>
                <div className="vrm-status">
                  <span className="vrm-dot" />
                  En ligne — réponse instantanée
                </div>
              </div>
            </div>
            <button type="button" className="vrm-close" onClick={() => setOpen(false)} aria-label="Fermer">
              <X size={16} />
            </button>
          </div>
          <p className="vrm-tagline">Toujours prêt à rouler avec vous ! 💨</p>
        </div>

        <div className="vrm-body" ref={bodyRef}>
          {messages.map((m, i) => (
            <div key={i} className={`vrm-row${m.role === "user" ? " vrm-user" : ""}`}>
              {m.role === "assistant" && (
                <div className="vrm-msg-avatar">
                  <VroomyFace size={16} />
                </div>
              )}
              <div className="vrm-bubble">{m.content}</div>
            </div>
          ))}

          {messages.length === 1 && (
            <div className="vrm-chips">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  className="vrm-chip"
                  onClick={() => void send(q.label)}
                >
                  <span className="vrm-ic">{q.icon}</span>
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {typing && (
            <div className="vrm-row">
              <div className="vrm-msg-avatar">
                <VroomyFace size={16} />
              </div>
              <div className="vrm-typing" aria-label="Vroomy est en train d'écrire">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          {handoff && !leadSent && (
            <div className="vrm-handoff">
              <div className="vrm-handoff-title">Être rappelé(e) par un conseiller</div>
              <input
                className="vrm-field"
                placeholder="Votre nom"
                value={lead.nom}
                onChange={(e) => setLead((l) => ({ ...l, nom: e.target.value }))}
              />
              <input
                className="vrm-field"
                placeholder="Votre téléphone"
                inputMode="tel"
                value={lead.telephone}
                onChange={(e) => setLead((l) => ({ ...l, telephone: e.target.value }))}
              />
              <button type="button" className="vrm-chip" onClick={() => void sendLead()}>
                <span className="vrm-ic">📞</span>
                Demander un rappel
              </button>
              <a className="vrm-call" href="tel:+33782456181">
                <Phone size={13} /> Appeler le 07 82 45 61 81
              </a>
            </div>
          )}
        </div>

        <div className="vrm-footer">
          <form
            className="vrm-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              ref={inputRef}
              className="vrm-input"
              placeholder="Écrivez à Vroomy..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1200}
            />
            <button type="submit" className="vrm-send" disabled={typing || !input.trim()} aria-label="Envoyer">
              <Send size={18} />
            </button>
          </form>
          <p className="vrm-fine">Réponses générées par IA · Transports Ligneo</p>
        </div>
      </div>
    </>
  );
}
