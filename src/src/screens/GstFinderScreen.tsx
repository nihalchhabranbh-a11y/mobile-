import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../themeContext";
import { useSafeScreen } from "../hooks/useSafeScreen";
import { lookupGstin, GstTaxpayerData } from "../services/sandboxService";
import { useUser } from "../userContext";
import { PaywallModal } from "../components/PaywallModal";

export const GstFinderScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeScreen();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<GstTaxpayerData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { user } = useUser();
  const [showPaywall, setShowPaywall] = useState(false);

  const styles = useMemo(
    () => createStyles({ colors, spacing, radius }),
    [colors, spacing, radius]
  );

  const handleSearch = async () => {
    if (user?.organisationPlan !== "premium") {
      setShowPaywall(true);
      return;
    }
    const gstin = query.trim().toUpperCase();
    if (!gstin) {
      Alert.alert("Required", "Enter a GSTIN to search.");
      return;
    }
    setSearching(true);
    setResult(null);
    setErrorMsg(null);
    try {
      const data = await lookupGstin(gstin);
      setResult(data);
    } catch (e: any) {
      setErrorMsg(e?.message || "Could not fetch GST details. Check the GSTIN and try again.");
    } finally {
      setSearching(false);
    }
  };

  const statusColor = (status?: string) => {
    if (!status) return colors.textMuted;
    const s = status.toUpperCase();
    if (s === "ACTIVE" || s === "ACT") return "#10B981";
    if (s === "CANCELLED" || s === "CAN") return "#EF4444";
    return "#F59E0B";
  };

  return (
    <View style={[styles.safe, { paddingTop: insets.paddingTop }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>GSTIN Finder</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hint}>
          Enter a 15-digit GST Identification Number (GSTIN) to verify it and fetch business details.
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="e.g. 29ABCDE1234F1Z5"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={(v) => setQuery(v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={15}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={[styles.searchIconBtn, { backgroundColor: colors.accentBlue }]}
            onPress={handleSearch}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="search" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Result card */}
        {result && (
          <View style={styles.resultCard}>
            {/* Header row */}
            <View style={styles.resultHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultGstin}>{result.gstin}</Text>
                <Text style={styles.resultLegalName}>
                  {result.legal_name || result.trade_name || "—"}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(result.status) + "20" }]}>
                <Text style={[styles.statusText, { color: statusColor(result.status) }]}>
                  {result.status || "Unknown"}
                </Text>
              </View>
            </View>

            {/* Details grid */}
            {[
              { label: "Trade Name", value: result.trade_name },
              { label: "Constitution", value: result.constitution_of_business },
              { label: "Registration Date", value: result.registration_date },
              { label: "State", value: result.state },
              { label: "Address", value: result.address },
            ].map(
              (row) =>
                row.value ? (
                  <View key={row.label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{row.label}</Text>
                    <Text style={styles.detailValue}>{row.value}</Text>
                  </View>
                ) : null
            )}
          </View>
        )}

        {/* Error state */}
        {errorMsg && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={22} color="#EF4444" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Placeholder when nothing searched yet */}
        {!result && !errorMsg && !searching && (
          <View style={styles.placeholderCard}>
            <Ionicons name="shield-checkmark-outline" size={40} color={colors.textMuted} />
            <Text style={styles.placeholderTitle}>Verify any GSTIN instantly</Text>
            <Text style={styles.placeholderSub}>
              Check business name, registration status, address and filing history.
            </Text>
          </View>
        )}
      </ScrollView>
      
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureName="GST Sandbox Verification"
        requiredPlan="premium"
      />
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
    content: { padding: spacing.lg, paddingBottom: 60 },
    hint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 18 },
    inputRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    input: {
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: radius.md,
      padding: spacing.md,
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
      letterSpacing: 1,
    },
    searchIconBtn: {
      width: 52,
      borderRadius: radius.md,
      justifyContent: "center",
      alignItems: "center",
    },
    resultCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    resultHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    resultGstin: { fontSize: 13, color: colors.accentBlue, fontWeight: "700", letterSpacing: 1 },
    resultLegalName: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginTop: 2 },
    statusBadge: {
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      alignSelf: "flex-start",
    },
    statusText: { fontSize: 12, fontWeight: "700" },
    detailRow: {
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    detailLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600", marginBottom: 2 },
    detailValue: { fontSize: 14, color: colors.textPrimary },
    errorCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      backgroundColor: "#EF444415",
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: "#EF444430",
    },
    errorText: { flex: 1, fontSize: 13, color: "#EF4444", lineHeight: 18 },
    placeholderCard: {
      alignItems: "center",
      padding: spacing.xl,
      gap: spacing.sm,
    },
    placeholderTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginTop: spacing.sm,
    },
    placeholderSub: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: 20,
    },
  });
