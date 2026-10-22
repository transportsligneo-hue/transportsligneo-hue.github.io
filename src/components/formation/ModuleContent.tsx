import { useMemo, useState } from "react";
import { AlertTriangle, Lightbulb } from "lucide-react";

function GlossaryTerm({ term, definition }: { term: string; definition: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="fm-gl"
      >
        {term}
      </button>
      {open && (
        <span className="fm-tt">
          <b>{term}</b>
          {definition}
        </span>
      )}
    </span>
  );
}

function renderInline(text: string, key: string) {
  const parts: React.ReactNode[] = [];
  const re = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<GlossaryTerm key={`${key}-g${i++}`} term={(m[1] ?? "").trim()} definition={(m[2] ?? "").trim()} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  // Gras : **texte**
  return parts.flatMap((p, pi): React.ReactNode[] =>
    typeof p !== "string"
      ? [p]
      : p.split(/\*\*(.+?)\*\*/g).map((s, si) =>
          si % 2 === 1 ? <strong key={`${key}-b${pi}-${si}`}>{s}</strong> : s,
        ),
  );
}

/**
 * Rendu du contenu module.
 * Syntaxe : "## titre", "- puce", "!! point de vigilance", ">> conseil terrain", ligne vide = paragraphe.
 */
export function ModuleContent({ content }: { content: string }) {
  const blocks = useMemo(() => content.split("\n"), [content]);
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = (k: string) => {
    if (!bullets.length) return;
    out.push(
      <ul key={k}>
        {bullets.map((b, i) => (
          <li key={i}><span>{renderInline(b, `${k}-${i}`)}</span></li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  blocks.forEach((raw, idx) => {
    const line = raw.trim();
    const k = `l${idx}`;
    if (line.startsWith("- ")) {
      bullets.push(line.slice(2));
      return;
    }
    flush(`${k}-ul`);
    if (!line) return;
    if (line.startsWith("## ")) {
      out.push(
        <h3 key={k}><i />{line.slice(3)}</h3>,
      );
      return;
    }
    if (line.startsWith("!! ")) {
      out.push(
        <div key={k} className="fm-call warn">
          <AlertTriangle size={18} />
          <p style={{ margin: 0 }}>
            <b>Point de vigilance</b>
            {renderInline(line.slice(3), k)}
          </p>
        </div>,
      );
      return;
    }
    if (line.startsWith(">> ")) {
      out.push(
        <div key={k} className="fm-call tip">
          <Lightbulb size={18} />
          <p style={{ margin: 0 }}>
            <b>Conseil terrain</b>
            {renderInline(line.slice(3), k)}
          </p>
        </div>,
      );
      return;
    }
    out.push(
      <p key={k}>{renderInline(line, k)}</p>,
    );
  });
  flush("ul-end");

  return <div className="fm-prose">{out}</div>;
}

export default ModuleContent;
