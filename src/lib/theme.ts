// Colour schemes. The colours themselves live in globals.css (html[data-theme=…]);
// this file lists them for the Settings picker and remembers the choice per device.

export const THEME_KEY = "kapda-theme";

export const THEMES = [
  { id: "indigo", name: "Indigo", feel: "Modern and professional", brand: "#4f46e5", soft: "#ecebfd", canvas: "#f5f6fa" },
  { id: "terracotta", name: "Terracotta", feel: "Warm and earthy", brand: "#9a4632", soft: "#f7e8e1", canvas: "#f7f3ee" },
  { id: "teal", name: "Teal", feel: "Fresh and calm", brand: "#0f766e", soft: "#ddf1ee", canvas: "#f2f6f5" },
  { id: "maroon", name: "Royal maroon", feel: "Rich and festive", brand: "#8b1e3f", soft: "#f8e4ea", canvas: "#fbf6ee" },
  { id: "navy", name: "Navy", feel: "Classic and trustworthy", brand: "#1e3a8a", soft: "#e4eafa", canvas: "#f5f6f8" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME: ThemeId = "indigo";

const isTheme = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);

export function getTheme(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isTheme(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  if (id === DEFAULT_THEME) root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", id);
  // Phone browser bar colour follows the scheme.
  const meta = document.querySelector('meta[name="theme-color"]');
  const t = THEMES.find((x) => x.id === id);
  if (meta && t) meta.setAttribute("content", t.brand);
  try {
    if (id === DEFAULT_THEME) localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, id);
  } catch {}
}

/** Runs in <head> before the page paints, so a saved scheme never flashes the default first. */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});var ok=${JSON.stringify(
  THEMES.map((t) => t.id),
)};if(t&&ok.indexOf(t)>0){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;
