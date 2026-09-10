"use client";

import { useRef, useState } from "react";
import { currentFormat, useEditor } from "../../store";
import {
  copyBlobToClipboard,
  downloadBlob,
  extensionFor,
  maxExportSize,
  renderImage,
  type ImageExportOptions,
} from "../../lib/export";
import {
  FPS_CHOICES,
  MAX_VIDEO_SECONDS,
  isFormatSupported,
  suggestedLoopDuration,
  videoExtension,
  videoSize,
  type VideoFormat,
  type VideoQuality,
} from "../../lib/video";
import {
  exportImageSet,
  exportVideoSet,
  resolveFormat,
  zipFiles,
  type BatchProgress,
  type ExportFile,
  type Framing,
} from "../../lib/batch";
import { CANVAS_FORMATS, DEFAULT_EXPORT_SET, FORMAT_GROUPS } from "../../presets/scene";
import { Button, Row, Section, SelectField, Slider, Toggle } from "../ui";

const SCALES = [
  { value: "0.5", label: "0.5×" },
  { value: "1", label: "1×" },
  { value: "2", label: "2×" },
  { value: "3", label: "3×" },
  { value: "4", label: "4×" },
];

const FRAMINGS = [
  { value: "fit" as const, label: "Refit the scene" },
  { value: "keep" as const, label: "Keep the camera" },
];

export function ExportPanel() {
  const [mode, setMode] = useState<"image" | "video">("image");
  return (
    <>
      <div className="flex gap-1 border-b border-white/5 p-2">
        {(["image", "video"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition ${
              mode === m ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-white/10 text-neutral-300 hover:bg-white/15"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      {mode === "image" ? <ImageExport /> : <VideoExport />}
    </>
  );
}

/** Shared multi-format picker: which shapes this render should be produced in. */
function FormatPicker({
  selected,
  onToggle,
  framing,
  onFraming,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  framing: Framing;
  onFraming: (f: Framing) => void;
}) {
  const activeId = useEditor((s) => s.project.formatId);
  return (
    <Section title={`Formats · ${selected.length}`}>
      {FORMAT_GROUPS.map((group) => (
        <div key={group} className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-neutral-600">{group}</span>
          <div className="flex flex-wrap gap-1">
            {CANVAS_FORMATS.filter((f) => f.group === group).map((f) => {
              const on = selected.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onToggle(f.id)}
                  title={`${f.width} × ${f.height}`}
                  className={`rounded-full px-2 py-0.5 text-[11px] transition ${
                    on ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-white/10 text-neutral-300 hover:bg-white/15"
                  } ${f.id === activeId && !on ? "ring-1 ring-white/30" : ""}`}
                >
                  {f.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {selected.length > 1 && (
        <>
          <SelectField label="Framing" value={framing} options={FRAMINGS} onChange={onFraming} />
          <p className="text-[11px] leading-relaxed text-neutral-500">
            {framing === "fit"
              ? "The camera pulls back per format so nothing is cut off. Best for one idea across several shapes."
              : "The camera stays exactly where it is, so wider formats reveal more and taller ones show less."}
          </p>
        </>
      )}
    </Section>
  );
}

function useFormatSelection() {
  const activeId = useEditor((s) => s.project.formatId);
  const [selected, setSelected] = useState<string[]>(
    DEFAULT_EXPORT_SET.includes(activeId) ? DEFAULT_EXPORT_SET : [activeId],
  );
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  return { selected, toggle };
}

async function deliver(files: ExportFile[], zipName: string): Promise<string> {
  if (files.length === 0) throw new Error("Nothing was rendered");
  if (files.length === 1) {
    downloadBlob(files[0].blob, files[0].name);
    return `Saved ${files[0].name}`;
  }
  const zip = await zipFiles(files);
  downloadBlob(zip, zipName);
  return `Saved ${files.length} files in ${zipName}`;
}

function ImageExport() {
  const project = useEditor((s) => s.project);
  const format = currentFormat(project);
  const { selected, toggle } = useFormatSelection();
  const [framing, setFraming] = useState<Framing>("fit");
  const [scale, setScale] = useState("2");
  const [type, setType] = useState<ImageExportOptions["type"]>("image/png");
  const [quality, setQuality] = useState(0.92);
  const [transparent, setTransparent] = useState(project.staging.transparent);
  const [busy, setBusy] = useState<null | "download" | "copy">(null);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const limit = maxExportSize();
  const biggest = selected
    .map((id) => resolveFormat(project, id))
    .filter((f): f is NonNullable<typeof f> => f !== null)
    .reduce((max, f) => Math.max(max, f.width, f.height) * parseFloat(scale), 0);
  const tooBig = biggest > limit;

  const run = async () => {
    setBusy("download");
    setMessage(null);
    try {
      const files = await exportImageSet(
        project,
        selected,
        {
          type,
          quality,
          transparent,
          scale: parseFloat(scale),
          framing,
          extension: extensionFor(type),
        },
        setProgress,
      );
      setMessage(await deliver(files, `${project.name.replace(/[^\w-]+/g, "_") || "export"}_images.zip`));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const copy = async () => {
    setBusy("copy");
    setMessage(null);
    try {
      const width = Math.round(format.width * parseFloat(scale));
      const height = Math.round(format.height * parseFloat(scale));
      const blob = await renderImage({ width, height, type, quality, transparent });
      await copyBlobToClipboard(blob);
      setMessage("Copied the current format to the clipboard.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Copy failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <FormatPicker selected={selected} onToggle={toggle} framing={framing} onFraming={setFraming} />
      <Section title="Image export">
        <SelectField label="Scale" value={scale} options={SCALES} onChange={setScale} />
        <Row label="Largest">
          <span className={`text-xs ${tooBig ? "text-red-300" : "text-neutral-300"}`}>
            {Math.round(biggest)} px{tooBig ? ` (max ${limit})` : ""}
          </span>
        </Row>
        <SelectField
          label="Format"
          value={type}
          options={[
            { value: "image/png", label: "PNG" },
            { value: "image/jpeg", label: "JPEG" },
            { value: "image/webp", label: "WebP" },
          ]}
          onChange={setType}
        />
        {type !== "image/png" && (
          <Slider label="Quality" value={quality} min={0.1} max={1} step={0.01} onChange={setQuality} />
        )}
        <Toggle label="Transparent" value={transparent} onChange={setTransparent} />
        {transparent && type === "image/jpeg" && (
          <p className="text-[11px] text-amber-300/90">JPEG has no alpha channel. Use PNG or WebP for transparency.</p>
        )}
        <div className="mt-1 flex gap-2">
          <Button
            variant="primary"
            disabled={busy !== null || tooBig || selected.length === 0}
            onClick={run}
            className="flex-1"
          >
            {busy === "download"
              ? progress
                ? `${progress.formatName} ${progress.index + 1}/${progress.total}`
                : "Rendering…"
              : selected.length > 1
                ? `Download ${selected.length} formats`
                : "Download"}
          </Button>
          <Button variant="default" disabled={busy !== null || tooBig} onClick={copy}>
            Copy
          </Button>
        </div>
        {message && <p className="text-[11px] text-neutral-400">{message}</p>}
      </Section>
    </>
  );
}

function VideoExport() {
  const project = useEditor((s) => s.project);
  const loop = suggestedLoopDuration(project);
  const { selected, toggle } = useFormatSelection();
  const [framing, setFraming] = useState<Framing>("fit");
  const [duration, setDuration] = useState(loop?.duration ?? 4);
  const [fps, setFps] = useState(30);
  const [videoFormat, setVideoFormat] = useState<VideoFormat>("mp4");
  const [quality, setQuality] = useState<VideoQuality>("high");
  const [scale, setScale] = useState("1");
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const frames = Math.round(duration * fps);

  const run = async () => {
    setRunning(true);
    setMessage(null);
    abort.current = new AbortController();
    try {
      for (const id of selected) {
        const format = resolveFormat(project, id);
        if (!format) continue;
        const target = videoSize(format.width * parseFloat(scale), format.height * parseFloat(scale));
        if (!(await isFormatSupported(videoFormat, target.width, target.height))) {
          throw new Error(
            `This browser cannot encode ${videoFormat.toUpperCase()} at ${target.width}×${target.height}. Try the other format or a smaller scale.`,
          );
        }
      }
      const files = await exportVideoSet(
        project,
        selected,
        {
          duration,
          fps,
          format: videoFormat,
          quality,
          scale: parseFloat(scale),
          framing,
          extension: videoExtension(videoFormat),
        },
        setProgress,
        abort.current.signal,
      );
      setMessage(await deliver(files, `${project.name.replace(/[^\w-]+/g, "_") || "export"}_videos.zip`));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") setMessage("Export cancelled");
      else setMessage(e instanceof Error ? e.message : "Video export failed");
    } finally {
      setRunning(false);
      setProgress(null);
      abort.current = null;
    }
  };

  const overall = progress ? (progress.index + progress.inner) / progress.total : 0;

  return (
    <>
      <FormatPicker selected={selected} onToggle={toggle} framing={framing} onFraming={setFraming} />
      <Section title="Video export">
        <SelectField label="Scale" value={scale} options={SCALES.slice(0, 3)} onChange={setScale} />
        <Row label="Frames">
          <span className="text-xs text-neutral-300">
            {frames} per format · {selected.length} format{selected.length === 1 ? "" : "s"}
          </span>
        </Row>
        <Slider
          label="Duration"
          value={duration}
          min={0.5}
          max={MAX_VIDEO_SECONDS}
          step={0.1}
          format={(v) => `${v.toFixed(1)}s`}
          onChange={setDuration}
        />
        <SelectField
          label="Frame rate"
          value={String(fps)}
          options={FPS_CHOICES.map((f) => ({ value: String(f), label: `${f} fps` }))}
          onChange={(v) => setFps(parseInt(v, 10))}
        />
        <SelectField
          label="Codec"
          value={videoFormat}
          options={[
            { value: "mp4", label: "MP4 (H.264)" },
            { value: "webm", label: "WebM (VP9)" },
          ]}
          onChange={setVideoFormat}
        />
        <SelectField
          label="Quality"
          value={quality}
          options={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "very-high", label: "Very high" },
          ]}
          onChange={setQuality}
        />

        {loop !== null && Math.abs(loop.duration - duration) > 0.05 && (
          <button
            type="button"
            onClick={() => setDuration(loop.duration)}
            className="rounded-md bg-white/5 px-2 py-1.5 text-left text-[11px] leading-relaxed text-neutral-400 hover:bg-white/10 hover:text-neutral-200"
          >
            {loop.exact
              ? `Set ${loop.duration.toFixed(2)}s to close every cycle and loop without a seam.`
              : `Set ${loop.duration.toFixed(2)}s. The speeds in this scene do not share a common cycle, so the loop will jump slightly. Round them to matching values to fix it.`}
          </button>
        )}
        {loop === null && (
          <p className="text-[11px] leading-relaxed text-neutral-500">
            Nothing in the scene is moving yet. Give an object a motion in the Object tab, or an effect a speed, and
            the clip will have something to show.
          </p>
        )}

        <div className="mt-1 flex gap-2">
          <Button variant="primary" disabled={running || selected.length === 0} onClick={run} className="flex-1">
            {running
              ? progress
                ? `${progress.formatName} ${progress.index + 1}/${progress.total} · ${Math.round(progress.inner * 100)}%`
                : "Rendering…"
              : selected.length > 1
                ? `Render ${selected.length} videos`
                : "Render video"}
          </Button>
          {running && (
            <Button variant="default" onClick={() => abort.current?.abort()}>
              Cancel
            </Button>
          )}
        </div>
        {running && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-white transition-[width] duration-150"
              style={{ width: `${Math.round(overall * 100)}%` }}
            />
          </div>
        )}
        {message && <p className="text-[11px] text-neutral-400">{message}</p>}
      </Section>
    </>
  );
}
