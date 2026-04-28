export type BoardThemeId = "classic" | "walnut" | "ice";

export interface BoardThemeColors {
  light: string;
  dark: string;
  frame: string;
  coordinate: string;
}

export const BOARD_THEME_COLORS: Record<BoardThemeId, BoardThemeColors> = {
  classic: {
    light: "#eeeed2",
    dark: "#769656",
    frame: "#312e2b",
    coordinate: "rgba(255,255,255,0.7)",
  },
  walnut: {
    light: "#f0d9b5",
    dark: "#8b5a2b",
    frame: "#2c1810",
    coordinate: "rgba(255,255,255,0.75)",
  },
  ice: {
    light: "#e3eaf2",
    dark: "#5d7894",
    frame: "#1a2332",
    coordinate: "rgba(255,255,255,0.75)",
  },
};

export function getBoardTheme(id: string | null | undefined): BoardThemeColors {
  return BOARD_THEME_COLORS[(id as BoardThemeId)] ?? BOARD_THEME_COLORS.classic;
}
