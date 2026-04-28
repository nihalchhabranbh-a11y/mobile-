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
import { Ionicons } from "@expo/vector-icons";

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://www.yourapp.com";

export const ReportsScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeScreen();
  const { user } = useUser();
  const styles = useMemo(() => createStyles({ colors, spacing, radius }), [colors, spacing, radius]);
  
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<RecentBill[]>([]);
  const [billPayments, setBillPayments] = useState<BillPayment[]>([]);
  const [activeTab, setActiveTab] = useState<"Overview" | "Performers" | "Outstandings">("Overview");

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

  const stats = useMemo(() => {
    let revenue = 0, paid = 0;
    let monthRev = 0, monthCnt = 0;
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const customerStats: Record<string, { name: string; revenue: number; billed: number; count: number }> = {};
    const productStats: Record<string, { name: string; qty: number; revenue: number }> = {};
    const outstandings: Array<RecentBill & { balance: number; isOverdue: boolean }> = [];

    for (const bill of bills) {
      const info = getBillPaymentInfo(bill, billPayments);
      revenue += info.paidAmount;
      if (info.isPaid) paid++;

      // Current Month
      const d = new Date(bill.createdAt || "");
      if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
        monthRev += info.paidAmount;
        monthCnt++;
      }

      // Customer Stats
      if (!customerStats[bill.customer]) {
        customerStats[bill.customer] = { name: bill.customer, revenue: 0, billed: 0, count: 0 };
      }
      customerStats[bill.customer].revenue += info.paidAmount;
      customerStats[bill.customer].billed += bill.total;
      customerStats[bill.customer].count += 1;

      // Product Stats
      if (bill.items) {
        for (const item of bill.items) {
          const key = item.productId || item.name;
          if (!productStats[key]) {
            productStats[key] = { name: item.name, qty: 0, revenue: 0 };
          }
          productStats[key].qty += Number(item.qty || 0);
          productStats[key].revenue += Number(item.amount || 0);
        }
      }

      // Outstandings
      const balance = info.totalAmount - info.paidAmount;
      if (balance > 0) {
        const isOverdue = false; // We don't have dueDate in RecentBill yet, add logic if needed
        outstandings.push({ ...bill, balance, isOverdue });
      }
    }

    const total = bills.length;
    const avg = total ? bills.reduce((s, b) => s + b.total, 0) / total : 0;
    const rate = total ? Math.round((paid / total) * 100) : 0;
    const gst = bills.filter((b) => b.gst).length;

    const topCustomers = Object.values(customerStats).sort((a, b) => b.billed - a.billed).slice(0, 5);
    const topProducts = Object.values(productStats).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const sortedOutstandings = outstandings.sort((a, b) => b.balance - a.balance);

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
      topCustomers,
      topProducts,
      outstandings: sortedOutstandings,
    };
  }, [bills, billPayments]);

  const fmtCurrency = (n: number) =>
    `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleExport = () => {
    Linking.openURL(WEB_APP_URL).catch(() =>
      Alert.alert("Error", "Could not open web app.")
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accentBlue} />
          <Text style={styles.loadingText}>Generating intelligent insights…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.paddingTop || spacing.lg }]}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Analytics & Reports</Text>
          <TouchableOpacity onPress={handleExport} style={styles.exportBtn}>
            <Ionicons name="download-outline" size={16} color={colors.accentBlue} />
            <Text style={styles.exportText}>Export</Text>
          </TouchableOpacity>
        </View>

        {/* Custom Tab Bar */}
        <View style={styles.tabBar}>
          {(["Overview", "Performers", "Outstandings"] as const).map(tab => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]} 
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* OVERVIEW TAB */}
        {activeTab === "Overview" && (
          <View>
            <View style={styles.cardRow}>
              <View style={[styles.statCard, { borderLeftColor: colors.accentGreen }]}>
                <Ionicons name="cash-outline" size={20} color={colors.accentGreen} style={{ marginBottom: 4 }} />
                <Text style={styles.statValue}>{fmtCurrency(stats.totalRevenue)}</Text>
                <Text style={styles.statLabel}>Collected Revenue</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: colors.accentBlue }]}>
                <Ionicons name="document-text-outline" size={20} color={colors.accentBlue} style={{ marginBottom: 4 }} />
                <Text style={styles.statValue}>{stats.totalBills}</Text>
                <Text style={styles.statLabel}>Total Bills</Text>
              </View>
            </View>
            
            <View style={styles.cardRow}>
              <View style={[styles.statCard, { borderLeftColor: colors.accentOrange }]}>
                <Ionicons name="pricetag-outline" size={20} color={colors.accentOrange} style={{ marginBottom: 4 }} />
                <Text style={styles.statValue}>{fmtCurrency(stats.avgBill)}</Text>
                <Text style={styles.statLabel}>Average Bill Value</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: colors.accentPurple || "#8B5CF6" }]}>
                <Ionicons name="pie-chart-outline" size={20} color={colors.accentPurple || "#8B5CF6"} style={{ marginBottom: 4 }} />
                <Text style={styles.statValue}>{stats.collectionRate}%</Text>
                <Text style={styles.statLabel}>Collection Rate</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>This Month's Performance</Text>
              <View style={styles.monthCard}>
                <View>
                  <Text style={styles.monthValue}>{fmtCurrency(stats.thisMonthRevenue)}</Text>
                  <Text style={styles.monthLabel}>Collected from {stats.thisMonthCount} bills</Text>
                </View>
                <View style={styles.trendIcon}>
                  <Ionicons name="trending-up" size={24} color={colors.accentGreen} />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* PERFORMERS TAB */}
        {activeTab === "Performers" && (
          <View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Customers</Text>
              <View style={styles.listCard}>
                {stats.topCustomers.length === 0 ? <Text style={styles.emptyText}>No data available</Text> : null}
                {stats.topCustomers.map((c, i) => (
                  <View key={i} style={[styles.listItem, i === stats.topCustomers.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.listLeft}>
                      <View style={styles.rankBadge}><Text style={styles.rankText}>{i + 1}</Text></View>
                      <View>
                        <Text style={styles.itemName}>{c.name}</Text>
                        <Text style={styles.itemSub}>{c.count} bills drafted</Text>
                      </View>
                    </View>
                    <Text style={styles.itemVal}>{fmtCurrency(c.billed)}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Products</Text>
              <View style={styles.listCard}>
                {stats.topProducts.length === 0 ? <Text style={styles.emptyText}>No data available</Text> : null}
                {stats.topProducts.map((p, i) => (
                  <View key={i} style={[styles.listItem, i === stats.topProducts.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.listLeft}>
                      <View style={[styles.rankBadge, { backgroundColor: colors.accentBlue }]}><Text style={styles.rankText}>{i + 1}</Text></View>
                      <View>
                        <Text style={styles.itemName}>{p.name}</Text>
                        <Text style={styles.itemSub}>{p.qty} sold</Text>
                      </View>
                    </View>
                    <Text style={styles.itemVal}>{fmtCurrency(p.revenue)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* OUTSTANDINGS TAB */}
        {activeTab === "Outstandings" && (
          <View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Unpaid & Pending Balances</Text>
              <Text style={styles.sectionSub}>Total Unpaid Bills: {stats.unpaidCount}</Text>
              
              <View style={[styles.listCard, { marginTop: spacing.md }]}>
                {stats.outstandings.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <Ionicons name="checkmark-circle-outline" size={48} color={colors.accentGreen} />
                    <Text style={[styles.emptyText, { marginTop: spacing.sm }]}>All bills are paid! Outstanding is zero.</Text>
                  </View>
                ) : null}
                
                {stats.outstandings.map((bill, i) => (
                  <View key={bill.id} style={[styles.listItem, i === stats.outstandings.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.listLeft}>
                      <Ionicons name="alert-circle" size={24} color={bill.isOverdue ? colors.accentRed : colors.accentOrange} style={{ marginRight: spacing.sm }} />
                      <View>
                        <Text style={styles.itemName}>{bill.customer}</Text>
                        <Text style={styles.itemSub}>{bill.number || 'Draft'} • {new Date(bill.createdAt).toLocaleDateString()}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.itemVal, { color: colors.accentRed }]}>{fmtCurrency(bill.balance)}</Text>
                      <Text style={styles.itemSub}>of {fmtCurrency(bill.total)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = ({ colors, spacing, radius }: any) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
    loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.sm },
    loadingText: { color: colors.textMuted, fontSize: 13, fontFamily: "Inter_500Medium" },
    
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
    title: { color: colors.textPrimary, fontSize: 22, fontFamily: "Inter_700Bold" },
    exportBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.accentBlue + "15", borderRadius: radius.full },
    exportText: { color: colors.accentBlue, fontSize: 13, fontFamily: "Inter_600SemiBold" },
    
    tabBar: { flexDirection: "row", backgroundColor: colors.cardBackground, borderRadius: radius.full, padding: 4, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.cardBorder },
    tabBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.full },
    tabBtnActive: { backgroundColor: colors.accentBlue },
    tabText: { color: colors.textSecondary, fontSize: 13, fontFamily: "Inter_600SemiBold" },
    tabTextActive: { color: "#FFF" },

    cardRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
    statCard: { flex: 1, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.cardBorder, borderLeftWidth: 4, elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    statValue: { color: colors.textPrimary, fontSize: 18, fontFamily: "Inter_700Bold" },
    statLabel: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontFamily: "Inter_500Medium" },
    
    section: { marginTop: spacing.md },
    sectionTitle: { color: colors.textPrimary, fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: spacing.xs },
    sectionSub: { color: colors.textMuted, fontSize: 13, fontFamily: "Inter_400Regular" },
    
    monthCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.cardBorder },
    monthValue: { color: colors.accentGreen, fontSize: 24, fontFamily: "Inter_700Bold" },
    monthLabel: { color: colors.textSecondary, fontSize: 14, marginTop: 4, fontFamily: "Inter_500Medium" },
    trendIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentGreen + "15", alignItems: "center", justifyContent: "center" },

    listCard: { backgroundColor: colors.cardBackground, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden" },
    listItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
    listLeft: { flexDirection: "row", alignItems: "center" },
    rankBadge: { width: 28, height: 28, borderRadius: 6, backgroundColor: colors.accentOrange, alignItems: "center", justifyContent: "center", marginRight: spacing.md },
    rankText: { color: "#FFF", fontSize: 12, fontFamily: "Inter_700Bold" },
    itemName: { color: colors.textPrimary, fontSize: 15, fontFamily: "Inter_600SemiBold" },
    itemSub: { color: colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
    itemVal: { color: colors.textPrimary, fontSize: 15, fontFamily: "Inter_700Bold" },
    
    emptyWrap: { padding: spacing.xl, alignItems: "center", justifyContent: "center" },
    emptyText: { color: colors.textMuted, fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center", padding: spacing.md },
  });

