"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "../../store";
import {
  OBJECT_COLLECTIONS,
  OBJECT_PRESETS,
  defaultParams,
  type ObjectPreset,
} from "../../presets/objects";
import { thumbnailFor } from "../../lib/thumbnails";
import {
  MAX_MODEL_BYTES,
  MODEL_EXTENSIONS,
  deleteAsset,
  formatBytes,
  listAssets,
  putAsset,
  type AssetMeta,
} from "../../lib/assets";
import { forgetModel } from "../../lib/model";
import { Button } from "../ui";

const IMPORTED = "Imported";

export function ObjectLibrary({ onClose }: { onClose: () => void }) {
  const addModel = useEditor((s) => s.addModel);
  const [collection, setCollection] = useState(OBJECT_COLLECTIONS[0]);
  const [assets, setAssets] = useState<AssetMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshAssets = () => {
    listAssets("model")
      .then(setAssets)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not read your model library"));
  };

  useEffect(refreshAssets, []);

  const presets = useMemo(
    () => OBJECT_PRESETS.filter((p) => p.collection === collection),
    [collection],
  );

  // Thumbnails are cached across opens, so this only costs on a collection's first view.
  const thumbs = useMemo(() => presets.map((p) => thumbnailFor(p)), [presets]);

  const importFiles = async (files: FileList) => {
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const ext = (file.name.split(".").pop() ?? "").toLowerCase();
        if (!MODEL_EXTENSIONS.includes(ext)) {
          throw new Error(`${file.name}: only ${MODEL_EXTENSIONS.join(", ")} files are supported`);
        }
        if (file.size > MAX_MODEL_BYTES) {
          throw new Error(`${file.name} is ${formatBytes(file.size)}, over the ${formatBytes(MAX_MODEL_BYTES)} limit`);
        }
        if (ext === "gltf") {
          // A .gltf alone points at files it does not carry; only the binary form is self-contained.
          throw new Error(`${file.name}: a .gltf refers to separate .bin and texture files. Export it as one .glb instead.`);
        }
        const meta = await putAsset(file, "model");
        addModel({ type: "asset", assetId: meta.id }, meta.name);
      }
      refreshAssets();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const addPreset = (preset: ObjectPreset) => {
    addModel({ type: "procedural", presetId: preset.id, params: defaultParams(preset) }, preset.name);
    onClose();
  };

  return (
    <div className="flex h-[420px] w-[430px] flex-col overflow-hidden rounded-lg border border-white/10 bg-neutral-900 shadow-2xl">
      <div className="flex flex-wrap gap-1 border-b border-white/5 p-2">
        {[...OBJECT_COLLECTIONS, IMPORTED].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCollection(c)}
            className={`rounded-full px-2.5 py-1 text-[11px] transition ${
              collection === c ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-white/10 text-neutral-300 hover:bg-white/15"
            }`}
          >
            {c}
            {c === IMPORTED && assets.length > 0 ? ` ${assets.length}` : ""}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {collection === IMPORTED ? (
          <ImportedGrid
            assets={assets}
            onAdd={(a) => {
              addModel({ type: "asset", assetId: a.id }, a.name);
              onClose();
            }}
            onDelete={async (a) => {
              await deleteAsset(a.id);
              forgetModel(a.id);
              refreshAssets();
            }}
          />
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {presets.map((preset, i) => (
              <button
                key={preset.id}
                type="button"
                title={preset.name}
                onClick={() => addPreset(preset)}
                className="group flex flex-col items-center gap-1 rounded-md p-1 hover:bg-white/10"
              >
                <span className="grid aspect-square w-full place-items-center overflow-hidden rounded-md bg-white/5 ring-1 ring-white/5">
                  {thumbs[i] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbs[i]} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-neutral-600">n/a</span>
                  )}
                </span>
                <span className="w-full truncate text-center text-[10px] text-neutral-400 group-hover:text-neutral-200">
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-white/5 p-2">
        <Button variant="default" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? "Importing…" : "Import GLB, FBX or OBJ…"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={MODEL_EXTENSIONS.map((e) => `.${e}`).join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void importFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <span className={`flex-1 text-[11px] ${error ? "text-red-300" : "truncate text-neutral-500"}`} title={error ?? undefined}>
          {error ?? `${OBJECT_PRESETS.length} objects in ${OBJECT_COLLECTIONS.length} collections, or drop files on the viewport`}
        </span>
      </div>
    </div>
  );
}

function ImportedGrid({
  assets,
  onAdd,
  onDelete,
}: {
  assets: AssetMeta[];
  onAdd: (a: AssetMeta) => void;
  onDelete: (a: AssetMeta) => void;
}) {
  if (assets.length === 0) {
    return (
      <p className="p-4 text-center text-[11px] leading-relaxed text-neutral-500">
        No imported models yet.
        <br />
        Bring in a GLB, FBX or OBJ file and it stays in this browser&apos;s library.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {assets.map((a) => (
        <li
          key={a.id}
          className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-neutral-300 hover:bg-white/5"
        >
          <button type="button" onClick={() => onAdd(a)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-neutral-400">{a.format}</span>
            <span className="truncate">{a.name}</span>
            <span className="shrink-0 text-[10px] text-neutral-600">{formatBytes(a.size)}</span>
          </button>
          <button
            type="button"
            title="Delete from library"
            onClick={() => onDelete(a)}
            className="rounded px-1 text-neutral-500 opacity-0 hover:bg-white/10 hover:text-red-300 group-hover:opacity-100"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
