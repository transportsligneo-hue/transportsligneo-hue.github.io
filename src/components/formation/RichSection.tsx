import { CheckCircle2, AlertTriangle, Info, Lightbulb, Star, ImageOff } from "lucide-react";

type Section =
  | { type: "text"; content: string }
  | { type: "image"; url: string; alt?: string; caption?: string }
  | { type: "video"; url: string }
  | { type: "checklist"; items: string[] }
  | { type: "callout"; tone?: "info" | "warning" | "success"; content: string };

const toneMap = {
  info: {
    icon: Info,
    border: "border-blue-200",
    bg: "bg-blue-50",
    text: "text-blue-900",
  },
  warning: {
    icon: AlertTriangle,
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-900",
  },
  success: {
    icon: CheckCircle2,
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-900",
  },
};

export function RichSection({ section }: { section: Section }) {
  if (section.type === "text") {
    return (
      <div className="text-sm leading-relaxed text-pro-text-soft whitespace-pre-line space-y-3">
        {section.content.split("\n\n").map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    );
  }

  if (section.type === "image") {
    const isPlaceholder = section.url.startsWith("[IMAGE:");
    const placeholderText = isPlaceholder
      ? section.url.replace(/^\[IMAGE:\s*/, "").replace(/\]$/, "")
      : "";

    return (
      <figure className="rounded-2xl border border-pro-border bg-pro-bg-soft p-4">
        {isPlaceholder ? (
          <div className="aspect-video rounded-xl border-2 border-dashed border-pro-border/60 bg-white flex flex-col items-center justify-center gap-3 text-pro-muted">
            <ImageOff size={36} className="opacity-40" />
            <p className="text-xs text-center px-6 max-w-md">{placeholderText}</p>
          </div>
        ) : (
          <img
            src={section.url}
            alt={section.alt ?? ""}
            className="rounded-xl w-full object-cover"
            loading="lazy"
          />
        )}
        {section.caption && (
          <figcaption className="text-xs text-pro-muted mt-3 text-center italic">
            {section.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  if (section.type === "video") {
    const yt = section.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/);
    if (yt) {
      return (
        <div className="aspect-video rounded-xl overflow-hidden border border-pro-border">
          <iframe
            src={`https://www.youtube.com/embed/${yt[1]}`}
            className="w-full h-full"
            allowFullScreen
            title="Vidéo de formation"
          />
        </div>
      );
    }
    return (
      <video src={section.url} controls className="w-full rounded-xl border border-pro-border" />
    );
  }

  if (section.type === "checklist") {
    return (
      <ul className="space-y-3 rounded-xl border border-pro-border bg-pro-bg-soft/50 p-4">
        {section.items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-pro-text-soft">
            <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (section.type === "callout") {
    const tone = section.tone ?? "info";
    const config = toneMap[tone];
    const Icon = config.icon;
    const isRules = section.content.includes("10 règles d'or");
    const isKeyPoint = section.content.includes("Point clé");
    const isTip = section.content.includes("Astuce");

    let title = "À retenir";
    if (isRules) title = "Les 10 règles d'or";
    else if (isKeyPoint) title = "Point clé";
    else if (isTip) title = "Astuce";

    return (
      <div className={`rounded-2xl border p-4 ${config.border} ${config.bg}`}>
        <div className="flex items-start gap-3">
          <Icon size={18} className={`${config.text} mt-0.5 shrink-0`} />
          <div className="min-w-0">
            <p className={`text-xs font-bold uppercase tracking-wider ${config.text}`}>{title}</p>
            <p className={`text-sm mt-1.5 leading-relaxed ${config.text}`}>{section.content}</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
