import { api, ApiError, Condition } from "./api";

// Everything a phone records goes into this queue first (IndexedDB), then is sent when there is a connection.
// Each record has an id made on the phone, so sending it twice never creates two rows on the server.
export interface QueuedScan {
  id: string;
  tagNumber: string;
  condition: Condition;
  notes: string;
  room: string;
  scannedAt: string;
  photo?: Blob;
  photoId?: string;
  error?: string;
}

const DB = "tallytag";
const STORE = "queue";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const enqueue = (s: QueuedScan) => run("readwrite", (st) => st.put(s));
export const listQueue = () => run<QueuedScan[]>("readonly", (st) => st.getAll());
export const removeFromQueue = (id: string) => run("readwrite", (st) => st.delete(id));

export type SyncResult = { sent: number; failed: number; offline: boolean; unauthorized: boolean };

let syncing = false;

export async function syncQueue(token: string): Promise<SyncResult> {
  const result: SyncResult = { sent: 0, failed: 0, offline: false, unauthorized: false };
  if (syncing) return result;
  syncing = true;
  try {
    const all = (await listQueue()).filter((q) => !q.error);
    for (let i = 0; i < all.length; i += 50) {
      const chunk = all.slice(i, i + 50);
      // Photos first, so the scan can point at them.
      for (const q of chunk) {
        if (q.photo && q.photoId) {
          await api(`/photos?id=${q.photoId}`, { method: "POST", token, raw: q.photo, contentType: q.photo.type || "image/jpeg" });
        }
      }
      const res = await api<{ results: { id: string; result: string; error?: string }[] }>("/scans/batch", {
        token,
        body: {
          scans: chunk.map((q) => ({
            id: q.id,
            tagNumber: q.tagNumber,
            condition: q.condition,
            notes: q.notes,
            room: q.room,
            scannedAt: q.scannedAt,
            photoId: q.photoId,
          })),
        },
      });
      for (const r of res.results) {
        if (r.result === "error") {
          const q = chunk.find((c) => c.id === r.id);
          if (q) await enqueue({ ...q, error: r.error || "generic" });
          result.failed++;
        } else {
          await removeFromQueue(r.id);
          result.sent++;
        }
      }
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) result.offline = true;
    else if (e instanceof ApiError && e.status === 401) result.unauthorized = true;
    else result.offline = true; // anything unexpected: keep the data and try again later
  } finally {
    syncing = false;
  }
  return result;
}

// Shrinks a camera photo to about 1280 px so it is quick to send on a weak connection.
export async function compressImage(file: File, maxSide = 1280, quality = 0.8): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    return blob || file;
  } catch {
    return file;
  }
}
