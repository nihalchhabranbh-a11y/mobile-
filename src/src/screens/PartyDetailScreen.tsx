import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  FlatList,
  ScrollView,
  TextInput,
  Linking,
  Alert,
  Platform,
} from "react-native";
import { useRoute, useFocusEffect, useNavigation } from "@react-navigation/native";
import { useTheme } from "../themeContext";
import { useUser } from "../userContext";
import { useSafeScreen } from "../hooks/useSafeScreen";
import { getCustomers, Customer, deleteCustomer } from "../services/customersService";
import {
  fetchBills,
  fetchBillPayments,
  RecentBill,
  BillPayment,
} from "../services/billingService";
import { getBillPaymentInfo } from "../utils/billingUtils";
import { shareBillViaWhatsApp } from "../utils/invoiceShare";
import { Ionicons } from "@expo/vector-icons";

type TabKey = "transactions" | "profile" | "ledger" | "itemwise";



// ─── helper ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const fmtShort = (n: number) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const letter = (name || "?").charAt(0).toUpperCase();
  const colors = ["#4F46E5", "#0891B2", "#059669", "#D97706", "#DC2626", "#7C3AED"];
  const bg = colors[letter.charCodeAt(0) % colors.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: "#fff", fontSize: size * 0.42, fontFamily: "Inter_700Bold" }}>{letter}</Text>
    </View>
  );
}

// ─── CREATE BILL DROPDOWN ────────────────────────────────────────────────────
const CREATE_OPTIONS = [
  { key: "sales", label: "Sales Invoice", icon: "document-text-outline" as const },
  { key: "payment", label: "Payment In", icon: "wallet-outline" as const },
  { key: "quotation", label: "Quotation", icon: "receipt-outline" as const },
  { key: "proforma", label: "Proforma Invoice", icon: "document-outline" as const },
  { key: "return", label: "Sales Return", icon: "return-down-back-outline" as const },
  { key: "challan", label: "Delivery Challan", icon: "car-outline" as const },
  { key: "purchase", label: "Purchase Order", icon: "cart-outline" as const },
];

// ─── LEFT SIDE: Party List Item ───────────────────────────────────────────────
function PartyListItem({
  item,
  selected,
  onPress,
}: {
  item: { customer: Customer; remainingTotal: number };
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.partyListItem,
        selected && { backgroundColor: "#EEF2FF", borderLeftWidth: 3, borderLeftColor: "#4F46E5" },
      ]}
    >
      <Avatar name={item.customer.name} size={36} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[styles.partyListName, selected && { color: "#4F46E5" }]} numberOfLines={1}>
          {item.customer.name}
        </Text>
        {item.remainingTotal !== 0 ? (
          <Text style={{ fontSize: 11, color: item.remainingTotal > 0 ? "#F59E0B" : "#059669", fontFamily: "Inter_600SemiBold" }}>
            {item.remainingTotal > 0 ? `↑ ${fmtShort(item.remainingTotal)}` : `↓ ${fmtShort(Math.abs(item.remainingTotal))}`}
          </Text>
        ) : (
          <Text style={{ fontSize: 11, color: "#6B7280", fontFamily: "Inter_400Regular" }}>to ₹0</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── TRANSACTION ROW ──────────────────────────────────────────────────────────
function TxnRow({ bill, payments, onPress }: { bill: RecentBill; payments: BillPayment[]; onPress: () => void }) {
  const info = getBillPaymentInfo(bill, payments);
  const statusColor =
    info.status === "Paid" ? "#059669" : info.status === "Partially Paid" ? "#D97706" : "#DC2626";
  const statusBg =
    info.status === "Paid" ? "#DCFCE7" : info.status === "Partially Paid" ? "#FEF3C7" : "#FEE2E2";

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.txnRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.txnDate}>{fmtDate(bill.createdAt)}</Text>
        <Text style={styles.txnType}>Sales Invoices</Text>
        <Text style={styles.txnNo}>SP/SL/{new Date(bill.createdAt).getFullYear().toString().slice(-2)}-{(new Date(bill.createdAt).getFullYear() + 1).toString().slice(-2)}/{bill.id.slice(-4).toUpperCase()}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text style={styles.txnAmt}>{fmt(bill.total)}</Text>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: statusBg }}>
          <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: statusColor }}>{info.status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── PAYMENT RECEIPT ROW ──────────────────────────────────────────────────────
function PaymentRow({ payment }: { payment: BillPayment }) {
  return (
    <View style={[styles.txnRow, { backgroundColor: "#F0FDF4" }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.txnDate}>{fmtDate(payment.paidAt)}</Text>
        <Text style={[styles.txnType, { color: "#059669" }]}>Payment In</Text>
        <Text style={styles.txnNo}>{payment.method?.toUpperCase() || "CASH"}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[styles.txnAmt, { color: "#059669" }]}>+{fmt(payment.amount)}</Text>
      </View>
    </View>
  );
}

// ─── LEDGER ROW ──────────────────────────────────────────────────────────────
function LedgerRow({
  date,
  desc,
  debit,
  credit,
  balance,
}: {
  date: string;
  desc: string;
  debit: number;
  credit: number;
  balance: number;
}) {
  return (
    <View style={styles.ledgerRow}>
      <Text style={[styles.ledgerCell, { flex: 1.5 }]}>{date}</Text>
      <Text style={[styles.ledgerCell, { flex: 3 }]} numberOfLines={1}>{desc}</Text>
      <Text style={[styles.ledgerCell, { flex: 1.5, color: "#DC2626", textAlign: "right" }]}>
        {debit > 0 ? fmt(debit) : "-"}
      </Text>
      <Text style={[styles.ledgerCell, { flex: 1.5, color: "#059669", textAlign: "right" }]}>
        {credit > 0 ? fmt(credit) : "-"}
      </Text>
      <Text style={[styles.ledgerCell, { flex: 1.5, textAlign: "right" }]}>{fmt(balance)}</Text>
    </View>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export const PartyDetailScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const { user } = useUser();
  const insets = useSafeScreen();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  // State
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bills, setBills] = useState<RecentBill[]>([]);
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(route?.params?.customerId ?? null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("transactions");
  const [txnFilter, setTxnFilter] = useState<"all" | "invoices" | "payments">("all");
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [dateFilter, setDateFilter] = useState("Last 365 Days");
  const [showDateMenu, setShowDateMenu] = useState(false);

  // Load all data
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const orgId = user?.organisationId || undefined;
      const [cs, bs, ps] = await Promise.all([
        getCustomers(orgId),
        fetchBills(orgId),
        fetchBillPayments(orgId),
      ]);
      setCustomers(cs);
      setBills(bs);
      setPayments(ps);
    } catch (e) {
      console.warn("[PartyDetail] load error", e);
    } finally {
      setLoading(false);
    }
  }, [user?.organisationId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));


  // Auto-select first if no param
  const partiesWithBalance = useMemo(() => {
    const paymentsByBillId = new Map<string, BillPayment[]>();
    for (const p of payments) {
      const arr = paymentsByBillId.get(p.billId) || [];
      arr.push(p);
      paymentsByBillId.set(p.billId, arr);
    }
    const billByCustomer = new Map<string, RecentBill[]>();
    for (const b of bills) {
      const key = (b.customer || "").trim().toLowerCase();
      if (!key) continue;
      const arr = billByCustomer.get(key) || [];
      arr.push(b);
      billByCustomer.set(key, arr);
    }
    return customers.map((c) => {
      const cbills = billByCustomer.get(c.name.trim().toLowerCase()) || [];
      const remaining = cbills.reduce(
        (sum, b) => sum + getBillPaymentInfo(b, paymentsByBillId.get(b.id) || []).remaining,
        0
      );
      return { customer: c, remainingTotal: remaining };
    });
  }, [customers, bills, payments]);

  const filteredParties = useMemo(() => {
    if (!search.trim()) return partiesWithBalance;
    const q = search.toLowerCase();
    return partiesWithBalance.filter(
      (x) =>
        x.customer.name.toLowerCase().includes(q) ||
        (x.customer.phone || "").includes(q)
    );
  }, [partiesWithBalance, search]);

  // Selected customer
  const selected = useMemo(
    () => partiesWithBalance.find((x) => x.customer.id === selectedId) ?? null,
    [partiesWithBalance, selectedId]
  );

  const customerBills = useMemo(() => {
    if (!selected) return [];
    const cPhone = String(selected.customer.phone || "").replace(/\D/g, "");
    return bills.filter((b) => {
      const bPhone = String(b.phone || "").replace(/\D/g, "");
      return (
        (cPhone && bPhone === cPhone) ||
        (b.customer || "").trim().toLowerCase() === selected.customer.name.trim().toLowerCase()
      );
    }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [bills, selected]);

  const customerPayments = useMemo(() => {
    const billIds = new Set(customerBills.map((b) => b.id));
    return payments
      .filter((p) => billIds.has(p.billId))
      .sort((a, b) => String(b.paidAt || "").localeCompare(String(a.paidAt || "")));
  }, [payments, customerBills]);

  const outstanding = useMemo(
    () => customerBills.reduce((sum, b) => sum + getBillPaymentInfo(b, payments).remaining, 0),
    [customerBills, payments]
  );

  const totalBusiness = useMemo(
    () => customerBills.reduce((sum, b) => sum + (b.total || 0), 0),
    [customerBills]
  );

  const paidTotal = useMemo(
    () => customerBills.reduce((sum, b) => sum + getBillPaymentInfo(b, payments).paidAmount, 0),
    [customerBills, payments]
  );

  // Merged txn list for "Transactions" tab (bills + payments chronologically)
  const mergedTxns = useMemo(() => {
    const rows: Array<{ type: "bill" | "payment"; date: string; data: any }> = [
      ...customerBills.map((b) => ({ type: "bill" as const, date: b.createdAt, data: b })),
      ...customerPayments.map((p) => ({ type: "payment" as const, date: p.paidAt || "", data: p })),
    ];
    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (txnFilter === "invoices") return rows.filter((r) => r.type === "bill");
    if (txnFilter === "payments") return rows.filter((r) => r.type === "payment");
    return rows;
  }, [customerBills, customerPayments, txnFilter]);

  // Ledger entries
  const ledgerEntries = useMemo(() => {
    let runningBalance = selected?.customer.opening_balance ?? 0;
    const entries: Array<{ date: string; desc: string; debit: number; credit: number; balance: number }> = [];
    if ((selected?.customer.opening_balance ?? 0) !== 0) {
      entries.push({
        date: fmtDate(selected?.customer.created_at),
        desc: "Opening Balance",
        debit: runningBalance > 0 ? runningBalance : 0,
        credit: runningBalance < 0 ? Math.abs(runningBalance) : 0,
        balance: runningBalance,
      });
    }
    const rows: Array<{ date: string; desc: string; debit: number; credit: number }> = [
      ...customerBills.map((b) => {
        const isCredit = ["Payment In", "Sales Return"].includes((b as any).docType || "");
        const shortId = (b.id || "").length > 16 ? (b.id.slice(0, 8).toUpperCase()) : b.id;
        return {
          date: fmtDate(b.createdAt),
          desc: isCredit ? `Payment In #${shortId}` : `Invoice #${b.id}`,
          debit: isCredit ? 0 : b.total,
          credit: isCredit ? b.total : 0,
        };
      }),
      ...customerPayments.map((p) => {
        const shortId = (p.id || "").length > 16 ? p.id.slice(0, 8).toUpperCase() : p.id;
        return { date: fmtDate(p.paidAt), desc: `Payment In #${shortId}`, debit: 0, credit: p.amount };
      }),
    ].sort((a, b) => a.date.localeCompare(b.date));

    for (const r of rows) {
      runningBalance = runningBalance + r.debit - r.credit;
      entries.push({ ...r, balance: runningBalance });
    }
    return entries; 
  }, [customerBills, customerPayments, selected]);

  // Item-wise report
  const itemWiseMap = useMemo(() => {
    const map = new Map<string, { qty: number; total: number }>();
    for (const b of customerBills) {
      const items = (b as any).items || [];
      for (const item of items) {
        const key = item.name || "Unknown";
        const prev = map.get(key) || { qty: 0, total: 0 };
        map.set(key, {
          qty: prev.qty + (item.qty || 0),
          total: prev.total + (item.amount || 0),
        });
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [customerBills]);

  // Delete party
  const handleDelete = () => {
    Alert.alert(
      "Delete Party",
      `Delete "${selected?.customer.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (selected) await (deleteCustomer as any)(selected.customer.id);
              setSelectedId(null);
              load();
            } catch (e) {
              Alert.alert("Error", "Could not delete party.");
            }
          },
        },
      ]
    );
  };

  // Navigation on create option — each doc type routes to InvoiceCreate with prefillDocType
  const handleCreateOption = (key: string) => {
    setShowCreateMenu(false);
    const cust = selected?.customer;
    const navParams = {
      prefillCustomer: cust?.name,
      prefillPhone: cust?.phone,
      prefillAddress: cust?.billing_address,
    };
    if (key === "sales") {
      navigation.navigate("InvoiceCreate", { ...navParams, prefillDocType: "Sales Invoice" });
    } else if (key === "payment") {
      navigation.navigate("Payments", { prefillCustomer: cust?.name, prefillPhone: cust?.phone });
    } else if (key === "quotation") {
      navigation.navigate("InvoiceCreate", { ...navParams, prefillDocType: "Quotation" });
    } else if (key === "proforma") {
      navigation.navigate("InvoiceCreate", { ...navParams, prefillDocType: "Proforma Invoice" });
    } else if (key === "return") {
      navigation.navigate("InvoiceCreate", { ...navParams, prefillDocType: "Sales Return" });
    } else if (key === "challan") {
      navigation.navigate("InvoiceCreate", { ...navParams, prefillDocType: "Delivery Challan" });
    } else if (key === "purchase") {
      navigation.navigate("InvoiceCreate", { ...navParams, prefillDocType: "Purchase Order" });
    } else {
      navigation.navigate("InvoiceCreate", navParams);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFF" }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="#4F46E5" size="large" />
          <Text style={{ color: "#6B7280", marginTop: 12, fontFamily: "Inter_500Medium" }}>Loading parties…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { paddingTop: Platform.OS === 'web' ? 0 : insets.paddingTop }]}>

      {/* ── Header bar — only shown on Android/mobile ───────────────────────── */}
      {Platform.OS !== 'web' && (
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Parties</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={styles.headerBtn} onPress={load}>
              <Ionicons name="refresh-outline" size={18} color="#4F46E5" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.body}>
        {/* ══ LEFT PANEL — Party List ══════════════════════════════════════ */}
        <View style={styles.leftPanel}>
          {/* Web-only: top row with Add Party + Refresh */}
          {Platform.OS === 'web' && (
            <View style={styles.leftPanelHeader}>
              <Text style={styles.leftPanelTitle}>Parties</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={styles.leftPanelBtn}
                  onPress={load}
                >
                  <Ionicons name="refresh-outline" size={14} color="#4F46E5" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.leftPanelBtn, { backgroundColor: '#4F46E5', borderColor: '#4F46E5' }]}
                  onPress={() => navigation.navigate('Parties', { openCreate: true })}
                >
                  <Ionicons name="add" size={14} color="#fff" />
                  <Text style={{ fontSize: 11, color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {/* Summary pills */}
          <View style={styles.summaryPills}>
            <View style={styles.pill}>
              <Text style={styles.pillIcon}>↑</Text>
              <View>
                <Text style={styles.pillAmt}>{fmtShort(partiesWithBalance.filter(x => x.remainingTotal > 0).reduce((s, x) => s + x.remainingTotal, 0))}</Text>
                <Text style={styles.pillLabel}>To Collect</Text>
              </View>
            </View>
            <View style={[styles.pill, { backgroundColor: "#FFF7ED" }]}>
              <Text style={[styles.pillIcon, { color: "#D97706" }]}>↓</Text>
              <View>
                <Text style={[styles.pillAmt, { color: "#D97706" }]}>{fmtShort(Math.abs(partiesWithBalance.filter(x => x.remainingTotal < 0).reduce((s, x) => s + x.remainingTotal, 0)))}</Text>
                <Text style={styles.pillLabel}>To Pay</Text>
              </View>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={15} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search Party"
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* List */}
          <FlatList
            data={filteredParties}
            keyExtractor={(x) => x.customer.id}
            renderItem={({ item }) => (
              <PartyListItem
                item={item}
                selected={item.customer.id === selectedId}
                onPress={() => { setSelectedId(item.customer.id); setTab("transactions"); }}
              />
            )}
            ListEmptyComponent={<Text style={{ color: "#9CA3AF", fontSize: 12, textAlign: "center", marginTop: 24, fontFamily: "Inter_400Regular" }}>No parties</Text>}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* ══ DIVIDER ══════════════════════════════════════════════════════ */}
        <View style={styles.divider} />

        {/* ══ RIGHT PANEL — Detail ═════════════════════════════════════════ */}
        {!selected ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 8 }}>
            <Ionicons name="people-outline" size={48} color="#D1D5DB" />
            <Text style={{ color: "#9CA3AF", fontFamily: "Inter_500Medium", fontSize: 14 }}>Select a party</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {/* ── Right header ──────────────────────────────────────────── */}
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailName} numberOfLines={1}>{selected.customer.name}</Text>
                {outstanding !== 0 && (
                  <Text style={{ fontSize: 12, color: outstanding > 0 ? "#F59E0B" : "#059669", fontFamily: "Inter_500Medium" }}>
                    {outstanding > 0 ? `To Collect: ${fmt(outstanding)}` : `Advance: ${fmt(Math.abs(outstanding))}`}
                  </Text>
                )}
              </View>
              {/* Action buttons */}
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                {/* Create dropdown button */}
                <View>
                  <TouchableOpacity
                    style={styles.createBtn}
                    onPress={() => setShowCreateMenu(!showCreateMenu)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="add-circle-outline" size={15} color="#4F46E5" />
                    <Text style={styles.createBtnText}>Create Sales Invoice</Text>
                    <Ionicons name={showCreateMenu ? "chevron-up" : "chevron-down"} size={13} color="#4F46E5" />
                  </TouchableOpacity>
                  {/* Modal-based dropdown — renders in true portal, no z-index issues */}
                  <Modal
                    visible={showCreateMenu}
                    transparent
                    animationType="none"
                    onRequestClose={() => setShowCreateMenu(false)}
                    statusBarTranslucent
                  >
                    <View style={{ flex: 1 }}>
                      {/* Invisible full-screen backdrop — closes menu on outside click */}
                      <TouchableOpacity
                        style={StyleSheet.absoluteFillObject}
                        activeOpacity={1}
                        onPress={() => setShowCreateMenu(false)}
                      />
                      {/* Dropdown box — positioned absolutely AFTER backdrop so paint on top */}
                      <View style={{
                        position: 'absolute', top: 48, right: 12,
                        backgroundColor: '#fff', borderRadius: 10,
                        borderWidth: 1, borderColor: '#E5E7EB',
                        shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 14,
                        shadowOffset: { width: 0, height: 6 }, elevation: 20,
                        minWidth: 200, paddingVertical: 4,
                      }}>
                        {CREATE_OPTIONS.map((opt) => (
                          <TouchableOpacity
                            key={opt.key}
                            style={styles.dropdownItem}
                            onPress={() => handleCreateOption(opt.key)}
                            activeOpacity={0.75}
                          >
                            <Ionicons name={opt.icon} size={14} color="#374151" />
                            <Text style={styles.dropdownItemText}>{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </Modal>
                </View>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => navigation.navigate("Parties", { openEdit: selected.customer.id })}
                >
                  <Ionicons name="create-outline" size={16} color="#374151" />
                  <Text style={styles.iconBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, { borderColor: "#FCA5A5" }]} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Tabs ──────────────────────────────────────────────────── */}
            <View style={styles.tabBar}>
              {(
                [
                  { key: "transactions", label: "Transactions", icon: "swap-horizontal-outline" as const },
                  { key: "profile", label: "Profile", icon: "person-outline" as const },
                  { key: "ledger", label: "Ledger (Statement)", icon: "newspaper-outline" as const },
                  { key: "itemwise", label: "Item Wise Report", icon: "bar-chart-outline" as const },
                ] as const
              ).map((t) => (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
                >
                  <Ionicons
                    name={t.icon}
                    size={13}
                    color={tab === t.key ? "#4F46E5" : "#6B7280"}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.tabBtnText, tab === t.key && styles.tabBtnTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Tab content ───────────────────────────────────────────── */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
              showsVerticalScrollIndicator={false}
            >

              {/* TRANSACTIONS TAB */}
              {tab === "transactions" && (
                <>
                  {/* Filter row */}
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                    {/* Date filter */}
                    <TouchableOpacity
                      style={styles.filterBtn}
                      onPress={() => setShowDateMenu(!showDateMenu)}
                    >
                      <Ionicons name="calendar-outline" size={13} color="#374151" />
                      <Text style={styles.filterBtnText}>{dateFilter}</Text>
                      <Ionicons name="chevron-down" size={12} color="#374151" />
                    </TouchableOpacity>
                    {(["all", "invoices", "payments"] as const).map((f) => (
                      <TouchableOpacity
                        key={f}
                        style={[styles.filterBtn, txnFilter === f && styles.filterBtnActive]}
                        onPress={() => setTxnFilter(f)}
                      >
                        <Text style={[styles.filterBtnText, txnFilter === f && { color: "#4F46E5" }]}>
                          {f === "all" ? "All" : f === "invoices" ? "Invoices" : "Payments"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Table header */}
                  <View style={styles.txnTableHeader}>
                    <Text style={[styles.txnHeaderCell, { flex: 2 }]}>Date</Text>
                    <Text style={[styles.txnHeaderCell, { flex: 3 }]}>Transaction Type</Text>
                    <Text style={[styles.txnHeaderCell, { flex: 3 }]}>Transaction Number</Text>
                    <Text style={[styles.txnHeaderCell, { flex: 2, textAlign: "right" }]}>Amount ↕</Text>
                    <Text style={[styles.txnHeaderCell, { flex: 2, textAlign: "right" }]}>Status</Text>
                  </View>

                  {mergedTxns.length === 0 ? (
                    <Text style={{ color: "#9CA3AF", textAlign: "center", marginTop: 32, fontFamily: "Inter_400Regular" }}>No transactions found.</Text>
                  ) : (
                    mergedTxns.map((t, i) => {
                      if (t.type === "bill") {
                        const bill = t.data as RecentBill;
                        const isPaymentType = ["Payment In", "Sales Return"].includes((bill as any).docType || "");
                        if (isPaymentType) {
                          return (
                            <View key={`bill-${bill.id}`} style={[styles.txnTableRow, { backgroundColor: "#F0FDF4" }]}>
                              <Text style={[styles.txnCell, { flex: 2 }]}>{fmtDate(bill.createdAt)}</Text>
                              <Text style={[styles.txnCell, { flex: 3, color: "#059669" }]}>{(bill as any).docType}</Text>
                              <Text style={[styles.txnCell, { flex: 3, color: "#059669" }]}>{bill.id}</Text>
                              <Text style={[styles.txnCell, { flex: 2, textAlign: "right", color: "#059669", fontFamily: "Inter_600SemiBold" }]}>+{fmt(bill.total)}</Text>
                              <View style={{ flex: 2, alignItems: "flex-end" }}>
                                <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: "#DCFCE7", borderRadius: 99 }}>
                                  <Text style={{ fontSize: 10, color: "#059669", fontFamily: "Inter_600SemiBold" }}>Received</Text>
                                </View>
                              </View>
                            </View>
                          );
                        }
                        const info = getBillPaymentInfo(bill, payments);
                        const statusColor =
                          info.status === "Paid" ? "#059669" : info.status === "Partially Paid" ? "#D97706" : "#DC2626";
                        const statusBg =
                          info.status === "Paid" ? "#DCFCE7" : info.status === "Partially Paid" ? "#FEF3C7" : "#FEE2E2";
                        const yr = new Date(bill.createdAt).getFullYear();
                        const txnNo = (bill as any).number || bill.id;
                        return (
                          <TouchableOpacity
                            key={`bill-${bill.id}`}
                            style={styles.txnTableRow}
                            onPress={() =>
                              navigation.navigate(
                                bill.status === "Draft" ? "InvoiceCreate" : "InvoiceDetail",
                                bill.status === "Draft" ? { editBillId: bill.id } : { billId: bill.id }
                              )
                            }
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.txnCell, { flex: 2 }]}>{fmtDate(bill.createdAt)}</Text>
                            <Text style={[styles.txnCell, { flex: 3, color: "#2563EB" }]}>{(bill as any).docType || "Sales Invoice"}</Text>
                            <Text style={[styles.txnCell, { flex: 3, color: "#6366F1" }]}>{txnNo}</Text>
                            <Text style={[styles.txnCell, { flex: 2, textAlign: "right", fontFamily: "Inter_600SemiBold" }]}>{fmt(bill.total)}</Text>
                            <View style={{ flex: 2, alignItems: "flex-end" }}>
                              <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: statusBg, borderRadius: 99 }}>
                                <Text style={{ fontSize: 10, color: statusColor, fontFamily: "Inter_600SemiBold" }}>{info.status}</Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      } else {
                        const p = t.data as BillPayment;
                        return (
                          <View key={`pay-${p.id}`} style={[styles.txnTableRow, { backgroundColor: "#F0FDF4" }]}>
                            <Text style={[styles.txnCell, { flex: 2 }]}>{fmtDate(p.paidAt)}</Text>
                            <Text style={[styles.txnCell, { flex: 3, color: "#059669" }]}>Payment In</Text>
                            <Text style={[styles.txnCell, { flex: 3, color: "#059669" }]}>{p.id || p.method?.toUpperCase() || "CASH"}</Text>
                            <Text style={[styles.txnCell, { flex: 2, textAlign: "right", color: "#059669", fontFamily: "Inter_600SemiBold" }]}>+{fmt(p.amount)}</Text>
                            <View style={{ flex: 2, alignItems: "flex-end" }}>
                              <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: "#DCFCE7", borderRadius: 99 }}>
                                <Text style={{ fontSize: 10, color: "#059669", fontFamily: "Inter_600SemiBold" }}>Received</Text>
                              </View>
                            </View>
                          </View>
                        );
                      }
                    })
                  )}
                </>
              )}

              {/* PROFILE TAB */}
              {tab === "profile" && (
                <View style={{ gap: 12 }}>
                  {/* Stats cards */}
                  <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                    {[
                      { label: "Total Business", val: fmt(totalBusiness), color: "#4F46E5" },
                      { label: "Total Paid", val: fmt(paidTotal), color: "#059669" },
                      { label: "Outstanding", val: fmt(outstanding), color: outstanding > 0 ? "#DC2626" : "#059669" },
                      { label: "Total Orders", val: String(customerBills.length), color: "#D97706" },
                    ].map((s) => (
                      <View key={s.label} style={styles.profileStatCard}>
                        <Text style={{ color: "#6B7280", fontSize: 11, fontFamily: "Inter_500Medium" }}>{s.label}</Text>
                        <Text style={{ color: s.color, fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 4 }}>{s.val}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Contact info */}
                  <View style={styles.profileCard}>
                    <Text style={styles.profileSectionTitle}>Contact Information</Text>
                    {[
                      { label: "Name", val: selected.customer.name },
                      { label: "Phone", val: selected.customer.phone || "—" },
                      { label: "Email", val: selected.customer.email || "—" },
                      { label: "GSTIN", val: selected.customer.gstin || "—" },
                      { label: "State", val: selected.customer.state || "—" },
                      { label: "Address", val: selected.customer.billing_address || "—" },
                      { label: "Balance Type", val: selected.customer.balance_type || "—" },
                      { label: "Opening Balance", val: fmt(selected.customer.opening_balance || 0) },
                      { label: "Created On", val: fmtDate(selected.customer.created_at) },
                    ].map((row) => (
                      <View key={row.label} style={styles.profileRow}>
                        <Text style={styles.profileRowLabel}>{row.label}</Text>
                        <Text style={styles.profileRowVal} numberOfLines={2}>{row.val}</Text>
                      </View>
                    ))}
                    {/* Quick actions */}
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                      {selected.customer.phone && (
                        <TouchableOpacity
                          style={styles.quickActionBtn}
                          onPress={() => Linking.openURL(`tel:${selected.customer.phone}`)}
                        >
                          <Ionicons name="call-outline" size={14} color="#4F46E5" />
                          <Text style={styles.quickActionText}>Call</Text>
                        </TouchableOpacity>
                      )}
                      {selected.customer.phone && outstanding > 0 && (
                        <TouchableOpacity
                          style={[styles.quickActionBtn, { borderColor: "#25D366" }]}
                          onPress={() => {
                            const p = String(selected.customer.phone).replace(/\D/g, "");
                            const msg = encodeURIComponent(`Dear ${selected.customer.name}, you have an outstanding of ${fmt(outstanding)}. Kindly pay at the earliest. Thank you!`);
                            Linking.openURL(`https://wa.me/91${p}?text=${msg}`);
                          }}
                        >
                          <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
                          <Text style={[styles.quickActionText, { color: "#25D366" }]}>Send Reminder</Text>
                        </TouchableOpacity>
                      )}
                      {selected.customer.phone && (
                        <TouchableOpacity
                          style={[styles.quickActionBtn, { borderColor: "#0891B2" }]}
                          onPress={() => {
                            const p = String(selected.customer.phone).replace(/\D/g, "");
                            const lines = [
                              `📋 *Account Statement — ${selected.customer.name}*`,
                              `Total Business: ${fmt(totalBusiness)}`,
                              `Total Paid: ${fmt(paidTotal)}`,
                              `Outstanding: ${fmt(outstanding)}`,
                              `Total Invoices: ${customerBills.length}`,
                            ].join("\n");
                            Linking.openURL(`https://wa.me/91${p}?text=${encodeURIComponent(lines)}`);
                          }}
                        >
                          <Ionicons name="document-text-outline" size={14} color="#0891B2" />
                          <Text style={[styles.quickActionText, { color: "#0891B2" }]}>Share Statement</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {/* LEDGER TAB */}
              {tab === "ledger" && (
                <>
                  {/* Summary */}
                  <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                    <View style={[styles.ledgerSummaryCard, { backgroundColor: "#FEF2F2" }]}>
                      <Text style={{ fontSize: 11, color: "#DC2626", fontFamily: "Inter_500Medium" }}>Total Debit</Text>
                      <Text style={{ fontSize: 15, color: "#DC2626", fontFamily: "Inter_700Bold", marginTop: 4 }}>{fmt(totalBusiness)}</Text>
                    </View>
                    <View style={[styles.ledgerSummaryCard, { backgroundColor: "#F0FDF4" }]}>
                      <Text style={{ fontSize: 11, color: "#059669", fontFamily: "Inter_500Medium" }}>Total Credit</Text>
                      <Text style={{ fontSize: 15, color: "#059669", fontFamily: "Inter_700Bold", marginTop: 4 }}>{fmt(paidTotal)}</Text>
                    </View>
                    <View style={[styles.ledgerSummaryCard, { backgroundColor: "#EEF2FF" }]}>
                      <Text style={{ fontSize: 11, color: "#4F46E5", fontFamily: "Inter_500Medium" }}>Balance</Text>
                      <Text style={{ fontSize: 15, color: "#4F46E5", fontFamily: "Inter_700Bold", marginTop: 4 }}>{fmt(outstanding)}</Text>
                    </View>
                  </View>

                  {/* Table */}
                  <View style={styles.ledgerTable}>
                    {/* Header */}
                    <View style={[styles.ledgerRow, styles.ledgerHeaderRow]}>
                      <Text style={[styles.ledgerHeaderCell, { flex: 1.5 }]}>Date</Text>
                      <Text style={[styles.ledgerHeaderCell, { flex: 3 }]}>Description</Text>
                      <Text style={[styles.ledgerHeaderCell, { flex: 1.5, textAlign: "right" }]}>Debit</Text>
                      <Text style={[styles.ledgerHeaderCell, { flex: 1.5, textAlign: "right" }]}>Credit</Text>
                      <Text style={[styles.ledgerHeaderCell, { flex: 1.5, textAlign: "right" }]}>Balance</Text>
                    </View>
                    {ledgerEntries.length === 0 ? (
                      <Text style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontFamily: "Inter_400Regular" }}>No ledger entries.</Text>
                    ) : (
                      ledgerEntries.map((e, i) => (
                        <LedgerRow key={i} {...e} />
                      ))
                    )}
                  </View>
                </>
              )}

              {/* ITEM WISE REPORT TAB */}
              {tab === "itemwise" && (
                <>
                  <View style={styles.ledgerTable}>
                    <View style={[styles.ledgerRow, styles.ledgerHeaderRow]}>
                      <Text style={[styles.ledgerHeaderCell, { flex: 3 }]}>Item / Product</Text>
                      <Text style={[styles.ledgerHeaderCell, { flex: 1.5, textAlign: "right" }]}>Qty Sold</Text>
                      <Text style={[styles.ledgerHeaderCell, { flex: 2, textAlign: "right" }]}>Total Value</Text>
                    </View>
                    {itemWiseMap.length === 0 ? (
                      <Text style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontFamily: "Inter_400Regular" }}>No item-level data found.</Text>
                    ) : (
                      itemWiseMap.map(([name, data], i) => (
                        <View key={i} style={[styles.ledgerRow, i % 2 === 0 ? {} : { backgroundColor: "#F9FAFB" }]}>
                          <Text style={[styles.txnCell, { flex: 3 }]}>{name}</Text>
                          <Text style={[styles.txnCell, { flex: 1.5, textAlign: "right" }]}>{data.qty}</Text>
                          <Text style={[styles.txnCell, { flex: 2, textAlign: "right", fontFamily: "Inter_600SemiBold" }]}>{fmt(data.total)}</Text>
                        </View>
                      ))
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Backdrop for dropdown */}
      {showCreateMenu && (
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={() => setShowCreateMenu(false)}
          activeOpacity={1}
        />
      )}
    </SafeAreaView>
  );
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFF" },

  // Header
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", color: "#111827" },
  headerBtn: {
    padding: 8,
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },

  // Body
  body: { flex: 1, flexDirection: "row" },

  // Left panel
  leftPanel: {
    width: Platform.OS === 'web' ? 280 : 220,
    backgroundColor: "#fff",
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  leftPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  leftPanelTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  leftPanelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    backgroundColor: "#EEF2FF",
  },
  summaryPills: { flexDirection: "row", gap: 6, padding: 10 },
  pill: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#F0FDF4", borderRadius: 10, padding: 8,
  },
  pillIcon: { fontSize: 16, color: "#059669", fontFamily: "Inter_700Bold" },
  pillAmt: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#059669" },
  pillLabel: { fontSize: 9, color: "#6B7280", fontFamily: "Inter_500Medium" },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginHorizontal: 10, marginBottom: 6,
    backgroundColor: "#F9FAFB", borderRadius: 8,
    borderWidth: 1, borderColor: "#E5E7EB",
    paddingHorizontal: 10, height: 36,
  },
  searchInput: { flex: 1, fontSize: 12, color: "#111827", fontFamily: "Inter_400Regular" },
  partyListItem: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  partyListName: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#111827" },

  divider: { width: 1, backgroundColor: "#E5E7EB" },

  // Right panel - detail header
  detailHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  detailName: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827" },
  createBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderColor: "#C7D2FE",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: "#EEF2FF",
  },
  createBtnText: { fontSize: 12, color: "#4F46E5", fontFamily: "Inter_600SemiBold" },
  iconBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: "#fff",
  },
  iconBtnText: { fontSize: 12, color: "#374151", fontFamily: "Inter_500Medium" },

  // Dropdown
  dropdownMenu: {
    position: "absolute", top: 38, right: 0, zIndex: 1000,
    backgroundColor: "#fff", borderRadius: 10,
    borderWidth: 1, borderColor: "#E5E7EB",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 10,
    minWidth: 180, paddingVertical: 4,
  },
  dropdownItem: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  dropdownItemText: { fontSize: 13, color: "#374151", fontFamily: "Inter_500Medium" },

  // Tabs
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
    paddingHorizontal: 4,
  },
  tabBtn: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: "#4F46E5" },
  tabBtnText: { fontSize: 12, color: "#6B7280", fontFamily: "Inter_600SemiBold" },
  tabBtnTextActive: { color: "#4F46E5" },

  // Filter buttons
  filterBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  filterBtnActive: { borderColor: "#4F46E5", backgroundColor: "#EEF2FF" },
  filterBtnText: { fontSize: 11, color: "#374151", fontFamily: "Inter_500Medium" },

  // Transaction table
  txnTableHeader: {
    flexDirection: "row", backgroundColor: "#F3F4F6",
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 8, marginBottom: 2,
  },
  txnHeaderCell: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#374151", textTransform: "uppercase" },
  txnTableRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
    backgroundColor: "#fff", marginBottom: 1, borderRadius: 6,
  },
  txnCell: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#374151" },

  // Txn rows (old)
  txnRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", padding: 12,
    borderRadius: 10, marginBottom: 8,
    borderWidth: 1, borderColor: "#F0F0F0",
  },
  txnDate: { fontSize: 11, color: "#9CA3AF", fontFamily: "Inter_400Regular", marginBottom: 2 },
  txnType: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#2563EB", marginBottom: 2 },
  txnNo: { fontSize: 11, color: "#6B7280", fontFamily: "Inter_400Regular" },
  txnAmt: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 4 },

  // Profile
  profileStatCard: {
    flex: 1, minWidth: 120,
    backgroundColor: "#fff", borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: "#E5E7EB",
  },
  profileCard: {
    backgroundColor: "#fff", borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: "#E5E7EB",
  },
  profileSectionTitle: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 10,
  },
  profileRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  profileRowLabel: { fontSize: 12, color: "#6B7280", fontFamily: "Inter_500Medium" },
  profileRowVal: { flex: 1, textAlign: "right", fontSize: 12, color: "#111827", fontFamily: "Inter_600SemiBold" },
  quickActionBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: "#C7D2FE",
  },
  quickActionText: { fontSize: 12, color: "#4F46E5", fontFamily: "Inter_600SemiBold" },

  // Ledger
  ledgerSummaryCard: {
    flex: 1, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB",
  },
  ledgerTable: {
    backgroundColor: "#fff", borderRadius: 10,
    borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden",
  },
  ledgerRow: {
    flexDirection: "row", paddingHorizontal: 10, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  ledgerHeaderRow: { backgroundColor: "#F3F4F6" },
  ledgerHeaderCell: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#374151", textTransform: "uppercase" },
  ledgerCell: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#374151" },
});
