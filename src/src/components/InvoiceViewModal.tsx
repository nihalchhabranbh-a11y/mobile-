/**
 * InvoiceViewModal.tsx
 * Beautiful professional invoice view — mirrors the web app style.
 * Shows as a full-screen modal when user taps "View" on an invoice.
 */
import React from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
  Platform,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BillWithItems, BillPayment } from "../services/billingService";
import { getBillPaymentInfo, fmtCurrency } from "../utils/billingUtils";

// ── Default brand fallback (used only when brand prop is not provided) ────────
const EMPTY_BRAND = {
  name: "My Business",
  address: "",
  phone: "",
  email: "",
  state: "",
};

const fmtDate = (d?: string) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

const fmtDue = (d?: string) => {
  if (!d) return "—";
  const due = new Date(d);
  due.setDate(due.getDate() + 30);
  return due.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  bill: BillWithItems;
  payments: BillPayment[];
  onClose: () => void;
  onShare: () => void;
  brand?: {
    shopName?: string | null;
    address?: string | null;
    phone?: string | null;
    businessEmail?: string | null;
    state?: string | null;
  } | null;
}

export function InvoiceViewModal({ visible, bill, payments, onClose, onShare, brand: brandProp }: Props) {
  const BRAND = {
    name: brandProp?.shopName || EMPTY_BRAND.name,
    address: brandProp?.address || EMPTY_BRAND.address,
    phone: brandProp?.phone || EMPTY_BRAND.phone,
    email: brandProp?.businessEmail || EMPTY_BRAND.email,
    state: brandProp?.state || EMPTY_BRAND.state,
  };
  const info = getBillPaymentInfo(bill as any, payments);
  const isPaid = info.isPaid;
  const statusColor = isPaid ? "#16A34A" : "#DC2626";
  const statusLabel = isPaid ? "PAID" : "UNPAID";

  const subtotal = bill.items?.reduce((s, it) => s + ((it.qty ?? 1) * (it.rate ?? 0)), 0) ?? 0;
  const totalTax = (bill as any).totalTax ?? 0;
  const discount = (bill as any).discount ?? 0;
  const grandTotal = bill.total ?? 0;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar backgroundColor="#1e3a5f" barStyle="light-content" />

      {/* ── Top Bar ──────────────────────────────────────── */}
      <View style={S.topBar}>
        <TouchableOpacity onPress={onClose} style={S.topBarBtn}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={S.topBarTitle}>Invoice Preview</Text>
        <TouchableOpacity onPress={onShare} style={S.topBarBtn}>
          <Ionicons name="share-social-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={S.scroll} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Invoice Card ─────────────────────────────── */}
        <View style={S.card}>

          {/* === HEADER === */}
          <View style={S.invoiceHeader}>
            <View style={{ flex: 1 }}>
              <Text style={S.companyName}>{BRAND.name}</Text>
              <Text style={S.companyAddr}>{BRAND.address}</Text>
              <Text style={S.companyAddr}>Mobile: {BRAND.phone}</Text>
              <Text style={S.companyAddr}>Email: {BRAND.email}</Text>
              <Text style={S.companyAddr}>State: {BRAND.state}</Text>
            </View>
            <View style={S.invoiceInfoBox}>
              <Text style={S.invoiceType}>SALES INVOICE</Text>
              <View style={[S.statusBadge, { backgroundColor: isPaid ? "#DCFCE7" : "#FEE2E2" }]}>
                <Text style={[S.statusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
              <View style={S.invoiceMetaRow}>
                <Text style={S.invoiceMetaLabel}>Invoice No.</Text>
                <Text style={S.invoiceMetaVal}>{bill.id}</Text>
              </View>
              <View style={S.invoiceMetaRow}>
                <Text style={S.invoiceMetaLabel}>Invoice Date</Text>
                <Text style={S.invoiceMetaVal}>{fmtDate(bill.createdAt)}</Text>
              </View>
              <View style={S.invoiceMetaRow}>
                <Text style={S.invoiceMetaLabel}>Due Date</Text>
                <Text style={S.invoiceMetaVal}>{fmtDue(bill.createdAt)}</Text>
              </View>
            </View>
          </View>

          <View style={S.divider} />

          {/* === BILL TO === */}
          <View style={S.billToRow}>
            <View style={S.billToBox}>
              <Text style={S.billToLabel}>BILL TO</Text>
              <Text style={S.billToName}>{bill.customer || "—"}</Text>
              {bill.phone ? <Text style={S.billToDetail}>Mobile: {bill.phone}</Text> : null}
              {(bill as any).address
                ? <Text style={S.billToDetail}>{(bill as any).address}</Text>
                : <Text style={S.billToDetailMuted}>Address not provided</Text>}
            </View>
            <View style={[S.billToBox, { borderLeftWidth: 1, borderLeftColor: "#e5e7eb" }]}>
              <Text style={S.billToLabel}>SHIP TO</Text>
              <Text style={S.billToName}>{bill.customer || "—"}</Text>
              <Text style={S.billToDetailMuted}>Same as Bill To</Text>
            </View>
          </View>

          <View style={S.divider} />

          {/* === ITEMS TABLE === */}
          {/* Header Row */}
          <View style={S.tableHeaderRow}>
            <Text style={[S.tableHeader, { width: 30 }]}>S.NO</Text>
            <Text style={[S.tableHeader, { flex: 1 }]}>ITEMS / SERVICES</Text>
            <Text style={[S.tableHeader, { width: 50, textAlign: "right" }]}>QTY</Text>
            <Text style={[S.tableHeader, { width: 70, textAlign: "right" }]}>RATE</Text>
            <Text style={[S.tableHeader, { width: 80, textAlign: "right" }]}>AMOUNT</Text>
          </View>

          {bill.items?.map((item: any, idx) => {
            // Web app may save name in different fields — handle all
            const itemName = item.name || item.desc || item.nameText || item.item_name || "—";
            const itemSize = item.size || item.description || "";
            const qty      = Number(item.qty ?? 1);
            const rate     = Number(item.rate ?? 0);
            const amt      = Number(item.amount ?? (qty * rate));
            return (
              <View key={idx} style={[S.tableRow, idx % 2 === 0 ? S.tableRowEven : {}]}>
                <Text style={[S.tableCell, { width: 30, color: "#6b7280" }]}>{idx + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.itemName}>{itemName}</Text>
                  {itemSize ? (
                    <Text style={S.itemSub}>{itemSize}</Text>
                  ) : null}
                </View>
                <Text style={[S.tableCell, { width: 50, textAlign: "right" }]}>{qty}</Text>
                <Text style={[S.tableCell, { width: 70, textAlign: "right" }]}>
                  {fmtCurrency(rate)}
                </Text>
                <Text style={[S.tableCell, { width: 80, textAlign: "right", fontWeight: "600", color: "#111827" }]}>
                  {fmtCurrency(amt)}
                </Text>
              </View>
            );
          })}

          <View style={S.divider} />

          {/* === TOTALS === */}
          <View style={S.totalsSection}>
            {/* Left: terms */}
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={S.termsTitle}>Terms & Conditions</Text>
              <Text style={S.termsText}>
                1. Goods once sold will not be taken back or exchanged{"\n"}
                2. All disputes are subject to local jurisdiction only
              </Text>
            </View>

            {/* Right: amount summary */}
            <View style={S.summaryBox}>
              {subtotal !== grandTotal && (
                <View style={S.summaryRow}>
                  <Text style={S.summaryLabel}>Subtotal</Text>
                  <Text style={S.summaryVal}>{fmtCurrency(subtotal)}</Text>
                </View>
              )}
              {discount > 0 && (
                <View style={S.summaryRow}>
                  <Text style={S.summaryLabel}>Discount</Text>
                  <Text style={[S.summaryVal, { color: "#16A34A" }]}>- {fmtCurrency(discount)}</Text>
                </View>
              )}
              {totalTax > 0 && (
                <View style={S.summaryRow}>
                  <Text style={S.summaryLabel}>Tax</Text>
                  <Text style={S.summaryVal}>{fmtCurrency(totalTax)}</Text>
                </View>
              )}
              <View style={[S.summaryRow, S.grandTotalRow]}>
                <Text style={S.grandTotalLabel}>Total Amount</Text>
                <Text style={S.grandTotalVal}>{fmtCurrency(grandTotal)}</Text>
              </View>
              <View style={S.summaryRow}>
                <Text style={S.summaryLabel}>Amount Received</Text>
                <Text style={[S.summaryVal, { color: "#16A34A" }]}>{fmtCurrency(info.paidAmount)}</Text>
              </View>
              <View style={[S.summaryRow, { borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8 }]}>
                <Text style={[S.summaryLabel, { color: statusColor, fontWeight: "700" }]}>Balance Due</Text>
                <Text style={[S.summaryVal, { color: statusColor, fontWeight: "700" }]}>
                  {fmtCurrency(Math.max(0, info.remaining))}
                </Text>
              </View>
            </View>
          </View>

          {/* === FOOTER === */}
          <View style={S.invoiceFooter}>
            <Text style={S.footerText}>Authorised Signatory for {BRAND.name}</Text>
            <View style={S.signatureBox} />
          </View>

        </View>
      </ScrollView>

      {/* ── Bottom actions ────────────────────────────── */}
      <View style={S.bottomBar}>
        <TouchableOpacity style={S.bottomBtn} onPress={onShare}>
          <Ionicons name="paper-plane-outline" size={18} color="#2563EB" />
          <Text style={[S.bottomBtnText, { color: "#2563EB" }]}>Share on WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.bottomBtn, S.bottomBtnClose]} onPress={onClose}>
          <Ionicons name="close-outline" size={18} color="#374151" />
          <Text style={S.bottomBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  topBar: {
    backgroundColor: "#1e3a5f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) + 8 : 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  topBarBtn: { padding: 6 },
  topBarTitle: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },

  scroll: { backgroundColor: "#F1F5F9" },

  card: {
    margin: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    overflow: "hidden",
  },

  // Header
  invoiceHeader: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    backgroundColor: "#fff",
  },
  companyName: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#1e3a5f",
    marginBottom: 4,
  },
  companyAddr: { fontSize: 11, color: "#4B5563", lineHeight: 17 },

  invoiceInfoBox: { alignItems: "flex-end", minWidth: 150 },
  invoiceType: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#6B7280",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 8,
  },
  statusText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  invoiceMetaRow: { flexDirection: "row", gap: 6, marginTop: 3 },
  invoiceMetaLabel: { fontSize: 11, color: "#6B7280" },
  invoiceMetaVal: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#111827" },

  divider: { height: 1, backgroundColor: "#E5E7EB" },

  // Bill To
  billToRow: { flexDirection: "row" },
  billToBox: { flex: 1, padding: 14 },
  billToLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#6B7280",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  billToName: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 2 },
  billToDetail: { fontSize: 11, color: "#4B5563", marginTop: 1 },
  billToDetailMuted: { fontSize: 11, color: "#9CA3AF", marginTop: 1, fontStyle: "italic" },

  // Items Table
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#1e3a5f",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tableHeader: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    alignItems: "flex-start",
  },
  tableRowEven: { backgroundColor: "#FAFAFA" },
  tableCell: { fontSize: 12, color: "#374151" },
  itemName: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#111827" },
  itemSub: { fontSize: 11, color: "#6B7280", marginTop: 1 },

  // Totals
  totalsSection: {
    flexDirection: "row",
    padding: 14,
  },
  summaryBox: { width: 200 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  summaryLabel: { fontSize: 12, color: "#6B7280" },
  summaryVal: { fontSize: 12, color: "#111827", fontFamily: "Inter_600SemiBold" },
  grandTotalRow: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
  },
  grandTotalLabel: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#1e3a5f" },
  grandTotalVal: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#1e3a5f" },

  termsTitle: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#374151", marginBottom: 4 },
  termsText: { fontSize: 10, color: "#6B7280", lineHeight: 16 },

  // Footer
  invoiceFooter: {
    padding: 16,
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  footerText: { fontSize: 10, color: "#6B7280", marginBottom: 8 },
  signatureBox: {
    width: 120,
    height: 48,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderStyle: "dashed",
    borderRadius: 4,
    backgroundColor: "#F9FAFB",
  },

  // Bottom bar
  bottomBar: {
    flexDirection: "row",
    padding: 12,
    gap: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
  },
  bottomBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  bottomBtnClose: { backgroundColor: "#F3F4F6" },
  bottomBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151" },
});
