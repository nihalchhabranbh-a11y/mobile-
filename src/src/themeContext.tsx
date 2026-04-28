import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors as baseColors, spacing, radius } from "./theme";

type ColorPalette = typeof baseColors;

type ThemeMode = "dark" | "light";
type WallpaperType = "image" | "video" | null;

type ThemeContextValue = {
  colors: ColorPalette;
  spacing: typeof spacing;
  radius: typeof radius;
  mode: ThemeMode;
  toggleTheme: () => void;
  primaryColor: string | null;
  setPrimaryColor: (color: string | null) => void;
  
  topColor: string | null;
  setTopColor: (c: string | null) => void;
  bottomColor: string | null;
  setBottomColor: (c: string | null) => void;
  dashboardColor: string | null;
  setDashboardColor: (c: string | null) => void;
  customTextColor: string | null;
  setCustomTextColor: (c: string | null) => void;
  glassOpacity: number;
  setGlassOpacity: (o: number) => void;
  transparentTabBar: boolean;
  setTransparentTabBar: (b: boolean) => void;

  wallpaperUri: string | null;
  wallpaperType: WallpaperType;
  setWallpaper: (uri: string | null, type: WallpaperType) => void;
  hasWallpaper: boolean;
};

const lightColors: ColorPalette = { ...baseColors };

const darkColors: ColorPalette = {
  ...baseColors,
  // ── Backgrounds ──────────────────────────────────────────────────
  background:          "#0D0D14",   // near-black app BG
  surface:             "#17172A",   // slightly lighter surface
  cardBackground:      "#1E1E33",   // card / list item BG — visible contrast
  cardBorder:          "#2E2E4A",   // subtle border
  // ── Typography — must be BRIGHT in dark mode ──────────────────────
  textPrimary:         "#F8FAFC",   // near-white — primary labels
  textSecondary:       "#CBD5E1",   // light-grey — secondary info
  textMuted:           "#8B9AB0",   // dimmer helper text (still readable)
  // ── Lines & inputs ────────────────────────────────────────────────
  divider:             "#2E2E4A",
  inputBackground:     "#1E1E33",
  // ── Tab bar ───────────────────────────────────────────────────────
  tabBarBg:            "#17172A",
  tabBarInactive:      "#6B7CA8",
};

const STORAGE_KEY = "pm_theme_mode";
const COLOR_KEY = "pm_primary_color";
const WP_URI_KEY = "pm_wallpaper_uri";
const WP_TYPE_KEY = "pm_wallpaper_type";

const TOP_COLOR_KEY = "pm_top_color_v2";
const BOT_COLOR_KEY = "pm_bot_color_v2";
const DASH_COLOR_KEY = "pm_dash_color_v2";
const TXT_COLOR_KEY = "pm_txt_color_v2";
const OPAC_KEY      = "pm_glass_opacity_v2";
const TAB_BAR_TRANS_KEY = "pm_tab_bar_trans";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [primaryColor, setPrimaryColorState] = useState<string | null>(null);
  
  const [topColor, setTopColorState] = useState<string | null>(null);
  const [bottomColor, setBottomColorState] = useState<string | null>(null);
  const [dashboardColor, setDashboardColorState] = useState<string | null>(null);
  const [customTextColor, setCustomTextColorState] = useState<string | null>(null);
  const [glassOpacity, setGlassOpacityState] = useState<number>(0.75);
  const [transparentTabBar, setTransparentTabBarState] = useState<boolean>(false);

  const [wallpaperUri, setWallpaperUriState] = useState<string | null>(null);
  const [wallpaperType, setWallpaperTypeState] = useState<WallpaperType>(null);

  useEffect(() => {
    (async () => {
      try {
        const storedMode = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedMode === "dark" || storedMode === "light") setMode(storedMode);

        const storedColor = await AsyncStorage.getItem(COLOR_KEY);
        if (storedColor) setPrimaryColorState(storedColor);

        const sTop = await AsyncStorage.getItem(TOP_COLOR_KEY); if (sTop) setTopColorState(sTop);
        const sBot = await AsyncStorage.getItem(BOT_COLOR_KEY); if (sBot) setBottomColorState(sBot);
        const sDash = await AsyncStorage.getItem(DASH_COLOR_KEY); if (sDash) setDashboardColorState(sDash);
        const sTxt = await AsyncStorage.getItem(TXT_COLOR_KEY); if (sTxt) setCustomTextColorState(sTxt);
        const sOpac = await AsyncStorage.getItem(OPAC_KEY); if (sOpac) setGlassOpacityState(parseFloat(sOpac));
        const sTabT = await AsyncStorage.getItem(TAB_BAR_TRANS_KEY); if (sTabT) setTransparentTabBarState(sTabT === "true");

        const storedWpUri = await AsyncStorage.getItem(WP_URI_KEY);
        const storedWpType = await AsyncStorage.getItem(WP_TYPE_KEY) as WallpaperType;
        if (storedWpUri) {
          setWallpaperUriState(storedWpUri);
          setWallpaperTypeState(storedWpType || "image");
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const toggleTheme = async () => {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    setMode(next);
    try { await AsyncStorage.setItem(STORAGE_KEY, next); } catch {}
  };

  const setPrimaryColor = async (color: string | null) => {
    setPrimaryColorState(color);
    try {
      if (color) await AsyncStorage.setItem(COLOR_KEY, color);
      else await AsyncStorage.removeItem(COLOR_KEY);
    } catch {}
  };

  const setTopColor = async (c: string | null) => {
    setTopColorState(c);
    try { if (c) await AsyncStorage.setItem(TOP_COLOR_KEY, c); else await AsyncStorage.removeItem(TOP_COLOR_KEY); } catch {}
  };
  const setBottomColor = async (c: string | null) => {
    setBottomColorState(c);
    try { if (c) await AsyncStorage.setItem(BOT_COLOR_KEY, c); else await AsyncStorage.removeItem(BOT_COLOR_KEY); } catch {}
  };
  const setDashboardColor = async (c: string | null) => {
    setDashboardColorState(c);
    try { if (c) await AsyncStorage.setItem(DASH_COLOR_KEY, c); else await AsyncStorage.removeItem(DASH_COLOR_KEY); } catch {}
  };
  const setCustomTextColor = async (c: string | null) => {
    setCustomTextColorState(c);
    try { if (c) await AsyncStorage.setItem(TXT_COLOR_KEY, c); else await AsyncStorage.removeItem(TXT_COLOR_KEY); } catch {}
  };
  const setGlassOpacity = async (o: number) => {
    setGlassOpacityState(o);
    try { await AsyncStorage.setItem(OPAC_KEY, o.toString()); } catch {}
  };
  const setTransparentTabBar = async (b: boolean) => {
    setTransparentTabBarState(b);
    try { await AsyncStorage.setItem(TAB_BAR_TRANS_KEY, b.toString()); } catch {}
  };

  const setWallpaper = async (uri: string | null, type: WallpaperType) => {
    setWallpaperUriState(uri);
    setWallpaperTypeState(type);
    try {
      if (uri) {
        await AsyncStorage.setItem(WP_URI_KEY, uri);
        await AsyncStorage.setItem(WP_TYPE_KEY, type || "image");
      } else {
        await AsyncStorage.removeItem(WP_URI_KEY);
        await AsyncStorage.removeItem(WP_TYPE_KEY);
      }
    } catch {}
  };

  const currentColors = { ...(mode === "dark" ? darkColors : lightColors) };
  const hasWallpaper = !!wallpaperUri;

  if (primaryColor) {
    currentColors.accentOrange = primaryColor;
    currentColors.headerGradientStart = primaryColor;
    currentColors.headerGradientEnd = primaryColor;
    currentColors.tabBarActive = primaryColor;
  }

  if (topColor) {
    currentColors.headerGradientStart = topColor;
    currentColors.headerGradientEnd = topColor;
  }
  if (bottomColor) {
    currentColors.tabBarBg = bottomColor;
  }
  if (dashboardColor) {
    currentColors.background = dashboardColor;
    // Derive a slightly lighter card surface from the chosen dashboard color
    // so cards remain distinguishable rather than merging with the background.
    currentColors.surface = dashboardColor;
    currentColors.cardBackground = dashboardColor + "CC"; // slight transparency
  }
  if (customTextColor) {
    // Only override primary text — keep secondary/muted at sensible values
    // so labels, meta info and placeholders stay readable.
    currentColors.textPrimary = customTextColor;
  }

  if (hasWallpaper) {
     const safeDash = dashboardColor || (mode === "dark" ? "#1c1c2e" : "#ffffff");
     const safeBot = bottomColor || (mode === "dark" ? "#1c1c2e" : "#ffffff");
     
     // Hex to RGBA simple converter helper
     const hexToRgba = (hex: string, op: number) => {
       const cleanHex = hex.replace('#', '');
       if(cleanHex.length === 6) {
         return `rgba(${parseInt(cleanHex.slice(0,2), 16)},${parseInt(cleanHex.slice(2,4), 16)},${parseInt(cleanHex.slice(4,6), 16)},${op})`;
       }
       return mode === "dark" ? `rgba(28,28,46,${op})` : `rgba(255,255,255,${op})`;
     };

     currentColors.background = "transparent";
     
     currentColors.surface = hexToRgba(safeDash, glassOpacity);
     currentColors.cardBackground = hexToRgba(safeDash, glassOpacity);
     currentColors.tabBarBg = hexToRgba(safeBot, Math.min(glassOpacity + 0.1, 1));
     currentColors.inputBackground = hexToRgba(safeDash, Math.max(glassOpacity - 0.05, 0));
  }

  const value: ThemeContextValue = {
    colors: currentColors,
    spacing,
    radius,
    mode,
    toggleTheme,
    primaryColor,
    setPrimaryColor,
    topColor,
    setTopColor,
    bottomColor,
    setBottomColor,
    dashboardColor,
    setDashboardColor,
    customTextColor,
    setCustomTextColor,
    glassOpacity,
    setGlassOpacity,
    transparentTabBar,
    setTransparentTabBar,
    wallpaperUri,
    wallpaperType,
    setWallpaper,
    hasWallpaper
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};

