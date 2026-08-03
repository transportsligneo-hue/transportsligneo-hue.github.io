/**
 * File d'attente hors ligne générique pour les écritures de mission (convoyeur).
 *
 * - Chaque opération (update / insert / upsert) est persistée en IndexedDB.
 * - Si le réseau est disponible, elle est envoyée immédiatement.
 * - Sinon elle reste en file et est rejouée dès le retour de connexion
 *   (event `online`, retour d'onglet, ou timer de secours).
 *
 * Les erreurs "métier" (RLS, contrainte) ne sont pas rejouées indéfiniment :
 * au-delà de MAX_ATTEMPTS l'entrée est abandonnée pour éviter une boucle.
 */
import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "ligneo-mission-outbox";
const STORE = "ops";
const VERSION = 1;
const MAX_ATTEMPTS = 12;
const BACKOFF_MS = [1000, 3000, 8000, 20_000, 60_000, 180_000];

export type OutboxOp =
  | { kind: "update"; table: string; values: Record<string, unknown>; match: Record<string, unknown> }
  | { kind: "insert"; table: string; values: Record<string, unknown> }
  | { kind: "upsert"; table: string; values: Record<string, unknown>; onConflict?: string };

export type OutboxEntry = OutboxOp & {
  id: string;
  createdAt: number;
  attempts: number;
  label?: string;
};

type Listener = (pending: number) => void;

const listeners = new Set<Listener>();
let dbPromise: Promise<IDBPDatabase> | null = null;
let running = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let memoryFallback: OutboxEntry[] = [];

function db() {
  if (typeof indexedDB === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "id" });
      },
    }).catch((err) => {
      console.warn("[outbox] openDB failed", err);
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

async function readAll(): Promise<OutboxEntry[]> {
  try {
    const d = await db();
    if (!d) return memoryFallback;
    return (await d.getAll(STORE)) as OutboxEntry[];
  } catch {
    return memoryFallback;
  }
}

async function put(entry: OutboxEntry) {
  try {
    const d = await db();
    if (!d) {
      memoryFallback = [...memoryFallback.filter((e) => e.id !== entry.id), entry];
      return;
    }
    await d.put(STORE, entry);
  } catch {
    memoryFallback = [...memoryFallback.filter((e) => e.id !== entry.id), entry];
  }
}

async function remove(id: string) {
  try {
    const d = await db();
    if (!d) {
      memoryFallback = memoryFallback.filter((e) => e.id !== id);
      return;
    }
    await d.delete(STORE, id);
  } catch {
    memoryFallback = memoryFallback.filter((e) => e.id !== id);
  }
}

async function emit() {
  const all = await readAll();
  listeners.forEach((l) => {
    try {
      l(all.length);
    } catch {
      /* noop */
    }
  });
}

export function subscribeOutbox(listener: Listener) {
  listeners.add(listener);
  void emit();
  return () => listeners.delete(listener);
}

export async function pendingCount() {
  return (await readAll()).length;
}

async function execute(op: OutboxOp): Promise<{ ok: boolean; retryable: boolean }> {
  try {
    const table = supabase.from(op.table as never);
    let error: { message: string } | null = null;
    if (op.kind === "update") {
      let q = (table as never as { update: (v: unknown) => never }).update(op.values) as never as {
        eq: (c: string, v: unknown) => unknown;
      };
      for (const [col, val] of Object.entries(op.match)) {
        q = (q as { eq: (c: string, v: unknown) => never }).eq(col, val);
      }
      ({ error } = (await (q as unknown as Promise<{ error: { message: string } | null }>)) ?? { error: null });
    } else if (op.kind === "insert") {
      ({ error } = await (table as never as { insert: (v: unknown) => Promise<{ error: { message: string } | null }> }).insert(op.values));
    } else {
      ({ error } = await (
        table as never as { upsert: (v: unknown, o?: unknown) => Promise<{ error: { message: string } | null }> }
      ).upsert(op.values, op.onConflict ? { onConflict: op.onConflict } : undefined));
    }
    if (error) {
      // Erreur renvoyée par le serveur : inutile de rejouer en boucle rapide,
      // mais on garde quelques tentatives (jetons expirés, verrous, etc.).
      console.warn("[outbox] server error", op.table, error.message);
      return { ok: false, retryable: true };
    }
    return { ok: true, retryable: false };
  } catch (err) {
    // Erreur réseau : rejouer.
    console.warn("[outbox] network error", op.table, err);
    return { ok: false, retryable: true };
  }
}

async function processQueue() {
  if (running) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  running = true;
  try {
    const all = (await readAll()).sort((a, b) => a.createdAt - b.createdAt);
    if (all.length === 0) return;
    let minDelay = Infinity;
    for (const entry of all) {
      const wait = BACKOFF_MS[Math.min(entry.attempts, BACKOFF_MS.length - 1)];
      const nextAt = entry.createdAt + (entry.attempts === 0 ? 0 : wait);
      if (Date.now() < nextAt) {
        minDelay = Math.min(minDelay, nextAt - Date.now());
        continue;
      }
      const res = await execute(entry);
      if (res.ok || entry.attempts + 1 >= MAX_ATTEMPTS) {
        await remove(entry.id);
      } else {
        entry.attempts += 1;
        entry.createdAt = Date.now();
        await put(entry);
        minDelay = Math.min(minDelay, BACKOFF_MS[Math.min(entry.attempts, BACKOFF_MS.length - 1)]);
      }
    }
    await emit();
    if (retryTimer) clearTimeout(retryTimer);
    if ((await readAll()).length > 0 && Number.isFinite(minDelay)) {
      retryTimer = setTimeout(() => {
        void processQueue();
      }, Math.max(1000, minDelay));
    }
  } finally {
    running = false;
  }
}

export function kickOutbox() {
  void processQueue();
}

async function enqueue(op: OutboxOp, label?: string) {
  const entry: OutboxEntry = {
    ...op,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
    attempts: 0,
    label,
  };
  await put(entry);
  await emit();
  void processQueue();
}

/**
 * Exécute l'opération immédiatement si le réseau répond, sinon la met en file.
 * Renvoie `{ queued: true }` quand l'écriture est différée (l'UI peut rester optimiste).
 */
export async function writeWithOutbox(op: OutboxOp, label?: string): Promise<{ queued: boolean }> {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (offline) {
    await enqueue(op, label);
    return { queued: true };
  }
  try {
    const res = await execute(op);
    if (res.ok) return { queued: false };
    await enqueue(op, label);
    return { queued: true };
  } catch {
    await enqueue(op, label);
    return { queued: true };
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void processQueue());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void processQueue();
  });
  setTimeout(() => void processQueue(), 2000);
}
