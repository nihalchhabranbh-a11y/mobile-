import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../themeContext";
import { useSafeScreen } from "../hooks/useSafeScreen";
import { Card, FabWithActions, ListRow, StatusPill } from "../components/ui";
import { useFocusEffect } from "@react-navigation/native";

type JobStage = "Design" | "Printing" | "Finishing" | "Delivered";

type Job = {
  id: string;
  customerName: string;
  title: string;
  dueDate?: string;
  stage: JobStage;
  sqft?: number;
  notes?: string;
  createdAt: string;
};

const STORAGE_KEY = "pm_jobs_v1";
const STAGES: JobStage[] = ["Design", "Printing", "Finishing", "Delivered"];

export const JobsScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeScreen();
  const styles = useMemo(
    () => createStyles({ colors, spacing, radius }),
    [colors, spacing, radius]
  );

  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [sqft, setSqft] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: Job[] = raw ? JSON.parse(raw) : [];
      setJobs(parsed.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const persist = async (next: Job[]) => {
    setJobs(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const openNew = () => {
    setCustomerName("");
    setTitle("");
    setDueDate("");
    setSqft("");
    setNotes("");
    setModalVisible(true);
  };

  const createJob = async () => {
    if (!customerName.trim() || !title.trim()) {
      Alert.alert("Required", "Enter customer name and job title.");
      return;
    }
    try {
      setSaving(true);
      const job: Job = {
        id: `JOB-${Date.now()}`,
        customerName: customerName.trim(),
        title: title.trim(),
        dueDate: dueDate.trim() || undefined,
        sqft: sqft.trim() ? Number(sqft) : undefined,
        notes: notes.trim() || undefined,
        stage: "Design",
        createdAt: new Date().toISOString(),
      };
      const next = [job, ...jobs];
      await persist(next);
      setModalVisible(false);
    } finally {
      setSaving(false);
    }
  };

  const deleteJob = async (id: string) => {
    Alert.alert("Delete Job", "Remove this job permanently?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        const next = jobs.filter(j => j.id !== id);
        await persist(next);
      }},
    ]);
  };

  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) return jobs;
    const q = searchQuery.toLowerCase();
    return jobs.filter(j => j.customerName.toLowerCase().includes(q) || j.title.toLowerCase().includes(q));
  }, [jobs, searchQuery]);

  const nextStage = async (job: Job) => {
    const idx = STAGES.indexOf(job.stage);
    const next = STAGES[Math.min(idx + 1, STAGES.length - 1)];
    const updated = jobs.map((j) => (j.id === job.id ? { ...j, stage: next } : j));
    await persist(updated);
  };

  const stageVariant = (stage: JobStage) => {
    if (stage === "Delivered") return "paid";
    if (stage === "Finishing") return "partial";
    if (stage === "Printing") return "info";
    return "unpaid";
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.root, { paddingTop: insets.paddingTop || spacing.lg }]}>
        <Text style={styles.title}>Production</Text>
        <Text style={styles.subtitle}>Design → Printing → Finishing → Delivered</Text>
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search jobs..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? <TouchableOpacity onPress={() => setSearchQuery("")}><Ionicons name="close-circle" size={18} color="#ccc" /></TouchableOpacity> : null}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accentBlue} />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : (
          <FlatList
            data={filteredJobs}
            keyExtractor={(j) => j.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.empty}>No jobs yet.</Text>}
            renderItem={({ item }) => (
              <Card style={{ marginBottom: spacing.sm }}>
                <View style={styles.jobHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobTitle} numberOfLines={1}>
                      {item.customerName}
                    </Text>
                    <Text style={styles.jobSub} numberOfLines={1}>
                      {item.title}
                      {item.dueDate ? ` • Due ${item.dueDate}` : ""}
                    </Text>
                  </View>
                  <StatusPill
                    label={item.stage}
                    variant={stageVariant(item.stage) as any}
                  />
                </View>
                <View style={styles.jobFooter}>
                  <Text style={styles.jobMeta}>
                    {item.sqft ? `${item.sqft} SQFT` : "—"}
                  </Text>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <TouchableOpacity
                      style={[styles.advanceBtn, { backgroundColor: colors.accentRed ?? "#EF4444", opacity: 0.85 }]}
                      onPress={() => deleteJob(item.id)}
                    >
                      <Text style={styles.advanceBtnText}>Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.advanceBtn}
                      onPress={() => nextStage(item)}
                      disabled={item.stage === "Delivered"}
                    >
                      <Text style={styles.advanceBtnText}>
                        {item.stage === "Delivered" ? "Done" : "Next stage"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            )}
          />
        )}

        <FabWithActions
          actions={[
            { label: "New Job", onPress: openNew },
            { label: "Reload", onPress: load },
          ]}
        />
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>New Job</Text>
            <Text style={styles.label}>Customer name *</Text>
            <TextInput
              style={styles.input}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Party name"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Job title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Flex banner, Visiting cards, etc."
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Due date</Text>
                <TextInput
                  style={styles.input}
                  value={dueDate}
                  onChangeText={setDueDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>SQFT</Text>
                <TextInput
                  style={styles.input}
                  value={sqft}
                  onChangeText={setSqft}
                  placeholder="Optional"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!customerName.trim() || !title.trim()) && { opacity: 0.6 },
                ]}
                onPress={createJob}
                disabled={saving || !customerName.trim() || !title.trim()}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
    root: { flex: 1, paddingHorizontal: spacing.lg },
    title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
    subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2, marginBottom: spacing.md },
    loadingWrap: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
    loadingText: { color: colors.textMuted, fontSize: 12 },
    listContent: { paddingBottom: 120 },
    empty: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: spacing.xl },
    searchWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.cardBackground,
      borderRadius: 24,
      paddingHorizontal: 14,
      height: 44,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, marginLeft: 8 },
    jobHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    jobTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
    jobSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    jobFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md },
    jobMeta: { color: colors.textSecondary, fontSize: 12 },
    advanceBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 999,
      backgroundColor: colors.accentBlue,
    },
    advanceBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    modalBox: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: colors.cardBackground,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    modalTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", marginBottom: spacing.md },
    label: { color: colors.textSecondary, fontSize: 12, marginTop: spacing.sm, marginBottom: 4 },
    input: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      fontSize: 13,
    },
    inputMultiline: { minHeight: 70, textAlignVertical: "top" },
    row: { flexDirection: "row", gap: spacing.md },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.lg },
    primaryButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.accentBlue },
    primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
    secondaryButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.cardBorder },
    secondaryButtonText: { color: colors.textSecondary, fontSize: 14 },
  });

