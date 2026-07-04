/**
 * File d'upload persistante pour les photos d'état des lieux.
 *
 * - Écrit chaque photo dans IndexedDB avant l'upload.
 * - Réessaie automatiquement (backoff exponentiel) tant que la ligne existe.
 * - Reprend au retour d'internet ou au retour d'onglet (visibilitychange).
 * - Purge dès que l'`upsert` Supabase a réussi.
 *
 * Aucune modification du schéma serveur : on utilise le même `upsert`
 * `inspection_photos(inspection_id, vue_type)` que le code existant.
 * En cas d'échec IndexedDB, on retombe silencieusement sur un upload direct.
 */
import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "ligneo-edl-queue";
const STORE = "pending";
const VERSION = 1;

export type QueueEntry = {
  key: string; // `${inspectionId}:${vueType}`
  inspectionId: string;
  vueType: string;
  path: string;
  blob: Blob;
  contentType: string;
  createdAt: number;
  attempts: number;
  captureId: string;
};

type Listener = (key: string, state: "sent" | "failed" | "pending") => void;

const listeners = new Set<Listener>();
let dbPromise: Promise<IDBPDatabase> | null = null;
let running = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const BACKOFF_MS = [1000, 3000, 10_000, 30_000, 120_000];

function db() {
  if (typeof indexedDB === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE, { keyPath: "key" });
        }
      },
    }).catch((err) => {
      console.warn("[edl-queue] openDB failed", err);
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export function subscribeQueue(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function emit(key: string, state: "sent" | "failed" | "pending") {
  listeners.forEach((l) => {
    try { l(key, state); } catch { /* noop */ }
  });
}

export async function pendingKeysForInspection(inspectionId: string): Promise<string[]> {
  try {
    const d = await db();
    if (!d) return [];
    const all = (await d.getAll(STORE)) as QueueEntry[];
    return all.filter((e) => e.inspectionId === inspectionId).map((e) => e.key);
  } catch { return []; }
}

async function tryUpload(entry: QueueEntry): Promise<boolean> {
  try {
    const { error: upErr } = await supabase.storage
      .from("inspection-photos")
      .upload(entry.path, entry.blob, { upsert: true, contentType: entry.contentType });
    if (upErr) throw upErr;
    const { error: dbErr } = await supabase.from("inspection_photos").upsert(
      { inspection_id: entry.inspectionId, vue_type: entry.vueType, url_photo: entry.path },
      { onConflict: "inspection_id,vue_type" },
    );
    if (dbErr) throw dbErr;
    return true;
  } catch (err) {
    console.warn("[edl-queue] upload failed", entry.key, err);
    return false;
  }
}

async function processQueue() {
  if (running) return;
  running = true;
  try {
    const d = await db();
    if (!d) return;
    while (true) {
      const all = (await d.getAll(STORE)) as QueueEntry[];
      if (all.length === 0) return;
      let sentAny = false;
      let minDelay = Infinity;
      for (const entry of all) {
        const wait = BACKOFF_MS[Math.min(entry.attempts, BACKOFF_MS.length - 1)];
        const nextAt = entry.createdAt + (entry.attempts === 0 ? 0 : wait);
        if (Date.now() < nextAt) {
          minDelay = Math.min(minDelay, nextAt - Date.now());
          continue;
        }
        const ok = await tryUpload(entry);
        if (ok) {
          await d.delete(STORE, entry.key);
          emit(entry.key, "sent");
          sentAny = true;
        } else {
          entry.attempts += 1;
          entry.createdAt = Date.now();
          await d.put(STORE, entry);
          emit(entry.key, "failed");
          const nextWait = BACKOFF_MS[Math.min(entry.attempts, BACKOFF_MS.length - 1)];
          minDelay = Math.min(minDelay, nextWait);
        }
      }
      if (!sentAny) {
        if (retryTimer) clearTimeout(retryTimer);
        if (Number.isFinite(minDelay)) {
          retryTimer = setTimeout(() => { void processQueue(); }, Math.max(500, minDelay));
        }
        return;
      }
    }
  } finally {
    running = false;
  }
}

export async function enqueueUpload(input: Omit<QueueEntry, "createdAt" | "attempts">): Promise<void> {
  const entry: QueueEntry = { ...input, createdAt: Date.now(), attempts: 0 };
  try {
    const d = await db();
    if (!d) {
      // Fallback : upload direct sans persistance.
      const ok = await tryUpload(entry);
      emit(entry.key, ok ? "sent" : "failed");
      return;
    }
    await d.put(STORE, entry);
    emit(entry.key, "pending");
    void processQueue();
  } catch (err) {
    console.warn("[edl-queue] enqueue failed", err);
    const ok = await tryUpload(entry);
    emit(entry.key, ok ? "sent" : "failed");
  }
}

export function kickQueue() { void processQueue(); }

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { void processQueue(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void processQueue();
  });
  // Rejoue une éventuelle file en attente au chargement de la page.
  setTimeout(() => { void processQueue(); }, 1500);
}
