import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Assistant IA public de Transports Ligneo.
 * - Reçoit le message d'un visiteur (aucune authentification requise)
 * - Appelle Lovable AI Gateway côté serveur (clé jamais exposée au navigateur)
 * - Journalise la conversation pour analyse admin
 * - Limite à 20 messages visiteur par conversation
 */

const MAX_MESSAGES = 20;
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

const BodySchema = z.object({
  session_token: z.string().min(8).max(80),
  conversation_id: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(1).max(1200).optional(),
  page: z.string().max(200).optional(),
  lead: z
    .object({
      nom: z.string().trim().min(1).max(120),
      telephone: z.string().trim().min(4).max(40),
      email: z.string().trim().max(160).optional(),
    })
    .optional(),
});

const SYSTEM_PROMPT = `Tu es l'assistant virtuel officiel de Transports Ligneo, entreprise française de convoyage automobile par la route (conduite du véhicule par un convoyeur professionnel), basée à Tours.

TON : chaleureux, professionnel, concis (3 à 6 phrases maximum, pas de pavés). Tutoiement interdit : vouvoie toujours. Réponds en français.

INFORMATIONS RÉELLES SUR L'ENTREPRISE — tu ne dois utiliser QUE celles-ci :
- Services : livraison + restitution (aller-retour), livraison simple, restitution simple ; convoyage pour particuliers, concessions, loueurs, garages et flottes d'entreprise ; missions ponctuelles ou contrats récurrents.
- Zone : toute la France, et Europe sur devis.
- Engagements : convoyeurs professionnels vérifiés, assurance incluse pendant le convoyage, 0 frais caché, délais habituels de 24 à 48 h selon la distance et la disponibilité, état des lieux photo au départ et à l'arrivée avec PDF remis au client, suivi de la mission dans l'espace client.
- Devis : un estimateur en ligne donne une estimation instantanée à partir des villes de départ et d'arrivée et du type de véhicule (page « Estimer mon trajet » / « Tarifs »). Le prix final est confirmé par un devis officiel.
- Devenir convoyeur : inscription en ligne sur la page « Devenir convoyeur » (permis B depuis au moins 3 ans, casier vierge, statut indépendant ou possibilité d'accompagnement, pièces justificatives à fournir). Les candidatures sont validées par l'équipe.
- Contact humain : 07 82 45 61 81, 7j/7.

RÈGLES ABSOLUES :
1. Ne JAMAIS inventer un prix précis, un délai garanti, un statut de mission, un contenu de devis ou de facture, ni une information dont tu n'es pas certain. Si on te demande un tarif exact : explique que le prix dépend de la distance, du type de véhicule et des options, et invite à utiliser l'estimateur en ligne ou à demander un devis.
2. Pour toute donnée personnelle (suivi d'une mission précise, devis déjà émis, facture, compte) : n'essaie pas de deviner. Invite le visiteur à se connecter à son espace client, ou propose d'être rappelé.
3. Ne demande jamais de données sensibles (numéro de carte bancaire, mot de passe, pièce d'identité) dans le chat.
4. Si la question est hors sujet (météo, politique, devoirs, autre entreprise…) : décline poliment en une phrase et ramène vers les sujets convoyage.
5. Si tu ne sais pas répondre, ou si le visiteur demande un humain : propose explicitement soit d'appeler le 07 82 45 61 81, soit de laisser son nom et son numéro pour être rappelé, et termine ta réponse par le marqueur [HANDOFF] sur la dernière ligne.`;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function getAdmin(): SupabaseClient | null {
  const url = process.env["SUPABASE_URL"] ?? import.meta.env.VITE_SUPABASE_URL;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export const Route = createFileRoute("/api/public/assistant-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = BodySchema.parse(await request.json());
        } catch {
          return jsonError("Requête invalide", 400);
        }

        const admin = getAdmin();
        if (!admin) return jsonError("Configuration serveur manquante", 500);

        // --- Conversation courante (créée à la volée) ---
        let conversationId = parsed.conversation_id ?? null;
        if (conversationId) {
          const { data } = await admin
            .from("assistant_conversations")
            .select("id, session_token, message_count")
            .eq("id", conversationId)
            .maybeSingle();
          if (!data || data.session_token !== parsed.session_token) conversationId = null;
          else if (data.message_count >= MAX_MESSAGES) {
            return Response.json({
              conversation_id: conversationId,
              reply:
                "Nous avons atteint la limite de messages pour cette conversation. Pour continuer, appelez-nous au 07 82 45 61 81 ou laissez-nous vos coordonnées, nous vous rappelons rapidement.",
              handoff: true,
              limit_reached: true,
            });
          }
        }

        if (!conversationId) {
          const { data, error } = await admin
            .from("assistant_conversations")
            .insert({ session_token: parsed.session_token, page_origine: parsed.page ?? null })
            .select("id")
            .single();
          if (error || !data) return jsonError("Impossible d'ouvrir la conversation", 500);
          conversationId = data.id;
        }

        // --- Demande de rappel (transfert humain) ---
        if (parsed.lead) {
          const { error } = await admin
            .from("assistant_conversations")
            .update({
              needs_human: true,
              contact_nom: parsed.lead.nom,
              contact_telephone: parsed.lead.telephone,
              contact_email: parsed.lead.email ?? null,
              last_message_at: new Date().toISOString(),
            })
            .eq("id", conversationId);
          if (error) return jsonError("Enregistrement impossible", 500);
          return Response.json({
            conversation_id: conversationId,
            reply: `Merci ${parsed.lead.nom}, votre demande de rappel est bien enregistrée. Un conseiller Ligneo vous contactera au ${parsed.lead.telephone}. Vous pouvez aussi nous joindre directement au 07 82 45 61 81.`,
            handoff: false,
            lead_saved: true,
          });
        }

        if (!parsed.message) return jsonError("Message manquant", 400);

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return jsonError("Assistant indisponible", 500);

        // --- Historique ---
        const { data: history } = await admin
          .from("assistant_messages")
          .select("role, content")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(40);

        const messages = [
          { role: "system", content: SYSTEM_PROMPT },
          ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: parsed.message },
        ];

        let reply = "";
        try {
          const res = await fetch(GATEWAY_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": apiKey,
              "X-Lovable-AIG-SDK": "fetch",
            },
            body: JSON.stringify({ model: MODEL, messages, max_tokens: 700 }),
          });

          if (res.status === 429) {
            return Response.json({
              conversation_id: conversationId,
              reply:
                "Beaucoup de demandes en ce moment 🙏 Merci de réessayer dans quelques instants, ou appelez-nous au 07 82 45 61 81.",
              handoff: true,
            });
          }
          if (res.status === 402) {
            return Response.json({
              conversation_id: conversationId,
              reply:
                "L'assistant est momentanément indisponible. Un conseiller Ligneo peut vous répondre au 07 82 45 61 81.",
              handoff: true,
            });
          }
          if (!res.ok) {
            const detail = await res.text();
            console.error("assistant-chat gateway error", res.status, detail.slice(0, 500));
            return Response.json({
              conversation_id: conversationId,
              reply:
                "Je ne parviens pas à répondre pour le moment. Souhaitez-vous être rappelé(e) par un conseiller ? Vous pouvez aussi appeler le 07 82 45 61 81.",
              handoff: true,
            });
          }

          const payload = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          reply = payload.choices?.[0]?.message?.content?.trim() ?? "";
        } catch (err) {
          console.error("assistant-chat gateway exception", err);
          return Response.json({
            conversation_id: conversationId,
            reply:
              "Une erreur technique est survenue. Vous pouvez joindre un conseiller Ligneo au 07 82 45 61 81.",
            handoff: true,
          });
        }

        if (!reply) {
          reply =
            "Je préfère ne pas répondre au hasard sur ce point. Souhaitez-vous être rappelé(e) par un conseiller ? Vous pouvez aussi appeler le 07 82 45 61 81.";
        }

        const handoff = reply.includes("[HANDOFF]");
        reply = reply.replace(/\[HANDOFF\]/g, "").trim();

        await admin.from("assistant_messages").insert([
          { conversation_id: conversationId, role: "user", content: parsed.message },
          { conversation_id: conversationId, role: "assistant", content: reply },
        ]);

        const { data: conv } = await admin
          .from("assistant_conversations")
          .select("message_count")
          .eq("id", conversationId)
          .maybeSingle();

        await admin
          .from("assistant_conversations")
          .update({
            message_count: (conv?.message_count ?? 0) + 1,
            last_message_at: new Date().toISOString(),
            ...(handoff ? { needs_human: true } : {}),
          })
          .eq("id", conversationId);

        return Response.json({
          conversation_id: conversationId,
          reply,
          handoff,
          remaining: Math.max(0, MAX_MESSAGES - ((conv?.message_count ?? 0) + 1)),
        });
      },
    },
  },
});
