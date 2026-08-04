import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, RefreshCw, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/assistant-ia")({
  component: AdminAssistantIa,
  head: () => ({
    meta: [
      { title: "Conversations Assistant IA — Admin Ligneo" },
      {
        name: "description",
        content:
          "Journal des conversations de l'assistant IA du site : questions fréquentes, demandes de rappel et transferts humains.",
      },
    ],
  }),
});

interface Conversation {
  id: string;
  message_count: number;
  needs_human: boolean;
  contact_nom: string | null;
  contact_telephone: string | null;
  contact_email: string | null;
  page_origine: string | null;
  last_message_at: string;
  created_at: string;
}

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

function fmt(d: string) {
  return new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function AdminAssistantIa() {
  const [selected, setSelected] = useState<string | null>(null);

  const convs = useQuery({
    queryKey: ["assistant-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assistant_conversations")
        .select("*")
        .order("last_message_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Conversation[];
    },
  });

  const msgs = useQuery({
    queryKey: ["assistant-messages", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assistant_messages")
        .select("*")
        .eq("conversation_id", selected!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  const list = convs.data ?? [];
  const rappels = list.filter((c) => c.needs_human).length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Assistant IA — conversations</h1>
          <p className="text-sm text-slate-500">
            {list.length} conversation(s) · {rappels} demande(s) de rappel
          </p>
        </div>
        <button
          type="button"
          onClick={() => void convs.refetch()}
          className="admin-btn-blue inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
        >
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>


      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="max-h-[70vh] space-y-2 overflow-y-auto rounded-xl border p-2">
          {convs.isLoading && (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          )}
          {!convs.isLoading && list.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Aucune conversation pour le moment.</p>
          )}
          {list.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(c.id)}
              className={`w-full rounded-lg border p-3 text-left text-sm transition ${
                selected === c.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{c.contact_nom ?? "Visiteur anonyme"}</span>
                <span className="text-xs text-muted-foreground">{fmt(c.last_message_at)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{c.message_count} message(s)</span>
                {c.page_origine && <span>· {c.page_origine}</span>}
                {c.needs_human && (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-600">
                    Rappel demandé
                  </span>
                )}
              </div>
              {c.contact_telephone && (
                <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <Phone className="h-3 w-3" /> {c.contact_telephone}
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="max-h-[70vh] overflow-y-auto rounded-xl border p-4">
          {!selected && (
            <p className="text-sm text-muted-foreground">
              Sélectionnez une conversation pour lire les échanges.
            </p>
          )}
          {selected && msgs.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          )}
          <div className="space-y-3">
            {(msgs.data ?? []).map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-xl border p-3 text-sm ${
                  m.role === "user" ? "ml-auto bg-primary/10" : "bg-muted/40"
                }`}
              >
                <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {m.role === "user" ? "Visiteur" : "Assistant"} · {fmt(m.created_at)}
                </div>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
