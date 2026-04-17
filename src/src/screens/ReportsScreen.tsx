import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import { useTheme } from "../themeContext";
import { useSafeScreen } from "../hooks/useSafeScreen";
import { useUser } from "../userContext";
import { fetchBills, fetchBillPayments, RecentBill, BillPayment } from "../services/billingService";
import { getBillPaymentInfo } from "../utils/billingUtils";
import { useFocusEffect } from "@react-navigation/native";

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://www.yourapp.com";

export const ReportsScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeScreen();
  const { user } = useUser();
  const styles = useMemo(
    () => createStyles({ colors, spacing, radius }),
    [colors, spacing, radius]
  );
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<RecentBill[]>([]);
  const [billPayments, setBillPayments] = useState<BillPayment[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [b, p] = await Promise.all([
        fetchBills((user as any)?.organisationId || undefined),
        fetchBillPayments((user as any)?.organisationId || undefined),
      ]);
      setBills(b);
      setBillPayments(p);
    } catch (e) {
      console.warn("[Reports] load failed", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { totalRevenue, totalBills, avgBill, collectionRate, paidCount, unpaidCount, gstCount, nonGstCount, thisMonthRevenue, thisMonthCount } = useMemo(() => {
    let revenue = 0;
    let paid = 0;
    for (const bill of bills) {
      const info = getBillPaymentInfo(bill, billPayments);
      revenue += info.paidAmount;
      if (info.isPaid) paid++;
    }
    const total = bills.length;
    const avg = total ? bills.reduce((s, b) => s + b.total, 0) / total : 0;
    const rate = total ? Math.round((paid / total) * 100) : 0;
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    let monthRev = 0;
    let monthCnt = 0;
    for (const bill of bills) {
      const d = new Date(bill.createdAt || "");
      if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
        const info = getBillPaymentInfo(bill, billPayments);
        monthRev += info.paidAmount;
        monthCnt++;
      }
    }
    const gst = bills.filter((b) => b.gst).length;
    return {
      totalRevenue: revenue,
      totalBills: total,
      avgBill: avg,
      collectionRate: rate,
      paidCount: paid,
      unpaidCount: total - paid,
      gstCount: gst,
      nonGstCount: total - gst,
      thisMonthRevenue: monthRev,
      thisMonthCount: monthCnt,
    };
  }, [bills, billPayments]);

  const fmtCurrency = (n: number) =>
    `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleTransfer = () => {
    Linking.openURL(WEB_APP_URL).catch(() =>
      Alert.alert("Error", "Could not open web app.")
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accentBlue} />
          <Text style={styles.loadingText}>Loading reports…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.paddingTop || spacing.lg }]}>
        <Text style={styles.title}>Revenue Reports</Text>

        <View style={styles.cardRow}>
          <View style={[styles.statCard, { borderLeftColor: colors.accentGreen }]}>
            <Text style={styles.statValue}>{fmtCurrency(totalRevenue)}</Text>
            <Text style={styles.statLabel}>Total Revenue</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: colors.accentBlue }]}>
            <Text style={styles.statValue}>{totalBills}</Text>
            <Text style={styles.statLabel}>Total Bills</Text>
          </View>
        </View>
        <View style={styles.cardRow}>
          <View style={[styles.statCard, { borderLeftColor: colors.accentOrange }]}>
            <Text style={styles.statValue}>{fmtCurrency(avgBill)}</Text>
            <Text style={styles.statLabel}>Avg. Bill</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: colors.accentBlue }]}>
            <Text style={styles.statValue}>{collectionRate}%</Text>
            <Text style={styles.statLabel}>Collection Rate</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Month</Text>
          <View style={styles.monthCard}>
            <Text style={styles.monthValue}>{fmtCurrency(thisMonthRevenue)}</Text>
            <Text style={styles.monthLabel}>{thisMonthCount} bills this month</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>Paid Bills</Text>
            <Text style={[styles.badge, styles.badgeGreen]}>{paidCount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>Unpaid Bills</Text>
            <Text style={[styles.badge, styles.badgeRed]}>{unpaidCount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>With GST</Text>
            <Text style={[styles.badge, styles.badgeBlue]}>{gstCount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>Without GST</Text>
            <Text style={[styles.badge, styles.badgePurple]}>{nonGstCount}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transfer to main software</Text>
          <Text style={styles.transferHint}>
            Open the full web app for CSV export, detailed reports, and backup.
          </Text>
          <TouchableOpacity style={styles.transferButton} onPress={handleTransfer}>
            <Text style={styles.transferButtonText}>Open Web App</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    safeArea: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
    loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.sm },
    loadingText: { color: colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular" },
    title: {
      color: colors.textPrimary,
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      marginBottom: spacing.lg,
    },
    cardRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
    statCard: {
      flex: 1,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderLeftWidth: 4,
    },
    statValue: { color: colors.textPrimary, fontSize: 16, fontFamily: "Inter_700Bold" },
    statLabel: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontFamily: "Inter_500Medium" },
    section: { marginTop: spacing.lg },
    sectionTitle: { color: colors.textPrimary, fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: spacing.sm },
    monthCard: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    monthValue: { color: colors.accentGreen, fontSize: 20, fontFamily: "Inter_700Bold" },
    monthLabel: { color: colors.textMuted, fontSize: 13, marginTop: 4, fontFamily: "Inter_400Regular" },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    summaryText: { color: colors.textSecondary, fontSize: 14, fontFamily: "Inter_500Medium" },
    badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999, fontSize: 12, fontFamily: "Inter_600SemiBold" },
    badgeGreen: { backgroundColor: colors.accentGreen + "33", color: colors.accentGreen },
    badgeRed: { backgroundColor: colors.accentRed + "33", color: colors.accentRed },
    badgeBlue: { backgroundColor: colors.accentBlue + "33", color: colors.accentBlue },
    badgePurple: { backgroundColor: "#8B5CF6" + "33", color: "#8B5CF6" },
    transferHint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm, fontFamily: "Inter_400Regular" },
    transferButton: {
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.accentBlue,
      alignItems: "center",
    },
    transferButtonText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  });
