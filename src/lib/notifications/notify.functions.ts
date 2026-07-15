/**
 * notifyUser — server fn unifié pour créer une notification utilisateur
 * (in-app + push web + email optionnel), avec dé-doublonnage.
 *
 * Doit être appelé depuis un contexte authentifié (server fn / server route).
 * Utilise supabaseAdmin pour permettre les notifs cross-user (driver → client, etc.).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CATEGORIES = ["mission", "paiement", "document", "message", "systeme", "compte"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const inputSchema = z.object({
  userId: z.string().uuid(),
  type: z.string().min(1).max(100),
  titre: z.string().min(1).max(300),
  message: z.string().max(2000).optional().nullable(),
  link: z.string().max(500).optional().nullable(),
  category: z.enum(CATEGORIES).default("systeme"),
  priority: z.enum(PRIORITIES).default("normal"),
  dedupKey: z.string().max(200).optional().nullable(),
  entityType: z.string().max(50).optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional(),
  push: z.boolean().default(true),
  email: z
    .object({
      template: z.string().min(1),
      data: z.record(z.string(), z.any()).optional(),
      recipient: z.string().email().optional(),
    })
    .optional()
    .nullable(),
});

export const notifyUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Authorization: caller may only notify themselves, unless they are admin/super_admin.
    if (data.userId !== context.userId) {
      const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
      ]);
      if (!isAdmin && !isSuper) {
        throw new Response("Forbidden", { status: 403 });
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Vérifier préférence in_app (par défaut activée)
    const { data: prefs } = await supabaseAdmin
      .from("notification_preferences")
      .select("channel, enabled")
      .eq("user_id", data.userId)
      .eq("category", data.category);

    const prefFor = (channel: "push" | "email" | "in_app") => {
      const row = prefs?.find((p: any) => p.channel === channel);
      return row ? row.enabled : true; // default: enabled
    };

    let notificationId: string | null = null;

    if (prefFor("in_app")) {
      const { data: id, error } = await (supabaseAdmin as any).rpc("create_user_notification", {
        _user_id: data.userId,
        _type: data.type,
        _titre: data.titre,
        _message: data.message ?? null,
        _link: data.link ?? null,
        _category: data.category,
        _priority: data.priority,
        _dedup_key: data.dedupKey ?? null,
        _entity_type: data.entityType ?? null,
        _entity_id: data.entityId ?? null,
        _metadata: data.metadata ?? {},
      });
      if (error) console.warn("[notifyUser] rpc failed", error);
      else notificationId = id as string;
    }

    // 2) Push web (best-effort)
    if (data.push && prefFor("push")) {
      try {
        const { sendPushToUser } = await import("@/lib/push/send.server");
        await sendPushToUser(data.userId, {
          title: data.titre.slice(0, 120),
          body: (data.message ?? "").slice(0, 500) || undefined,
          url: data.link ?? "/notifications",
          tag: data.dedupKey ?? `${data.category}-${data.entityId ?? Date.now()}`,
        });
      } catch (err) {
        console.warn("[notifyUser] push failed", err);
      }
    }

    // 3) Email (best-effort, seulement si prefs autorisent)
    if (data.email && prefFor("email")) {
      try {
        let recipient = data.email.recipient;
        if (!recipient) {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(data.userId);
          recipient = userData?.user?.email ?? undefined;
        }
        if (recipient) {
          // Enqueue via table pgmq (bypass send.ts qui exige session client)
          await (supabaseAdmin as any).rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              template_name: data.email.template,
              recipient_email: recipient,
              template_data: data.email.data ?? {},
              idempotency_key: data.dedupKey ?? undefined,
            },
          });
        }
      } catch (err) {
        console.warn("[notifyUser] email enqueue failed", err);
      }
    }

    return { ok: true, notificationId };
  });
