/**
 * EInvoiceScreen.tsx
 * Generate GST-compliant e-invoices (IRN + QR code) from existing bills.
 * Integrates with your Supabase `bills` table.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, StatusBar, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../themeContext";
import { useUser } from "../userContext";
import { supabase } from "../src/services/supabaseClient";
import { generateRealEInvoice } from "../src/services/sandboxService";

type Bill = {
  id: string;
  customer: string;
  total: number;
  gst: boolean;
  gst_amt: number;
  created_at: string;
  irn?: string;
  ack_no?: string;
  ewb_no?: string;
  bill_number?: string;
  buyer_gstin?: string | null;
  items?: any[];
};

type EInvStatus = "not_generated" | "generating" | "generated" | "error";

// ─────────────────────────────────────────────────────────────
export function EInvoiceScreen() {
  const { colors, mode } = useTheme();
  const { user }         = useUser();
  const navigation       = useNavigation<any>();

  const [bills,    setBills]    = useState<Bill[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [statuses, setStatuses] = useState<Record<string, EInvStatus>>({});

  const dark = mode === "dark";
  const bg   = dark ? "#0F1117" : "#F0F4FF";
  const card = dark ? "#1C1C2E" : "#FFFFFF";
  const txt  = dark ? "#F1F5F9" : "#111827";
  const sub  = dark ? "#94A3B8" : "#6B7280";

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("bills")
        .select("id, customer, total, gst, gst_amt, created_at, irn, ack_no, ewb_no, bill_number, buyer_gstin, items")
        .eq("organisation_id", user?.organisationId ?? "")
        .eq("deleted", false)
        .eq("gst", true)
        .order("created_at", { ascending: false })
        .limit(80);
      if (!error && data) {
        setBills(data as Bill[]);
        const st: Record<string, EInvStatus> = {};
        for (const b of data as Bill[]) {
          if (b.irn) st[b.id] = "generated";
        }
        setStatuses(st);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const filtered = bills.filter((b) =>
    b.customer.toLowerCase().includes(search.toLowerCase())
  );

  const generateIRN = async (bill: Bill) => {
    if (bill.irn || statuses[bill.id] === "generated") return; // Guard to prevent re-generating
    
    setStatuses((s) => ({ ...s, [bill.id]: "generating" }));
    try {
      // Fetch seller GSTIN from org settings
      const { data: settings } = await supabase
        .from("settings")
        .select("gst_number")
        .eq("organisation_id", user?.organisationId ?? "")
        .limit(1)
        .maybeSingle();

      const sellerGstin = settings?.gst_number;
      if (!sellerGstin) {
        throw new Error(
          "Your GST number is not configured.\nGo to Company Details \u2192 GST Number and add it first."
        );
      }

      // Build DD/MM/YYYY invoice date required by Sandbox API
      const d = new Date(bill.created_at);
      const invoiceDate = [
        String(d.getDate()).padStart(2, "0"),
        String(d.getMonth() + 1).padStart(2, "0"),
        d.getFullYear(),
      ].join("/");

      const halfGst = (bill.gst_amt ?? 0) / 2;

      const result = await generateRealEInvoice({
        seller_gstin: sellerGstin,
        buyer_gstin: bill.buyer_gstin || undefined,
        buyer_name: bill.customer,
        invoice_number: bill.bill_number || bill.id.slice(0, 12).toUpperCase(),
        invoice_date: invoiceDate,
        invoice_value: bill.total,
        cgst: halfGst,
        sgst: halfGst,
        igst: 0,
        items: Array.isArray(bill.items)
          ? bill.items.map((it: any) => ({
              description: it.name || it.description || "Item",
              quantity: Number(it.qty ?? it.quantity ?? 1),
              unit_price: Number(it.rate ?? it.unit_price ?? 0),
              amount: Number(it.amount ?? 0),
              hsn_code: it.hsn || it.hsn_code || undefined,
              tax_rate: Number(it.tax ?? it.tax_rate ?? 0),
            }))
          : [],
      });

      // Save IRN + Ack No to Supabase for persistence
      await supabase
        .from("bills")
        .update({ irn: result.irn, ack_no: result.ack_no })
        .eq("id", bill.id);

      setStatuses((s) => ({ ...s, [bill.id]: "generated" }));
      await fetchBills();
      Alert.alert(
        "E-Invoice Generated \u2705",
        `IRN: ${result.irn}\n` +
          (result.ack_no ? `Ack No: ${result.ack_no}\n` : "") +
          (result.ack_dt ? `Ack Date: ${result.ack_dt}\n` : "") +
          "\nBill is now GST compliant!"
      );
    } catch (e: any) {
      setStatuses((s) => ({ ...s, [bill.id]: "error" }));
      Alert.alert("Generation Failed", e?.message || "Could not generate IRN. Please try again.");
    }
  };

  const statusChip = (id: string) => {
    const st = statuses[id] ?? "not_generated";
    const map: Record<EInvStatus, { label: string; color: string }> = {
      not_generated: { label: "Generate",   color: "#2563EB" },
      generating:    { label: "...",         color: "#F59E0B" },
      generated:     { label: "✓ IRN Ready", color: "#10B981" },
      error:         { label: "Retry",       color: "#EF4444" },
    };
    return map[st];
  };

  const renderBill = ({ item }: { item: Bill }) => {
    const chip = statusChip(item.id);
    const date = new Date(item.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    return (
      <View style={[styles.billCard, { backgroundColor: card }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.billCustomer, { color: txt }]} numberOfLines={1}>{item.customer}</Text>
          <Text style={[styles.billDate, { color: sub }]}>{date} · GST ₹{item.gst_amt?.toFixed(0) ?? 0}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Text style={[styles.billTotal, { color: txt }]}>₹{item.total.toLocaleString("en-IN")}</Text>
          <TouchableOpacity
            style={[styles.irnBtn, { backgroundColor: chip.color + "18", borderColor: chip.color + "40" }]}
            onPress={() => statuses[item.id] !== "generating" && generateIRN(item)}
            disabled={statuses[item.id] === "generating" || statuses[item.id] === "generated"}
          >
            {statuses[item.id] === "generating" ? (
              <ActivityIndicator size={12} color={chip.color} />
            ) : (
              <Text style={[styles.irnBtnText, { color: chip.color }]}>{chip.label}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />

      {/* Header */}
      <LinearGradient colors={["#2563EB", "#1D4ED8"]} start={[0,0]} end={[1,1]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>E-Invoice</Text>
          <Text style={styles.headerSub}>GST · IRN Generation · QR Code</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchBills}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Info banner */}
      <View style={[styles.infoBanner, { backgroundColor: "#2563EB18", borderColor: "#2563EB30" }]}>
        <Ionicons name="information-circle" size={18} color="#2563EB" />
        <Text style={[styles.infoText, { color: dark ? "#93C5FD" : "#1D4ED8" }]}>
          Only GST-enabled bills above ₹5 Cr turnover require mandatory e-invoicing. Generating IRN is always recommended.
        </Text>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: card, borderColor: dark ? "#2A2A3C" : "#E5E7EB" }]}>
        <Ionicons name="search-outline" size={18} color={sub} />
        <TextInput
          style={[styles.searchInput, { color: txt }]}
          placeholder="Search by party name…"
          placeholderTextColor={sub}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderBill}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Ionicons name="document-text-outline" size={48} color={sub} />
              <Text style={[styles.emptyText, { color: sub }]}>No GST bills found.</Text>
              <Text style={{ color: sub, fontSize: 13, textAlign: "center", marginTop: 4 }}>Create a bill with GST enabled first.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 18, paddingTop: Platform.OS === "android" ? 14 : 6, paddingBottom: 18,
  },
  backBtn:    { padding: 4 },
  refreshBtn: { padding: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.15)" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 2 },
  infoBanner: {
    flexDirection: "row", alignItems: "flex-start",
    margin: 16, borderRadius: 12, padding: 12, gap: 8, borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, gap: 8, marginBottom: 4,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  billCard: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 14, padding: 16, gap: 12,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  billCustomer: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  billDate:     { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  billTotal:    { fontSize: 16, fontFamily: "Inter_700Bold" },
  irnBtn: {
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1,
    minWidth: 90, alignItems: "center",
  },
  irnBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 12 },
});
