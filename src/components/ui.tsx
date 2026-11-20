"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, HelpCircle, Inbox, Lightbulb, Search, X, type LucideIcon } from "lucide-react";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { avatarTone, categoryIcon, colorHex, initials } from "@/lib/humanize";

export function PageHeader({ title, subtitle, actions, icon: Icon }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; icon?: LucideIcon }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
      <div className="flex items-center gap-3 sm:gap-3.5">
        {Icon && (
          <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand sm:flex" aria-hidden>
            <Icon size={21} strokeWidth={1.9} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto max-sm:[&>*]:flex-1 max-sm:[&>a>button]:w-full">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className, pad = true, subtitle, id, icon: Icon }: { title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean; id?: string; icon?: LucideIcon }) {
  return (
    <section id={id} className={cn("rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(60,40,20,0.04)]", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              {Icon && <Icon size={16} strokeWidth={2} className="shrink-0 text-brand" aria-hidden />}
              {title}
            </h2>
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

const toneText = { ok: "text-ok", warn: "text-warn", bad: "text-bad", info: "text-info" };
const toneChip = { ok: "bg-ok-soft text-ok", warn: "bg-warn-soft text-warn", bad: "bg-bad-soft text-bad", info: "bg-info-soft text-info", brand: "bg-brand-soft text-brand" };

export function Stat({ label, value, hint, tone, icon, help }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "ok" | "warn" | "bad" | "info"; icon?: React.ReactNode; help?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5 shadow-[0_1px_2px_rgba(60,40,20,0.04)] sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1 text-[13px] font-medium text-muted">
          {label}
          {help && <InfoTip text={help} />}
        </div>
        {icon && <span className={cn("hidden h-8 w-8 shrink-0 items-center justify-center rounded-full sm:flex", toneChip[tone ?? "brand"])}>{icon}</span>}
      </div>
      <div className={cn("mt-1 text-xl font-bold tabular-nums sm:text-2xl", tone && toneText[tone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

/** Hover/focus explanation for jargon. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex" tabIndex={0}>
      <HelpCircle size={13} className="cursor-help text-muted" aria-label={text} />
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden w-56 max-w-[calc(100vw-3rem)] -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs font-normal leading-snug text-white shadow-lg group-hover:block group-focus:block">
        {text}
      </span>
    </span>
  );
}

const badgeTones = {
  neutral: "bg-canvas text-muted border-line",
  ok: "bg-ok-soft text-ok border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  bad: "bg-bad-soft text-bad border-transparent",
  info: "bg-info-soft text-info border-transparent",
  brand: "bg-brand-soft text-brand border-transparent",
};
export type Tone = keyof typeof badgeTones;

export function Badge({ tone = "neutral", children, dot, icon: Icon }: { tone?: Tone; children: React.ReactNode; dot?: boolean; icon?: LucideIcon }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", badgeTones[tone])}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {Icon && <Icon size={12} strokeWidth={2.2} aria-hidden />}
      {children}
    </span>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md"; ref?: React.Ref<HTMLButtonElement> };
export function Button({ variant = "secondary", size = "md", className, ...rest }: BtnProps) {
  const v = {
    primary: "bg-brand text-white hover:bg-brand/90 border-brand shadow-sm",
    secondary: "bg-surface text-ink hover:bg-canvas border-line",
    ghost: "bg-transparent text-ink hover:bg-canvas border-transparent",
    danger: "bg-surface text-bad hover:bg-bad-soft border-line",
  }[variant];
  const s = size === "sm" ? "px-2.5 py-1 text-xs rounded-lg max-sm:min-h-9" : "px-4 py-2 text-sm rounded-xl max-sm:min-h-11";
  return (
    <button
      className={cn("inline-flex items-center justify-center gap-1.5 border font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50", v, s, className)}
      {...rest}
    />
  );
}

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink/80">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer, wide }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    // Stop the page behind from scrolling while the dialog is open (matters on phones).
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-start sm:overflow-y-auto sm:p-8"
      onMouseDown={onClose}
    >
      <div
        className={cn(
          "flex max-h-[92dvh] w-full animate-pop flex-col rounded-t-3xl bg-surface shadow-2xl sm:max-h-none sm:rounded-2xl",
          wide ? "sm:max-w-4xl" : "sm:max-w-lg",
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-line sm:hidden" aria-hidden />
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{title}</h2>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-canvas sm:mr-0 sm:h-9 sm:w-9" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:max-h-[70vh] sm:px-6 sm:py-5">{children}</div>
        {footer && (
          <div className="pb-safe shrink-0 border-t border-line bg-canvas/50 sm:pb-0">
            <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3 max-sm:[&>button]:flex-1 sm:px-6 sm:py-3.5">{footer}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/** A plain-language "are you sure?" dialog. */
export function Confirm({ open, onClose, onConfirm, title, children, confirmLabel, danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; children: React.ReactNode; confirmLabel: string; danger?: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>Never mind</Button>
          <Button variant={danger ? "danger" : "primary"} className={danger ? "!bg-bad !text-white !border-bad hover:!bg-bad/90" : ""} onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed">{children}</div>
    </Modal>
  );
}

export function Empty({ title, children, icon: Icon = Inbox, action }: { title: string; children?: React.ReactNode; icon?: LucideIcon; action?: React.ReactNode }) {
  return (
    <div className="animate-fade px-4 py-12 text-center">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-muted" aria-hidden>
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <div className="font-semibold">{title}</div>
      {children && <div className="mx-auto mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input className="inp pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "Search…"} aria-label={placeholder ?? "Search"} />
      {value && (
        <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink" onClick={() => onChange("")} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** Simple horizontal bar list — used for category / size / top-seller breakdowns. */
export function BarList({ rows, format }: { rows: { label: React.ReactNode; value: number; sub?: string; key?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">Nothing to show yet.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.key ?? String(r.label) ?? i}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted">
              {format ? format(r.value) : r.value}
              {r.sub && <span className="ml-1.5 text-xs">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-canvas">
            <div className="h-2 rounded-full bg-brand/80 transition-all" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-ink/80"
      style={{ width: size, height: size, background: avatarTone(name), fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function ColorDot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full ring-1 ring-black/10"
      style={{ width: size, height: size, background: colorHex(color) }}
      title={color}
      aria-hidden
    />
  );
}

/** Picture stand-in: category icon on a tile with a strip of the product's colour. */
export function ProductThumb({ p, size = 40 }: { p: Pick<Product, "category" | "color">; size?: number }) {
  const Icon = categoryIcon(p.category);
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-soft/60 text-brand ring-1 ring-line"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.45)} strokeWidth={1.8} className="-mt-1" />
      <span className="absolute inset-x-0 bottom-0 h-1.5" style={{ background: colorHex(p.color) }} />
    </span>
  );
}

/** Product name + thumbnail + subtitle, used in most tables. */
export function ProductCell({ p, href, sub }: { p: Product; href?: string; sub?: React.ReactNode }) {
  const name = <span className="font-semibold">{p.name}</span>;
  return (
    <div className="flex items-center gap-3">
      <ProductThumb p={p} size={38} />
      <div className="min-w-0">
        {href ? <Link href={href} className="hover:text-brand">{name}</Link> : name}
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <ColorDot color={p.color} size={8} />
          <span className="line-clamp-1">{sub ?? `${p.color} · ${p.styleCode}`}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Short "how this page works" steps. Shown on a first visit; after "Got it"
 * it shrinks to a small link so it never gets in the way.
 */
export function PageGuide({ id, steps, title = "How this page works" }: { id: string; steps: React.ReactNode[]; title?: string }) {
  const key = `kapda-guide-${id}`;
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(key) === "seen";
    } catch {}
    setOpen(!seen);
  }, [key]);
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(key, "seen");
    } catch {}
  };
  if (open === null) return null;
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
        <Lightbulb size={15} aria-hidden /> {title}
      </button>
    );
  return (
    <section aria-label={title} className="mb-5 animate-fade rounded-2xl border border-brand/15 bg-brand-soft/50 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-brand"><Lightbulb size={16} aria-hidden /> {title}</h2>
        <button onClick={close} className="shrink-0 rounded-lg bg-surface px-3 py-1 text-xs font-semibold text-ink shadow-sm hover:bg-canvas">Got it</button>
      </div>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-snug text-ink/85">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Folds optional fields away behind a "More details" toggle. */
export function MoreDetails({ label = "More details (optional)", children, defaultOpen = false }: { label?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-5 rounded-xl border border-line">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-canvas/60">
        {label}
        <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && <div className="border-t border-line p-4">{children}</div>}
    </div>
  );
}

/** Big, easy-to-hit choice buttons (instead of a dropdown) for a handful of options. */
export function ChoiceButtons<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; icon?: LucideIcon }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
            value === o.value ? "border-brand bg-brand text-white" : "border-line bg-surface hover:bg-canvas",
          )}
        >
          {o.icon && <o.icon size={14} aria-hidden />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** True when the screen matches the query, e.g. useMediaQuery("(min-width: 1024px)"). */
export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
}
