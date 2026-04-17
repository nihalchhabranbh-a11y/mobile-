/* ─── Shiromani Printers Premium Orange Design ─── */

export const colors = {
  /* Bright Orange base */
  background:       "#F5F6FA", // Extremely subtle cool gray/off-white
  surface:          "#FFFFFF",
  cardBackground:   "#FFFFFF",
  cardBorder:       "#E2E8F0", // subtle border for light mode

  /* Orange primary */
  accentOrange:     "#FF6600",
  accentOrangeDark: "#E65C00",
  accentOrangeSoft: "rgba(255,102,0,0.10)",

  /* Accents */
  accentGreen:      "#10B981",
  accentBlue:       "#3B82F6",   // for icons
  accentRed:        "#EF4444",
  accentCyan:       "#0EA5E9",
  accentPurple:     "#8B5CF6",

  /* Typography */
  textPrimary:      "#1E293B", // Dark slate
  textSecondary:    "#475569",
  textMuted:        "#94A3B8",

  /* Surfaces */
  divider:          "#E2E8F0",
  inputBackground:  "#FFFFFF",

  /* Header gradient (Orange) */
  headerGradientStart: "#FF7A00",
  headerGradientEnd:   "#FF5500",

  /* Tab bar */
  tabBarBg:         "#FFFFFF",
  tabBarActive:     "#FF6600",
  tabBarInactive:   "#94A3B8",

  /* Status pill */
  paidBg:           "rgba(16,185,129,0.12)",
  paidText:         "#059669",
  unpaidBg:         "rgba(239,68,68,0.12)",
  unpaidText:       "#DC2626",
  partialBg:        "rgba(245,158,11,0.12)",
  partialText:      "#D97706",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const shadows = {
  card: {
    shadowColor: "#64748B",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  button: {
    shadowColor: "#FF6600",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  glow: {
    shadowColor: "#FF6600",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
};

export const typography = {
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: colors.textSecondary,
  },
  headingLg: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: colors.textPrimary,
  },
  headingMd: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: colors.textPrimary,
  },
  body: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: colors.textPrimary,
  },
  caption: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: colors.textMuted,
  },
  numberLg: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: colors.textPrimary,
  },
};
