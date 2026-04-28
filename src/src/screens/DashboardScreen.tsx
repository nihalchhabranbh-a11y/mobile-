import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
} from "react-native";
import { Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../themeContext";
import { useUser } from "../userContext";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { supabase, Task } from "../services/supabaseClient";
import {
  fetchBills,
  fetchBillPayments,
  RecentBill,
  BillPayment,
} from "../services/billingService";
import { getBillPaymentInfo } from "../utils/billingUtils";
import { useSafeScreen } from "../hooks/useSafeScreen";
import { loadBrand, Brand } from "../services/settingsService";
import { shareBillViaWhatsApp, WEB_BASE_URL } from "../utils/invoiceShare";
import { Card, StatusPill } from "../components/ui";
import { getProducts, Product } from "../services/productsService";
import { WebDashboard } from "./WebDashboard";
import { Platform } from "react-native";

type RecentTask = {
  id: string;
  title: string;
  workerName: string;
  status: "Pending" | "In Progress" | "Completed";
};

type WorkerWithCount = { id: string; name: string; completed: number };

export const DashboardScreen: React.FC = () => {
  const { colors, spacing, radius, topColor } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeScreen();
  const { user } = useUser();
  const styles = useMemo(
    () => createStyles({ colors, spacing, radius }),
    [colors, spacing, radius]
  );
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalOrders: 0,
    pendingTasks: 0,
    completedTasks: 0,
    revenueReceived: 0,
    pendingPayment: 0,
    totalCustomers: 0,
    billsToday: 0,
    todaySales: 0,
    paymentsReceivedToday: 0,
    tasksCompletedToday: 0,
    weekSales: 0,
  });
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [methodTotals, setMethodTotals] = useState<Record<string, number>>({});
  const [workerStats, setWorkerStats] = useState<WorkerWithCount[]>([]);
  const [recentBillsWithStatus, setRecentBillsWithStatus] = useState<
    Array<{ id: string; customer: string; total: number; status: string; paidAmount: number; remaining: number }>
  >([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [bills, setBills] = useState<RecentBill[]>([]);
  const [billPayments, setBillPayments] = useState<BillPayment[]>([]);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [txnRange, setTxnRange] = useState<"7" | "30" | "365">("365");
  const [rangePickerVisible, setRangePickerVisible] = useState(false);
  const [txnSearch, setTxnSearch] = useState("");
  const [stockValue, setStockValue] = useState(0);
  const [rangeFrom, setRangeFrom] = useState<string>("");
  const [rangeTo, setRangeTo] = useState<string>("");
  const [chartPeriod, setChartPeriod] = useState<"7" | "30">("7");

  const scrollY = useRef(new Animated.Value(0)).current;
  const dashSearchTranslateY = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, -40],
    extrapolate: "clamp",
  });
  const dashSearchOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const load = useCallback(async () => {
    let isMounted = true;
    try {
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10);

      const orgId = user?.organisationId || undefined;

      let customersQuery = supabase
        .from("customers")
        .select("id")
        .order("created_at", { ascending: false });
      if (orgId) customersQuery = customersQuery.eq("organisation_id", orgId);

      let tasksQuery = supabase
        .from("tasks")
        .select("id, title, status, worker, vendor, created_at, organisation_id")
        .order("created_at", { ascending: false })
        .limit(50);
      if (orgId) tasksQuery = tasksQuery.eq("organisation_id", orgId);

      let workersQuery = supabase
        .from("workers")
        .select("id, name, organisation_id")
        .order("created_at", { ascending: false });
      if (orgId) workersQuery = workersQuery.eq("organisation_id", orgId);

      const [billsData, billPaymentsData, customersRes, tasksRes, workersRes, brandRes, products] =
        await Promise.all([
          fetchBills(orgId),
          fetchBillPayments(orgId),
          customersQuery,
          tasksQuery,
          workersQuery,
          loadBrand(orgId ?? null),
          getProducts(orgId),
        ]);

      if (!isMounted) return;

      const customers = (customersRes.data || []) as any[];
      const tasks = (tasksRes.data || []) as Task[];
      const workers = (workersRes.data || []) as any[];

      const now = Date.now();
      const todayPrefix = today;
      const weekStart = now - 7 * 24 * 60 * 60 * 1000;
      const billsThisWeek = billsData.filter((b) => {
        const t = new Date(b.createdAt || "").getTime();
        return t && t >= weekStart && t <= now;
      });
      const billsCreatedToday = billsData.filter((b) =>
        String(b.createdAt || "").startsWith(todayPrefix)
      );

      const weekSales = billsThisWeek.reduce((s, b) => s + (Number(b.total) || 0), 0);
      const todaySales = billsCreatedToday.reduce((s, b) => s + (Number(b.total) || 0), 0);

      // O(n) — pre-group payments by billId to avoid repeated filtering inside getBillPaymentInfo
      const paymentsByBillId = new Map<string, typeof billPaymentsData>();
      for (const p of billPaymentsData) {
        const key = (p.billId || p.bill_id || "") as string;
        if (!paymentsByBillId.has(key)) paymentsByBillId.set(key, []);
        paymentsByBillId.get(key)!.push(p);
      }

      const revenueReceived = billsThisWeek
        .filter((b) => {
          const info = getBillPaymentInfo(b, paymentsByBillId.get(b.id) ?? []);
          return info.isPaid;
        })
        .reduce((sum, b) => sum + b.total, 0);
      let pendingPayment = 0;
      billsData.forEach((b) => {
        const info = getBillPaymentInfo(b, paymentsByBillId.get(b.id) ?? []);
        if (!info.isPaid) pendingPayment += info.remaining;
      });
      const todayPayments = billPaymentsData.filter((p) => (p.paidAt || "").toString().startsWith(today));
      const paymentsReceivedToday = todayPayments.reduce((s, p) => s + p.amount, 0);
      const tasksCompletedToday = tasks.filter((t) => t.status === "Completed" && (t as any).created_at && String((t as any).created_at).startsWith(today)).length;

      const pendingTasksCount = tasks.filter((t) => t.status !== "Completed").length;
      const completedTasksCount = tasks.filter((t) => t.status === "Completed").length;

      const methodTotalsAcc: Record<string, number> = {};
      billPaymentsData.forEach((p) => {
        const m = (p.method || "cash").toLowerCase();
        methodTotalsAcc[m] = (methodTotalsAcc[m] || 0) + p.amount;
      });

      const workerStatsAcc: WorkerWithCount[] = workers.map((w) => ({
        id: w.id,
        name: w.name || w.username || w.id,
        completed: tasks.filter((t) => (t.worker === w.id || (t as any).worker_id === w.id) && t.status === "Completed").length,
      }));
      workerStatsAcc.sort((a, b) => b.completed - a.completed);

      const recentBills = billsData.slice(0, 5).map((b) => {
        const info = getBillPaymentInfo(b, paymentsByBillId.get(b.id) ?? []);
        return {
          id: b.id,
          customer: b.customer,
          total: b.total,
          status: info.status,
          paidAmount: info.paidAmount,
          remaining: info.remaining,
        };
      });

      const mappedTasks: RecentTask[] = tasks.slice(0, 5).map((t) => ({
        id: t.id,
        title: t.title,
        workerName: t.worker || t.vendor || "—",
        status: t.status,
      }));

      setSummary({
        totalOrders: billsData.length,
        pendingTasks: pendingTasksCount,
        completedTasks: completedTasksCount,
        revenueReceived,
        pendingPayment,
        totalCustomers: customers.length,
        billsToday: billsCreatedToday.length,
        todaySales,
        paymentsReceivedToday,
        tasksCompletedToday,
        weekSales,
      });
      setRecentTasks(mappedTasks);
      setMethodTotals(methodTotalsAcc);
      setWorkerStats(workerStatsAcc.slice(0, 5));
      setRecentBillsWithStatus(recentBills);
      setBills(billsData);
      setBillPayments(billPaymentsData);
      setBrand(brandRes);

      const activeProducts = (products as Product[]).filter((p) => p.active !== false);
      const stockTotal = activeProducts.reduce(
        (sum, p) => sum + (Number(p.opening_stock || 0) * Number(p.default_rate || 0)),
        0
      );
      setStockValue(stockTotal);
    } catch (e) {
      console.warn("[Dashboard] Failed to load data", e);
    } finally {
      if (isMounted) setLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [user?.organisationId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filteredBills = useMemo(() => {
    // If user selected a date range, use it. Otherwise fall back to preset range.
    const hasRange = !!rangeFrom.trim() && !!rangeTo.trim();
    if (hasRange) {
      const fromT = new Date(rangeFrom.trim()).getTime();
      const toT = new Date(rangeTo.trim()).getTime();
      if (!fromT || !toT || Number.isNaN(fromT) || Number.isNaN(toT)) return bills;
      const start = Math.min(fromT, toT);
      const end = Math.max(fromT, toT) + 24 * 60 * 60 * 1000 - 1; // include entire end day
      return bills.filter((b) => {
        const t = new Date(b.createdAt).getTime();
        if (!t || Number.isNaN(t)) return false;
        return t >= start && t <= end;
      });
    }

    const days = txnRange === "7" ? 7 : txnRange === "30" ? 30 : 365;
    const now = Date.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    return bills.filter((b) => {
      const t = new Date(b.createdAt).getTime();
      if (!t || Number.isNaN(t)) return false;
      return t >= cutoff;
    });
  }, [bills, txnRange, rangeFrom, rangeTo]);

  const transactions = useMemo(
    () =>
      filteredBills.map((b) => {
        const info = getBillPaymentInfo(b, billPayments);
        return {
          id: b.id,
          customer: b.customer,
          total: b.total,
          status: info.status,
          paidAmount: info.paidAmount,
          remaining: info.remaining,
          createdAt: b.createdAt,
          phone: b.phone,
        };
      }),
    [filteredBills, billPayments]
  );

  const filteredTransactions = useMemo(() => {
    if (!txnSearch.trim()) return transactions;
    const q = txnSearch.toLowerCase().trim();
    return transactions.filter(
      (t) =>
        (t.customer || "").toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
    );
  }, [transactions, txnSearch]);

  const txnRangeLabel = useMemo(() => {
    if (rangeFrom.trim() && rangeTo.trim()) {
      const f = rangeFrom.trim();
      const t = rangeTo.trim();
      return `${f} → ${t}`;
    }
    return txnRange === "7"
      ? "LAST 7 DAYS"
      : txnRange === "30"
        ? "LAST 30 DAYS"
        : "LAST 365 DAYS";
  }, [txnRange, rangeFrom, rangeTo]);

  const fmtCurrency = (n: number) =>
    `₹${Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const salesChartData = useMemo(() => {
    const days = chartPeriod === "7" ? 7 : 30;
    const now = new Date();
    const data: Array<{ date: string; label: string; total: number }> = [];
    let maxSale = 0;
    
    // Initialize day buckets
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      data.push({ date: ds, label: i === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }), total: 0 });
    }
    
    // Fill from bills
    bills.forEach(b => {
      if (!b.createdAt) return;
      const bDate = b.createdAt.slice(0, 10);
      const match = data.find(x => x.date === bDate);
      if (match) {
        match.total += (Number(b.total) || 0);
        if (match.total > maxSale) maxSale = match.total;
      }
    });

    return { data, maxSale: maxSale || 1000 };
  }, [bills, chartPeriod]);

  const toCollect = summary.pendingPayment;
  const toPay = 0;
  const weekSale = summary.weekSales;
  const cashAndBank = Object.values(methodTotals).reduce(
    (sum, n) => sum + (n || 0),
    0
  );

  const handleOpenLastInvoiceInBrowser = () => {
    if (!bills.length) {
      navigation.navigate("Billing");
      return;
    }
    const lastBillId = bills[0].id;
    const base = WEB_BASE_URL.replace(/\/$/, "");
    const url = `${base}?inv=${encodeURIComponent(lastBillId)}`;
    Linking.openURL(url).catch((e) => {
      console.warn("[Dashboard] Failed to open invoice URL", e);
    });
  };

  if (Platform.OS === "web") {
    return (
      <WebDashboard
        summary={summary}
        salesChartData={salesChartData}
        transactions={transactions}
        tasks={recentTasks}
        user={user}
        brand={brand}
        loading={loading}
        navigation={navigation}
        fmtCurrency={fmtCurrency}
      />
    );
  }

  return (
    <View style={styles.root}>
      {/* Massive Orange Header Background */}
      <View style={[styles.headerBg, { backgroundColor: topColor || colors.headerGradientStart, paddingTop: insets.paddingTop || spacing.lg }]} />
      
      <SafeAreaView style={styles.safeArea}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header Info */}
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.greetingText}>Good Afternoon 👋</Text>
                <Text style={styles.brandTitle}>{(brand?.shopName || user?.name || "My Business").toUpperCase()}</Text>
              </View>
              <View style={styles.headerIconsRow}>
                <TouchableOpacity style={styles.headerIconCircleWhite} onPress={handleOpenLastInvoiceInBrowser}>
                  <Ionicons name="desktop-outline" size={20} color="#FF6600" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerIconCircleWhite} onPress={() => navigation.navigate("Billing")}>
                  <Ionicons name="document-text-outline" size={20} color="#FF6600" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerIconCircleOrange}>
                  <Ionicons name="settings-sharp" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Top Stat Cards (Horizontal Scroll or Flex Row) */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.statsScroll}
              style={styles.statsScrollView}
            >
              <TouchableOpacity style={styles.statCardSmall} onPress={() => navigation.navigate("Billing")}>
                <View style={[styles.statIconBadge, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="trending-up" size={16} color="#4CAF50" />
                </View>
                <Text style={styles.statSmallValue} numberOfLines={1}>{fmtCurrency(summary.weekSales)}</Text>
                <Text style={styles.statSmallLabel}>Revenue</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statCardSmall} onPress={() => navigation.navigate("Billing", { filter: "to_collect" } as any)}>
                <View style={[styles.statIconBadge, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="time-outline" size={16} color="#FF9800" />
                </View>
                <Text style={styles.statSmallValue} numberOfLines={1}>{fmtCurrency(summary.pendingPayment)}</Text>
                <Text style={styles.statSmallLabel}>Pending</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statCardSmall} onPress={() => navigation.navigate("Billing")}>
                <View style={[styles.statIconBadge, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="receipt-outline" size={16} color="#2196F3" />
                </View>
                <Text style={styles.statSmallValue} numberOfLines={1}>{summary.billsToday}</Text>
                <Text style={styles.statSmallLabel}>Bills</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statCardSmall} onPress={() => navigation.navigate("Parties")}>
                <View style={[styles.statIconBadge, { backgroundColor: '#F3E5F5' }]}>
                  <Ionicons name="people-outline" size={16} color="#9C27B0" />
                </View>
                <Text style={styles.statSmallValue} numberOfLines={1}>{summary.totalCustomers}</Text>
                <Text style={styles.statSmallLabel}>Customers</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.bodyContent}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickGrid}>
                {[
                  { label: "Create\nInvoice", icon: "document-text-outline", color: "#FF7A00", bg: "#FFF4ED", route: "InvoiceCreate" },
                  { label: "Record\nPayment", icon: "wallet-outline", color: "#3B82F6", bg: "#EFF6FF", route: "Parties" },
                  { label: "Add\nCustomer", icon: "person-add-outline", color: "#10B981", bg: "#ECFDF5", route: "Parties", params: { openCreate: true } },
                  { label: "Inventory\n", icon: "cube-outline", color: "#8B5CF6", bg: "#F5F3FF", route: "Items" },
                  { label: "Fast\nBilling", icon: "barcode-outline", color: "#0EA5E9", bg: "#F0F9FF", route: "BarcodeBilling" },
                  { label: "GST\nFinder", icon: "search-outline", color: "#EAB308", bg: "#FEFCE8", route: "GstFinder" },
                  { label: "Delivery\nChallan", icon: "document-outline", color: "#10B981", bg: "#ECFDF5", route: "Challans" },
                  { label: "Stock\nTransfer", icon: "swap-horizontal", color: "#8B5CF6", bg: "#F5F3FF", route: "Transfers" },
                  { label: "E-Invoice\n", icon: "shield-checkmark-outline", color: "#3B82F6", bg: "#EFF6FF", route: "EInvoice" },
                ].map((action, i) => (
                  <TouchableOpacity key={i} style={styles.quickCard} onPress={() => navigation.navigate(action.route as any, action.params)}>
                    <View style={[styles.quickIconBox, { backgroundColor: action.bg }]}>
                      <Ionicons name={action.icon as any} size={24} color={action.color} />
                    </View>
                    <Text style={styles.quickLabel}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionTitle}>Today's Activity</Text>
              <View style={styles.activityBox}>
                <View style={styles.activityPill}>
                   <Ionicons name="document-text-outline" size={16} color="#10B981" />
                   <View style={styles.activityPillCol}>
                     <Text style={[styles.activityPillVal, { color: '#10B981' }]}>{summary.billsToday}</Text>
                     <Text style={styles.activityPillLabel}>Bills Today</Text>
                   </View>
                </View>
                <View style={styles.activityPill}>
                   <Ionicons name="wallet-outline" size={16} color="#3B82F6" />
                   <View style={styles.activityPillCol}>
                     <Text style={[styles.activityPillVal, { color: '#3B82F6' }]}>₹{summary.paymentsReceivedToday}</Text>
                     <Text style={styles.activityPillLabel}>Received</Text>
                   </View>
                </View>
                <View style={styles.activityPill}>
                   <Ionicons name="checkmark-circle-outline" size={16} color="#FF7A00" />
                   <View style={styles.activityPillCol}>
                     <Text style={[styles.activityPillVal, { color: '#FF7A00' }]}>{summary.tasksCompletedToday}</Text>
                     <Text style={styles.activityPillLabel}>Tasks Done</Text>
                   </View>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Sales Trend</Text>
              <View style={styles.salesTrendBox}>
                <View style={styles.salesTrendToggles}>
                  <TouchableOpacity 
                    style={chartPeriod === "7" ? styles.salesTrendToggleActive : styles.salesTrendToggleInactive}
                    onPress={() => setChartPeriod("7")}
                  >
                    <Text style={chartPeriod === "7" ? styles.salesTrendToggleActiveText : styles.salesTrendToggleInactiveText}>7 Days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={chartPeriod === "30" ? styles.salesTrendToggleActive : styles.salesTrendToggleInactive}
                    onPress={() => setChartPeriod("30")}
                  >
                    <Text style={chartPeriod === "30" ? styles.salesTrendToggleActiveText : styles.salesTrendToggleInactiveText}>30 Days</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Dynamic Chart bars mapping to actual sales data */}
                <View style={styles.fakeChartWrapper}>
                   <View style={styles.fakeChartCols}>
                     {salesChartData.data.map((d, i) => {
                       const heightPercentage = Math.max(4, (d.total / salesChartData.maxSale) * 70); // Max 70px height
                       const isToday = i === salesChartData.data.length - 1;
                       const width = chartPeriod === "7" ? 34 : 8; // Thinner bars for 30 days
                       return (
                         <View key={i} style={{ height: heightPercentage, width, backgroundColor: isToday ? '#FF7A00' : '#71A8F9', borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                       );
                     })}
                   </View>
                   <View style={styles.fakeChartLabels}>
                     {chartPeriod === "7" ? salesChartData.data.map((d, i) => (
                       <Text key={i} style={styles.fakeChartLabel} numberOfLines={1}>{d.label.split(' ')[0]}</Text>
                     )) : (
                       <View style={{flexDirection: 'row', justifyContent: 'space-between', width: '100%'}}>
                         <Text style={styles.fakeChartLabel}>{salesChartData.data[0].date.slice(5)}</Text>
                         <Text style={styles.fakeChartLabel}>Today</Text>
                       </View>
                     )}
                   </View>
                   <View style={styles.fakeChartLegend}>
                      <View style={{flexDirection:'row', alignItems:'center', gap: 4}}>
                         <View style={{width:10,height:10, backgroundColor: '#71A8F9'}} />
                         <Text style={styles.fakeChartLegendText}>Sales</Text>
                      </View>
                      <View style={{flexDirection:'row', alignItems:'center', gap: 4}}>
                         <View style={{width:10,height:10, backgroundColor: '#FF7A00'}} />
                         <Text style={styles.fakeChartLegendText}>Today</Text>
                      </View>
                      <Text style={[styles.fakeChartLegendText, {marginLeft: 'auto'}]}>Last {chartPeriod} days</Text>
                   </View>
                </View>
              </View>

              <View style={styles.searchWrap}>
                 <Ionicons name="search" size={18} color={colors.textMuted} />
                 <TextInput 
                   style={styles.searchInput}
                   placeholder="Search party or invoice no."
                   placeholderTextColor={colors.textMuted}
                   value={txnSearch}
                   onChangeText={setTxnSearch}
                 />
              </View>

              <View style={styles.recentSectionHeader}>
                <Text style={styles.recentTransactionsTitle}>Recent Transactions</Text>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                   <TouchableOpacity style={styles.recentSectionChip} onPress={() => setRangePickerVisible(true)}>
                      <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.recentSectionChipText}>LAST {txnRange} DAYS</Text>
                   </TouchableOpacity>
                   <TouchableOpacity onPress={() => navigation.navigate("Billing")}>
                     <Text style={styles.viewAllText}>View All</Text>
                   </TouchableOpacity>
                </View>
              </View>

              <View style={styles.transactionsList}>
                {filteredTransactions.length === 0 ? (
                   <Text style={{textAlign: 'center', color: colors.textMuted, marginVertical: 20}}>No transactions yet</Text>
                ) : (
                  filteredTransactions.slice(0, 5).map(b => (
                    <TouchableOpacity 
                      key={b.id} 
                      style={styles.txnRow}
                      onPress={() => {
                        if (b.status === "Draft") {
                           navigation.navigate("InvoiceCreate", { editBillId: b.id });
                        } else {
                           navigation.navigate("InvoiceDetail", { billId: b.id });
                        }
                      }}
                    >
                      <View style={styles.txnAvatar}>
                         <Text style={styles.txnAvatarText}>{(b.customer || "U")[0].toUpperCase()}</Text>
                      </View>
                      <View style={styles.txnLeft}>
                         <Text style={styles.txnCustomer} numberOfLines={1}>{b.customer}</Text>
                         <Text style={styles.txnMeta}>INV-{b.id.slice(-4).toUpperCase()} • {new Date(b.createdAt).toLocaleDateString("en-IN", {day: "2-digit", month: "short"})}</Text>
                          {!!(b as any).desc && <Text style={[styles.txnMeta, { marginTop: 1 }]} numberOfLines={1}>{(b as any).desc}</Text>}
                          {!!(b as any).notes && <Text style={[styles.txnMeta, { fontStyle: "italic", marginTop: 1 }]} numberOfLines={1}>Note: {(b as any).notes}</Text>}
                      </View>
                      <View style={styles.txnRight}>
                         <Text style={styles.txnAmount}>{fmtCurrency(b.total)}</Text>
                         <Text style={[
                           styles.txnStatus, 
                           b.status === "Paid" ? styles.txnStatusPaid : b.status === "Partially Paid" ? styles.txnStatusPartial : styles.txnStatusUnpaid
                         ]}>{b.status.toUpperCase()}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>

            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Calendar range picker (From → To) */}
      {rangePickerVisible && (
        <View style={styles.rangeOverlay}>
          <View style={styles.rangeModal}>
            <View style={styles.rangeHeader}>
              <Text style={styles.rangeTitle}>Select date range</Text>
              <TouchableOpacity
                onPress={() => setRangePickerVisible(false)}
                style={styles.rangeClose}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.rangePresets}>
              {[
                { key: "7", label: "Last 7 days" },
                { key: "30", label: "Last 30 days" },
                { key: "365", label: "Last 365 days" },
              ].map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={styles.rangePresetBtn}
                  onPress={() => {
                     setRangeFrom("");
                     setRangeTo("");
                     setTxnRange(p.key as any);
                     setRangePickerVisible(false);
                  }}
                >
                  <Text style={styles.rangePresetText}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.rangeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rangeLabel}>From (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.rangeInput}
                  value={rangeFrom}
                  onChangeText={setRangeFrom}
                  placeholder="2026-03-01"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rangeLabel}>To (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.rangeInput}
                  value={rangeTo}
                  onChangeText={setRangeTo}
                  placeholder="2026-03-31"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.rangeActions}>
              <TouchableOpacity
                style={styles.rangeSecondary}
                onPress={() => {
                  setRangeFrom("");
                  setRangeTo("");
                  setRangePickerVisible(false);
                }}
              >
                <Text style={styles.rangeSecondaryText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rangePrimary}
                onPress={() => setRangePickerVisible(false)}
              >
                <Text style={styles.rangePrimaryText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerBg: {
      position: 'absolute',
      width: '100%',
      height: 280, // Massive orange background
      backgroundColor: colors.headerGradientStart || '#FF6600',
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
    },
    safeArea: {
      flex: 1,
    },
    loadingWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 120,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.lg,
    },
    greetingText: {
      color: 'white',
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      opacity: 0.9,
    },
    brandTitle: {
      color: 'white',
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      letterSpacing: 0.5,
      marginTop: 2,
    },
    headerIconsRow: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    headerIconCircleWhite: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIconCircleOrange: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(0,0,0,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    statsScrollView: {
      marginBottom: 20,
    },
    statsScroll: {
      paddingHorizontal: spacing.sm,
      gap: spacing.sm,
      paddingVertical: 10,
    },
    statCardSmall: {
      backgroundColor: colors.cardBackground,
      borderRadius: radius.md,
      padding: spacing.md,
      minWidth: 90,
      alignItems: 'flex-start',
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
      marginHorizontal: spacing.xs,
    },
    statIconBadge: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    statSmallValue: {
      color: colors.textPrimary,
      fontSize: 15,
      fontFamily: "Inter_700Bold",
    },
    statSmallLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      marginTop: 2,
    },
    bodyContent: {
      flex: 1,
      backgroundColor: 'transparent',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      marginBottom: spacing.md,
      marginTop: spacing.md,
    },
    quickGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      justifyContent: 'space-between',
    },
    quickCard: {
      width: '31%', // 3 columns
      aspectRatio: 1,
      backgroundColor: colors.cardBackground,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xs,
      shadowColor: "#000",
      shadowOpacity: 0.03,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
      marginBottom: spacing.xs,
    },
    quickIconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    quickLabel: {
      color: colors.textPrimary,
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      textAlign: 'center',
      lineHeight: 14,
    },
    activityBox: {
      backgroundColor: colors.cardBackground,
      borderRadius: radius.lg,
      padding: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    activityPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    activityPillCol: {
      flex: 1,
    },
    activityPillVal: {
      fontSize: 14,
      color: colors.textPrimary,
      fontFamily: "Inter_700Bold",
    },
    activityPillLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      marginTop: 2,
    },
    salesTrendBox: {
      backgroundColor: colors.cardBackground,
      borderRadius: radius.lg,
      padding: spacing.lg,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    salesTrendToggles: {
      flexDirection: 'row',
      position: 'absolute',
      right: spacing.lg,
      top: -45, // overlaps title visually
      backgroundColor: '#fff',
      padding: 4,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      gap: 4,
    },
    salesTrendToggleActive: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: '#FF7A00',
      backgroundColor: '#FFF4ED',
    },
    salesTrendToggleActiveText: {
      color: '#FF7A00',
      fontSize: 10,
      fontFamily: "Inter_600SemiBold",
    },
    salesTrendToggleInactive: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 100,
      backgroundColor: '#F3F4F6',
    },
    salesTrendToggleInactiveText: {
      color: '#6B7280',
      fontSize: 10,
      fontFamily: "Inter_600SemiBold",
    },
    fakeChartWrapper: {
      marginTop: 20,
    },
    fakeChartCols: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      height: 80,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
    },
    fakeChartLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    fakeChartLabel: {
      fontSize: 9,
      color: '#9CA3AF',
      width: 34,
      textAlign: 'center',
    },
    fakeChartLegend: {
      flexDirection: 'row',
      marginTop: 16,
      gap: 12,
    },
    fakeChartLegendText: {
      fontSize: 10,
      color: '#9CA3AF',
      fontFamily: "Inter_500Medium",
    },
    searchWrap: {
      backgroundColor: '#fff',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      borderRadius: 100,
      height: 48,
      marginTop: spacing.xl,
      gap: spacing.sm,
      shadowColor: "#000",
      shadowOpacity: 0.03,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: '#111827',
    },
    recentSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.xl,
      marginBottom: spacing.md,
      backgroundColor: '#fff',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: radius.md,
    },
    recentTransactionsTitle: {
      color: '#111827',
      fontSize: 14,
      fontFamily: "Inter_700Bold",
    },
    recentSectionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F3F4F6',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      gap: 4,
    },
    recentSectionChipText: {
      fontSize: 9,
      color: '#6B7280',
      fontFamily: "Inter_600SemiBold",
    },
    viewAllText: {
      color: '#3B82F6',
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
    },
    transactionsList: {
      backgroundColor: '#fff',
      padding: spacing.md,
      borderRadius: radius.lg,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    txnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: '#F3F4F6',
    },
    txnAvatar: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: '#FFF1F2',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    txnAvatarText: {
      color: '#EF4444',
      fontSize: 18,
      fontFamily: "Inter_700Bold",
    },
    txnLeft: {
      flex: 1,
    },
    txnCustomer: {
      color: '#111827',
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
    },
    txnMeta: {
      color: '#9CA3AF',
      fontSize: 11,
      marginTop: 2,
      fontFamily: "Inter_400Regular",
    },
    txnRight: {
      alignItems: 'flex-end',
    },
    txnAmount: {
      color: '#111827',
      fontSize: 14,
      fontFamily: "Inter_700Bold",
    },
    txnStatus: {
      fontSize: 10,
      fontFamily: "Inter_700Bold",
      marginTop: 4,
    },
    txnStatusPaid: {
      color: '#10B981',
    },
    txnStatusPartial: {
      color: '#F59E0B',
    },
    txnStatusUnpaid: {
      color: '#EF4444',
    },
    rangeOverlay: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    rangeModal: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: colors.cardBackground,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.lg,
      gap: spacing.md,
    },
    rangeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    rangeTitle: { color: colors.textPrimary, fontSize: 16, fontFamily: "Inter_700Bold" },
    rangeClose: { padding: 6 },
    rangePresets: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    rangePresetBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.surface,
    },
    rangePresetText: { color: colors.textPrimary, fontSize: 12, fontFamily: "Inter_600SemiBold" },
    rangeRow: { flexDirection: "row", gap: spacing.md },
    rangeLabel: { color: colors.textSecondary, fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 },
    rangeInput: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontFamily: "Inter_400Regular",
      fontSize: 13,
    },
    rangeActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
    rangeSecondary: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    rangeSecondaryText: { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" },
    rangePrimary: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.accentBlue,
    },
    rangePrimaryText: { color: "#fff", fontFamily: "Inter_600SemiBold" },
  });

