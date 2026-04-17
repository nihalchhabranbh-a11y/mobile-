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
  Modal,
  Alert,
} from "react-native";
import { useTheme } from "../themeContext";
import { useFocusEffect } from "@react-navigation/native";
import { useUser } from "../userContext";
import {
  Customer,
  getCustomers,
  addCustomer,
  updateCustomer,
} from "../services/customersService";

export const CustomersScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const styles = useMemo(
    () => createStyles({ colors, spacing, radius }),
    [colors, spacing, radius]
  );
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getCustomers(user?.organisationId);
      setCustomers(list);
    } catch (e) {
      console.warn("[Customers] load failed", e);
      Alert.alert("Error", "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.gstin || "").toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const openNew = () => {
    setEditing(null);
    setName("");
    setPhone("");
    setEmail("");
    setGstin("");
    setOpeningBalance("0");
    setModalVisible(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setName(c.name);
    setPhone(c.phone || "");
    setEmail(c.email || "");
    setGstin(c.gstin || "");
    setOpeningBalance(String(c.opening_balance ?? 0));
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Enter customer name.");
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        await updateCustomer(editing.id, {
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          gstin: gstin.trim() || null,
          openingBalance: Number(openingBalance) || 0,
        }, user?.organisationId);
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === editing.id
              ? {
                  ...c,
                  name: name.trim(),
                  phone: phone.trim() || null,
                  email: email.trim() || null,
                  gstin: gstin.trim() || null,
                  opening_balance: Number(openingBalance) || 0,
                }
              : c
          )
        );
      } else {
        const created = await addCustomer({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          gstin: gstin.trim() || null,
          openingBalance: Number(openingBalance) || 0,
          organisationId: user?.organisationId ?? undefined,
        });
        if (created) setCustomers((prev) => [created, ...prev]);
      }
      setModalVisible(false);
    } catch (e) {
      console.warn("[Customers] save failed", e);
      Alert.alert("Error", "Failed to save customer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Customers</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={openNew}>
            <Text style={styles.primaryButtonText}>Add Party</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, phone, email, GST…"
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accentBlue} />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No customers found.</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => openEdit(item)}
                activeOpacity={0.7}
              >
                <View>
                  <Text style={styles.rowName}>{item.name}</Text>
                  {item.phone ? (
                    <Text style={styles.rowMeta}>{item.phone}</Text>
                  ) : null}
                  {(item.gstin || item.opening_balance !== 0) && (
                    <Text style={styles.rowMeta}>
                      {item.gstin ? `GST: ${item.gstin}` : ""}
                      {item.gstin && item.opening_balance !== 0 ? " • " : ""}
                      {item.opening_balance !== 0
                        ? `Opening: ₹${item.opening_balance}`
                        : ""}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        )}

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
              <Text style={styles.modalTitle}>
                {editing ? "Edit Party" : "New Party"}
              </Text>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Party name"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone"
                keyboardType="phone-pad"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                keyboardType="email-address"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.label}>GSTIN</Text>
              <TextInput
                style={styles.input}
                value={gstin}
                onChangeText={setGstin}
                placeholder="GST number"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.label}>Opening balance</Text>
              <TextInput
                style={styles.input}
                value={openingBalance}
                onChangeText={setOpeningBalance}
                placeholder="0"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
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
    title: {
      color: colors.textPrimary,
      fontSize: 20,
      fontFamily: "Inter_700Bold",
    },
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
    secondaryButtonText: { color: colors.textSecondary, fontSize: 14 },
    searchInput: {
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: "transparent",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      marginBottom: spacing.md,
    },
    loadingWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    loadingText: { color: colors.textMuted, fontSize: 12 },
    listContent: { paddingBottom: spacing.xl * 2 },
    emptyText: { color: colors.textMuted, fontSize: 13 },
    row: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      backgroundColor: colors.cardBackground,
      borderRadius: radius.md,
      marginBottom: spacing.xs,
    },
    rowName: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    rowMeta: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 4,
      marginTop: spacing.sm,
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
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    modalBox: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: colors.cardBackground,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: spacing.md,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
  });
