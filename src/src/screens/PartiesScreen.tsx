import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  FlatList,
  TouchableOpacity,
  Pressable,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../themeContext";
import { useUser } from "../userContext";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { useSafeScreen } from "../hooks/useSafeScreen";
import { ListRow } from "../components/ui";
import {
  Customer,
  getCustomers,
  addCustomer,
  updateCustomer,
} from "../services/customersService";
import { fetchBills, fetchBillPayments, RecentBill, BillPayment } from "../services/billingService";
import { getBillPaymentInfo, calculatePartyBalance } from "../utils/billingUtils";

type FilterType = "paid" | "to_collect" | "all";

export const PartiesScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeScreen();
  const styles = useMemo(
    () => createStyles({ colors, spacing, radius }),
    [colors, spacing, radius]
  );
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bills, setBills] = useState<RecentBill[]>([]);
  const [billPayments, setBillPayments] = useState<BillPayment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>(route.params?.filter ?? "all");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [address, setAddress] = useState("");
  const [stateName, setStateName] = useState("");
  const [notes, setNotes] = useState("");
  const [tab, setTab] = useState<"business" | "credit" | "other">("business");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const orgId = user?.organisationId || undefined;
      const [list, bs, ps] = await Promise.all([
        getCustomers(orgId),
        fetchBills(orgId),
        fetchBillPayments(orgId),
      ]);
      setCustomers(list);
      setBills(bs);
      setBillPayments(ps);
    } catch (e) {
      console.warn("[Parties] load failed", e);
      Alert.alert("Error", "Failed to load parties.");
    } finally {
      setLoading(false);
    }
  }, [user?.organisationId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  React.useEffect(() => {
    const p = route.params?.filter;
    if (p === "to_collect" || p === "to_pay") setFilter(p);
  }, [route.params?.filter]);

  React.useEffect(() => {
    if (route.params?.openCreate) {
      openNew();
      navigation.setParams({ openCreate: false });
    }
  }, [route.params?.openCreate]);

  React.useEffect(() => {
    const editId = route.params?.openEdit;
    if (editId && customers.length > 0) {
      const found = customers.find((c) => c.id === editId);
      if (found) {
        openEdit(found);
        navigation.setParams({ openEdit: null });
      }
    }
  }, [route.params?.openEdit, customers]);

  const partiesWithOutstanding = useMemo(() => {
    // Group bills by customer name
    const billsByCustomer = new Map<string, RecentBill[]>();
    for (const b of bills) {
      const key = (b.customer || "").trim().toLowerCase();
      if (!billsByCustomer.has(key)) billsByCustomer.set(key, []);
      billsByCustomer.get(key)!.push(b);
    }

    // Build billId → customer name lookup
    const billIdToCustomer = new Map<string, string>();
    for (const b of bills) {
      billIdToCustomer.set(b.id, (b.customer || "").trim().toLowerCase());
    }

    // Group payments by customer name (via billId → customer lookup)
    const paymentsByCustomer = new Map<string, BillPayment[]>();
    for (const p of billPayments) {
      const key = billIdToCustomer.get(p.billId) ?? "";
      if (!paymentsByCustomer.has(key)) paymentsByCustomer.set(key, []);
      paymentsByCustomer.get(key)!.push(p);
    }

    return customers.map((c) => {
      const key = (c.name || "").trim().toLowerCase();
      const cbills = billsByCustomer.get(key) || [];
      const cpayments = paymentsByCustomer.get(key) || [];
      
      const remainingTotal = calculatePartyBalance(c.name, cbills, cpayments, [c], true);
      
      let lastOutstandingDate: string | null = null;
      for (const b of cbills) {
        if (!lastOutstandingDate || String(b.createdAt) > String(lastOutstandingDate)) {
          lastOutstandingDate = b.createdAt;
        }
      }

      return {
        customer: c,
        remainingTotal,
        lastOutstandingDate,
      };
    });
  }, [customers, bills, billPayments]);

  const filtered = useMemo(() => {
    let list = partiesWithOutstanding;
    if (filter === "to_collect") list = list.filter((x) => x.remainingTotal > 0);
    else if (filter === "paid") list = list.filter((x) => x.remainingTotal === 0);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (x) =>
          (x.customer.name || "").toLowerCase().includes(q) ||
          (x.customer.phone || "").includes(q) ||
          (x.customer.email || "").toLowerCase().includes(q) ||
          (x.customer.gstin || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [partiesWithOutstanding, searchQuery, filter]);

  const openNew = () => {
    setEditing(null);
    setName("");
    setPhone("");
    setEmail("");
    setGstin("");
    setOpeningBalance("0");
    setAddress("");
    setStateName("");
    setNotes("");
    setModalVisible(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setName(c.name);
    setPhone(c.phone || "");
    setEmail(c.email || "");
    setGstin(c.gstin || "");
    setOpeningBalance(String(c.opening_balance ?? 0));
    setAddress(c.billing_address || "");
    setStateName(c.state || "");
    setNotes((c as any).notes || "");
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Enter party name.");
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        await updateCustomer(editing.id, {
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          gstin: gstin.trim() || null,
          openingBalance: Number(openingBalance) || 0,
          billingAddress: address.trim() || null,
          state: stateName.trim() || null,
          notes: notes.trim() || null,
        }, user?.organisationId);
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === editing.id
              ? {
                  ...c,
                  name: name.trim(),
                  phone: phone.trim() || null,
                  email: email.trim() || null,
                  gstin: gstin.trim() || null,
                  opening_balance: Number(openingBalance) || 0,
                  billing_address: address.trim() || null,
                  state: stateName.trim() || null,
                }
              : c
          )
        );
      } else {
        const created = await addCustomer({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          gstin: gstin.trim() || null,
          openingBalance: Number(openingBalance) || 0,
          billingAddress: address.trim() || null,
          state: stateName.trim() || null,
          notes: notes.trim() || null,
          organisationId: user?.organisationId ?? undefined,
        });
        if (created) setCustomers((prev) => [created, ...prev]);
      }
      setModalVisible(false);
    } catch (e) {
      console.warn("[Parties] save failed", e);
      Alert.alert("Error", "Failed to save party.");
    } finally {
      setSaving(false);
    }
  };

  const fmtCurrency = (n: number) =>
    `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const toCollectTotal = partiesWithOutstanding
    .filter((x) => x.remainingTotal > 0)
    .reduce((sum, x) => sum + x.remainingTotal, 0);

  const outstandingCount = partiesWithOutstanding.filter(
    (x) => x.remainingTotal !== 0
  ).length;

  const toCollectCount = useMemo(
    () => partiesWithOutstanding.filter((x) => x.remainingTotal > 0).length,
    [partiesWithOutstanding]
  );
  const paidCount = useMemo(
    () => partiesWithOutstanding.filter((x) => x.remainingTotal === 0).length,
    [partiesWithOutstanding]
  );

  return (
    <View style={styles.safeArea}>
      <View style={[styles.root, { paddingTop: insets.paddingTop }]}>
        <View style={styles.greenHeader}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerSubtitle}>Manage your contacts</Text>
              <Text style={styles.headerTitle}>Parties & Customers</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.refreshBtn} onPress={load}>
                <Ionicons name="refresh" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={openNew}>
                 <Text style={styles.addBtnText}>Add Party</Text>
                 <Ionicons name="settings-outline" size={14} color="#666" style={{marginLeft: 4}} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{fmtCurrency(toCollectTotal)}</Text>
              <Text style={styles.statLabel}>To Collect</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{customers.length}</Text>
              <Text style={styles.statLabel}>Total Parties</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{outstandingCount}</Text>
              <Text style={styles.statLabel}>Outstanding</Text>
            </View>
          </View>
        </View>

        <View style={styles.bodyContent}>
          <View style={styles.searchWrapper}>
            <Ionicons name="search" size={18} color={colors.textMuted} style={{marginRight: 8}} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search parties..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterPill, filter === "all" && styles.filterPillActive]}
              onPress={() => setFilter("all")}
            >
              <Text style={[styles.filterPillText, filter === "all" && styles.filterPillTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterPill, filter === "to_collect" && styles.filterPillActive]}
              onPress={() => setFilter("to_collect")}
            >
              <Text style={[styles.filterPillText, filter === "to_collect" && styles.filterPillTextActive]}>
                Collect ({toCollectCount})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterPill, filter === "paid" && styles.filterPillActive]}
              onPress={() => setFilter("paid")}
            >
              <Text style={[styles.filterPillText, filter === "paid" && styles.filterPillTextActive]}>
                Paid ({paidCount})
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="#00C282" />
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(x) => x.customer.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No parties found.</Text>
              }
              renderItem={({ item }) => {
                const c = item.customer.name || "?";
                const isPaid = item.remainingTotal === 0;
                const isCollect = item.remainingTotal > 0;
                
                // Color mapping for avatars
                let bg = "#E5F7ED"; let fg = "#00C282";
                if(isCollect) { bg = "#FFF4ED"; fg = "#FF7A00"; }
                
                return (
                  <TouchableOpacity 
                    style={styles.listCard} 
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate("PartyDetail", { customerId: item.customer.id })}
                  >
                    <View style={[styles.avatar, { backgroundColor: bg }]}>
                      <Text style={[styles.avatarText, { color: fg }]}>{c.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.cardCenter}>
                      <Text style={styles.cardName} numberOfLines={1}>{item.customer.name}</Text>
                      <Text style={styles.cardPhone}>{item.customer.phone || "No phone"}</Text>
                      <Text style={styles.cardDate}>
                        Since {item.customer.created_at ? new Date(item.customer.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Recently"}
                      </Text>
                    </View>
                    <View style={styles.cardRight}>
                      {isCollect ? (
                        <>
                          <Text style={styles.cardAmtOrange}>{fmtCurrency(item.remainingTotal)}</Text>
                          <Text style={styles.cardStatusOrange}>TO COLLECT</Text>
                        </>
                      ) : item.remainingTotal < 0 ? (
                        <>
                          <Text style={styles.cardAmtOrange}>{fmtCurrency(Math.abs(item.remainingTotal))}</Text>
                          <Text style={styles.cardStatusOrange}>TO PAY</Text>
                        </>
                      ) : (
                        <Text style={styles.cardStatusGreen}>PAID</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editing ? "Edit Party" : "New Party"}
            </Text>
            <View style={styles.partyTabs}>
              {[
                { key: "business", label: "Business Info" },
                { key: "credit", label: "Credit Info" },
                { key: "other", label: "Other Details" },
              ].map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.partyTab, tab === t.key && styles.partyTabActive]}
                  onPress={() => setTab(t.key as any)}
                >
                  <Text style={[styles.partyTabText, tab === t.key && styles.partyTabTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {tab === "business" && (
              <>
                <Text style={styles.label}>Name *</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Party name" placeholderTextColor={colors.textMuted} />
                <Text style={styles.label}>Phone</Text>
                <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" placeholderTextColor={colors.textMuted} />
                <Text style={styles.label}>Email</Text>
                <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" placeholderTextColor={colors.textMuted} />
                <Text style={styles.label}>GSTIN</Text>
                <TextInput style={styles.input} value={gstin} onChangeText={setGstin} placeholder="GST number" placeholderTextColor={colors.textMuted} />
              </>
            )}

            {tab === "credit" && (
              <>
                <Text style={styles.label}>Opening balance</Text>
                <TextInput style={styles.input} value={openingBalance} onChangeText={setOpeningBalance} placeholder="0" keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} />
              </>
            )}

            {tab === "other" && (
              <>
                <Text style={styles.label}>Address</Text>
                <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} value={address} onChangeText={setAddress} placeholder="Street address, City, Pincode" placeholderTextColor={colors.textMuted} multiline />
                <Text style={styles.label}>State</Text>
                <TextInput style={styles.input} value={stateName} onChangeText={setStateName} placeholder="e.g. Maharashtra" placeholderTextColor={colors.textMuted} />
                <Text style={styles.label}>Notes (optional)</Text>
                <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder="Any extra details" placeholderTextColor={colors.textMuted} multiline />
              </>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryButtonText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    safeArea: { flex: 1, backgroundColor: "#F5F6FA" },
    root: { flex: 1 },
    greenHeader: {
      backgroundColor: "#00B873",
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: 24,
      zIndex: 10,
    },
    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    headerSubtitle: {
      color: "rgba(255,255,255,0.8)",
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      marginBottom: 2,
    },
    headerTitle: {
      color: "#ffffff",
      fontSize: 24,
      fontFamily: "Inter_700Bold",
    },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
    refreshBtn: {
      width: 34, height: 34,
      borderRadius: 17,
      backgroundColor: "rgba(255,255,255,0.2)",
      justifyContent: "center", alignItems: "center",
    },
    addBtn: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: "#fff",
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 20,
    },
    addBtnText: { color: "#00B873", fontSize: 13, fontFamily: "Inter_700Bold" },
    statsRow: {
      flexDirection: "row", gap: 8, justifyContent: "space-between"
    },
    statBox: {
      flex: 1,
      backgroundColor: "rgba(255,255,255,0.15)",
      borderRadius: 12,
      paddingVertical: 12, paddingHorizontal: 4,
      alignItems: "center",
    },
    statVal: {
      color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 2
    },
    statLabel: {
      color: "rgba(255,255,255,0.9)", fontSize: 10, fontFamily: "Inter_500Medium"
    },
    bodyContent: {
      flex: 1,
      paddingHorizontal: spacing.lg,
    },
    searchWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#fff",
      borderRadius: 24,
      marginTop: -20,
      paddingHorizontal: 16,
      height: 48,
      borderWidth: 1,
      borderColor: "#EAEAEA",
      shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 3,
      zIndex: 20,
    },
    searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111" },
    filterRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 20,
      marginBottom: 16,
    },
    filterPill: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: "#fff",
      borderWidth: 1, borderColor: "#E5E5E5",
    },
    filterPillActive: {
      backgroundColor: "#00B873",
      borderColor: "#00B873",
    },
    filterPillText: {
      color: "#666", fontSize: 13, fontFamily: "Inter_600SemiBold"
    },
    filterPillTextActive: {
      color: "#fff"
    },
    loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
    listContent: { paddingBottom: 120 },
    listCard: {
      flexDirection: "row",
      backgroundColor: "#fff",
      padding: 16,
      borderRadius: 16,
      marginBottom: 12,
      alignItems: "center",
      borderWidth: 1, borderColor: "#F0F0F0",
      shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 8, elevation: 1,
    },
    avatar: {
      width: 44, height: 44, borderRadius: 12,
      justifyContent: "center", alignItems: "center",
      marginRight: 14,
    },
    avatarText: { fontSize: 20, fontFamily: "Inter_700Bold" },
    cardCenter: { flex: 1 },
    cardName: { color: "#111", fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
    cardPhone: { color: "#888", fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 2 },
    cardDate: { color: "#888", fontSize: 11, fontFamily: "Inter_400Regular" },
    cardRight: { alignItems: "flex-end" },
    cardAmtOrange: { color: "#FF7A00", fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 4 },
    cardStatusOrange: { color: "#FF7A00", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
    cardStatusGreen: { color: "#00C282", fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
    emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: spacing.xl },
    label: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 4,
      marginTop: spacing.sm,
      fontFamily: "Inter_500Medium",
    },
    input: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
      backgroundColor: colors.cardBackground,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    modalBox: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: colors.cardBackground,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      marginBottom: spacing.md,
    },
    partyTabs: {
      flexDirection: "row",
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      padding: 2,
      marginBottom: spacing.md,
      gap: 2,
    },
    partyTab: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      alignItems: "center",
    },
    partyTabActive: {
      backgroundColor: colors.cardBackground,
    },
    partyTabText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontFamily: "Inter_500Medium",
    },
    partyTabTextActive: {
      color: colors.textPrimary,
      fontFamily: "Inter_600SemiBold",
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    primaryButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.accentBlue,
    },
    primaryButtonText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
    secondaryButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    secondaryButtonText: { color: colors.textSecondary, fontSize: 14, fontFamily: "Inter_500Medium" },
  });
