import "@/styles/chat-v2.css";
import { useEffect, useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChatThread } from "./ChatThread";

/**
 * Messagerie d'une mission avec Transports Ligneo.
 * Client : canal client ↔ Ligneo. Convoyeur : canal convoyeur ↔ Ligneo.
 * Les deux canaux sont étanches : le client et le convoyeur ne se parlent jamais.
 */
export function MissionChatPanel(
  props:
    | { missionId: string; attributionId?: never; viewer: "client" }
    | { attributionId: string; missionId?: never; viewer: "convoyeur" },
) {
  const [convId, setConvId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    const p = props.viewer === "client"
      ? supabase.rpc("chat_open_mission", { _mission_id: props.missionId!, _kind: "mission_client" })
      : supabase.rpc("chat_open_attribution", { _attribution_id: props.attributionId! });
    p.then(({ data, error }) => {
      if (!alive) return;
      if (error || !data) { setState("unavailable"); return; }
      setConvId(data as string);
      setState("ready");
    });
    return () => { alive = false; };
  }, [props.viewer, props.missionId, props.attributionId]);

  const green = props.viewer === "convoyeur";
  return (
    <section className={`lgc-panel${green ? " lgc-panel-green" : ""}`} aria-label="Messagerie de la mission">
      <header className="lgc-panel-head">
        <MessageCircle size={18} aria-hidden="true" />
        <div>
          <h3>Messagerie avec Transports Ligneo</h3>
          <p>Une question sur cette mission ? Notre équipe vous répond ici.</p>
        </div>
      </header>
      {state === "loading" && <div className="lgc-empty"><Loader2 size={18} className="animate-spin" /> Ouverture…</div>}
      {state === "unavailable" && <div className="lgc-empty">La messagerie sera disponible dès que la mission sera enregistrée.</div>}
      {state === "ready" && convId && (
        <ChatThread conversationId={convId} viewer={props.viewer} accent={green ? "green" : "blue"} height={420} />
      )}
    </section>
  );
}
