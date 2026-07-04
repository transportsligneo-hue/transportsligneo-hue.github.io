import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://transportsligneo.fr";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const STATIC_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/services", changefreq: "monthly", priority: "0.9" },
  { path: "/tarifs", changefreq: "monthly", priority: "0.9" },
  { path: "/comment-ca-marche", changefreq: "monthly", priority: "0.8" },
  { path: "/a-propos", changefreq: "monthly", priority: "0.7" },
  { path: "/contact", changefreq: "monthly", priority: "0.7" },
  { path: "/pro", changefreq: "monthly", priority: "0.8" },
  { path: "/b2b", changefreq: "monthly", priority: "0.8" },
  { path: "/b2b/partenariat-flotte", changefreq: "monthly", priority: "0.7" },
  { path: "/b2b/transport-ponctuel", changefreq: "monthly", priority: "0.7" },
  { path: "/blog", changefreq: "weekly", priority: "0.7" },
  { path: "/reserver", changefreq: "monthly", priority: "0.8" },
  { path: "/inscription-client", changefreq: "yearly", priority: "0.5" },
  { path: "/inscription-convoyeur", changefreq: "yearly", priority: "0.5" },
  { path: "/inscription-pro", changefreq: "yearly", priority: "0.5" },
  { path: "/inscription-flotte", changefreq: "yearly", priority: "0.5" },
  { path: "/login", changefreq: "yearly", priority: "0.3" },
  { path: "/cgv", changefreq: "yearly", priority: "0.3" },
  { path: "/mentions-legales", changefreq: "yearly", priority: "0.3" },
  { path: "/confidentialite", changefreq: "yearly", priority: "0.3" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = STATIC_ENTRIES.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
