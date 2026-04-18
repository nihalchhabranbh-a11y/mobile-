import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../themeContext";
import { useUser } from "../userContext";
import { fetchBills, RecentBill } from "../services/billingService";
import { getTasks, getWorkers, getVendors, Task, Worker, Vendor } from "../services/tasksService";
import { useFocusEffect } from "@react-navigation/native";

export const AdminPanelScreen: React.FC = () => {
  const { user } = useUser();
  const { colors, spacing, radius } = useTheme();
  const styles = useMemo(
    () => createStyles({ colors, spacing, radius }),
    [colors, spacing, radius]
  );
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<RecentBill[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  if (user?.role !== "admin") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "bold" }}>Unauthorized</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 8 }}>You do not have administration permissions.</Text>
      </View>
    );
  }

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [b, t, w, v] = await Promise.all([
        fetchBills(user?.organisationId || undefined),
        getTasks(),
        getWorkers(),
        getVendors(),
      ]);
      setBills(b);
      setTasks(t);
      setWorkers(w);
      setVendors(v);
    } catch (e) {
      console.warn("[Admin] load failed", e);
    } finally {
      setLoading(false);
    }
  }, [user?.organisationId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const workerProgress = useMemo(() => {
    return workers.map((w) => {
      const wt = tasks.filter((t) => (t.worker || t.worker_id) === w.id);
      const done = wt.filter((t) => t.status === "Completed").length;
      return { worker: w, total: wt.length, done };
    });
  }, [workers, tasks]);

  const fmtCurrency = (n: number) =>
    `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  if (user?.role !== "admin") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.restricted}>
          <Text style={styles.restrictedTitle}>Admin only</Text>
          <Text style={styles.restrictedText}>This section is for administrators.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accentBlue} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Admin Panel</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Bills Overview</Text>
          {bills.slice(0, 8).map((b) => (
            <View key={b.id} style={styles.billRow}>
              <View>
                <Text style={styles.billCustomer}>{b.customer}</Text>
                <Text style={styles.billMeta}>{b.id} · {fmtDate(b.createdAt)}</Text>
              </View>
              <View style={styles.billRight}>
                <Text style={styles.billTotal}>{fmtCurrency(b.total)}</Text>
                <Text style={[styles.billBadge, b.paid ? styles.badgeGreen : styles.badgeRed]}>
                  {b.paid ? "Paid" : "Unpaid"}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workers & Task Progress</Text>
          {workerProgress.map(({ worker, total, done }) => (
            <View key={worker.id} style={styles.workerRow}>
              <View style={styles.workerHeader}>
                <Text style={styles.workerName}>{worker.name}</Text>
                <Text style={styles.workerCount}>{done}/{total} tasks</Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: total ? `${(done / total) * 100}%` : "0%" },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vendors</Text>
          <Text style={styles.vendorSummary}>
            {vendors.length} vendor{vendors.length !== 1 ? "s" : ""} registered.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    safeArea: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
    loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.sm },
    loadingText: { color: colors.textMuted, fontSize: 12 },
    restricted: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
    restrictedTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700" },
    restrictedText: { color: colors.textMuted, fontSize: 14, marginTop: spacing.sm },
    title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: spacing.lg },
    section: { marginBottom: spacing.xl },
    sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "600", marginBottom: spacing.sm },
    billRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    billCustomer: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
    billMeta: { color: colors.textMuted, fontSize: 11 },
    billRight: { alignItems: "flex-end" },
    billTotal: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
    billBadge: { fontSize: 11, marginTop: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
    badgeGreen: { backgroundColor: colors.accentGreen + "33", color: colors.accentGreen },
    badgeRed: { backgroundColor: colors.accentRed + "33", color: colors.accentRed },
    workerRow: { marginBottom: spacing.md },
    workerHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
    workerName: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
    workerCount: { color: colors.textMuted, fontSize: 12 },
    progressBar: { height: 6, borderRadius: 999, backgroundColor: colors.surface, overflow: "hidden" },
    progressFill: { height: "100%", backgroundColor: colors.accentBlue, borderRadius: 999 },
    vendorSummary: { color: colors.textSecondary, fontSize: 14 },
  });
