/**
 * PaymentReminderScreen.tsx
 * View unpaid bills, set auto-reminders via WhatsApp / SMS / notification.
 * Pulls from Supabase bills table where paid = false.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar, Platform, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../themeContext";
import { useUser } from "../userContext";
import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Constants.expoConfig?.extra?.supabaseUrl ?? "",
  Constants.expoConfig?.extra?.supabaseAnonKey ?? ""
);

type Bill = { id: string; customer: string; phone: string; total: number; due_date: string | null; created_at: string };

const daysDiff = (d: string | null) => {
  if (!d) return null;
  const diff = Math.floor((new Date(d).getTime() - Date.now()) / 86400000);
  return diff;
};

const overdueBadge = (days: number | null) => {
  if (days === null) return { label: "No Due Date", color: "#6B7280" };
  if (days < 0)  return { label: `${Math.abs(days)}d overdue`,  color: "#EF4444" };
  if (days === 0) return { label: "Due today",                   color: "#F59E0B" };
  if (days <= 7)  return { label: `${days}d left`,               color: "#F97316" };
  return              { label: `${days}d left`,                  color: "#10B981" };
};

// ─────────────────────────────────────────────────────────────
export function PaymentReminderScreen() {
  const { colors, mode } = useTheme();
  const { user }         = useUser();
  const navigation       = useNavigation<any>();

  const [bills,   setBills]   = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<Record<string, boolean>>({});
  const [autoMode, setAutoMode]   = useState(false);

  const dark = mode === "dark";
  const bg   = dark ? "#0F1117" : "#F0F4FF";
  const card = dark ? "#1C1C2E" : "#FFFFFF";
  const txt  = dark ? "#F1F5F9" : "#111827";
  const sub  = dark ? "#94A3B8" : "#6B7280";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("bills")
        .select("id, customer, phone, total, due_date, created_at")
        .eq("organisation_id", user?.organisation_id ?? "")
        .eq("deleted", false)
        .eq("paid", false)
        .order("due_date", { ascending: true })
        .limit(100);
      if (data) setBills(data as Bill[]);
    } catch (_) {}
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const sendReminder = (bill: Bill, channel: "whatsapp" | "sms") => {
    const msg = `Dear ${bill.customer}, your payment of ₹${bill.total.toLocaleString("en-IN")} is due${bill.due_date ? ` on ${new Date(bill.due_date).toLocaleDateString("en-IN")}` : ""}. Kindly clear the dues. – Shiromani Printers`;
    if (channel === "whatsapp") {
      Alert.alert("WhatsApp Reminder", `Message drafted for ${bill.phone ?? "no phone"}:\n\n"${msg}"`);
    } else {
      Alert.alert("SMS Reminder", `SMS drafted for ${bill.phone ?? "no phone"}:\n\n"${msg}"`);
    }
  };

  const toggleReminder = (id: string) =>
    setReminders((r) => ({ ...r, [id]: !r[id] }));

  const totalDue = bills.reduce((s, b) => s + b.total, 0);
  const overdue  = bills.filter((b) => (daysDiff(b.due_date) ?? 0) < 0).length;

  const renderBill = ({ item }: { item: Bill }) => {
    const badge = overdueBadge(daysDiff(item.due_date));
    return (
      <View style={[styles.billCard, { backgroundColor: card }]}>
        {/* top row */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <View style={[styles.avatar, { backgroundColor: badge.color + "18" }]}>
            <Text style={[styles.avatarText, { color: badge.color }]}>
              {item.customer.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.custName, { color: txt }]} numberOfLines={1}>{item.customer}</Text>
            <Text style={[styles.custPhone, { color: sub }]}>{item.phone || "No phone"}</Text>
          </View>
          <View>
            <Text style={[styles.amt, { color: txt }]}>₹{item.total.toLocaleString("en-IN")}</Text>
            <View style={[styles.dueBadge, { backgroundColor: badge.color + "1A" }]}>
              <Text style={[styles.dueBadgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          </View>
        </View>

        {/* action row */}
        <View style={styles.actionRowInner}>
          <TouchableOpacity
            style={[styles.reminderBtn, { backgroundColor: "#25D36618", borderColor: "#25D36630" }]}
            onPress={() => sendReminder(item, "whatsapp")}
          >
            <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
            <Text style={[styles.reminderBtnTxt, { color: "#25D366" }]}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reminderBtn, { backgroundColor: "#3B82F618", borderColor: "#3B82F630" }]}
            onPress={() => sendReminder(item, "sms")}
          >
            <Ionicons name="chatbubble-outline" size={16} color="#3B82F6" />
            <Text style={[styles.reminderBtnTxt, { color: "#3B82F6" }]}>SMS</Text>
          </TouchableOpacity>
          <View style={styles.autoToggle}>
            <Text style={[styles.autoLabel, { color: sub }]}>Auto</Text>
            <Switch
              value={!!reminders[item.id]}
              onValueChange={() => toggleReminder(item.id)}
              trackColor={{ true: "#2563EB", false: dark ? "#374151" : "#D1D5DB" }}
              thumbColor="#fff"
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />

      {/* Header */}
      <LinearGradient colors={["#EF4444", "#B91C1C"]} start={[0,0]} end={[1,1]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Payment Reminders</Text>
          <Text style={styles.headerSub}>Unpaid bills · Auto WhatsApp / SMS</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Summary banner */}
      <View style={[styles.summaryBanner, { backgroundColor: card }]}>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.bannerValue, { color: txt }]}>{bills.length}</Text>
          <Text style={[styles.bannerLabel, { color: sub }]}>Unpaid Bills</Text>
        </View>
        <View style={[styles.bannerDiv, { backgroundColor: dark ? "#2A2A3C" : "#E5E7EB" }]} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.bannerValue, { color: "#EF4444" }]}>{overdue}</Text>
          <Text style={[styles.bannerLabel, { color: sub }]}>Overdue</Text>
        </View>
        <View style={[styles.bannerDiv, { backgroundColor: dark ? "#2A2A3C" : "#E5E7EB" }]} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.bannerValue, { color: txt }]}>₹{(totalDue / 1000).toFixed(0)}K</Text>
          <Text style={[styles.bannerLabel, { color: sub }]}>Total Due</Text>
        </View>
      </View>

      {/* Global auto-reminder toggle */}
      <View style={[styles.globalToggle, { backgroundColor: "#EF444412", borderColor: "#EF444430" }]}>
        <Ionicons name="alarm" size={18} color="#EF4444" />
        <Text style={[styles.globalToggleTxt, { color: txt, flex: 1 }]}>Auto-reminder (daily 10 AM)</Text>
        <Switch
          value={autoMode}
          onValueChange={setAutoMode}
          trackColor={{ true: "#EF4444", false: dark ? "#374151" : "#D1D5DB" }}
          thumbColor="#fff"
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#EF4444" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={bills}
          keyExtractor={(b) => b.id}
          renderItem={renderBill}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Ionicons name="checkmark-circle" size={56} color="#10B981" />
              <Text style={[{ color: txt, fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 14 }]}>All Paid! 🎉</Text>
              <Text style={[{ color: sub, fontSize: 14, marginTop: 6 }]}>No outstanding payments.</Text>
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
  summaryBanner: {
    flexDirection: "row", marginHorizontal: 16, marginTop: 14, borderRadius: 16,
    paddingVertical: 14, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  bannerValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  bannerLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
  bannerDiv:   { width: 1, marginVertical: 8 },
  globalToggle: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1,
    borderRadius: 12, padding: 12, marginHorizontal: 16, marginTop: 12,
  },
  globalToggleTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },
  billCard: {
    borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  custName:  { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  custPhone: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  amt: { fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "right" },
  dueBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4, alignSelf: "flex-end" },
  dueBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  actionRowInner: { flexDirection: "row", gap: 8, alignItems: "center" },
  reminderBtn: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 8, paddingVertical: 7 },
  reminderBtnTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  autoToggle: { flexDirection: "row", alignItems: "center", gap: 2 },
  autoLabel:  { fontSize: 11, fontFamily: "Inter_500Medium" },
});
