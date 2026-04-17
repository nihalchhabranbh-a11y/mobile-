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
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../themeContext";
import { useUser } from "../userContext";
import { useSafeScreen } from "../hooks/useSafeScreen";
import { useFocusEffect } from "@react-navigation/native";
import {
  Task,
  Worker,
  Vendor,
  getTasks,
  addTask,
  updateTaskStatus,
  updateTask,
  deleteTask,
  getWorkers,
  getVendors,
  addTaskId,
} from "../services/tasksService";

const STATUSES = ["All", "Pending", "In Progress", "Completed"] as const;

export const TasksScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeScreen();
  const topPadding = insets.paddingTop ?? spacing.lg;
  const styles = useMemo(
    () => createStyles({ colors, spacing, radius }),
    [colors, spacing, radius]
  );
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filterStatus, setFilterStatus] = useState<(typeof STATUSES)[number]>("All");
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [assignTo, setAssignTo] = useState<"worker" | "vendor">("worker");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [idModalVisible, setIdModalVisible] = useState(false);
  const [idType, setIdType] = useState<"worker" | "vendor">("worker");
  const [idName, setIdName] = useState("");
  const [idUser, setIdUser] = useState("");
  const [idPass, setIdPass] = useState("");

  const { user } = useUser();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const orgId = user?.organisationId || undefined;
      const [t, w, v] = await Promise.all([
        getTasks(orgId),
        getWorkers(orgId),
        getVendors(orgId),
      ]);
      setTasks(t);
      setWorkers(w);
      setVendors(v);
    } catch (e) {
      console.warn("[Tasks] load failed", e);
      Alert.alert("Error", "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    let result = tasks;
    if (filterStatus !== "All") {
      result = result.filter((t) => t.status === filterStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.customer?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tasks, filterStatus, searchQuery]);

  const assigneeName = (t: Task) => {
    if (t.worker || t.worker_id) {
      const w = workers.find((x) => x.id === (t.worker || t.worker_id));
      return w?.name ?? "Worker";
    }
    if (t.vendor || t.vendor_id) {
      const v = vendors.find((x) => x.id === (t.vendor || t.vendor_id));
      return v?.name ?? "Vendor";
    }
    return "—";
  };

  const openNew = () => {
    setTitle("");
    setCustomer("");
    setDescription("");
    setAssignTo("worker");
    setSelectedWorkerId(null);
    setSelectedVendorId(null);
    setDeadline("");
    setNotes("");
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Title required", "Enter task title.");
      return;
    }
    const workerId = assignTo === "worker" ? selectedWorkerId : null;
    const vendorId = assignTo === "vendor" ? selectedVendorId : null;
    try {
      setSaving(true);
      const created = await addTask({
        title: title.trim(),
        customer: customer.trim() || "",
        description: description.trim() || undefined,
        worker: workerId ?? undefined,
        vendor: vendorId ?? undefined,
        deadline: deadline.trim() || undefined,
        notes: notes.trim() || undefined,
        status: "Pending",
        organisationId: user?.organisationId || undefined,
      });
      if (created) setTasks((prev) => [created, ...prev]);
      setModalVisible(false);
    } catch (e) {
      console.warn("[Tasks] addTask failed", e);
      Alert.alert("Error", "Failed to create task.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (task: Task, newStatus: string) => {
    try {
      await updateTaskStatus(task.id, newStatus);
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
      );
    } catch (e) {
      Alert.alert("Error", "Failed to update status.");
    }
  };

  const handleDelete = (task: Task) => {
    Alert.alert(
      "Delete task",
      `Delete "${task.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTask(task.id);
              setTasks((prev) => prev.filter((t) => t.id !== task.id));
            } catch (e) {
              Alert.alert("Error", "Failed to delete task.");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.root, { paddingTop: topPadding }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Task Management</Text>
        </View>

        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tasks or customers..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#ccc" />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filterRow}>
          {STATUSES.map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.filterChip,
                filterStatus === s && styles.filterChipActive,
              ]}
              onPress={() => setFilterStatus(s)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterStatus === s && styles.filterChipTextActive,
                ]}
              >
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accentBlue} />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(t) => t.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No tasks found.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={styles.rowTop}>
                  <View style={styles.rowTopLeft}>
                    <Text style={styles.rowTitle} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                      {item.title}
                    </Text>
                    {item.description ? (
                      <Text style={[styles.rowMeta, { color: "#4B5563", fontFamily: "Inter_500Medium" }]} numberOfLines={2} maxFontSizeMultiplier={1.1}>
                        {item.description}
                      </Text>
                    ) : null}
                    {item.customer ? (
                      <Text style={styles.rowMeta} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                        Customer: {item.customer}
                      </Text>
                    ) : null}
                    <Text style={styles.rowMeta} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                      Assignee: {assigneeName(item)}
                      {item.deadline ? ` • Due: ${item.deadline}` : ""}
                    </Text>
                  </View>
                  <View style={styles.rowTopRight}>
                    <Text
                      style={[
                        styles.statusChip,
                        item.status === "Completed"
                          ? styles.statusChipDone
                          : item.status === "In Progress"
                            ? styles.statusChipProgress
                            : styles.statusChipPending,
                      ]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.1}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.rowActions}>
                  {item.status === "Pending" && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleStatusChange(item, "In Progress")}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.actionBtnText} maxFontSizeMultiplier={1.1}>Start</Text>
                    </TouchableOpacity>
                  )}
                  {item.status !== "Completed" && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnPrimary]}
                      onPress={() => handleStatusChange(item, "Completed")}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.actionBtnPrimaryText} maxFontSizeMultiplier={1.1}>Done</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnDanger]}
                    onPress={() => handleDelete(item)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.actionBtnDangerText} maxFontSizeMultiplier={1.1}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}

        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            {/* Tap backdrop to close — separate from content so chips don't dismiss */}
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>Assign Task</Text>
                <Text style={styles.label}>Title *</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Task title"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.label}>Customer</Text>
                <TextInput
                  style={styles.input}
                  value={customer}
                  onChangeText={setCustomer}
                  placeholder="Customer name"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Task description / details"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
                <Text style={styles.label}>Assign to</Text>
                <View style={styles.assignRow}>
                  <TouchableOpacity
                    style={[styles.assignChip, assignTo === "worker" && styles.assignChipActive]}
                    onPress={() => setAssignTo("worker")}
                  >
                    <Text style={[styles.assignChipText, assignTo === "worker" && styles.assignChipTextActive]}>Worker</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.assignChip, assignTo === "vendor" && styles.assignChipActive]}
                    onPress={() => setAssignTo("vendor")}
                  >
                    <Text style={[styles.assignChipText, assignTo === "vendor" && styles.assignChipTextActive]}>Vendor</Text>
                  </TouchableOpacity>
                </View>
                {assignTo === "worker" ? (
                  <>
                    <Text style={styles.label}>Worker</Text>
                    <View style={styles.pickerRow}>
                      {workers.map((w) => (
                        <TouchableOpacity
                          key={w.id}
                          style={[styles.pickerChip, selectedWorkerId === w.id && styles.pickerChipActive]}
                          onPress={() => setSelectedWorkerId(selectedWorkerId === w.id ? null : w.id)}
                        >
                          <Text style={[styles.pickerChipText, selectedWorkerId === w.id && styles.pickerChipTextActive]}>{w.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>Vendor</Text>
                    <View style={styles.pickerRow}>
                      {vendors.map((v) => (
                        <TouchableOpacity
                          key={v.id}
                          style={[styles.pickerChip, selectedVendorId === v.id && styles.pickerChipActive]}
                          onPress={() => setSelectedVendorId(selectedVendorId === v.id ? null : v.id)}
                        >
                          <Text style={[styles.pickerChipText, selectedVendorId === v.id && styles.pickerChipTextActive]}>{v.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                <Text style={styles.label}>Deadline (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={deadline}
                  onChangeText={setDeadline}
                  placeholder="Optional"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Optional notes"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => setModalVisible(false)}>
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryButtonText}>Save</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
        <View style={styles.fabContainer}>
          <TouchableOpacity
            style={styles.idFabButtonLeft}
            onPress={() => setIdModalVisible(true)}
          >
            <Text style={styles.idFabText}>Create IDs</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.mainFab} onPress={openNew}>
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.mainFabText}>New Task</Text>
          </TouchableOpacity>
        </View>
        <Modal
          visible={idModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIdModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIdModalVisible(false)}
          >
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>Create IDs</Text>
                <Text style={styles.label}>Type</Text>
                <View style={styles.assignRow}>
                  <TouchableOpacity
                    style={[
                      styles.assignChip,
                      idType === "worker" && styles.assignChipActive,
                    ]}
                    onPress={() => setIdType("worker")}
                  >
                    <Text
                      style={[
                        styles.assignChipText,
                        idType === "worker" && styles.assignChipTextActive,
                      ]}
                    >
                      Work ID
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.assignChip,
                      idType === "vendor" && styles.assignChipActive,
                    ]}
                    onPress={() => setIdType("vendor")}
                  >
                    <Text
                      style={[
                        styles.assignChipText,
                        idType === "vendor" && styles.assignChipTextActive,
                      ]}
                    >
                      Vendor ID
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={idName}
                  onChangeText={setIdName}
                  placeholder="Name for this ID"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.label}>Username</Text>
                <TextInput
                  style={styles.input}
                  value={idUser}
                  onChangeText={setIdUser}
                  placeholder="Login / user ID"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={idPass}
                  onChangeText={setIdPass}
                  placeholder="Password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => setIdModalVisible(false)}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={async () => {
                      if (!idName.trim() || !idUser.trim() || !idPass.trim()) {
                        Alert.alert(
                          "Missing details",
                          "Fill name, username and password."
                        );
                        return;
                      }
                      try {
                        await addTaskId({
                          type: idType,
                          name: idName.trim(),
                          username: idUser.trim(),
                          password: idPass,
                          organisationId: user?.organisationId || undefined,
                        });
                        setIdName("");
                        setIdUser("");
                        setIdPass("");
                        setIdModalVisible(false);
                      } catch (e) {
                        Alert.alert("Error", "Failed to save ID.");
                      }
                    }}
                  >
                    <Text style={styles.primaryButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </Modal>
      </View>
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
    root: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    title: { color: colors.textPrimary, fontSize: 24, fontFamily: "Inter_700Bold" },
    searchWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#fff",
      borderRadius: 24,
      paddingHorizontal: 16,
      height: 48,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: "#EAEAEA",
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      elevation: 3,
    },
    searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111", marginLeft: 8 },
    primaryButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.accentBlue,
      shadowColor: "#2563EB",
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
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
    filterRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    filterChip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    filterChipActive: {
      borderColor: colors.accentBlue,
      backgroundColor: colors.accentBlue + "22",
    },
    filterChipText: { color: colors.textSecondary, fontSize: 12, fontFamily: "Inter_500Medium" },
    filterChipTextActive: { color: colors.accentBlue, fontFamily: "Inter_600SemiBold" },
    loadingWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    loadingText: { color: colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular" },
    listContent: { paddingBottom: spacing.xl * 2 },
    emptyText: { color: colors.textMuted, fontSize: 13, fontFamily: "Inter_400Regular" },
    row: {
      padding: spacing.lg,
      backgroundColor: colors.cardBackground,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: spacing.sm,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    rowTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
    rowTopLeft: { flex: 1, minWidth: 0, paddingRight: spacing.sm },
    rowTopRight: { alignItems: "flex-end" },
    rowTitle: { color: colors.textPrimary, fontSize: 15, fontFamily: "Inter_600SemiBold" },
    rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2, fontFamily: "Inter_400Regular" },
    statusChip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 999,
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      overflow: "hidden",
    },
    statusChipPending: { backgroundColor: colors.accentOrange + "22", color: colors.accentOrange },
    statusChipProgress: { backgroundColor: colors.accentBlue + "22", color: colors.accentBlue },
    statusChipDone: { backgroundColor: colors.accentGreen + "22", color: colors.accentGreen },
    rowActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    actionBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "transparent",
      backgroundColor: colors.surface,
    },
    actionBtnText: { color: colors.textSecondary, fontSize: 12, fontFamily: "Inter_600SemiBold" },
    actionBtnPrimary: { borderColor: "transparent", backgroundColor: colors.accentGreen + "18" },
    actionBtnPrimaryText: { color: colors.accentGreen, fontSize: 12, fontFamily: "Inter_600SemiBold" },
    actionBtnDanger: { borderColor: "transparent", backgroundColor: colors.accentRed + "12" },
    actionBtnDangerText: { color: colors.accentRed, fontSize: 12, fontFamily: "Inter_600SemiBold" },
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
    inputMultiline: { minHeight: 60, textAlignVertical: "top" },
    assignRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
    assignChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    assignChipActive: {
      borderColor: colors.accentBlue,
      backgroundColor: colors.accentBlue + "22",
    },
    assignChipText: { color: colors.textSecondary, fontSize: 13, fontFamily: "Inter_500Medium" },
    assignChipTextActive: { color: colors.accentBlue, fontFamily: "Inter_600SemiBold" },
    pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
    pickerChip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    pickerChipActive: {
      borderColor: colors.accentBlue,
      backgroundColor: colors.accentBlue + "22",
    },
    pickerChipText: { color: colors.textSecondary, fontSize: 12, fontFamily: "Inter_500Medium" },
    pickerChipTextActive: { color: colors.accentBlue, fontFamily: "Inter_600SemiBold" },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
      ...(Platform.OS === "web" ? {
        position: "fixed" as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      } : {}),
    },
    modalScroll: { width: "100%", maxWidth: 520, alignSelf: "center" },
    modalScrollContent: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingVertical: spacing.xl },
    modalBox: {
      width: "100%",
      backgroundColor: colors.cardBackground,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      marginBottom: spacing.md,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    fabContainer: {
      position: "absolute",
      bottom: 24,
      left: spacing.lg,
      right: spacing.lg,
      alignItems: "center",
      zIndex: 50,
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: spacing.md,
    },
    mainFab: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.accentBlue,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 999,
      shadowColor: colors.accentBlue,
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    mainFabText: {
      color: "#fff",
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      marginLeft: 6,
    },
    idFabButtonLeft: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    idFabText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
    },
  });
