/**
 * Lecture publique des articles (SSR-safe, clé publiable, RLS anon).
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type PublicArticle = {
  id: string;
  titre: string;
  slug: string;
  extrait: string | null;
  contenu: string;
  image_url: string | null;
  published_at: string | null;
};

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getArticleBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().trim().min(1).max(160) }).parse(d))
  .handler(async ({ data }): Promise<PublicArticle | null> => {
    const { data: row } = await publicClient()
      .from("articles")
      .select("id, titre, slug, extrait, contenu, image_url, published_at")
      .eq("statut", "publie")
      .eq("slug", data.slug)
      .maybeSingle();
    return (row as PublicArticle | null) ?? null;
  });
