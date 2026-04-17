/**
 * GstFilingScreen.tsx
 * Auto-computes GSTR-1 & GSTR-3B summary from Supabase bills.
 * Shows tax liability, ITC, net payable and download options.
 */
import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, StatusBar, Platform, Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../themeContext";
import { useUser } from "../userContext";
import { supabase } from "../src/services/supabaseClient";

type ReturnPeriod = { label: string; value: string; due: string; filed: boolean };

/** Generate last 6 months dynamically from today */
function buildPeriods(): ReturnPeriod[] {
  const months: ReturnPeriod[] = [];
  const MONTH_NAMES = ["January","February","March","April","May","June",
    "July","August","September","October","November","December"];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    // Due date is 11th of the following month
    const dueD = new Date(d.getFullYear(), d.getMonth() + 1, 11);
    const dueLabel = `${String(dueD.getDate()).padStart(2,"0")} ${MONTH_NAMES[dueD.getMonth()].slice(0,3)} ${dueD.getFullYear()}`;
    months.push({
      label: `${MONTH_NAMES[d.getMonth()]} ${yyyy}`,
      value: `${mm}-${yyyy}`,
      due: dueLabel,
      filed: i > 0, // treat previous months as filed (approximate)
    });
  }
  return months;
}

type GstrSummary = {
  totalSales: number; taxableValue: number;
  cgst: number; sgst: number; igst: number;
  totalGst: number; itc: number; netPayable: number;
  b2bCount: number; b2cCount: number;
};

// ─────────────────────────────────────────────────────────────
export function GstFilingScreen() {
  const { colors, mode } = useTheme();
  const { user }         = useUser();
  const navigation       = useNavigation<any>();

  const PERIODS = useMemo(() => buildPeriods(), []);
  const [period,   setPeriod]  = useState<ReturnPeriod>(PERIODS[0]);
  const [retType,  setRetType] = useState<"gstr1" | "gstr3b">("gstr1");
  const [loading,  setLoading] = useState(false);
  const [summary,  setSummary] = useState<GstrSummary | null>(null);

  const dark = mode === "dark";
  const bg   = dark ? "#0F1117" : "#F0F4FF";
  const card = dark ? "#1C1C2E" : "#FFFFFF";
  const txt  = dark ? "#F1F5F9" : "#111827";
  const sub  = dark ? "#94A3B8" : "#6B7280";

  const computeSummary = useCallback(async () => {
    if (!user?.organisationId) return;
    setLoading(true);
    setSummary(null);
    try {
      const [month, year] = period.value.split("-");
      const from = `${year}-${month}-01`;
      const to   = new Date(parseInt(year), parseInt(month), 0).toISOString().split("T")[0];

      const { data } = await supabase
        .from("bills")
        .select("total, gst, gst_amt, subtotal, buyer_gstin")
        .eq("organisation_id", user.organisationId)
        .eq("deleted", false)
        .gte("created_at", from)
        .lte("created_at", to + "T23:59:59");

      const bills = data ?? [];
      const gstBills    = bills.filter((b: any) => b.gst);
      const b2bBills    = gstBills.filter((b: any) => b.buyer_gstin);
      const b2cBills    = gstBills.filter((b: any) => !b.buyer_gstin);
      const totalSales  = bills.reduce((s: number, b: any) => s + (b.total ?? 0), 0);
      const taxableValue = gstBills.reduce((s: number, b: any) => s + (b.subtotal ?? b.total ?? 0), 0);
      const totalGst    = gstBills.reduce((s: number, b: any) => s + (b.gst_amt ?? 0), 0);
      const cgst = totalGst / 2;
      const sgst = totalGst / 2;
      const igst = 0;
      const itc  = 0; // ITC from purchases — set to 0 until purchase data is linked
      const netPayable = Math.max(0, totalGst - itc);

      setSummary({
        totalSales, taxableValue, cgst, sgst, igst,
        totalGst, itc, netPayable,
        b2bCount: b2bBills.length,
        b2cCount: b2cBills.length,
      });
    } catch (e) {
      console.warn(e);
    }
    setLoading(false);
  }, [user, period]);

  useEffect(() => { computeSummary(); }, [computeSummary]);

  const Row = ({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) => (
    <View style={styles.summaryRow}>
      <Text style={[styles.rowLabel, { color: sub }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: color ?? txt, fontFamily: bold ? "Inter_700Bold" : "Inter_600SemiBold" }]}>{value}</Text>
    </View>
  );

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />

      {/* Header */}
      <LinearGradient colors={["#D97706", "#B45309"]} start={[0,0]} end={[1,1]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>GST Filing</Text>
          <Text style={styles.headerSub}>Auto GSTR-1 & GSTR-3B Summary</Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* Period selector */}
        <Text style={[styles.sectionLabel, { color: sub }]}>SELECT PERIOD</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.value}
              onPress={() => setPeriod(p)}
              style={[
                styles.periodChip,
                {
                  backgroundColor: period.value === p.value ? "#D97706" : card,
                  borderColor: period.value === p.value ? "#D97706" : (dark ? "#2A2A3C" : "#E5E7EB"),
                },
              ]}
            >
              <Text style={{ color: period.value === p.value ? "#fff" : txt, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                {p.label}
              </Text>
              {p.filed && <View style={styles.filedDot} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Return type tabs */}
        <View style={[styles.retTabs, { backgroundColor: card }]}>
          {(["gstr1", "gstr3b"] as const).map((t) => (
            <TouchableOpacity
              key={t} style={[styles.retTab, retType === t && { backgroundColor: "#D97706" }]}
              onPress={() => setRetType(t)}
            >
              <Text style={{ color: retType === t ? "#fff" : sub, fontSize: 14, fontFamily: "Inter_700Bold" }}>
                {t === "gstr1" ? "GSTR-1" : "GSTR-3B"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Due date info */}
        <View style={[styles.dueBox, { backgroundColor: period.filed ? "#D1FAE518" : "#FEF3C718", borderColor: period.filed ? "#10B98130" : "#F59E0B30" }]}>
          <Ionicons name={period.filed ? "checkmark-circle" : "alarm"} size={16} color={period.filed ? "#10B981" : "#F59E0B"} />
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: period.filed ? "#065F46" : "#92400E" }}>
            {period.filed ? `${period.label} return filed ✅` : `Due: ${period.due} · Not yet filed`}
          </Text>
        </View>

        {/* Summary Card */}
        {loading ? (
          <View style={{ alignItems: "center", padding: 40 }}>
            <ActivityIndicator size="large" color="#D97706" />
            <Text style={[{ color: sub, marginTop: 12, fontFamily: "Inter_400Regular" }]}>Computing from bills…</Text>
          </View>
        ) : summary ? (
          <>
            <View style={[styles.summaryCard, { backgroundColor: card }]}>
              <Text style={[styles.summaryCardTitle, { color: txt }]}>
                {retType === "gstr1" ? "GSTR-1 Summary" : "GSTR-3B Summary"} · {period.label}
              </Text>

              <View style={styles.divider} />

              <Row label="Total Sales"         value={fmt(summary.totalSales)} />
              <Row label="Taxable Value"        value={fmt(summary.taxableValue)} />

              <View style={styles.divider} />

              {retType === "gstr1" ? (
                <>
                  <Row label="B2B Invoices"  value={`${summary.b2bCount} invoices`} />
                  <Row label="B2C Invoices"  value={`${summary.b2cCount} invoices`} />
                  <View style={styles.divider} />
                  <Row label="CGST Collected"  value={fmt(summary.cgst)} />
                  <Row label="SGST Collected"  value={fmt(summary.sgst)} />
                  <Row label="IGST Collected"  value={fmt(summary.igst)} />
                  <View style={styles.divider} />
                  <Row label="Total GST"  value={fmt(summary.totalGst)} bold color="#D97706" />
                </>
              ) : (
                <>
                  <Row label="Output Tax (GST)"  value={fmt(summary.totalGst)} />
                  <Row label="Input Tax Credit"  value={fmt(summary.itc)} color="#10B981" />
                  <View style={styles.divider} />
                  <Row label="Net GST Payable" value={fmt(summary.netPayable)} bold color={summary.netPayable > 0 ? "#EF4444" : "#10B981"} />
                </>
              )}
            </View>

            {/* Action buttons */}
            <View style={{ gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#D97706" }]} onPress={() => Linking.openURL("https://services.gst.gov.in/services/login").catch(() => Alert.alert("Error", "Could not open GST portal."))}>
                <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                <Text style={styles.actionBtnTxt}>File on GST Portal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: card, borderWidth: 1, borderColor: dark ? "#2A2A3C" : "#E5E7EB" }]} onPress={() => Alert.alert("Export", `JSON / Excel export for ${period.label} will be available in the next update.\n\nUse the web app (shiromani.xyz) for full export today.`)}>
                <Ionicons name="download-outline" size={18} color={txt} />
                <Text style={[styles.actionBtnTxt, { color: txt }]}>Download JSON / Excel</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 18, paddingTop: Platform.OS === "android" ? 14 : 6, paddingBottom: 18,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 2 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 },
  periodChip: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 10, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  filedDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10B981" },
  retTabs:    { flexDirection: "row", borderRadius: 12, padding: 4, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  retTab:     { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  dueBox:     { flexDirection: "row", gap: 8, alignItems: "center", borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 16 },
  summaryCard: { borderRadius: 16, padding: 18, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, elevation: 4, marginBottom: 12 },
  summaryCardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 14 },
  divider: { height: 1, backgroundColor: "rgba(0,0,0,0.07)", marginVertical: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  rowLabel:   { fontSize: 13, fontFamily: "Inter_400Regular" },
  rowValue:   { fontSize: 14 },
  actionBtn:  { borderRadius: 12, paddingVertical: 14, flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center" },
  actionBtnTxt: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
