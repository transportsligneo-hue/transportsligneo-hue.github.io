import { useMemo, useState } from "react";
import { AlertTriangle, Lightbulb } from "lucide-react";

function GlossaryTerm({ term, definition }: { term: string; definition: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="underline decoration-dotted decoration-2 underline-offset-4 decoration-[#B8862A] text-inherit font-medium"
      >
        {term}
      </button>
      {open && (
        <span className="absolute z-30 left-0 top-full mt-1 w-64 rounded-lg bg-[#0B1338] text-white text-xs leading-relaxed p-3 shadow-xl border border-[#B8862A]/40">
          <span className="block text-[#E7C76A] font-semibold mb-1">{term}</span>
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
  return parts;
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
      <ul key={k} className="space-y-1.5 my-3">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2 text-sm text-pro-text-soft leading-relaxed">
            <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-[#B8862A] shrink-0" />
            <span>{renderInline(b, `${k}-${i}`)}</span>
          </li>
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
        <h3 key={k} className="text-base font-semibold text-pro-text mt-6 mb-2 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-[#2F5FFF]" />
          {line.slice(3)}
        </h3>,
      );
      return;
    }
    if (line.startsWith("!! ")) {
      out.push(
        <div key={k} className="my-4 rounded-xl border border-amber-300 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 leading-relaxed">
            <span className="font-semibold block mb-0.5">Point de vigilance</span>
            {renderInline(line.slice(3), k)}
          </p>
        </div>,
      );
      return;
    }
    if (line.startsWith(">> ")) {
      out.push(
        <div key={k} className="my-4 rounded-xl border border-[#2F5FFF]/30 bg-[#2F5FFF]/5 p-4 flex gap-3">
          <Lightbulb size={18} className="text-[#2F5FFF] shrink-0 mt-0.5" />
          <p className="text-sm text-pro-text leading-relaxed">
            <span className="font-semibold block mb-0.5 text-[#2F5FFF]">Conseil terrain</span>
            {renderInline(line.slice(3), k)}
          </p>
        </div>,
      );
      return;
    }
    out.push(
      <p key={k} className="text-sm text-pro-text-soft leading-relaxed my-2">
        {renderInline(line, k)}
      </p>,
    );
  });
  flush("ul-end");

  return <div>{out}</div>;
}

export default ModuleContent;
