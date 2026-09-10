"use client";

import { useEffect, useRef, useState } from "react";
import { currentFormat, useEditor } from "../../store";
import {
  assetUrl,
  deleteAsset,
  formatBytes,
  listAssets,
  putAsset,
  type AssetMeta,
} from "../../lib/assets";
import {
  MAX_MEDIA_BYTES,
  MEDIA_EXTENSIONS,
  forgetMedia,
  mediaTypeOf,
  storeCapture,
} from "../../lib/media";
import { renderImage } from "../../lib/export";
import { Button } from "../ui";

type Entry = AssetMeta & { url: string };

/**
 * Picks the media a cover shows. Everything uploaded or captured lands here and
 * stays in this browser's library.
 */
export function MediaLibrary({
  onPick,
  onClose,
}: {
  onPick: (asset: AssetMeta) => void;
  onClose: () => void;
}) {
  const project = useEditor((s) => s.project);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    listAssets("media")
      .then(async (metas) =>
        Promise.all(metas.map(async (m) => ({ ...m, url: await assetUrl(m.id) }))),
      )
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not read your media library"));
  };

  useEffect(refresh, []);

  const importFiles = async (files: FileList) => {
    setBusy("import");
    setError(null);
    try {
      let last: AssetMeta | null = null;
      for (const file of Array.from(files)) {
        const ext = (file.name.split(".").pop() ?? "").toLowerCase();
        if (!mediaTypeOf(ext)) {
          throw new Error(`${file.name}: only ${MEDIA_EXTENSIONS.join(", ")} files are supported`);
        }
        if (file.size > MAX_MEDIA_BYTES) {
          throw new Error(
            `${file.name} is ${formatBytes(file.size)}, over the ${formatBytes(MAX_MEDIA_BYTES)} limit`,
          );
        }
        last = await putAsset(file, "media");
      }
      refresh();
      if (last) onPick(last);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(null);
    }
  };

  const capture = async () => {
    setBusy("capture");
    setError(null);
    try {
      const format = currentFormat(project);
      const blob = await renderImage({
        width: format.width,
        height: format.height,
        type: "image/png",
        quality: 1,
        transparent: true,
        excludeCovers: true,
      });
      const meta = await storeCapture(blob, `Capture ${new Date().toLocaleTimeString()}`);
      refresh();
      onPick(meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Capture failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex h-[420px] w-[430px] flex-col overflow-hidden rounded-lg border border-white/10 bg-neutral-900 shadow-2xl">
      <div className="flex items-center gap-2 border-b border-white/5 p-2">
        <Button variant="default" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
          {busy === "import" ? "Importing…" : "Upload media"}
        </Button>
        <Button variant="default" onClick={capture} disabled={busy !== null}>
          {busy === "capture" ? "Capturing…" : "Capture canvas"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={MEDIA_EXTENSIONS.map((e) => `.${e}`).join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void importFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {entries.length === 0 ? (
          <p className="p-6 text-center text-[11px] leading-relaxed text-neutral-500">
            No media yet.
            <br />
            Upload an image or a video, or capture the current canvas and put effects on it.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {entries.map((entry) => (
              <div key={entry.id} className="group relative">
                <button
                  type="button"
                  title={entry.name}
                  onClick={() => {
                    onPick(entry);
                    onClose();
                  }}
                  className="flex w-full flex-col gap-1 rounded-md p-1 hover:bg-white/10"
                >
                  <span className="grid aspect-square w-full place-items-center overflow-hidden rounded-md bg-black/40 ring-1 ring-white/5">
                    {mediaTypeOf(entry.format) === "video" ? (
                      <video src={entry.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.url} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="w-full truncate text-center text-[10px] text-neutral-400">{entry.name}</span>
                </button>
                <button
                  type="button"
                  title="Delete from library"
                  onClick={async () => {
                    await deleteAsset(entry.id);
                    forgetMedia(entry.id);
                    refresh();
                  }}
                  className="absolute right-1 top-1 rounded bg-black/70 px-1 text-neutral-400 opacity-0 hover:text-red-300 group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/5 px-2 py-1.5">
        <span className="text-[11px] text-neutral-500">
          {error ?? `${entries.length} item${entries.length === 1 ? "" : "s"} · images and video`}
        </span>
      </div>
    </div>
  );
}
