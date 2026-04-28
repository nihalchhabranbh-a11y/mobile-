/**
 * NotificationsScreen.tsx
 * Shows payment received, reminders sent, GST dues, system alerts.
 */
import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../themeContext";

type Notif = {
  id: string;
  type: "payment" | "reminder" | "gst" | "system" | "bill";
  title: string;
  body: string;
  time: string;
  read: boolean;
};

const ICON_MAP = {
  payment:  { icon: "cash",                color: "#10B981" },
  reminder: { icon: "alarm",               color: "#EF4444" },
  gst:      { icon: "document-attach",     color: "#D97706" },
  system:   { icon: "settings",            color: "#6B7280" },
  bill:     { icon: "receipt",             color: "#2563EB" },
} as const;

const SAMPLE: Notif[] = [
  {
    id: "1", type: "payment", read: false,
    title: "Payment Received",
    body:  "Mehta Textiles paid ₹1,25,000 for INV-2025-089",
    time:  "2 min ago",
  },
  {
    id: "2", type: "gst", read: false,
    title: "GST Filing Due",
    body:  "GSTR-1 for August 2025 is due on 11 Sep. File now to avoid late fee.",
    time:  "1 hr ago",
  },
  {
    id: "3", type: "reminder", read: false,
    title: "Payment Reminder Sent",
    body:  "WhatsApp reminder sent to Kumar Enterprises (₹78,500 overdue).",
    time:  "3 hr ago",
  },
  {
    id: "4", type: "bill", read: true,
    title: "New Bill Created",
    body:  "INV-2025-091 created for Patel Industries · ₹34,200 · GST included",
    time:  "Yesterday",
  },
  {
    id: "5", type: "gst", read: true,
    title: "E-Invoice Generated",
    body:  "IRN generated for INV-2025-087 · Mehta Textiles · ₹1,25,000",
    time:  "Yesterday",
  },
  {
    id: "6", type: "system", read: true,
    title: "Backup Complete",
    body:  "Daily data backup completed successfully to Supabase cloud.",
    time:  "2 days ago",
  },
  {
    id: "7", type: "reminder", read: true,
    title: "Overdue Alert",
    body:  "5 bills are overdue by more than 30 days. Total: ₹2,14,000",
    time:  "2 days ago",
  },
  {
    id: "8", type: "payment", read: true,
    title: "Partial Payment",
    body:  "Sharma Bros paid ₹25,000 of ₹68,000 outstanding.",
    time:  "3 days ago",
  },
];

// ─────────────────────────────────────────────────────────────
export function NotificationsScreen() {
  const { colors, mode } = useTheme();
  const navigation       = useNavigation<any>();
  const [notifs, setNotifs] = useState<Notif[]>(SAMPLE);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const dark = mode === "dark";
  const bg   = colors.background;
  const card = colors.cardBackground;
  const txt  = colors.textPrimary;
  const sub  = colors.textSecondary;

  const markAllRead = () => setNotifs((n) => n.map((x) => ({ ...x, read: true })));
  const markRead    = (id: string) => setNotifs((n) => n.map((x) => x.id === id ? { ...x, read: true } : x));

  const unreadCount = notifs.filter((n) => !n.read).length;
  const displayed   = filter === "unread" ? notifs.filter((n) => !n.read) : notifs;

  const renderNotif = ({ item }: { item: Notif }) => {
    const meta = ICON_MAP[item.type];
    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => markRead(item.id)}
        style={[
          styles.notifCard,
          {
            backgroundColor: item.read ? card : (dark ? "#1C2340" : "#EFF6FF"),
            borderLeftWidth: item.read ? 0 : 3,
            borderLeftColor: meta.color,
          },
        ]}
      >
        <View style={[styles.notifIcon, { backgroundColor: meta.color + "1A" }]}>
          <Ionicons name={meta.icon as any} size={22} color={meta.color} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[styles.notifTitle, { color: txt }]}>{item.title}</Text>
            {!item.read && <View style={[styles.unreadDot, { backgroundColor: meta.color }]} />}
          </View>
          <Text style={[styles.notifBody, { color: sub }]} numberOfLines={2}>{item.body}</Text>
          <Text style={[styles.notifTime, { color: sub }]}>{item.time}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />

      {/* Header */}
      <LinearGradient colors={["#1E293B","#0F172A"]} start={[0,0]} end={[1,1]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSub}>{unreadCount} unread alert{unreadCount > 1 ? "s" : ""}</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markBtn}>
            <Text style={styles.markBtnTxt}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* Filter chips */}
      <View style={[styles.filterRow, { backgroundColor: card, borderBottomColor: dark ? "#2A2A3C" : "#E5E7EB" }]}>
        {(["all", "unread"] as const).map((f) => (
          <TouchableOpacity
            key={f} style={[styles.filterChip, filter === f && { borderBottomWidth: 2, borderBottomColor: "#2563EB" }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterLabel, { color: filter === f ? "#2563EB" : sub }]}>
              {f === "all" ? `All (${notifs.length})` : `Unread (${unreadCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={displayed}
        keyExtractor={(n) => n.id}
        renderItem={renderNotif}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60, gap: 12 }}>
            <Ionicons name="notifications-off-outline" size={52} color={sub} />
            <Text style={[{ color: sub, fontSize: 16, fontFamily: "Inter_600SemiBold" }]}>No unread notifications</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: Platform.OS === "android" ? 14 : 6, paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 2 },
  markBtn: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  markBtnTxt: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  filterRow: { flexDirection: "row", borderBottomWidth: 1 },
  filterChip: { flex: 1, paddingVertical: 13, alignItems: "center" },
  filterLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  notifCard: {
    flexDirection: "row", gap: 12, borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  notifIcon:  { width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  notifTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  notifBody:  { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  notifTime:  { fontSize: 11, fontFamily: "Inter_400Regular" },
  unreadDot:  { width: 7, height: 7, borderRadius: 4 },
});
