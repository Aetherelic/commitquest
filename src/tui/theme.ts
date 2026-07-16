export type TuiThemeId =
  | "tokyo-night"
  | "arcane"
  | "catppuccin"
  | "everforest"
  | "monochrome";

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

export const TUI_THEMES: readonly TuiTheme[] = [
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    description: "Midnight indigo, cool blue, and soft violet.",
    background: "#1a1b26",
    surface: "#24283b",
    surfaceAlt: "#292e42",
    text: "#c0caf5",
    muted: "#565f89",
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
    warning: "#fbbf24",
    danger: "#fb7185",
    border: "#29406d"
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    description: "Soft mocha tones with mauve, lavender, and peach.",
    background: "#1e1e2e",
    surface: "#313244",
    surfaceAlt: "#45475a",
    text: "#cdd6f4",
    muted: "#7f849c",
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
    description: "A calm forest palette with warm greens and amber.",
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
    id: "monochrome",
    name: "Monochrome",
    description: "Minimal graphite with crisp white and silver accents.",
    background: "#101010",
    surface: "#1b1b1b",
    surfaceAlt: "#292929",
    text: "#eeeeee",
    muted: "#888888",
    accent: "#d8d8d8",
    accentAlt: "#aaaaaa",
    success: "#d0d0d0",
    warning: "#bcbcbc",
    danger: "#f0f0f0",
    border: "#444444"
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
