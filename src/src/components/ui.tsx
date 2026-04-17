import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  GestureResponderEvent,
  ViewStyle,
  TextStyle,
} from "react-native";
import { useTheme } from "../themeContext";

type CardProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
};

export const Card: React.FC<CardProps> = ({ children, style }) => {
  const { colors, spacing, radius } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flex: 1,
          padding: spacing.lg,
          borderRadius: radius.lg,
          backgroundColor: colors.cardBackground,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },
      }),
    [colors, spacing, radius]
  );
  return <View style={[styles.card, style]}>{children}</View>;
};

type StatusVariant = "paid" | "unpaid" | "partial" | "info" | "success" | "danger";

type StatusPillProps = {
  label: string;
  variant?: StatusVariant;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
};

export const StatusPill: React.FC<StatusPillProps> = ({
  label,
  variant = "info",
  style,
  textStyle,
}) => {
  const { colors, spacing } = useTheme();
  const styles = useMemo(() => {
    const baseBg = colors.accentBlue + "22";
    const baseText = colors.accentBlue;
    const map: Record<StatusVariant, { bg: string; text: string }> = {
      info: { bg: baseBg, text: baseText },
      paid: { bg: colors.accentGreen + "22", text: colors.accentGreen },
      success: { bg: colors.accentGreen + "22", text: colors.accentGreen },
      partial: { bg: colors.accentOrange + "22", text: colors.accentOrange },
      unpaid: { bg: colors.accentRed + "22", text: colors.accentRed },
      danger: { bg: colors.accentRed + "22", text: colors.accentRed },
    };
    const palette = map[variant];
    return StyleSheet.create({
      pill: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 999,
        alignSelf: "flex-start",
        backgroundColor: palette.bg,
      },
      pillText: {
        fontSize: 11,
        fontFamily: "Inter_600SemiBold",
        color: palette.text,
      },
    });
  }, [colors, spacing, variant]);

  return (
    <View style={[styles.pill, style]}>
      <Text style={[styles.pillText, textStyle]}>{label}</Text>
    </View>
  );
};

type ListRowProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  amount?: string;
  statusLabel?: string;
  statusVariant?: StatusVariant;
  avatarLabel?: string;
  onPress?: (e: GestureResponderEvent) => void;
  rightContent?: React.ReactNode;
};

export const ListRow: React.FC<ListRowProps> = ({
  title,
  subtitle,
  meta,
  amount,
  statusLabel,
  statusVariant,
  avatarLabel,
  onPress,
  rightContent,
}) => {
  const { colors, spacing, radius } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flexDirection: "row",
          alignItems: "center",
          padding: spacing.lg,
          borderRadius: radius.lg,
          backgroundColor: colors.cardBackground,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          marginBottom: spacing.sm,
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },
        avatar: {
          width: 40,
          height: 40,
          borderRadius: radius.md,
          backgroundColor: colors.accentBlue + "22",
          justifyContent: "center",
          alignItems: "center",
          marginRight: spacing.lg,
        },
        avatarText: {
          color: colors.accentBlue,
          fontSize: 18,
          fontFamily: "Inter_700Bold",
        },
        main: { flex: 1, minWidth: 0 },
        title: {
          color: colors.textPrimary,
          fontSize: 15,
          fontFamily: "Inter_600SemiBold",
          flexShrink: 1,
        },
        subtitle: {
          color: colors.textMuted,
          fontSize: 12,
          marginTop: 2,
          fontFamily: "Inter_400Regular",
          flexShrink: 1,
        },
        meta: {
          color: colors.textSecondary,
          fontSize: 11,
          marginTop: 2,
          fontFamily: "Inter_400Regular",
          flexShrink: 1,
        },
        right: {
          alignItems: "flex-end",
          marginLeft: spacing.sm,
          flexShrink: 0,
        },
        amount: {
          color: colors.textPrimary,
          fontSize: 15,
          fontFamily: "Inter_700Bold",
        },
      }),
    [colors, spacing, radius]
  );

  const content = (
    <View style={styles.root}>
      {avatarLabel ? (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarLabel}</Text>
        </View>
      ) : null}
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={1.1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1} maxFontSizeMultiplier={1.1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text style={styles.meta} numberOfLines={1} maxFontSizeMultiplier={1.1}>
            {meta}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        {amount ? (
          <Text style={styles.amount} numberOfLines={1} maxFontSizeMultiplier={1.1}>
            {amount}
          </Text>
        ) : null}
        {statusLabel ? (
          <StatusPill label={statusLabel} variant={statusVariant} />
        ) : null}
        {rightContent}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
};

type FabAction = {
  label: string;
  onPress: () => void;
};

type FabProps = {
  actions: FabAction[];
};

export const FabWithActions: React.FC<FabProps> = ({ actions }) => {
  const { colors, spacing } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          position: "absolute",
          bottom: 32,
          alignSelf: "center",
          alignItems: "center",
        },
        fab: {
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.accentBlue,
          justifyContent: "center",
          alignItems: "center",
          elevation: 4,
          shadowColor: "#000",
          shadowOpacity: 0.16,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        },
        fabPlus: {
          color: "#fff",
          fontSize: 32,
          marginTop: -2,
        },
        sheet: {
          marginBottom: spacing.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: 999,
          backgroundColor: colors.surface,
          flexDirection: "row",
          gap: spacing.sm,
        },
        sheetButton: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: 999,
          backgroundColor: colors.cardBackground,
          borderWidth: 1,
          borderColor: colors.cardBorder,
        },
        sheetText: {
          color: colors.textPrimary,
          fontSize: 12,
          fontWeight: "600",
        },
      }),
    [colors, spacing]
  );

  const [open, setOpen] = React.useState(false);

  return (
    <View style={styles.container}>
      {open && (
        <View style={styles.sheet}>
          {actions.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.sheetButton}
              onPress={() => {
                setOpen(false);
                a.onPress();
              }}
            >
              <Text style={styles.sheetText}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => setOpen((v) => !v)}
      >
        <Text style={styles.fabPlus}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

