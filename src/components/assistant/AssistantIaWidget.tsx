import { useCallback, useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Send, X, Phone, Calculator, MapPin, FileDown, BellOff, Bell, ClipboardList, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadVroomyDevisPdf } from "@/lib/vroomy-devis-pdf";
import vroomyMascotte from "@/assets/vroomy-mascotte.png.asset.json";
import { Button } from "@/components/ui/button";
import { VroomyAvatar } from "@/components/VroomyAvatar";
import VroomyOrderFlow from "@/components/assistant/VroomyOrderFlow";
import { ConseillerChat } from "@/components/chat/ConseillerChat";
import {
  detectOrderIntent,
  extractOrderInfo,
  loadDraft,
  type VroomyOrderDraft,
} from "@/lib/vroomy-order";


/**
 * Vroomy — assistant flottant de Transports Ligneo (site public).
 * Même backend/API que l'assistant précédent : /api/public/assistant-chat.
 * Seuls le nom, la mascotte et le ton changent.
 */

type Profil = "client" | "convoyeur";

type VroomyCard =
  | { type: "mission"; data: Record<string, unknown> }
  | { type: "devis"; data: Record<string, unknown> }
  | { type: "catalogue"; data: { ville: string | null; missions: Array<Record<string, unknown>> } }
  | { type: "login"; data: { url: string } };

type ChatMsg = { role: "user" | "assistant"; content: string; cards?: VroomyCard[] };

const WELCOME =
  "Vrooom, bonjour ! Moi c'est Vroomy, le copilote de Transports Ligneo ! Dites-moi qui vous êtes, je m'adapte tout de suite.";


const HIDDEN_PREFIXES = ["/admin", "/convoyeur", "/dashboard", "/scan", "/espace", "/lovable"];

const PROACTIVE_PREF_KEY = "ligneo_vroomy_proactive_off";

/** Mascotte officielle Vroomy (voiture bleue néon Transports Ligneo). */
function VroomyFace({ size = 28, alt, className }: { size?: number; alt?: string; className?: string }) {
  return (
    <img
      src={vroomyMascotte.url}
      width={size}
      height={size}
      className={`vrm-mascotte${className ? ` ${className}` : ""}`}
      alt={alt ?? ""}
      aria-hidden={alt ? undefined : true}
      loading="lazy"
      decoding="async"
    />
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

function fmtEur(v: unknown) {
  return typeof v === "number" ? `${Math.round(v)} €` : "—";
}

function VroomyCardView({ card }: { card: VroomyCard }) {
  if (card.type === "devis") {
    const d = card.data as Record<string, unknown>;
    const trajet = `${String(d.depart)} vers ${String(d.arrivee)}`;
    return (
      <section className="vrm-card" aria-label={`Estimation ${trajet}`}>
        <div className="vrm-card-title">Estimation · {String(d.depart)} → {String(d.arrivee)}</div>
        <div className="vrm-card-price">{fmtEur(d.prix_ttc)} TTC</div>
        <div className="vrm-card-meta">
          {d.distance_km ? `${d.distance_km} km · ` : ""}
          {String(d.delai_estime ?? "")} · {String(d.type_livraison ?? "")}
        </div>
        <Button variant="ghost"
          type="button"
          className="vrm-card-pdf"
          onClick={() => downloadVroomyDevisPdf(d)}
          aria-label={`Exporter en PDF l'estimation ${trajet}`}
        >
          <FileDown size={13} aria-hidden="true" />
          Exporter en PDF
        </Button>
      </section>
    );
  }

  if (card.type === "login") {
    return (
      <div className="vrm-card">
        <div className="vrm-card-title">Connexion requise</div>
        <div className="vrm-card-meta">
          Le suivi de mission est réservé à votre espace client sécurisé.
        </div>
        <a className="vrm-card-pdf" href={card.data.url || "/login"}>
          Se connecter à mon espace
        </a>
      </div>
    );
  }

  if (card.type === "mission") {
    const d = card.data as Record<string, unknown>;
    return (
      <div className="vrm-card">
        <div className="vrm-card-title">Mission {String(d.numero)}</div>
        <div className="vrm-card-price">{String(d.statut)}</div>
        <div className="vrm-card-meta">
          {String(d.depart)} → {String(d.arrivee)}
          {d.vehicule ? ` · ${String(d.vehicule)}` : ""}
        </div>
      </div>
    );
  }
  const missions = card.data.missions ?? [];
  return (
    <div className="vrm-card">
      <div className="vrm-card-title">
        Missions disponibles{card.data.ville ? ` · ${card.data.ville}` : ""}
      </div>
      {missions.map((m, i) => (
        <div key={i} className="vrm-mini-mission">
          <div>
            <strong>
              {String(m.depart ?? "?")} → {String(m.arrivee ?? "?")}
            </strong>
            <em>
              {m.date ? String(m.date) : "Date à confirmer"}
              {m.vehicule ? ` · ${String(m.vehicule)}` : ""}
            </em>
          </div>
          <span>{fmtEur(m.remuneration)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AssistantIaWidget() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [chatTab, setChatTab] = useState<"vroomy" | "conseiller">("vroomy");
  const [notif, setNotif] = useState(true);
  const [greet, setGreet] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem("vroomy-greet")) return;
    const t1 = setTimeout(() => { sessionStorage.setItem("vroomy-greet", "1"); setGreet(true); }, 3000);
    const t2 = setTimeout(() => setGreet(false), 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: "assistant", content: WELCOME }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [profilAuto, setProfilAuto] = useState(false);
  const [prenom, setPrenom] = useState<string | null>(null);
  const [leadSent, setLeadSent] = useState(false);
  const [lead, setLead] = useState({ nom: "", telephone: "" });
  const [proactiveOff, setProactiveOff] = useState(false);
  const [prefNotice, setPrefNotice] = useState<string | null>(null);
  const [orderFlow, setOrderFlow] = useState(false);
  const [orderInitial, setOrderInitial] = useState<Partial<VroomyOrderDraft> | undefined>(undefined);
  const [hasDraft, setHasDraft] = useState(false);
  const convId = useRef<string | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

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

  /* Lecture de la préférence "relance proactive" */
  useEffect(() => {
    if (typeof window === "undefined") return;
    setProactiveOff(window.localStorage.getItem(PROACTIVE_PREF_KEY) === "1");
  }, []);

  const toggleProactive = useCallback(() => {
    setProactiveOff((v) => {
      const next = !v;
      if (typeof window !== "undefined") {
        if (next) window.localStorage.setItem(PROACTIVE_PREF_KEY, "1");
        else window.localStorage.removeItem(PROACTIVE_PREF_KEY);
      }
      setPrefNotice(
        next
          ? "Vroomy ne s'ouvrira plus tout seul sur les pages Tarifs et Estimation."
          : "Vroomy pourra de nouveau vous proposer son aide sur Tarifs et Estimation.",
      );
      return next;
    });
  }, []);

  /* Détection automatique du profil réel, y compris quand le statut change */
  useEffect(() => {
    let alive = true;

    const detect = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!alive) return;
      if (!user) {
        // Déconnexion : on repasse en mode visiteur (choix manuel possible)
        setProfilAuto(false);
        setProfil(null);
        setPrenom(null);
        return;
      }
      const [{ data: conv }, { data: prof }] = await Promise.all([
        supabase.from("convoyeurs").select("id").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("prenom").eq("id", user.id).maybeSingle(),
      ]);
      if (!alive) return;
      setProfil(conv?.id ? "convoyeur" : "client");
      setProfilAuto(true);
      const p = (prof as { prenom?: string } | null)?.prenom;
      setPrenom(p ?? null);
    };

    void detect();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void detect();
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  /* Ré-évaluation du profil à chaque changement de page (statut convoyeur validé, etc.) */
  useEffect(() => {
    if (!profilAuto) return;
    let alive = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user || !alive) return;
      const { data: conv } = await supabase
        .from("convoyeurs")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!alive) return;
      setProfil(conv?.id ? "convoyeur" : "client");
    })();
    return () => {
      alive = false;
    };
  }, [pathname, profilAuto]);

  /* Ouverture proactive désactivée : Vroomy ne s'ouvre plus tout seul,
     uniquement au clic sur le lanceur ou via l'événement ligneo:assistant-open. */

  /* Clavier : Échap ferme le panneau et rend le focus au lanceur */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    const node = panelRef.current;
    node?.addEventListener("keydown", onKey);
    return () => node?.removeEventListener("keydown", onKey);
  }, [open]);


  /* Brouillon de commande guidée en attente de reprise */
  useEffect(() => {
    if (!open) return;
    const d = loadDraft();
    setHasDraft(!!d && !!(d.depart || d.arrivee));
  }, [open]);

  /* Démarre (ou reprend) le parcours guidé */
  const startOrderFlow = useCallback((initial?: Partial<VroomyOrderDraft>, intro?: string) => {
    setOrderInitial(initial);
    setOrderFlow(true);
    if (intro) setMessages((m) => [...m, { role: "assistant", content: intro }]);
  }, []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("ligneo:assistant-open", onOpen);
    return () => window.removeEventListener("ligneo:assistant-open", onOpen);
  }, []);



  const send = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value || typing) return;
      setInput("");
      setMessages((m) => [...m, { role: "user", content: value }]);

      // Intention de commande : on bascule sur le parcours guidé pas à pas,
      // en réutilisant les informations déjà données dans le message.
      if (!orderFlow && profil !== "convoyeur" && detectOrderIntent(value)) {
        const info = extractOrderInfo(value);
        const known = [
          info.depart && `départ ${info.depart}`,
          info.arrivee && `arrivée ${info.arrivee}`,
          info.vehicule && `véhicule ${info.vehicule}`,
        ].filter(Boolean).join(", ");
        const step = !info.depart ? "depart" : !info.arrivee ? "arrivee" : !info.vehicule ? "vehicule" : "date";
        startOrderFlow(
          { ...info, step } as Partial<VroomyOrderDraft>,
          known
            ? `Parfait, je note ${known}. Je vous guide pas à pas pour le reste, une question à la fois.`
            : "Avec plaisir, on prend la route ensemble : je vous guide pas à pas, une question à la fois.",
        );
        return;
      }

      setTyping(true);
      try {
        const { data: sessData } = await supabase.auth.getSession();
        const accessToken = sessData.session?.access_token;
        const res = await fetch("/api/public/assistant-chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            session_token: sessionToken(),
            conversation_id: convId.current,
            message: value,
            page: typeof window !== "undefined" ? window.location.pathname : undefined,
            profil: profil ?? undefined,
            prenom: prenom ?? undefined,
          }),
        });
        const data = (await res.json()) as {
          conversation_id?: string;
          reply?: string;
          handoff?: boolean;
          cards?: VroomyCard[];
          error?: string;
        };
        if (data.conversation_id) convId.current = data.conversation_id;
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              data.reply ??
              "Panne sèche de mon côté 😅 Je ne parviens pas à répondre pour le moment. Vous pouvez nous écrire à contact@transportsligneo.fr.",
            cards: data.cards && data.cards.length > 0 ? data.cards : undefined,
          },
        ]);
        if (data.handoff) setHandoff(true);
      } catch {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "Connexion interrompue en pleine route. Réessayez dans un instant, ou écrivez-nous à contact@transportsligneo.fr.",
          },
        ]);
        setHandoff(true);
      } finally {
        setTyping(false);
        inputRef.current?.focus();
      }
    },
    [typing, profil, prenom, orderFlow, startOrderFlow],
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
        { role: "assistant", content: "Enregistrement impossible. Écrivez-nous à contact@transportsligneo.fr." },
      ]);
    } finally {
      setTyping(false);
    }
  }, [lead, typing]);

  if (hidden) return null;
  // (onglet Conseiller géré via chatTab)

  return (
    <>
      <Button variant="ghost"
        type="button"
        ref={launcherRef}
        className="vrm-launcher vrm-chat-launcher vrm-launcher-animated"
        aria-label="Ouvrir Vroomy, l'assistant Transports Ligneo"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => { setGreet(false); setOpen((o) => !o); }}
        style={{ display: open ? "none" : undefined }}
      >
        <VroomyAvatar size={72} talking={typing} />
        <span className="vroomy-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" fill="#2f5fff"/><g fill="#fff"><circle className="vroomy-dot" cx="8.5" cy="11" r="1.4"/><circle className="vroomy-dot" cx="12" cy="11" r="1.4"/><circle className="vroomy-dot" cx="15.5" cy="11" r="1.4"/></g></svg>
        </span>
        {greet && !open && <span className="vroomy-greet" aria-hidden="true">Bonjour ! Je suis Vroomy.</span>}

      </Button>

      <div
        ref={panelRef}
        className={`vrm-panel vrm-window${open ? " vrm-open" : ""}`}
        role="dialog"
        aria-modal="false"
        aria-label="Vroomy, assistant Transports Ligneo"
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        <div className="vrm-head">
          <div className="vrm-head-row">
            <div className="vrm-id">
              <div className="vrm-avatar">
                <VroomyAvatar size={48} talking={open && chatTab === "vroomy" && typing} effects={false} />
                <span className="vrm-chat-bubble" aria-hidden="true"><MessageCircle size={12} strokeWidth={2.6} /></span>
              </div>
              <div>
                <h2 className="vrm-title">Vroomy</h2>
                <div className="vrm-status">
                  <span className="vrm-dot" aria-hidden="true" />
                  Assistant Transports Ligneo
                </div>
              </div>
            </div>
            <div className="vrm-head-actions">
              <Button variant="ghost"
                type="button"
                className="vrm-close"
                onClick={toggleProactive}
                aria-pressed={proactiveOff}
                aria-label={
                  proactiveOff
                    ? "Réactiver la proposition automatique de Vroomy sur les pages Tarifs et Estimation"
                    : "Désactiver la proposition automatique de Vroomy sur les pages Tarifs et Estimation"
                }
                title={proactiveOff ? "Relance automatique désactivée" : "Désactiver la relance automatique"}
              >
                {proactiveOff ? <BellOff size={15} aria-hidden="true" /> : <Bell size={15} aria-hidden="true" />}
              </Button>
              <Button variant="ghost"
                type="button"
                className="vrm-close"
                onClick={() => {
                  setOpen(false);
                  launcherRef.current?.focus();
                }}
                aria-label="Fermer Vroomy"
              >
                <X size={16} aria-hidden="true" />
              </Button>
            </div>
          </div>
          {prefNotice && (
            <p className="vrm-pref-note" role="status">
              {prefNotice}
            </p>
          )}
        </div>

        <div className="vrm-tabs" role="tablist" aria-label="Choisir un interlocuteur">
          <Button variant="ghost" type="button" role="tab" aria-selected={chatTab === "vroomy"} className={chatTab === "vroomy" ? "on" : ""} onClick={() => setChatTab("vroomy")}>Vroomy</Button>
          <Button variant="ghost" type="button" role="tab" aria-selected={chatTab === "conseiller"} className={chatTab === "conseiller" ? "on" : ""} onClick={() => setChatTab("conseiller")}>Conseiller</Button>
        </div>
        {chatTab === "conseiller" && (
          <div className="vrm-conseiller-wrap">
            <ConseillerChat
              summary={messages
                .filter((m) => m.role === "user")
                .slice(-6)
                .map((m) => `- ${m.content}`)
                .join("\n") || undefined}
            />
          </div>
        )}

        <div className="vrm-body" ref={bodyRef} role="log" aria-live="polite" aria-label="Conversation avec Vroomy" tabIndex={0} style={chatTab === "conseiller" ? { display: "none" } : undefined}>
          {messages.map((m, i) => (
            <div key={i} className={`vrm-row${m.role === "user" ? " vrm-user" : ""}`}>
              {m.role === "assistant" && (
                <div className="vrm-msg-avatar">
                  <VroomyAvatar size={24} effects={false} />
                </div>
              )}
              <div className="vrm-bubble">
                <span className="sr-only">{m.role === "user" ? "Vous : " : "Vroomy : "}</span>
                {m.content}
                {m.cards?.map((c, ci) => (
                  <VroomyCardView key={ci} card={c} />
                ))}
              </div>
            </div>
          ))}

          {!messages.some((m) => m.role === "user") && !orderFlow && (
            <div className="vrm-chips vrm-welcome-chips" role="group" aria-label="Questions suggérées">
              <Button variant="ghost" className="vrm-chip" onClick={() => void send("Estimer un convoyage")}>
                <Calculator size={16} aria-hidden="true" /> Estimer un convoyage
              </Button>
              <Button variant="ghost" className="vrm-chip" onClick={() => void send("Suivre mon véhicule")}>
                <MapPin size={16} aria-hidden="true" /> Suivre mon véhicule
              </Button>
              <Button variant="ghost" className="vrm-chip" onClick={() => setChatTab("conseiller")}>
                <MessageCircle size={16} aria-hidden="true" /> Parler à un conseiller
              </Button>
            </div>
          )}

          {orderFlow && (
            <VroomyOrderFlow
              initial={orderInitial}
              onExit={() => {
                setOrderFlow(false);
                setMessages((m) => [
                  ...m,
                  {
                    role: "assistant",
                    content:
                      "Pas de souci, je garde vos réponses de côté : vous pourrez reprendre la commande quand vous voulez, ou passer par le formulaire classique.",
                  },
                ]);
              }}
              onFinished={(numero, prix) => {
                setOrderFlow(false);
                setHasDraft(false);
                setMessages((m) => [
                  ...m,
                  {
                    role: "assistant",
                    content: `Commande enregistrée, plein phare ! Votre devis ${numero} (${Math.round(prix)} € TTC) vient d'être créé et vous est envoyé par email. Il est en attente d'acceptation : vous pourrez l'accepter et le régler depuis votre espace client.`,
                    cards: [{ type: "login", data: { url: "/dashboard-client/devis" } }],
                  },
                ]);
              }}
            />
          )}

          {profil === "client" && hasDraft && !orderFlow && (
            <div className="vrm-chips" role="group" aria-label="Commander avec Vroomy">
              <Button variant="ghost"
                type="button"
                className="vrm-chip"
                onClick={() => startOrderFlow(undefined, hasDraft
                  ? "On reprend votre commande là où nous l'avions laissée."
                  : "Très bien, je vous guide pas à pas jusqu'à la confirmation.")}
              >
                <span className="vrm-ic" aria-hidden="true">
                  <ClipboardList size={14} strokeWidth={2.2} />
                </span>
                {hasDraft ? "Reprendre ma commande" : "Se faire guider pas à pas"}
              </Button>
            </div>
          )}

          {typing && (
            <div className="vrm-row">
              <div className="vrm-msg-avatar">
                <VroomyAvatar size={24} effects={false} />
              </div>
              <div className="vrm-typing" role="status" aria-label="Vroomy est en train d'écrire">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          {handoff && !leadSent && (
            <div className="vrm-handoff">
              <div className="vrm-handoff-title" id="vrm-handoff-title">
                Être rappelé(e) par un conseiller
              </div>
              <label className="sr-only" htmlFor="vrm-lead-nom">
                Votre nom
              </label>
              <input
                id="vrm-lead-nom"
                className="vrm-field"
                placeholder="Votre nom"
                autoComplete="name"
                value={lead.nom}
                onChange={(e) => setLead((l) => ({ ...l, nom: e.target.value }))}
              />
              <label className="sr-only" htmlFor="vrm-lead-tel">
                Votre téléphone
              </label>
              <input
                id="vrm-lead-tel"
                className="vrm-field"
                placeholder="Votre téléphone"
                inputMode="tel"
                autoComplete="tel"
                value={lead.telephone}
                onChange={(e) => setLead((l) => ({ ...l, telephone: e.target.value }))}
              />
              <Button variant="ghost" type="button" className="vrm-chip" onClick={() => void sendLead()}>
                <span className="vrm-ic" aria-hidden="true">
                  <Phone size={16} aria-hidden="true" />
                </span>
                Demander un rappel
              </Button>
              <a className="vrm-call" href="tel:+33782456181">
                <Phone size={13} aria-hidden="true" /> Appeler le 07 82 45 61 81
              </a>
            </div>
          )}
        </div>

        <div className="vrm-footer" style={chatTab === "conseiller" ? { display: "none" } : undefined}>
          <form
            className="vrm-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <label className="sr-only" htmlFor="vrm-input">
              Votre message pour Vroomy
            </label>
            <input
              id="vrm-input"
              ref={inputRef}
              className="vrm-input"
              placeholder="Écrivez votre message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1200}
            />
            <Button variant="ghost" type="submit" className="vrm-send" disabled={typing || !input.trim()} aria-label="Envoyer le message">
              <Send size={18} aria-hidden="true" />
            </Button>
          </form>

          <p className="vrm-fine">
            <Button variant="ghost" type="button" className="vrm-pref-link" onClick={toggleProactive} aria-pressed={proactiveOff}>
              {proactiveOff ? "Réactiver les propositions automatiques" : "Ne plus me proposer d'aide automatiquement"}
            </Button>
          </p>

        </div>
      </div>
    </>
  );
}
