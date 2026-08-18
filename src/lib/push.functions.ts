import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth_key: z.string().min(1).max(500),
  user_agent: z.string().max(500).optional().nullable(),
});

/**
 * Persists (or refreshes) a Web Push subscription for the current user.
 * Notifications are DISABLED by default in the UI; this server fn only
 * runs when the user explicitly opts in.
 */
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => subscriptionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth_key: data.auth_key,
          user_agent: data.user_agent ?? null,
        },
        { onConflict: "user_id,endpoint" }
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Removes a Web Push subscription for the current user.
 */
export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ endpoint: z.string().url().max(2000) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", data.endpoint);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Push natif (Capacitor / FCM / APNs)                                 */
/* ------------------------------------------------------------------ */

const nativeTokenSchema = z.object({
  token: z.string().min(10).max(4000),
  platform: z.enum(["ios", "android"]),
  user_agent: z.string().max(500).optional().nullable(),
});

/** Enregistre le jeton push natif de l'appareil courant. */
export const saveNativePushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => nativeTokenSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("native_push_tokens").upsert(
      {
        user_id: userId,
        token: data.token,
        platform: data.platform,
        user_agent: data.user_agent ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Supprime le jeton push natif de l'appareil courant. */
export const deleteNativePushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(10).max(4000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("native_push_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("token", data.token);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
