"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FONTS } from "../../presets/fonts";
import {
  GOOGLE_FONTS,
  assetFontId,
  describeFont,
  fontSource,
  googleFontId,
  importFontFile,
  listImportedFonts,
  variantLabel,
  type GoogleFamily,
} from "../../lib/fonts";
import { deleteAsset, type AssetMeta } from "../../lib/assets";
import { Button, Row } from "../ui";

type Tab = "yours" | "google" | "bundled";

const GOOGLE_CATEGORIES = ["All", "Sans Serif", "Serif", "Display", "Handwriting", "Monospace"];
const PAGE = 60;
const PREVIEWED = 30;

/**
 * Picks a typeface from three places: the files the designer brought in, the
 * Google Fonts catalogue, and the handful bundled with the app. The first is
 * listed first because a brand's own type is the one that matters.
 */
export function FontPicker({ value, onChange }: { value: string; onChange: (fontId: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = describeFont(value);
  return (
    <Row label="Font">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded bg-white/5 px-2 py-1 text-left text-xs text-neutral-200 hover:bg-white/10"
      >
        <span className="truncate">{current.name}</span>
        <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wide text-neutral-500">{current.category}</span>
      </button>
      {open && <FontDialog value={value} onChange={onChange} onClose={() => setOpen(false)} />}
    </Row>
  );
}

function FontDialog({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (fontId: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(fontSource(value) === "bundled" ? "bundled" : fontSource(value) === "asset" ? "yours" : "google");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [imported, setImported] = useState<AssetMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    listImportedFonts().then(setImported).catch(() => setImported([]));
  };
  useEffect(refresh, []);

  const q = query.trim().toLowerCase();
  const googleResults = useMemo(() => {
    const list = GOOGLE_FONTS.filter(
      (f) => (category === "All" || f.category === category) && (!q || f.family.toLowerCase().includes(q)),
    );
    return list.slice(0, PAGE);
  }, [q, category]);

  const bundledResults = FONTS.filter((f) => !q || f.name.toLowerCase().includes(q));
  const importedResults = imported.filter((f) => !q || f.name.toLowerCase().includes(q));

  // Previews: Google serves the web version of each listed family, so the
  // names can be shown in their own face. Capped, since each one is a download.
  const previewHref = useMemo(() => {
    if (tab !== "google") return null;
    const families = googleResults.slice(0, PREVIEWED).map((f) => `family=${encodeURIComponent(f.family)}`);
    return families.length ? `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap` : null;
  }, [googleResults, tab]);

  useEffect(() => {
    if (!previewHref) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = previewHref;
    document.head.appendChild(link);
    return () => link.remove();
  }, [previewHref]);

  const pick = (id: string) => {
    onChange(id);
    onClose();
  };

  const importFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const meta = await importFontFile(file);
      refresh();
      pick(assetFontId(meta.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import that font");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full max-h-[620px] w-full max-w-[640px] flex-col overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-100">Fonts</h2>
          <div className="ml-2 flex gap-0.5 rounded-md bg-black/30 p-0.5">
            {(
              [
                ["yours", `Yours${imported.length ? ` · ${imported.length}` : ""}`],
                ["google", "Google Fonts"],
                ["bundled", "Built in"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                  tab === id ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-44 rounded bg-white/5 px-2 py-1 text-xs text-neutral-200 outline-none focus:ring-1 focus:ring-[var(--accent-edge)]"
          />
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        {tab === "google" && (
          <div className="flex flex-wrap gap-1 border-b border-white/5 px-4 py-2">
            {GOOGLE_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  category === c ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-white/10 text-neutral-300 hover:bg-white/15"
                }`}
              >
                {c}
              </button>
            ))}
            <span className="ml-auto self-center text-[10.5px] text-neutral-500">
              {GOOGLE_FONTS.length} families, most used first. Free to use and to export.
            </span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {tab === "yours" && (
            <>
              <div className="flex items-center gap-2 px-2 py-2">
                <Button variant="default" onClick={() => fileRef.current?.click()} disabled={busy}>
                  {busy ? "Importing…" : "Import a .ttf or .otf"}
                </Button>
                <span className="text-[11px] text-neutral-500">
                  A brand typeface stays in this browser, like an imported model. It never leaves your machine.
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".ttf,.otf,font/ttf,font/otf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importFile(file);
                    e.target.value = "";
                  }}
                />
              </div>
              {importedResults.length === 0 && (
                <p className="px-2 py-6 text-center text-[11px] text-neutral-500">
                  {imported.length === 0 ? "No imported fonts yet." : "No imported font matches."}
                </p>
              )}
              {importedResults.map((f) => (
                <FontRow
                  key={f.id}
                  name={f.name}
                  detail={`${f.format.toUpperCase()} · yours`}
                  active={value === assetFontId(f.id)}
                  onPick={() => pick(assetFontId(f.id))}
                  onDelete={async () => {
                    await deleteAsset(f.id);
                    refresh();
                  }}
                />
              ))}
            </>
          )}

          {tab === "google" && (
            <>
              {googleResults.map((f, i) => (
                <GoogleRow key={f.family} font={f} preview={i < PREVIEWED} value={value} onPick={pick} />
              ))}
              {googleResults.length === PAGE && (
                <p className="px-2 py-3 text-center text-[11px] text-neutral-500">Showing the first {PAGE}. Type to narrow.</p>
              )}
              {googleResults.length === 0 && (
                <p className="px-2 py-6 text-center text-[11px] text-neutral-500">No family matches.</p>
              )}
            </>
          )}

          {tab === "bundled" &&
            bundledResults.map((f) => (
              <FontRow key={f.id} name={f.name} detail={f.category} active={value === f.id} onPick={() => pick(f.id)} />
            ))}
        </div>

        {error && <div className="border-t border-white/5 px-4 py-2 text-[11px] text-red-300">{error}</div>}
      </div>
    </div>
  );
}

function FontRow({
  name,
  detail,
  active,
  onPick,
  onDelete,
  style,
}: {
  name: string;
  detail: string;
  active: boolean;
  onPick: () => void;
  onDelete?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`group flex items-center gap-2 rounded-md px-2 ${active ? "bg-[var(--accent-soft)]" : "hover:bg-white/5"}`}>
      <button type="button" onClick={onPick} className="flex flex-1 items-baseline gap-3 py-2 text-left">
        <span className={`text-[15px] ${active ? "text-[var(--accent)]" : "text-neutral-100"}`} style={style}>
          {name}
        </span>
        <span className="text-[10.5px] uppercase tracking-wide text-neutral-500">{detail}</span>
      </button>
      {onDelete && (
        <button
          type="button"
          title="Remove from your library"
          onClick={onDelete}
          className="rounded px-1.5 text-neutral-500 opacity-0 hover:text-red-300 group-hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  );
}

function GoogleRow({
  font,
  preview,
  value,
  onPick,
}: {
  font: GoogleFamily;
  preview: boolean;
  value: string;
  onPick: (id: string) => void;
}) {
  const [, family, currentVariant] = value.split(":");
  const isCurrent = fontSource(value) === "google" && family === font.family;
  const regular = font.variants.includes("400") ? "400" : font.variants[0];
  return (
    <div className={`group flex items-center gap-2 rounded-md px-2 ${isCurrent ? "bg-[var(--accent-soft)]" : "hover:bg-white/5"}`}>
      <button
        type="button"
        onClick={() => onPick(googleFontId(font.family, isCurrent && currentVariant ? currentVariant : regular))}
        className="flex flex-1 items-baseline gap-3 py-2 text-left"
      >
        <span
          className={`text-[15px] ${isCurrent ? "text-[var(--accent)]" : "text-neutral-100"}`}
          style={preview ? { fontFamily: `"${font.family}", sans-serif` } : undefined}
        >
          {font.family}
        </span>
        <span className="text-[10.5px] uppercase tracking-wide text-neutral-500">{font.category}</span>
      </button>
      {font.variants.length > 1 && (
        <select
          value={isCurrent && currentVariant ? currentVariant : regular}
          onChange={(e) => onPick(googleFontId(font.family, e.target.value))}
          onClick={(e) => e.stopPropagation()}
          title="Weight"
          className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-neutral-300 outline-none"
        >
          {font.variants.map((v) => (
            <option key={v} value={v} className="bg-neutral-900">
              {variantLabel(v)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
