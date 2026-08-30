/**
 * GALLERY STORAGE — IndexedDB, on-device only. Nothing ever leaves the phone
 * unless the user taps Share.
 */

import type { CameraId } from "../cameras/profiles";

export interface Shot {
  id: string;
  cameraId: CameraId;
  createdAt: number;
  /** Rendered, framed image (the artefact the camera produced). */
  blob: Blob;
  /** Unprocessed sensor frame, only when "save original" is on. */
  original?: Blob;
  width: number;
  height: number;
}

const DB_NAME = "vintage-camera";
const STORE = "shots";
let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("createdAt", "createdAt");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

export async function saveShot(shot: Shot): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(shot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listShots(): Promise<Shot[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as Shot[]) ?? [];
      rows.sort((a, b) => b.createdAt - a.createdAt);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteShot(id: string): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function shotFilename(shot: Pick<Shot, "cameraId" | "createdAt">) {
  const d = new Date(shot.createdAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${shot.cameraId}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}.jpg`;
}

/** Save to the device photo library / downloads, with graceful fallback. */
export async function exportShot(blob: Blob, filename: string): Promise<"saved" | "downloaded"> {
  const w = window as unknown as {
    Capacitor?: { Plugins?: { Media?: { savePhoto(o: { path: string }): Promise<void> } } };
  };
  const media = w.Capacitor?.Plugins?.Media;
  if (media) {
    const dataUrl = await blobToDataUrl(blob);
    await media.savePhoto({ path: dataUrl });
    return "saved";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}

export async function shareShot(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Shot on Vintage Camera" });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}
