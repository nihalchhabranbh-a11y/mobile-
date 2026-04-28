import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../themeContext";
import { useUser } from "../userContext";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { supabase } from "../src/services/supabaseClient";

// ─────────────────────────────────────────────────────────────
//  Data
// ─────────────────────────────────────────────────────────────
const SUITE_ITEMS = [
  {
    key: "EInvoice",
    title: "E-Invoice",
    subtitle: "Generate IRN / QR-code\ncompliant invoices",
    icon: "document-text",
    gradient: ["#2563EB", "#1D4ED8"] as [string, string],
    badge: null,
  },
  {
    key: "EWayBill",
    title: "E-Way Bill",
    subtitle: "Generate & manage\ne-way bills (EWB)",
    icon: "car-sport",
    gradient: ["#7C3AED", "#5B21B6"] as [string, string],
    badge: null,
  },
  {
    key: "GstFiling",
    title: "GST Filing",
    subtitle: "GSTR-1, GSTR-3B\nreturn summary",
    icon: "folder",
    gradient: ["#D97706", "#B45309"] as [string, string],
    badge: "NEW",
  },
  {
    key: "GstFinder",
    title: "GST Finder",
    subtitle: "Verify GSTIN, fetch\nbusiness details",
    icon: "search-circle",
    gradient: ["#059669", "#047857"] as [string, string],
    badge: null,
  },
];

// ─────────────────────────────────────────────────────────────
export function GstSuiteScreen() {
  const { colors, mode } = useTheme();
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  
  const dark = mode === "dark";
  const bg   = colors.background;
  const card = colors.cardBackground;
  const txt  = colors.textPrimary;
  const sub  = colors.textSecondary;

  const [stats, setStats] = useState([
    { label: "Invoices This Month", value: "-",  icon: "receipt",         color: "#2563EB" },
    { label: "E-Way Bills",         value: "-",   icon: "car-sport",       color: "#7C3AED" },
    { label: "GST Payable",         value: "₹0",  icon: "cash",            color: "#D97706" },
    { label: "Pending Returns",     value: "-",   icon: "alert-circle",    color: "#DC2626" },
  ]);

  useEffect(() => {
    if (isFocused && user?.organisationId) {
      loadStats();
    }
  }, [isFocused, user?.organisationId]);

  const loadStats = async () => {
    try {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      // Bills this month
      const { count: billsCount } = await supabase
        .from("bills")
        .select("*", { count: "exact", head: true })
        .eq("organisation_id", user.organisationId)
        .gte("created_at", firstDay)
        .lte("created_at", lastDay);

      // EWay Bills total (or this month)
      const { count: ewbCount } = await supabase
        .from("eway_bills")
        .select("*", { count: "exact", head: true })
        .eq("organisation_id", user.organisationId)
        .eq("status", "ACTIVE");

      setStats([
        { label: "Invoices This Month", value: `${billsCount || 0}`, icon: "receipt", color: "#2563EB" },
        { label: "E-Way Bills (Active)", value: `${ewbCount || 0}`, icon: "car-sport", color: "#7C3AED" },
        { label: "GST Payable", value: "₹0", icon: "cash", color: "#D97706" },
        { label: "Pending Returns", value: "2", icon: "alert-circle", color: "#DC2626" },
      ]);
    } catch (err) {
      console.warn("Failed to load suite stats", err);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />

      {/* ── Header ─────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: bg }]}>
        <View>
          <Text style={[styles.headerTitle, { color: txt }]}>GST Suite</Text>
          <Text style={[styles.headerSub, { color: sub }]}>FY 2024-25 · GSTIN linked</Text>
        </View>
        <TouchableOpacity
          style={[styles.notifBtn, { backgroundColor: card }]}
          onPress={() => navigation.navigate("Notifications")}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.accentBlue ?? "#2563EB"} />
          <View style={styles.notifDot} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* ── Stats Row ──────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 18, marginBottom: 24 }}>
          {stats.map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: card }]}>
              <View style={[styles.statIconWrap, { backgroundColor: s.color + "16" }]}>
                <Ionicons name={s.icon as any} size={18} color={s.color} />
              </View>
              <Text style={[styles.statValue, { color: txt }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: sub }]}>{s.label}</Text>
            </View>
          ))}
          <View style={{ width: 18 }} />
        </ScrollView>

        {/* ── Suite Grid ─────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: sub, marginLeft: 20 }]}>MODULES</Text>
        <View style={styles.grid}>
          {SUITE_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.85}
              style={styles.gridCell}
              onPress={() => navigation.navigate(item.key)}
            >
              <LinearGradient colors={item.gradient} start={[0, 0]} end={[1, 1]} style={styles.suiteCard}>
                {item.badge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                )}
                <View style={styles.suiteIconWrap}>
                  <Ionicons name={item.icon as any} size={32} color="#fff" />
                </View>
                <Text style={styles.suiteTitle}>{item.title}</Text>
                <Text style={styles.suiteSub}>{item.subtitle}</Text>
                <View style={styles.suiteArrow}>
                  <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.8)" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Compliance Checklist ──────────────────────────── */}
        <View style={{ paddingHorizontal: 18, marginTop: 8 }}>
          <Text style={[styles.sectionTitle, { color: sub, marginBottom: 12 }]}>COMPLIANCE CHECKLIST</Text>
          {[
            { label: "GSTR-1 (July 2025)",   done: true },
            { label: "GSTR-3B (July 2025)",  done: true },
            { label: "GSTR-1 (Aug 2025)",    done: false },
            { label: "GSTR-3B (Aug 2025)",   done: false },
          ].map((row, i) => (
            <View key={i} style={[styles.checkRow, { backgroundColor: card }]}>
              <Ionicons
                name={row.done ? "checkmark-circle" : "ellipse-outline"}
                size={20}
                color={row.done ? "#10B981" : "#F59E0B"}
              />
              <Text style={[styles.checkLabel, { color: txt }]}>{row.label}</Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: row.done ? "#10B981" : "#F59E0B" }}>
                {row.done ? "Filed" : "Pending"}
              </Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 12 : 4, paddingBottom: 16,
  },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
  headerSub:   { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  notifBtn: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  notifDot: {
    position: "absolute", top: 9, right: 10,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "#EF4444", borderWidth: 1.5, borderColor: "#fff",
  },
  // Stats
  statCard: {
    width: 130, borderRadius: 16, padding: 14, marginRight: 12,
    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  statIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  statValue:    { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel:    { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },
  // Grid
  sectionTitle: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 18, gap: 12, marginBottom: 24 },
  gridCell: { width: "47.5%" },
  suiteCard: {
    borderRadius: 20, padding: 18, minHeight: 160,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 14, elevation: 6,
  },
  badge: {
    position: "absolute", top: 14, right: 14,
    backgroundColor: "#FCD34D", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  badgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#92400E" },
  suiteIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  suiteTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 4 },
  suiteSub:   { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", lineHeight: 16 },
  suiteArrow: {
    position: "absolute", bottom: 14, right: 14,
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
  },
  // Checklist
  checkRow: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 12, padding: 14, marginBottom: 8, gap: 12,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  checkLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
});
