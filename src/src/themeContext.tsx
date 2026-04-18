import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors as baseColors, spacing, radius } from "./theme";

type ColorPalette = typeof baseColors;

type ThemeMode = "dark" | "light";

type ThemeContextValue = {
  colors: ColorPalette;
  spacing: typeof spacing;
  radius: typeof radius;
  mode: ThemeMode;
  toggleTheme: () => void;
};

const lightColors: ColorPalette = {
  ...baseColors,
};

const darkColors: ColorPalette = {
  ...baseColors,
  background:       "#0F1117",
  surface:          "#1C1C2E",
  cardBackground:   "#1C1C2E",
  cardBorder:       "#2A2A3C",
  textPrimary:      "#F1F5F9",
  textSecondary:    "#94A3B8",
  textMuted:        "#64748B",
  divider:          "#2A2A3C",
  inputBackground:  "#1E293B",
  tabBarBg:         "#1C1C2E",
};

const STORAGE_KEY = "pm_theme_mode";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "dark" || stored === "light") {
          setMode(stored);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const toggleTheme = async () => {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    setMode(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const value: ThemeContextValue = {
    colors: mode === "dark" ? darkColors : lightColors,
    spacing,
    radius,
    mode,
    toggleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
};

