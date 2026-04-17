import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../themeContext";
import { useSafeScreen } from "../hooks/useSafeScreen";
import { supabase } from "../services/supabaseClient";

export const RecoverDeletedScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeScreen();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [deleted, setDeleted] = useState<any[]>([]);
  const styles = useMemo(
    () => createStyles({ colors, spacing, radius }),
    [colors, spacing, radius]
  );

  const loadDeleted = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("bills")
        .select("id, customer, total, created_at")
        .eq("deleted", true)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) {
        setDeleted([]);
        return;
      }
      setDeleted((data as any[]) || []);
    } catch (e) {
      console.warn("[RecoverDeleted] load failed", e);
      setDeleted([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = (id: string, customer: string) => {
    Alert.alert("Restore Invoice", `Restore invoice for "${customer}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Restore",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("bills")
              .update({ deleted: false })
              .eq("id", id);
            if (error) throw error;
            setDeleted((prev) => prev.filter((d) => d.id !== id));
            Alert.alert("Restored", `Invoice for "${customer}" has been restored.`);
          } catch (e) {
            Alert.alert("Error", "Failed to restore invoice.");
          }
        },
      },
    ]);
  };

  React.useEffect(() => {
    loadDeleted();
  }, []);

  return (
    <View style={[styles.safe, { paddingTop: insets.paddingTop }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Recover Deleted Invoices</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.para}>
          Invoices deleted by mistake can be restored from here (if your database supports soft delete).
        </Text>
        {loading ? (
          <ActivityIndicator color={colors.accentBlue} style={{ marginTop: spacing.xl }} />
        ) : deleted.length === 0 ? (
          <View style={styles.card}>
            <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No deleted invoices found</Text>
          </View>
        ) : (
          deleted.map((inv) => (
            <View key={inv.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowCustomer}>{inv.customer}</Text>
                <Text style={styles.rowAmount}>₹{Number(inv.total || 0).toLocaleString("en-IN")}</Text>
              </View>
              <TouchableOpacity
                style={styles.restoreBtn}
                onPress={() => handleRestore(inv.id, inv.customer)}
              >
                <Ionicons name="refresh" size={16} color={colors.accentGreen || "#10B981"} />
                <Text style={styles.restoreBtnText}>Restore</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
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
      padding: spacing.xl,
      alignItems: "center",
      marginTop: spacing.md,
    },
    emptyText: { marginTop: spacing.sm, color: colors.textMuted },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      padding: spacing.md,
      backgroundColor: colors.cardBackground,
      borderRadius: radius.sm,
      marginBottom: spacing.sm,
    },
    rowCustomer: { fontWeight: "600", color: colors.textPrimary },
    rowAmount: { color: colors.accentBlue, fontWeight: "600", marginTop: 2 },
    restoreBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: (colors.accentGreen || "#10B981") + "40",
      backgroundColor: (colors.accentGreen || "#10B981") + "15",
    },
    restoreBtnText: { color: colors.accentGreen || "#10B981", fontSize: 12, fontWeight: "600" },
  });
