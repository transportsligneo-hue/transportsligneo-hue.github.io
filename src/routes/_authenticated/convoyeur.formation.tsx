import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, HelpCircle, FolderOpen, Search, X, Menu } from "lucide-react";
import { useTraining } from "@/lib/formation/useTraining";
import { TrainingSidebar } from "@/components/formation/TrainingSidebar";
import { extractGlossary, plainText } from "@/lib/formation/types";

export const Route = createFileRoute("/_authenticated/convoyeur/formation")({
  component: FormationLayout,
});

function FormationLayout() {
  const training = useTraining();
  const [drawer, setDrawer] = useState(false);
  const [tool, setTool] = useState<"none" | "glossary" | "search">("none");
  const [q, setQ] = useState("");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeId = pathname.split("/module/")[1];

  const glossary = training.modules
    .flatMap((m) => extractGlossary(m.content))
    .filter((g, i, arr) => arr.findIndex((x) => x.term.toLowerCase() === g.term.toLowerCase()) === i)
    .sort((a, b) => a.term.localeCompare(b.term));

  const results = q.trim().length > 1
    ? training.modules.filter((m) =>
        (m.title + " " + plainText(m.content) + " " + (m.tag ?? "")).toLowerCase().includes(q.trim().toLowerCase()),
      )
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          className="lg:hidden rounded-lg border border-pro-border bg-white px-3 py-2 text-xs font-medium text-pro-text flex items-center gap-1.5"
        >
          <Menu size={14} /> Modules
        </button>
        <Link
          to="/convoyeur/formation"
          className="rounded-lg border border-pro-border bg-white px-3 py-2 text-xs font-medium text-pro-text flex items-center gap-1.5 hover:border-[#2F5FFF]/40"
        >
          <BookOpen size={14} /> Parcours
        </Link>
        <Link
          to="/convoyeur/formation/documents"
          className="rounded-lg border border-pro-border bg-white px-3 py-2 text-xs font-medium text-pro-text flex items-center gap-1.5 hover:border-[#2F5FFF]/40"
        >
          <FolderOpen size={14} /> Mes documents
        </Link>
        <Link
          to="/convoyeur/formation/faq"
          className="rounded-lg border border-pro-border bg-white px-3 py-2 text-xs font-medium text-pro-text flex items-center gap-1.5 hover:border-[#2F5FFF]/40"
        >
          <HelpCircle size={14} /> FAQ
        </Link>
        <button
          type="button"
          onClick={() => setTool(tool === "glossary" ? "none" : "glossary")}
          className="rounded-lg border border-pro-border bg-white px-3 py-2 text-xs font-medium text-pro-text hover:border-[#B8862A]/50"
        >
          Glossaire
        </button>
        <button
          type="button"
          onClick={() => setTool(tool === "search" ? "none" : "search")}
          className="rounded-lg border border-pro-border bg-white px-3 py-2 text-xs font-medium text-pro-text flex items-center gap-1.5 hover:border-[#2F5FFF]/40"
        >
          <Search size={14} /> Rechercher
        </button>
      </div>

      {tool === "search" && (
        <div className="rounded-2xl border border-pro-border bg-white p-4">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher dans le contenu des modules…"
            className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm outline-none focus:border-[#2F5FFF]"
          />
          <div className="mt-3 space-y-1">
            {results.map((m) => (
              <Link
                key={m.id}
                to="/convoyeur/formation/module/$id"
                params={{ id: m.id }}
                onClick={() => setTool("none")}
                className="block rounded-lg px-3 py-2 text-sm text-pro-text hover:bg-pro-bg-soft"
              >
                {m.order_index}. {m.title}
              </Link>
            ))}
            {q.trim().length > 1 && !results.length && <p className="text-xs text-pro-muted px-1">Aucun résultat.</p>}
          </div>
        </div>
      )}

      {tool === "glossary" && (
        <div className="rounded-2xl border border-pro-border bg-white p-5">
          <h3 className="text-sm font-semibold text-pro-text mb-3">Glossaire</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            {glossary.map((g) => (
              <div key={g.term} className="rounded-xl border border-pro-border p-3">
                <dt className="text-sm font-semibold text-[#0B1338]">{g.term}</dt>
                <dd className="text-xs text-pro-text-soft mt-1 leading-relaxed">{g.definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-4">
            <TrainingSidebar
              modules={training.modules}
              progress={training.progress}
              percent={training.percent}
              activeId={activeId}
            />
          </div>
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <div className="absolute left-0 top-0 h-full w-[85%] max-w-sm bg-pro-bg p-3 overflow-y-auto">
            <button
              type="button"
              onClick={() => setDrawer(false)}
              className="mb-2 ml-auto flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-pro-border"
            >
              <X size={16} />
            </button>
            <TrainingSidebar
              modules={training.modules}
              progress={training.progress}
              percent={training.percent}
              activeId={activeId}
              onNavigate={() => setDrawer(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
