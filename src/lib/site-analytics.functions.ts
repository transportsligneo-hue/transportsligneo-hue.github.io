/**
 * Statistiques du site (migration 20261026000700).
 * - trackVisit : une page vue, anonyme (identifiant de session temporaire, ni nom, ni IP, ni cookie).
 * - logEstimation / markEstimationRequested : journal de l'estimateur (ville + département seulement).
 * - getSearchConsoleStats : chiffres Google Search Console (admin), via un compte de service Google.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BOT = /bot|crawl|spider|slurp|preview|lighthouse|headless|facebookexternalhit|bingpreview|pingdom|uptime/i;
const anyDb = (c: unknown) => c as { from: (t: string) => any };

function classifySource(referrer: string, utm: string, ownHost: string): { source: string | null; host: string | null } {
  const u = (utm || "").toLowerCase();
  if (u) {
    if (/brevo|sendinblue|mail|newsletter|campagne/.test(u)) return { source: "E-mails Ligneo", host: null };
    if (/linkedin/.test(u)) return { source: "LinkedIn", host: null };
    if (/google/.test(u)) return { source: "Google (annonce ou fiche)", host: null };
    return { source: u.slice(0, 40), host: null };
  }
  let host = "";
  try { host = new URL(referrer).hostname.replace(/^www\./, ""); } catch { host = ""; }
  if (!host || host === ownHost.replace(/^www\./, "")) return { source: null, host: null }; // lien direct ou navigation interne
  if (/(^|\.)google\./.test(host)) return { source: "Google (recherche)", host };
  if (/bing\.|duckduckgo\.|qwant\.|ecosia\.|yahoo\./.test(host)) return { source: "Autres moteurs", host };
  if (/linkedin\.|lnkd\.in/.test(host)) return { source: "LinkedIn", host };
  if (/facebook\.|instagram\.|fb\.|t\.co$|twitter\.|x\.com$|tiktok\./.test(host)) return { source: "Réseaux sociaux", host };
  if (/mail\.|outlook\.|gmail\./.test(host)) return { source: "E-mails", host };
  return { source: "Autres sites", host };
}

function decodeHeader(v: string | undefined | null) {
  if (!v) return null;
  try { return decodeURIComponent(v).slice(0, 80); } catch { return v.slice(0, 80); }
}

export const trackVisit = createServerFn({ method: "POST" })
  .inputValidator((input: { sid: string; path: string; ref?: string; utm?: string; device?: string; first?: boolean }) =>
    z.object({
      sid: z.string().min(8).max(64),
      path: z.string().min(1).max(200),
      ref: z.string().max(500).optional(),
      utm: z.string().max(80).optional(),
      device: z.enum(["Téléphone", "Ordinateur", "Tablette"]).optional(),
      first: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const ua = getRequestHeader("user-agent") ?? "";
    if (BOT.test(ua)) return { ok: false };
    const host = getRequestHeader("host") ?? "transportsligneo.fr";
    const src = data.first ? classifySource(data.ref ?? "", data.utm ?? "", host) : { source: null, host: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await anyDb(supabaseAdmin).from("site_visits").insert({
      session_id: data.sid,
      path: data.path.split("?")[0].slice(0, 200),
      source: data.first ? (src.source ?? "Lien direct") : null,
      referrer_host: src.host,
      device: data.device ?? null,
      city: decodeHeader(getRequestHeader("x-vercel-ip-city")),
      country: decodeHeader(getRequestHeader("x-vercel-ip-country")),
    });
    if (error) console.warn("[stats] visite non enregistrée", error.message);
    return { ok: !error };
  });

const placeSchema = z.object({ ville: z.string().max(80).nullable(), dept: z.string().max(3).nullable() });

export const logEstimation = createServerFn({ method: "POST" })
  .inputValidator((input: { sid?: string; depart: { ville: string | null; dept: string | null }; arrivee: { ville: string | null; dept: string | null }; km?: number | null; vehicule?: string; option?: string; prix?: number | null }) =>
    z.object({
      sid: z.string().max(64).optional(),
      depart: placeSchema,
      arrivee: placeSchema,
      km: z.number().min(0).max(10000).nullable().optional(),
      vehicule: z.string().max(40).optional(),
      option: z.string().max(30).optional(),
      prix: z.number().min(0).max(100000).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const ua = getRequestHeader("user-agent") ?? "";
    if (BOT.test(ua)) return { id: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await anyDb(supabaseAdmin).from("estimations_log").insert({
      session_id: data.sid ?? null,
      depart_ville: data.depart.ville, depart_dept: data.depart.dept,
      arrivee_ville: data.arrivee.ville, arrivee_dept: data.arrivee.dept,
      km: data.km ?? null, vehicule: data.vehicule || null, option_trajet: data.option || null, prix: data.prix ?? null,
    }).select("id").single();
    if (error) { console.warn("[stats] estimation non enregistrée", error.message); return { id: null }; }
    return { id: (row as { id: string }).id };
  });

export const markEstimationRequested = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; devisId?: string | null }) =>
    z.object({ id: z.string().uuid(), devisId: z.string().uuid().nullable().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await anyDb(supabaseAdmin).from("estimations_log")
      .update({ demande_envoyee: true, demande_at: new Date().toISOString(), devis_id: data.devisId ?? null })
      .eq("id", data.id).eq("demande_envoyee", false);
    return { ok: !error };
  });

/* ------------------------------------------------------------------ */
/* Google Search Console (admin)                                        */
/* Variables à ajouter sur Vercel : GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY,   */
/* GSC_SITE_URL (ex. sc-domain:transportsligneo.fr).                    */
/* ------------------------------------------------------------------ */
async function googleAccessToken(email: string, key: string) {
  const { createSign } = await import("node:crypto");
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: email, scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(key.replace(/\\n/g, "\n"), "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!json.access_token) throw new Error(json.error_description || "Connexion à Google refusée");
  return json.access_token;
}

type GscRow = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };

export const getSearchConsoleStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days: number }) => z.object({ days: z.number().int().min(7).max(90) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!isAdmin && !isSuper) throw new Error("Forbidden");

    const email = process.env.GSC_CLIENT_EMAIL, key = process.env.GSC_PRIVATE_KEY, site = process.env.GSC_SITE_URL || "sc-domain:transportsligneo.fr";
    if (!email || !key) return { configured: false as const };

    const token = await googleAccessToken(email, key);
    const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
    // Google publie avec ~2 jours de retard
    const end = day(2), start = day(data.days + 1), prevEnd = day(data.days + 2), prevStart = day(data.days * 2 + 1);
    const query = async (body: object) => {
      const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = (await r.json()) as { rows?: GscRow[]; error?: { message?: string } };
      if (j.error) throw new Error(j.error.message || "Erreur Google Search Console");
      return j.rows ?? [];
    };
    const [tot, prevTot, queries, prevQueries, pages] = await Promise.all([
      query({ startDate: start, endDate: end }),
      query({ startDate: prevStart, endDate: prevEnd }),
      query({ startDate: start, endDate: end, dimensions: ["query"], rowLimit: 50 }),
      query({ startDate: prevStart, endDate: prevEnd, dimensions: ["query"], rowLimit: 250 }),
      query({ startDate: start, endDate: end, dimensions: ["page"], rowLimit: 10 }),
    ]);
    const prevPos = new Map(prevQueries.map((r) => [r.keys?.[0] ?? "", r.position]));
    const t = tot[0], p = prevTot[0];
    return {
      configured: true as const,
      site, start, end,
      totals: { clicks: t?.clicks ?? 0, impressions: t?.impressions ?? 0, ctr: t?.ctr ?? 0, position: t?.position ?? 0 },
      prev: { clicks: p?.clicks ?? 0, position: p?.position ?? 0 },
      queries: queries.map((r) => ({ query: r.keys?.[0] ?? "", clicks: r.clicks, impressions: r.impressions, position: r.position, prevPosition: prevPos.get(r.keys?.[0] ?? "") ?? null })),
      pages: pages.map((r) => ({ page: (r.keys?.[0] ?? "").replace(/^https?:\/\/(www\.)?[^/]+/, "") || "/", clicks: r.clicks, impressions: r.impressions })),
    };
  });
