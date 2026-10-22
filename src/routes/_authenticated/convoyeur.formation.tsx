import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, HelpCircle, FolderOpen, Search, X, Menu, Languages } from "lucide-react";
import { useTraining } from "@/lib/formation/useTraining";
import { TrainingSidebar } from "@/components/formation/TrainingSidebar";
import { extractGlossary, plainText } from "@/lib/formation/types";
import "@/styles/driver-v2.css";
import "@/styles/driver-formation.css";

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
  const onDocs = pathname.endsWith("/formation/documents");
  const onFaq = pathname.endsWith("/formation/faq");
  const onParcours = !onDocs && !onFaq;

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
    <div className="drv2">
      <div className="fm">
        <div className="fm-tabs" role="tablist" aria-label="Navigation de la formation">
          <button type="button" className="fm-tab mob" onClick={() => setDrawer(true)}>
            <Menu size={15} /> Modules
          </button>
          <Link to="/convoyeur/formation" className={`fm-tab${onParcours && tool === "none" ? " on" : ""}`}>
            <BookOpen size={15} /> Parcours
          </Link>
          <Link to="/convoyeur/formation/documents" className={`fm-tab${onDocs ? " on" : ""}`}>
            <FolderOpen size={15} /> Mes documents
          </Link>
          <Link to="/convoyeur/formation/faq" className={`fm-tab${onFaq ? " on" : ""}`}>
            <HelpCircle size={15} /> FAQ
          </Link>
          <button type="button" className={`fm-tab${tool === "glossary" ? " on" : ""}`} onClick={() => setTool(tool === "glossary" ? "none" : "glossary")}>
            <Languages size={15} /> Glossaire
          </button>
          <button type="button" className={`fm-tab${tool === "search" ? " on" : ""}`} onClick={() => setTool(tool === "search" ? "none" : "search")}>
            <Search size={15} /> Rechercher
          </button>
        </div>

        {tool === "search" && (
          <div className="fm-card">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un mot dans les modules"
              className="fm-in"
            />
            <div>
              {results.map((m) => (
                <Link
                  key={m.id}
                  to="/convoyeur/formation/module/$id"
                  params={{ id: m.id }}
                  onClick={() => setTool("none")}
                  className="fm-sr"
                >
                  {m.order_index}. {m.title}
                </Link>
              ))}
              {q.trim().length > 1 && !results.length && <p className="fm-empty">Aucun résultat pour cette recherche.</p>}
            </div>
          </div>
        )}

        {tool === "glossary" && (
          <div className="fm-card">
            <div className="fm-card-h">
              <h3 className="fm-card-t"><span className="fm-ic"><Languages size={16} /></span> Glossaire</h3>
              <span className="fm-sub">{glossary.length} termes</span>
            </div>
            <dl className="fm-gl-g">
              {glossary.map((g) => (
                <div key={g.term} className="fm-gl-i">
                  <dt>{g.term}</dt>
                  <dd>{g.definition}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="fm-grid">
          <aside className="fm-aside">
            <div style={{ position: "sticky", top: 16 }}>
              <TrainingSidebar
                modules={training.modules}
                progress={training.progress}
                percent={training.percent}
                activeId={activeId}
              />
            </div>
          </aside>
          <div style={{ minWidth: 0 }}>
            <Outlet />
          </div>
        </div>

        {drawer && (
          <div className="fm-drawer">
            <i onClick={() => setDrawer(false)} />
            <div>
              <button type="button" onClick={() => setDrawer(false)} className="fm-x" aria-label="Fermer">
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
    </div>
  );
}
