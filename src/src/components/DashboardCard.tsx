import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../themeContext";

type Props = {
  label: string;
  value: string;
  subtitle?: string;
  accentColor?: string;
};

export const DashboardCard: React.FC<Props> = ({
  label,
  value,
  subtitle,
  accentColor,
}) => {
  const { colors, spacing, radius } = useTheme();
  const styles = useMemo(
    () => createStyles({ colors, spacing, radius }),
    [colors, spacing, radius]
  );
  const effectiveAccent = accentColor || colors.accentBlue;
  return (
    <View style={styles.card}>
      <View
        style={[
          styles.iconPill,
          { backgroundColor: effectiveAccent + "22" },
        ]}
      >
        <View style={[styles.iconDot, { backgroundColor: effectiveAccent }]} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const createStyles = ({
  colors,
  spacing,
  radius,
}: {
  colors: any;
  spacing: any;
  radius: any;
}) =>
  StyleSheet.create({
    card: {
      flex: 1,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: spacing.sm,
    },
    iconPill: {
      alignSelf: "flex-start",
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 999,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.xs,
    },
    iconDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    value: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "800",
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 12,
    },
  });

