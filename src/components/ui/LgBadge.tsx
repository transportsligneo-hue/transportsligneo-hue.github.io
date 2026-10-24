import { type CSSProperties, type ReactNode } from "react";

/** Badge de statut unique du site : dégradé, reflet et pastille lumineuse (couleur = statut). */
export function LgBadge({
  color,
  children,
  size = "sm",
  title,
  className = "",
}: {
  color: string;
  children: ReactNode;
  size?: "xs" | "sm" | "md";
  title?: string;
  className?: string;
}) {
  const sz = size === "md" ? "lg-bdg--md" : size === "xs" ? "lg-bdg--sm" : "";
  return (
    <span title={title} className={`lg-bdg ${sz} ${className}`} style={{ "--c": color } as CSSProperties}>
      <span>{children}</span>
    </span>
  );
}
