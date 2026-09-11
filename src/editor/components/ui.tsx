"use client";

import { type ReactNode, useState } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * A square button that is only an icon. The title is not optional: an icon
 * with no name is a riddle, and the tooltip is where the word went.
 */
export function IconButton({
  icon: Icon,
  title,
  onClick,
  disabled,
  active = false,
  danger = false,
  size = "sm",
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const box = size === "md" ? "h-7 w-7" : "h-5 w-5";
  const glyph = size === "md" ? 15 : 13;
  const tone = active
    ? "bg-[var(--accent)] text-[var(--accent-ink)]"
    : danger
      ? "text-neutral-400 hover:bg-red-500/15 hover:text-red-300"
      : "text-neutral-400 hover:bg-white/10 hover:text-white";
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`grid ${box} shrink-0 place-items-center rounded transition disabled:cursor-not-allowed disabled:opacity-30 ${tone} ${className}`}
    >
      <Icon size={glyph} strokeWidth={1.75} />
    </button>
  );
}

export function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="border-b border-white/5 px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{title}</h3>
        {right}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-xs text-neutral-300">
      <span className="truncate text-neutral-400">{label}</span>
      {children}
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format,
  logarithmic = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  /** Spreads the travel by ratio rather than by amount, for ranges like a focus
   *  distance where the useful detail sits at the near end. Needs min > 0. */
  logarithmic?: boolean;
}) {
  const usesLog = logarithmic && min > 0 && max > min;
  const toTrack = (v: number) =>
    usesLog ? Math.log(Math.max(min, Math.min(max, v)) / min) / Math.log(max / min) : v;
  const fromTrack = (t: number) => (usesLog ? min * Math.pow(max / min, t) : t);

  return (
    <Row label={label}>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={usesLog ? 0 : min}
          max={usesLog ? 1 : max}
          step={usesLog ? 0.001 : step}
          value={toTrack(value)}
          onChange={(e) => onChange(fromTrack(parseFloat(e.target.value)))}
          className="h-1 flex-1 cursor-pointer accent-white"
        />
        <NumberField value={value} step={step} onChange={onChange} format={format} />
      </div>
    </Row>
  );
}

export function NumberField({
  value,
  onChange,
  step = 0.01,
  format,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const shown = format ? format(value) : String(Math.round(value * 1000) / 1000);
  const [text, setText] = useState(shown);
  const [editing, setEditing] = useState(false);
  const [lastShown, setLastShown] = useState(shown);
  // Sync the field with the incoming value while it is not being edited (adjust-state-during-render pattern).
  if (!editing && shown !== lastShown) {
    setLastShown(shown);
    setText(shown);
  }
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      step={step}
      onFocus={() => setEditing(true)}
      onBlur={() => {
        setEditing(false);
        const v = parseFloat(text);
        if (!Number.isNaN(v)) onChange(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      onChange={(e) => setText(e.target.value)}
      className={`w-14 rounded bg-white/5 px-1.5 py-1 text-right text-[11px] text-neutral-200 outline-none ring-1 ring-transparent focus:ring-[var(--accent-edge)] ${className}`}
    />
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && onChange(e.target.value)}
          className="w-20 rounded bg-white/5 px-1.5 py-1 font-mono text-[11px] uppercase text-neutral-200 outline-none focus:ring-1 focus:ring-[var(--accent-edge)]"
        />
      </div>
    </Row>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <Row label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded bg-white/5 px-2 py-1 text-xs text-neutral-200 outline-none focus:ring-1 focus:ring-[var(--accent-edge)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-neutral-900">
            {o.label}
          </option>
        ))}
      </select>
    </Row>
  );
}

export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row label={label}>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-5 w-9 rounded-full transition ${value ? "bg-[var(--accent)]" : "bg-white/15"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full transition ${
            value ? "left-[18px] bg-[var(--accent-ink)]" : "left-0.5 bg-neutral-300"
          }`}
        />
      </button>
    </Row>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Row label={label}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded bg-white/5 px-2 py-1 text-xs text-neutral-200 outline-none focus:ring-1 focus:ring-[var(--accent-edge)]"
      />
    </Row>
  );
}

export function Button({
  children,
  onClick,
  variant = "default",
  disabled,
  title,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost" | "danger";
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const styles = {
    default: "bg-white/10 hover:bg-white/15 text-neutral-100",
    primary: "bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-110",
    ghost: "bg-transparent hover:bg-white/10 text-neutral-300",
    danger: "bg-red-500/15 text-red-300 hover:bg-red-500/25",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Vec3Field({
  label,
  value,
  onChange,
  step = 0.01,
  format,
}: {
  label: string;
  value: [number, number, number];
  onChange: (v: [number, number, number]) => void;
  step?: number;
  format?: (v: number) => string;
}) {
  return (
    <Row label={label}>
      <div className="grid grid-cols-3 gap-1">
        {value.map((v, i) => (
          <NumberField
            key={i}
            value={v}
            step={step}
            format={format}
            className="w-full"
            onChange={(n) => {
              const next = [...value] as [number, number, number];
              next[i] = n;
              onChange(next);
            }}
          />
        ))}
      </div>
    </Row>
  );
}
