import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useFocusEffect, useNavigation } from "@react-navigation/native";
import { useUser } from "../userContext";
import {
  fetchBills,
  fetchBillPayments,
  addBillPayment,
  RecentBill,
  BillPayment,
} from "../services/billingService";
import { getBillPaymentInfo } from "../utils/billingUtils";
import { useSafeScreen } from "../hooks/useSafeScreen";

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  `₹${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const todayStr = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const METHODS = ["Cash", "UPI", "Bank", "Card", "Cheque"] as const;

// ── Screen ────────────────────────────────────────────────────────────────────
export const PaymentsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useUser();
  const insets = useSafeScreen();

  // form state
  const [partyName, setPartyName]       = useState(route?.params?.prefillCustomer ?? "");
  const [amount, setAmount]             = useState("0");
  const [discount, setDiscount]         = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [paymentDate, setPaymentDate]   = useState(todayStr());
  const [prefix, setPrefix]             = useState("PI-");
  const [paymentNumber, setPaymentNumber] = useState("1");
  const [notes, setNotes]               = useState("");
  const [selectedBill, setSelectedBill] = useState<RecentBill | null>(null);
  const [saving, setSaving]             = useState(false);

  // data
  const [loading, setLoading]           = useState(true);
  const [bills, setBills]               = useState<RecentBill[]>([]);
  const [billPayments, setBillPayments] = useState<BillPayment[]>([]);

  // load
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const orgId = user?.organisationId || undefined;
      const [b, p] = await Promise.all([fetchBills(orgId), fetchBillPayments(orgId)]);
      setBills(b);
      setBillPayments(p);
      // auto-set payment number
      setPaymentNumber(String(p.length + 1));
    } catch (e) {
      console.warn("[Payments] load failed", e);
    } finally {
      setLoading(false);
    }
  }, [user?.organisationId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // pre-fill billId if passed
  useEffect(() => {
    if (!route?.params?.billId || loading) return;
    const target = bills.find((b) => b.id === route.params.billId);
    if (target) {
      setSelectedBill(target);
      setPartyName(target.customer || "");
      const info = getBillPaymentInfo(target, billPayments);
      if (info.remaining > 0) setAmount(String(Math.round(info.remaining)));
    }
  }, [route?.params?.billId, bills, billPayments, loading]);

  // derived
  const unpaidBills = useMemo(() => {
    if (!partyName.trim()) return [];
    const q = partyName.trim().toLowerCase();
    return bills.filter((b) => {
      const matchName = (b.customer || "").toLowerCase().includes(q);
      const info = getBillPaymentInfo(b, billPayments);
      return matchName && info.remaining > 0;
    });
  }, [bills, billPayments, partyName]);

  const currentBalance = useMemo(
    () => unpaidBills.reduce((sum, b) => sum + getBillPaymentInfo(b, billPayments).remaining, 0),
    [unpaidBills, billPayments]
  );

  // save
  const handleSave = async () => {
    const amt = Number(amount);
    if (!partyName.trim()) {
      Alert.alert("Missing", "Please enter a party name.");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      Alert.alert("Invalid", "Enter a valid amount.");
      return;
    }
    const targetBill = selectedBill ?? unpaidBills[0] ?? null;
    if (!targetBill) {
      Alert.alert("No Invoice", "No unpaid invoices found for this party to link the payment.");
      return;
    }
    try {
      setSaving(true);
      await addBillPayment({
        billId: targetBill.id,
        amount: amt,
        method: paymentMethod.toLowerCase(),
        organisationId: user?.organisationId || undefined,
        notes: notes.trim() || undefined,
      } as any);
      Alert.alert("Saved", "Payment recorded successfully.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      console.warn("[Payments] save failed", e);
      Alert.alert("Error", "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[S.root, { paddingTop: Platform.OS === "web" ? 0 : insets.paddingTop }]}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>
          Record Payment In #{paymentNumber}
        </Text>
        <View style={S.headerActions}>
          <TouchableOpacity style={S.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={S.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={14} color="#fff" />
                <Text style={S.saveBtnText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={S.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── 2-column form ───────────────────────────────────────────────── */}
          <View style={S.formRow}>
            {/* LEFT CARD */}
            <View style={[S.card, { flex: 1 }]}>
              <Text style={S.fieldLabel}>PARTY NAME</Text>
              <TextInput
                style={S.input}
                value={partyName}
                onChangeText={setPartyName}
                placeholder="Select or type party name"
                placeholderTextColor="#9CA3AF"
              />
              {currentBalance > 0 && (
                <Text style={S.balanceText}>
                  Current Balance: {fmt(currentBalance)} to collect
                </Text>
              )}

              <Text style={[S.fieldLabel, { marginTop: 14 }]}>AMOUNT RECEIVED</Text>
              <TextInput
                style={S.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                selectTextOnFocus
              />

              <Text style={[S.fieldLabel, { marginTop: 14 }]}>PAYMENT IN DISCOUNT</Text>
              <TextInput
                style={S.input}
                value={discount}
                onChangeText={setDiscount}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                selectTextOnFocus
              />
            </View>

            {/* RIGHT CARD */}
            <View style={[S.card, { flex: 1 }]}>
              {/* Date + Mode row */}
              <View style={S.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={S.fieldLabel}>PAYMENT DATE</Text>
                  <TextInput
                    style={S.input}
                    value={paymentDate}
                    onChangeText={setPaymentDate}
                    placeholder="DD-MM-YYYY"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={S.fieldLabel}>PAYMENT MODE</Text>
                  <View style={S.modeChips}>
                    {METHODS.map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[S.modeChip, paymentMethod === m && S.modeChipActive]}
                        onPress={() => setPaymentMethod(m)}
                        activeOpacity={0.75}
                      >
                        <Text style={[S.modeChipText, paymentMethod === m && S.modeChipTextActive]}>
                          {m}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Prefix + Number row */}
              <View style={[S.fieldRow, { marginTop: 14 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={S.fieldLabel}>PAYMENT IN PREFIX</Text>
                  <TextInput
                    style={S.input}
                    value={prefix}
                    onChangeText={setPrefix}
                    placeholder="PI-"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={S.fieldLabel}>PAYMENT IN NUMBER</Text>
                  <TextInput
                    style={S.input}
                    value={paymentNumber}
                    onChangeText={setPaymentNumber}
                    keyboardType="number-pad"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              {/* Notes */}
              <Text style={[S.fieldLabel, { marginTop: 14 }]}>NOTES</Text>
              <TextInput
                style={[S.input, S.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Enter Notes"
                placeholderTextColor="#9CA3AF"
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* ── Unpaid invoices list ─────────────────────────────────────────── */}
          <View style={S.card}>
            {loading ? (
              <View style={S.centerBox}>
                <ActivityIndicator color="#4F46E5" />
                <Text style={S.emptyLabel}>Loading invoices…</Text>
              </View>
            ) : unpaidBills.length === 0 ? (
              <View style={S.centerBox}>
                <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
                <Text style={S.emptyTitle}>No Transactions yet!</Text>
                <Text style={S.emptyLabel}>
                  {partyName.trim()
                    ? "No unpaid invoices found for selected party"
                    : "Enter a party name to see their unpaid invoices"}
                </Text>
              </View>
            ) : (
              <>
                <Text style={S.sectionTitle}>
                  Unpaid Invoices ({unpaidBills.length})
                </Text>
                {unpaidBills.map((b) => {
                  const info = getBillPaymentInfo(b, billPayments);
                  const isSelected = selectedBill?.id === b.id;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[S.billRow, isSelected && S.billRowSelected]}
                      onPress={() => {
                        setSelectedBill(isSelected ? null : b);
                        if (!isSelected) setAmount(String(Math.round(info.remaining)));
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={S.billInfo}>
                        <Text style={S.billId}>
                          INV-{b.id.slice(-6).toUpperCase()}
                        </Text>
                        <Text style={S.billDate}>
                          {new Date(b.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                        </Text>
                      </View>
                      <View style={S.billRight}>
                        <Text style={S.billTotal}>{fmt(b.total)}</Text>
                        <Text style={S.billRemaining}>Due: {fmt(info.remaining)}</Text>
                      </View>
                      {isSelected && (
                        <View style={S.selectedBadge}>
                          <Ionicons name="checkmark-circle" size={18} color="#4F46E5" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F3F4F6" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  headerActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
  },
  cancelText: { fontSize: 13, color: "#374151", fontFamily: "Inter_500Medium" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#4F46E5",
  },
  saveBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Scroll
  scrollContent: { padding: 14, gap: 14, paddingBottom: 40 },

  // Form layout
  formRow: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 14,
  },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // Fields
  fieldLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#6B7280",
    letterSpacing: 0.5,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#111827",
    backgroundColor: "#FAFAFA",
  },
  notesInput: {
    minHeight: 80,
    paddingTop: 10,
  },
  balanceText: {
    fontSize: 12,
    color: "#D97706",
    fontFamily: "Inter_500Medium",
    marginTop: 6,
  },
  fieldRow: { flexDirection: "row" },

  // Payment mode chips
  modeChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  modeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
  },
  modeChipActive: { borderColor: "#4F46E5", backgroundColor: "#EEF2FF" },
  modeChipText: { fontSize: 11, color: "#6B7280", fontFamily: "Inter_500Medium" },
  modeChipTextActive: { color: "#4F46E5", fontFamily: "Inter_600SemiBold" },

  // Empty state
  centerBox: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#9CA3AF",
    marginTop: 4,
  },
  emptyLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },

  // Invoice list
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#374151",
    marginBottom: 10,
  },
  billRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
    backgroundColor: "#FAFAFA",
  },
  billRowSelected: {
    borderColor: "#4F46E5",
    backgroundColor: "#EEF2FF",
  },
  billInfo: { flex: 1 },
  billId: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#111827",
  },
  billDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginTop: 2,
  },
  billRight: { alignItems: "flex-end", marginRight: 8 },
  billTotal: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  billRemaining: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#F59E0B",
    marginTop: 2,
  },
  selectedBadge: { marginLeft: 4 },
});
