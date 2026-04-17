import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Platform,
  useWindowDimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface WebDashboardProps {
  summary: any;
  salesChartData: { data: Array<{ date: string; label: string; total: number }>; maxSale: number };
  transactions: any[];
  tasks: any[];
  user: any;
  brand: any;
  loading: boolean;
  navigation: any;
  fmtCurrency: (n: number) => string;
}

export const WebDashboard: React.FC<WebDashboardProps> = ({
  summary,
  salesChartData,
  transactions,
  tasks,
  user,
  brand,
  loading,
  navigation,
  fmtCurrency,
}) => {
  const { width } = useWindowDimensions();

  const S = React.useMemo(() => StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: "#F9FAFB",
    },
    loadingWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 24,
      backgroundColor: "#fff",
      borderBottomWidth: 1,
      borderBottomColor: "#E5E7EB",
    },
    greeting: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#111827" },
    brandName: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#6B7280", marginTop: 4 },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 16 },
    promoBtn: {
      backgroundColor: "#FEF3C7",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    promoText: { color: "#D97706", fontFamily: "Inter_600SemiBold", fontSize: 13 },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "#E5E7EB",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#fff",
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "#ea580c",
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
    
    content: { padding: 24 },
    
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 20,
      marginBottom: 32,
    },
    statCard: {
      flex: 1,
      minWidth: 200,
      backgroundColor: "#fff",
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: "#E5E7EB",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 6,
      elevation: 2,
    },
    statHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    statTitle: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#4B5563" },
    statValue: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#111827", marginTop: 12 },
    statSub: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#10B981", marginTop: 4 },
    
    mainRow: {
      flexDirection: Platform.OS === 'web' && width > 1024 ? "row" : "column",
      gap: 24,
    },
    chartSection: {
      flex: 2,
      backgroundColor: "#fff",
      borderRadius: 16,
      padding: 24,
      borderWidth: 1,
      borderColor: "#E5E7EB",
    },
    sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 20 },
    chartArea: {
      height: 250,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      paddingTop: 20,
    },
    chartBarWrap: { flex: 1, alignItems: "center", gap: 8 },
    chartBarContainer: { width: 40, height: 180, justifyContent: "flex-end", backgroundColor: "#F3F4F6", borderRadius: 8 },
    chartBarFill: { width: "100%", backgroundColor: "#ea580c", borderRadius: 8 },
    chartLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#6B7280" },
    
    recentSection: {
      flex: 1,
      backgroundColor: "#fff",
      borderRadius: 16,
      padding: 24,
      borderWidth: 1,
      borderColor: "#E5E7EB",
    },
    recentHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    recentViewAll: { color: "#ea580c", fontSize: 14, fontFamily: "Inter_600SemiBold" },
    recentItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: "#F3F4F6",
    },
    recentAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFF7ED", justifyContent: "center", alignItems: "center" },
    recentContent: { flex: 1, marginHorizontal: 12 },
    recentName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 2 },
    recentDate: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#6B7280" },
    recentAmount: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#111827" },
  }), [width]);

  if (loading) {
    return (
      <View style={S.loadingWrap}>
        <ActivityIndicator size="large" color="#ea580c" />
      </View>
    );
  }

  const cards = [
    { title: "Revenue (Last 7 Days)", value: fmtCurrency(summary.weekSales), sub: "Total Sales", icon: "trending-up", color: "#10B981", bg: "#D1FAE5" },
    { title: "To Collect", value: fmtCurrency(summary.pendingPayment), sub: "Pending Invoices", icon: "time-outline", color: "#F59E0B", bg: "#FEF3C7" },
    { title: "Total Customers", value: summary.totalCustomers.toString(), sub: "All time records", icon: "people-outline", color: "#3B82F6", bg: "#DBEAFE" },
    { title: "Tasks Completed", value: summary.completedTasks.toString(), sub: `${summary.pendingTasks} Pending`, icon: "checkmark-circle", color: "#8B5CF6", bg: "#EDE9FE" },
  ];

  return (
    <View style={S.root}>
      {/* Top Navbar */}
      <View style={S.header}>
        <View>
          <Text style={S.greeting}>Welcome back, {user?.name || "User"} 👋</Text>
          <Text style={S.brandName}>{brand?.shopName || "PrintMaster System"}</Text>
        </View>
        <View style={S.headerRight}>
          <TouchableOpacity style={S.promoBtn} onPress={() => navigation.navigate("EInvoice")}>
            <Ionicons name="rocket-outline" size={16} color="#D97706" />
            <Text style={S.promoText}>New Features Available</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.iconBtn} onPress={() => navigation.navigate("Notifications")}>
            <Ionicons name="notifications-outline" size={20} color="#4B5563" />
          </TouchableOpacity>
          <View style={S.avatar}>
            <Text style={S.avatarText}>{(user?.name || "U")[0].toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>
        {/* Metric Cards */}
        <View style={S.statsGrid}>
          {cards.map((card, idx) => (
            <View key={idx} style={S.statCard}>
              <View style={S.statHeader}>
                <Text style={S.statTitle}>{card.title}</Text>
                <View style={[S.iconBtn, { backgroundColor: card.bg, borderColor: "transparent", width: 32, height: 32 }]}>
                  <Ionicons name={card.icon as any} size={16} color={card.color} />
                </View>
              </View>
              <Text style={S.statValue}>{card.value}</Text>
              <Text style={[S.statSub, card.title === "To Collect" && { color: "#F59E0B" }]}>{card.sub}</Text>
            </View>
          ))}
        </View>

        <View style={S.mainRow}>
          {/* Sales Chart Area */}
          <View style={S.chartSection}>
            <Text style={S.sectionTitle}>Sales Activity (Last 7 Days)</Text>
            <View style={S.chartArea}>
              {salesChartData.data.slice(-7).map((d, i) => {
                const heightPct = salesChartData.maxSale > 0 ? (d.total / salesChartData.maxSale) * 100 : 0;
                return (
                  <View key={i} style={S.chartBarWrap}>
                    <View style={S.chartBarContainer}>
                      <View style={[S.chartBarFill, { height: `${heightPct}%` }]} />
                    </View>
                    <Text style={S.chartLabel} numberOfLines={1}>{d.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Recent Invoices list */}
          <View style={S.recentSection}>
            <View style={S.recentHeaderRow}>
              <Text style={[S.sectionTitle, { marginBottom: 0 }]}>Recent Activity</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Billing")}>
                <Text style={S.recentViewAll}>View All</Text>
              </TouchableOpacity>
            </View>

            {transactions.slice(0, 6).map((txn, idx) => (
              <TouchableOpacity
                key={txn.id || idx}
                style={S.recentItem}
                onPress={() => navigation.navigate("InvoiceDetail", { invoiceData: txn })}
                delayPressIn={0}
              >
                <View style={S.recentAvatar}>
                  <Ionicons name="receipt-outline" size={18} color="#ea580c" />
                </View>
                <View style={S.recentContent}>
                  <Text style={S.recentName}>{txn.customer}</Text>
                  <Text style={S.recentDate}>{txn.id} • {txn.createdAt.slice(0, 10)}</Text>
                </View>
                <Text style={S.recentAmount}>{fmtCurrency(txn.total)}</Text>
              </TouchableOpacity>
            ))}
            {transactions.length === 0 && (
              <Text style={{ textAlign: "center", color: "#9CA3AF", marginTop: 24, fontFamily: "Inter_500Medium" }}>
                No recent activity found.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
