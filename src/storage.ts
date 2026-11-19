import type { ScreenshotProject } from './types';
import { createId } from './id';

const DB_NAME = 'vibe-screenshots-db';
const STORE = 'library';
export type ProjectEntry = { id: string; project: ScreenshotProject; persisted: boolean };
let pending: Promise<unknown> = Promise.resolve();

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other Vibe Screenshots windows and try again.'));
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = operation(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error ?? request.error);
      tx.onabort = () => reject(tx.error ?? new Error('Storage transaction aborted.'));
    });
  } finally {
    db.close();
  }
}

export async function loadLibrary(): Promise<ProjectEntry[]> {
  const db = await openDatabase();
  try {
    if (db.objectStoreNames.contains('projects')) {
      // Migrate the previous single-project save atomically. Never discard it on failure.
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['projects', STORE], 'readwrite');
        const old = tx.objectStore('projects');
        const request = old.get('current-project');
        request.onsuccess = () => {
          if (request.result) {
            tx.objectStore(STORE).put({ id: createId('project'), project: request.result, persisted: true });
            old.delete('current-project');
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    }
  } finally {
    db.close();
  }
  return transaction('readonly', (store) => store.getAll());
}

function enqueue(operation: () => Promise<unknown>) {
  const next = pending.catch(() => undefined).then(operation);
  pending = next;
  return next.then(() => undefined);
}
export function saveEntry(entry: ProjectEntry) {
  return enqueue(() => transaction('readwrite', (store) => store.put({ ...entry, persisted: true })));
}
export function deleteEntry(id: string) {
  return enqueue(() => transaction('readwrite', (store) => store.delete(id)));
}
export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(`vibe:${key}`);
  } catch {
    return null;
  }
}
export function writePreference(key: string, value: string) {
  try {
    localStorage.setItem(`vibe:${key}`, value);
  } catch {
    /* Preferences are optional. Project errors are reported separately. */
  }
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.replace(/[\\/:*?"<>|]/g, '-');
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
