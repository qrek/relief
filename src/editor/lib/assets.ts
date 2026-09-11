export type AssetKind = "model" | "media" | "template" | "font" | "hdri";

export type StoredAsset = {
  id: string;
  kind: AssetKind;
  name: string;
  /** File extension without the dot: glb, gltf, fbx, obj, png, mp4… */
  format: string;
  mime: string;
  size: number;
  createdAt: number;
  blob: Blob;
  /**
   * JSON payload for entries that carry data rather than a file, such as
   * templates; for a font fetched from Google, the font id it was fetched for.
   */
  data?: string;
};

export type AssetMeta = Omit<StoredAsset, "blob">;

const DB_NAME = "relief";
const LEGACY_DB_NAME = "endlessmechant";
const DB_VERSION = 1;
const STORE = "assets";

let dbPromise: Promise<IDBDatabase> | null = null;

function open(name: string, createStore: boolean): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (createStore && !db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("kind", "kind");
        store.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"));
  });
}

/** Carries a library over from the database this app used before it was renamed. */
async function adoptLegacyLibrary(db: IDBDatabase) {
  try {
    const legacy = await open(LEGACY_DB_NAME, false);
    if (!legacy.objectStoreNames.contains(STORE)) {
      legacy.close();
      return;
    }
    const rows = await new Promise<StoredAsset[]>((resolve, reject) => {
      const req = legacy.transaction(STORE, "readonly").objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as StoredAsset[]);
      req.onerror = () => reject(req.error);
    });
    if (rows.length > 0) {
      const write = db.transaction(STORE, "readwrite").objectStore(STORE);
      for (const row of rows) write.put(row);
    }
    legacy.close();
  } catch {
    // A missing or unreadable old database simply means there is nothing to adopt.
  }
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const db = await open(DB_NAME, true);
    const count = await new Promise<number>((resolve) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
    if (count === 0) await adoptLegacyLibrary(db);
    return db;
  })();
  return dbPromise;
}

export function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
      }),
  );
}

const newAssetId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `a${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

export async function putAsset(file: File, kind: AssetKind): Promise<AssetMeta> {
  const format = (file.name.split(".").pop() ?? "").toLowerCase();
  const asset: StoredAsset = {
    id: newAssetId(),
    kind,
    name: file.name.replace(/\.[^.]+$/, ""),
    format,
    mime: file.type,
    size: file.size,
    createdAt: Date.now(),
    blob: file.slice(0, file.size, file.type),
  };
  await tx("readwrite", (s) => s.put(asset));
  const { blob: _blob, ...meta } = asset;
  void _blob;
  return meta;
}

export async function getAsset(id: string): Promise<StoredAsset | undefined> {
  return tx<StoredAsset | undefined>("readonly", (s) => s.get(id));
}

export async function listAssets(kind?: AssetKind): Promise<AssetMeta[]> {
  const all = await tx<StoredAsset[]>("readonly", (s) => s.getAll());
  return all
    .filter((a) => !kind || a.kind === kind)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(({ blob: _blob, ...meta }) => {
      void _blob;
      return meta;
    });
}

export async function deleteAsset(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
  const url = objectUrls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrls.delete(id);
  }
}

export async function assetUsage(): Promise<{ count: number; bytes: number }> {
  const all = await tx<StoredAsset[]>("readonly", (s) => s.getAll());
  return { count: all.length, bytes: all.reduce((sum, a) => sum + a.size, 0) };
}

const objectUrls = new Map<string, string>();

/** Object URL for an asset, cached so the same blob is not re-registered. */
export async function assetUrl(id: string): Promise<string> {
  const cached = objectUrls.get(id);
  if (cached) return cached;
  const asset = await getAsset(id);
  if (!asset) throw new Error("Asset not found");
  const url = URL.createObjectURL(asset.blob);
  objectUrls.set(id, url);
  return url;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MODEL_EXTENSIONS = ["glb", "gltf", "fbx", "obj"];
export const MAX_MODEL_BYTES = 60 * 1024 * 1024;

/** Stores a saved scene plus its preview image as one library entry. */
export async function putTemplate(name: string, json: string, preview: Blob): Promise<AssetMeta> {
  const asset: StoredAsset = {
    id: newAssetId(),
    kind: "template",
    name,
    format: "json",
    mime: "application/json",
    size: json.length + preview.size,
    createdAt: Date.now(),
    blob: preview,
    data: json,
  };
  await tx("readwrite", (s) => s.put(asset));
  const { blob: _blob, ...meta } = asset;
  void _blob;
  return meta;
}

export async function getTemplateData(id: string): Promise<string | null> {
  const asset = await getAsset(id);
  return asset?.data ?? null;
}
