export type TuiThemeId =
  | "tokyo-night"
  | "arcane"
  | "catppuccin"
  | "everforest"
  | "matrix"
  | "nord"
  | "rose-pine"
  | "gruvbox-dark"
  | "dracula"
  | "solarized-dark"
  | "monochrome"
  | "obsidian-ink"
  | "synthwave"
  | "amber-terminal"
  | "iceberg"
  | "cyberdeck";

export interface TuiTheme {
  id: TuiThemeId;
  name: string;
  description: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  muted: string;
  accent: string;
  accentAlt: string;
  success: string;
  warning: string;
  danger: string;
  border: string;
}

export const DEFAULT_THEME_ID: TuiThemeId = "tokyo-night";

/**
 * Every semantic colour is declared by the active theme. Renderers never
 * substitute global reds, greens, or highlights, so status colours remain
 * coherent with Matrix, Catppuccin, monochrome, and every other palette.
 */
export const TUI_THEMES: readonly TuiTheme[] = [
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    description: "Midnight indigo, cool blue, and soft violet.",
    background: "#1a1b26",
    surface: "#24283b",
    surfaceAlt: "#292e42",
    text: "#c0caf5",
    muted: "#737aa2",
    accent: "#7aa2f7",
    accentAlt: "#bb9af7",
    success: "#9ece6a",
    warning: "#e0af68",
    danger: "#f7768e",
    border: "#3b4261"
  },
  {
    id: "arcane",
    name: "Arcane",
    description: "Deep navy glass with electric blue and violet magic.",
    background: "#080d1a",
    surface: "#101a31",
    surfaceAlt: "#172342",
    text: "#dbeafe",
    muted: "#7184a8",
    accent: "#60a5fa",
    accentAlt: "#a78bfa",
    success: "#5eead4",
    warning: "#f6c177",
    danger: "#e879a8",
    border: "#29406d"
  },
  {
    id: "catppuccin",
    name: "Catppuccin Mocha",
    description: "Soft mocha tones with mauve, lavender, peach, and teal.",
    background: "#1e1e2e",
    surface: "#313244",
    surfaceAlt: "#45475a",
    text: "#cdd6f4",
    muted: "#9399b2",
    accent: "#cba6f7",
    accentAlt: "#89b4fa",
    success: "#a6e3a1",
    warning: "#f9e2af",
    danger: "#f38ba8",
    border: "#585b70"
  },
  {
    id: "everforest",
    name: "Everforest",
    description: "A calm forest palette with warm greens, aqua, and amber.",
    background: "#272e33",
    surface: "#2e383c",
    surfaceAlt: "#374145",
    text: "#d3c6aa",
    muted: "#859289",
    accent: "#a7c080",
    accentAlt: "#83c092",
    success: "#a7c080",
    warning: "#dbbc7f",
    danger: "#e67e80",
    border: "#4f5b58"
  },
  {
    id: "matrix",
    name: "Matrix",
    description: "Near-black terminal glass with layered phosphor greens.",
    background: "#020704",
    surface: "#06120a",
    surfaceAlt: "#0a1d10",
    text: "#c7ffd8",
    muted: "#4e8f61",
    accent: "#39ff6f",
    accentAlt: "#17d95b",
    success: "#8dffad",
    warning: "#b7e85b",
    danger: "#54b86f",
    border: "#176b33"
  },
  {
    id: "nord",
    name: "Nord",
    description: "Polar night surfaces with frost blue and aurora accents.",
    background: "#2e3440",
    surface: "#3b4252",
    surfaceAlt: "#434c5e",
    text: "#eceff4",
    muted: "#8f9bb3",
    accent: "#88c0d0",
    accentAlt: "#81a1c1",
    success: "#a3be8c",
    warning: "#ebcb8b",
    danger: "#bf616a",
    border: "#4c566a"
  },
  {
    id: "rose-pine",
    name: "Rosé Pine",
    description: "Muted ink, rose, foam, and gold with restrained contrast.",
    background: "#191724",
    surface: "#1f1d2e",
    surfaceAlt: "#26233a",
    text: "#e0def4",
    muted: "#908caa",
    accent: "#c4a7e7",
    accentAlt: "#9ccfd8",
    success: "#9ccfd8",
    warning: "#f6c177",
    danger: "#eb6f92",
    border: "#403d52"
  },
  {
    id: "gruvbox-dark",
    name: "Gruvbox Dark",
    description: "Warm retro contrast with earthy orange, aqua, and green.",
    background: "#282828",
    surface: "#3c3836",
    surfaceAlt: "#504945",
    text: "#ebdbb2",
    muted: "#a89984",
    accent: "#fe8019",
    accentAlt: "#83a598",
    success: "#b8bb26",
    warning: "#fabd2f",
    danger: "#fb4934",
    border: "#665c54"
  },
  {
    id: "dracula",
    name: "Dracula",
    description: "Dark violet surfaces with purple, cyan, green, and orange.",
    background: "#282a36",
    surface: "#343746",
    surfaceAlt: "#44475a",
    text: "#f8f8f2",
    muted: "#8b90a7",
    accent: "#bd93f9",
    accentAlt: "#8be9fd",
    success: "#50fa7b",
    warning: "#ffb86c",
    danger: "#ff5555",
    border: "#6272a4"
  },
  {
    id: "solarized-dark",
    name: "Solarized Dark",
    description: "Precision contrast with blue, cyan, green, and ochre.",
    background: "#002b36",
    surface: "#073642",
    surfaceAlt: "#0d4855",
    text: "#eee8d5",
    muted: "#839496",
    accent: "#268bd2",
    accentAlt: "#2aa198",
    success: "#859900",
    warning: "#b58900",
    danger: "#dc322f",
    border: "#586e75"
  },
  {
    id: "monochrome",
    name: "Monochrome",
    description: "Minimal graphite with crisp white and silver hierarchy.",
    background: "#101010",
    surface: "#1b1b1b",
    surfaceAlt: "#292929",
    text: "#eeeeee",
    muted: "#888888",
    accent: "#d8d8d8",
    accentAlt: "#aaaaaa",
    success: "#f2f2f2",
    warning: "#bcbcbc",
    danger: "#ffffff",
    border: "#444444"
  },
  {
    id: "obsidian-ink",
    name: "Obsidian Ink",
    description: "Black ink, smoke, bone, and restrained steel-blue light.",
    background: "#08090c",
    surface: "#111318",
    surfaceAlt: "#1a1d24",
    text: "#e8e6df",
    muted: "#797d86",
    accent: "#9aa7bd",
    accentAlt: "#c2b8a3",
    success: "#9fb6a0",
    warning: "#c6ad78",
    danger: "#b98787",
    border: "#343842"
  },
  {
    id: "synthwave",
    name: "Synthwave",
    description: "Night-drive purple with cyan, magenta, and sunset amber.",
    background: "#171126",
    surface: "#24183a",
    surfaceAlt: "#34204f",
    text: "#f4e9ff",
    muted: "#9b82b8",
    accent: "#ff7edb",
    accentAlt: "#36f1f8",
    success: "#72f1b8",
    warning: "#fede5d",
    danger: "#fe4450",
    border: "#5b3b78"
  },
  {
    id: "amber-terminal",
    name: "Amber Terminal",
    description: "Warm black phosphor display with layered amber states.",
    background: "#100b02",
    surface: "#1b1204",
    surfaceAlt: "#2a1b06",
    text: "#ffe6a3",
    muted: "#9b7130",
    accent: "#ffb000",
    accentAlt: "#ffd166",
    success: "#f4c95d",
    warning: "#ffca3a",
    danger: "#d98e04",
    border: "#6f4a0a"
  },
  {
    id: "iceberg",
    name: "Iceberg",
    description: "Blue-grey night with lavender frost and cool cyan light.",
    background: "#161821",
    surface: "#1e2132",
    surfaceAlt: "#2a2e43",
    text: "#c6c8d1",
    muted: "#6b7089",
    accent: "#84a0c6",
    accentAlt: "#a093c7",
    success: "#b4be82",
    warning: "#e2a478",
    danger: "#e27878",
    border: "#3e445e"
  },
  {
    id: "cyberdeck",
    name: "Cyberdeck",
    description: "Industrial black with terminal cyan, lime, and hazard gold.",
    background: "#06090b",
    surface: "#0d1518",
    surfaceAlt: "#142126",
    text: "#d8f3f5",
    muted: "#5f7f85",
    accent: "#00d9ff",
    accentAlt: "#9cff57",
    success: "#4ee6a8",
    warning: "#f4c95d",
    danger: "#ff6b5f",
    border: "#1e5963"
  }
] as const;

export function isTuiThemeId(value: unknown): value is TuiThemeId {
  return typeof value === "string" && TUI_THEMES.some((theme) => theme.id === value);
}

export function getTuiTheme(id: TuiThemeId | string | null | undefined): TuiTheme {
  return TUI_THEMES.find((theme) => theme.id === id)
    ?? TUI_THEMES.find((theme) => theme.id === DEFAULT_THEME_ID)!;
}

export function themeIndex(id: TuiThemeId | string | null | undefined): number {
  const index = TUI_THEMES.findIndex((theme) => theme.id === id);
  return index >= 0 ? index : 0;
}
