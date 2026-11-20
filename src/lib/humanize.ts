// Small helpers that make numbers, dates and names read like a person wrote them.
import { Baby, Flower2, Handbag, Layers, Ribbon, Ruler, Shirt, Snowflake, Sparkles, Spool, Tag, type LucideIcon } from "lucide-react";
import type { Category } from "./types";

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function timeAgo(iso?: string) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (diff < 0) {
    const days = Math.ceil(-diff / 86_400_000);
    return days <= 1 ? "tomorrow" : `in ${days} days`;
  }
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.round(days / 7)} week${days >= 14 ? "s" : ""} ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** "in 3 days" / "2 days late" relative to a due date. */
export function dueIn(iso: string) {
  const days = Math.round((new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  if (days === 0) return { text: "due today", late: false };
  if (days === 1) return { text: "due tomorrow", late: false };
  if (days > 1) return { text: `due in ${days} days`, late: false };
  return { text: `${-days} day${days < -1 ? "s" : ""} late`, late: true };
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/** Stable soft colour for an avatar, picked from the name. */
const AVATAR_TONES = ["#f3d9cf", "#dbe7d3", "#d7e3f3", "#efe0c4", "#e6d9ef", "#d3ebe8", "#f3d6de"];
export const avatarTone = (name: string) =>
  AVATAR_TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TONES.length];

const COLOR_WORDS: [RegExp, string][] = [
  [/black|charcoal/i, "#2b2b2b"],
  [/white|off white|cream|ivory/i, "#f4efe6"],
  [/grey|gray|melange/i, "#a3a3a3"],
  [/navy|indigo/i, "#2c3e6b"],
  [/sky|light blue/i, "#9cc3e6"],
  [/blue/i, "#4a78b5"],
  [/olive|khaki/i, "#8a8455"],
  [/green|emerald/i, "#2f8a63"],
  [/maroon|wine/i, "#7a2333"],
  [/red/i, "#c23b32"],
  [/pink/i, "#ec9db5"],
  [/peach/i, "#f4b99a"],
  [/mustard|yellow|gold/i, "#d7a530"],
  [/brown|tan/i, "#7b5135"],
  [/orange/i, "#e57a34"],
  [/purple|lavender/i, "#8a6bb5"],
];
export function colorHex(name: string) {
  if (/multi|&/i.test(name)) return "conic-gradient(#c23b32, #d7a530, #2f8a63, #4a78b5, #c23b32)";
  for (const [re, hex] of COLOR_WORDS) if (re.test(name)) return hex;
  return "#cfc6bb";
}

const CATEGORY_ICON: Record<Category, LucideIcon> = {
  "T-Shirts": Shirt,
  Shirts: Shirt,
  Jeans: Layers,
  Trousers: Ruler,
  Kurtas: Shirt,
  Dresses: Sparkles,
  Sarees: Ribbon,
  Jackets: Snowflake,
  Sweaters: Spool,
  "Ethnic Sets": Flower2,
  Kidswear: Baby,
  Accessories: Handbag,
};
export const categoryIcon = (c: Category): LucideIcon => CATEGORY_ICON[c] ?? Tag;

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
