"use client";

import { type ReactNode, useState } from "react";

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
    <div className="border-b border-[var(--line)] px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11.5px] font-medium text-[var(--ink)]">{title}</h3>
        {right}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid grid-cols-[76px_1fr] items-center gap-2 text-[11.5px] text-[var(--ink)]">
      <span className="truncate text-[var(--ink-dim)]">{label}</span>
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
          className="flex-1 cursor-pointer"
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
      className={`w-[52px] rounded border border-transparent bg-[var(--field)] px-1.5 py-1 text-right text-[11px] tabular-nums text-[var(--ink)] outline-none transition hover:border-[var(--raised)] focus:border-[var(--accent)] ${className}`}
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
          className="w-20 rounded border border-transparent bg-[var(--field)] px-1.5 py-1 font-mono text-[11px] uppercase text-[var(--ink)] outline-none transition hover:border-[var(--raised)] focus:border-[var(--accent)]"
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
        className="w-full rounded border border-transparent bg-[var(--field)] px-2 py-1 text-[11.5px] text-[var(--ink)] outline-none transition hover:border-[var(--raised)] focus:border-[var(--accent)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[var(--panel)]">
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
        className={`relative h-[18px] w-8 rounded-full transition ${value ? "bg-[var(--accent)]" : "bg-[var(--raised)]"}`}
      >
        <span
          className={`absolute top-0.5 h-[14px] w-[14px] rounded-full bg-white transition ${
            value ? "left-[16px]" : "left-0.5"
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
        className="w-full rounded border border-transparent bg-[var(--field)] px-2 py-1 text-[11.5px] text-[var(--ink)] outline-none transition hover:border-[var(--raised)] focus:border-[var(--accent)]"
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
    default: "bg-[var(--raised)] hover:brightness-125 text-[var(--ink)]",
    primary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-press)]",
    ghost: "bg-transparent hover:bg-[var(--raised)] text-[var(--ink-dim)] hover:text-[var(--ink)]",
    danger: "bg-red-500/15 text-red-300 hover:bg-red-500/25",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded px-2.5 py-1.5 text-[11.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
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
