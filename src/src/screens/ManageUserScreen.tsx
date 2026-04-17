import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../themeContext";
import { useSafeScreen } from "../hooks/useSafeScreen";

export const ManageUserScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeScreen();
  const navigation = useNavigation<any>();
  const styles = useMemo(
    () => createStyles({ colors, spacing, radius }),
    [colors, spacing, radius]
  );

  return (
    <View style={[styles.safe, { paddingTop: insets.paddingTop }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Manage User</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.para}>
          Add or remove users who can access this business. Only admin can manage users.
        </Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Users</Text>
          <Text style={styles.muted}>User list will appear here. Configure in web or admin panel.</Text>
        </View>
      </ScrollView>
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
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    backBtn: { marginRight: spacing.sm, padding: spacing.xs },
    title: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
    scroll: { flex: 1 },
    content: { padding: spacing.lg },
    para: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.lg },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.lg,
    },
    cardTitle: { fontSize: 16, fontWeight: "600", color: colors.textPrimary, marginBottom: spacing.sm },
    muted: { fontSize: 13, color: colors.textMuted },
  });
