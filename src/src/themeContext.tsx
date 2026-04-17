import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors as darkColors, spacing, radius } from "./theme";

type ColorPalette = typeof darkColors;

type ThemeMode = "dark" | "light";

type ThemeContextValue = {
  colors: ColorPalette;
  spacing: typeof spacing;
  radius: typeof radius;
  mode: ThemeMode;
  toggleTheme: () => void;
};

const lightColors: ColorPalette = {
  ...darkColors,
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
        // Force light mode for the Orange Redesign, ignore stored dark mode
        if (stored === "light") {

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

