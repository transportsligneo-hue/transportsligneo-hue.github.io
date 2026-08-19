import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Avatar convoyeur réutilisable dans l'admin.
 * Charge (et met en cache) la photo de profil du convoyeur à partir de son id,
 * exactement comme le logo client — mais avec sa tête.
 */

const cache = new Map<string, string | null>();
const listeners = new Set<() => void>();
let queue = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function notify() {
  listeners.forEach((fn) => fn());
}

async function flush() {
  timer = null;
  const ids = Array.from(queue);
  queue = new Set();
  if (!ids.length) return;

  const { data: convs } = await supabase
    .from("convoyeurs")
    .select("id, user_id")
    .in("id", ids);

  const rows = (convs ?? []) as Array<{ id: string; user_id: string | null }>;
  const userIds = rows.map((r) => r.user_id).filter(Boolean) as string[];

  let avatars = new Map<string, string | null>();
  if (userIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, avatar_url")
      .in("user_id", userIds);
    avatars = new Map(
      ((profs ?? []) as Array<{ user_id: string; avatar_url: string | null }>).map((p) => [
        p.user_id,
        p.avatar_url,
      ]),
    );
  }

  ids.forEach((id) => {
    const row = rows.find((r) => r.id === id);
    cache.set(id, (row?.user_id ? avatars.get(row.user_id) : null) ?? null);
  });
  notify();
}

function request(id: string) {
  if (cache.has(id)) return;
  cache.set(id, null);
  queue.add(id);
  if (!timer) timer = setTimeout(() => void flush(), 40);
}

export function useDriverAvatar(convoyeurId?: string | null): string | null {
  const [, force] = useState(0);

  useEffect(() => {
    if (!convoyeurId) return;
    const rerender = () => force((n) => n + 1);
    listeners.add(rerender);
    request(convoyeurId);
    return () => {
      listeners.delete(rerender);
    };
  }, [convoyeurId]);

  return convoyeurId ? cache.get(convoyeurId) ?? null : null;
}

const SIZES: Record<string, string> = {
  xs: "w-6 h-6 text-[9px]",
  sm: "w-8 h-8 text-[10px]",
  md: "w-10 h-10 text-xs",
  lg: "w-16 h-16 text-base",
};

interface DriverAvatarProps {
  convoyeurId?: string | null;
  /** Photo déjà connue (évite une requête). */
  src?: string | null;
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

function initials(name?: string | null) {
  if (!name) return "C";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function DriverAvatar({
  convoyeurId,
  src,
  name,
  size = "sm",
  className = "",
}: DriverAvatarProps) {
  const fetched = useDriverAvatar(src ? null : convoyeurId);
  const url = src ?? fetched;
  const box = SIZES[size] ?? SIZES.sm;

  if (url) {
    return (
      <img
        src={url}
        alt={name || "Convoyeur"}
        title={name || undefined}
        loading="lazy"
        className={`${box} rounded-full object-cover shrink-0 ring-1 ring-emerald-400/40 ${className}`}
      />
    );
  }

  return (
    <span
      title={name || undefined}
      className={`${box} rounded-full shrink-0 inline-flex items-center justify-center font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300/60 ${className}`}
    >
      {initials(name)}
    </span>
  );
}
