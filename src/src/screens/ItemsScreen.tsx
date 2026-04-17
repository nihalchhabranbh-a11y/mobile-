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
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../themeContext";
import { useUser } from "../userContext";
import { useSafeScreen } from "../hooks/useSafeScreen";
import { ListRow } from "../components/ui";
import {
  Product,
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
} from "../services/productsService";

export const ItemsScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeScreen();
  const { user } = useUser();
  const styles = useMemo(
    () => createStyles({ colors, spacing, radius }),
    [colors, spacing, radius]
  );
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [unit, setUnit] = useState("PCS");
  const [defaultRate, setDefaultRate] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [openingStock, setOpeningStock] = useState("");
  const [active, setActive] = useState(true);
  const [useSqftPricing, setUseSqftPricing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getProducts(user?.organisationId || undefined);
      setProducts(list);
    } catch (e) {
      console.warn("[Items] load failed", e);
      Alert.alert("Error", "Failed to load items.");
    } finally {
      setLoading(false);
    }
  }, [user?.organisationId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (route.params?.openCreate) {
      openNew();
      navigation.setParams({ openCreate: false });
    }
  }, [route.params?.openCreate]);

  const filtered = useMemo(() => {
    let list = products;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.item_code || "").toLowerCase().includes(q) ||
          (p.hsn_code || "").toLowerCase().includes(q) ||
          (p.unit || "").toLowerCase().includes(q)
      );
    }
    if (lowStockOnly) {
      list = list.filter((p) => (p.opening_stock ?? 0) <= 10);
    }
    return list;
  }, [products, searchQuery, lowStockOnly]);

  const openNew = () => {
    setEditing(null);
    setName("");
    setItemCode("");
    setHsnCode("");
    setUnit("PCS");
    setDefaultRate("");
    setTaxRate("");
    setPurchasePrice("");
    setOpeningStock("");
    setActive(true);
    setUseSqftPricing(false);
    setModalVisible(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setItemCode(p.item_code || "");
    setHsnCode(p.hsn_code || "");
    setUnit(p.unit || "PCS");
    setDefaultRate(String(p.default_rate ?? ""));
    setTaxRate(String(p.tax_rate ?? ""));
    setPurchasePrice(String(p.purchase_price ?? ""));
    setOpeningStock(String(p.opening_stock ?? ""));
    setActive(p.active);
    setUseSqftPricing((p.unit || "").toLowerCase().includes("sq"));
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Enter item name.");
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        await updateProduct(editing.id, {
          name: name.trim(),
          itemCode: itemCode.trim() || null,
          hsnCode: hsnCode.trim() || null,
          unit: unit.trim() || null,
          defaultRate: Number(defaultRate) || 0,
          taxRate: Number(taxRate) || 0,
          purchasePrice: Number(purchasePrice) || 0,
          openingStock: Number(openingStock) || 0,
          active,
        });
        setProducts((prev) =>
          prev.map((p) =>
            p.id === editing.id
              ? {
                  ...p,
                  name: name.trim(),
                  item_code: itemCode.trim() || null,
                  hsn_code: hsnCode.trim() || null,
                  unit: unit.trim() || null,
                  default_rate: Number(defaultRate) || 0,
                  tax_rate: Number(taxRate) || 0,
                  purchase_price: Number(purchasePrice) || 0,
                  opening_stock: Number(openingStock) || 0,
                  active,
                }
              : p
          )
        );
      } else {
        const created = await addProduct({
          name: name.trim(),
          itemCode: itemCode.trim() || null,
          hsnCode: hsnCode.trim() || null,
          unit: unit.trim() || null,
          defaultRate: Number(defaultRate) || 0,
          taxRate: Number(taxRate) || 0,
          purchasePrice: Number(purchasePrice) || 0,
          openingStock: Number(openingStock) || 0,
          active,
          organisationId: user?.organisationId || undefined,
        });
        if (created) setProducts((prev) => [created, ...prev]);
      }
      setModalVisible(false);
    } catch (e) {
      console.warn("[Items] save failed", e);
      Alert.alert("Error", "Failed to save item.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (p: Product) => {
    Alert.alert(
      "Delete item",
      `Delete "${p.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteProduct(p.id);
              setProducts((prev) => prev.filter((x) => x.id !== p.id));
            } catch (e) {
              Alert.alert("Error", "Failed to delete item.");
            }
          },
        },
      ]
    );
  };

  const fmtNum = (n: number) =>
    Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

  const fmtCurrency = (n: number) =>
    `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  const handleBulkAction = () => {
    Alert.alert(
      "Bulk Action",
      "Import items from Excel (CSV)? You can upload a file with columns: name, unit, default_rate, etc.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Import Excel", onPress: () => Alert.alert("Import", "Excel import will open file picker. Add expo-document-picker for full support.") },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.root, { paddingTop: insets.paddingTop || spacing.md }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Items</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => {}}
              accessibilityLabel="Search items">
              <Ionicons name="search" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}
              onPress={() => Alert.alert("Bulk actions", "Use the Excel import below or the FAB to add items.")}
              accessibilityLabel="More options">
              <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterPill, lowStockOnly && styles.filterPillActive]}
            onPress={() => setLowStockOnly((v) => !v)}
          >
            <Text style={[styles.filterPillText, lowStockOnly && styles.filterPillTextActive]}>
              Low Stock
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterPill}
            onPress={() => Alert.alert("Categories", "Category filtering coming soon!")}
          >
            <Text style={styles.filterPillText}>Select Category</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterPill}
            onPress={() => Alert.alert("Sort", "Sort by:", [
              { text: "Name (A-Z)", onPress: () => setProducts(p => [...p].sort((a,b) => a.name.localeCompare(b.name))) },
              { text: "Rate (High)", onPress: () => setProducts(p => [...p].sort((a,b) => (b.default_rate??0)-(a.default_rate??0))) },
              { text: "Rate (Low)", onPress: () => setProducts(p => [...p].sort((a,b) => (a.default_rate??0)-(b.default_rate??0))) },
              { text: "Cancel", style: "cancel" },
            ])}
          >
            <Ionicons name="filter" size={16} color={colors.textSecondary} />
            <Text style={styles.filterPillText}>Sort By</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accentBlue} />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(p) => p.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No items found.</Text>
            }
            renderItem={({ item }) => (
              <ListRow
                title={item.name}
                subtitle={`Sales ₹${fmtNum(item.default_rate)} / ${item.unit || "PCS"}`}
                meta={`Stock: ${fmtNum(item.opening_stock ?? 0)} ${item.unit || ""}`.trim()}
                amount={fmtCurrency(item.default_rate ?? 0)}
                statusLabel={
                  (item.opening_stock ?? 0) <= 0
                    ? "Out"
                    : (item.opening_stock ?? 0) <= 10
                      ? "Low"
                      : undefined
                }
                statusVariant={
                  (item.opening_stock ?? 0) <= 0
                    ? "danger"
                    : (item.opening_stock ?? 0) <= 10
                      ? "partial"
                      : undefined
                }
                avatarLabel={(item.name || "?").charAt(0).toUpperCase()}
                onPress={() => openEdit(item)}
                rightContent={
                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    style={{ marginTop: 6 }}
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={16}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                }
              />
            )}
          />
        )}

        {/* Inventory FAB */}
        <TouchableOpacity style={styles.fab} onPress={openNew}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
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
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>
              {editing ? "Edit Item" : "Create Item"}
            </Text>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Item name"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Item code</Text>
            <TextInput
              style={styles.input}
              value={itemCode}
              onChangeText={setItemCode}
              placeholder="Code"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>HSN code</Text>
            <TextInput
              style={styles.input}
              value={hsnCode}
              onChangeText={setHsnCode}
              placeholder="HSN"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Unit</Text>
            <TextInput
              style={styles.input}
              value={unit}
              onChangeText={setUnit}
              placeholder="PCS, SQF, etc."
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => {
                setUseSqftPricing((v) => !v);
                if (!useSqftPricing) setUnit("SQFT");
              }}
            >
              <View style={[styles.checkbox, useSqftPricing && styles.checkboxChecked]}>
                {useSqftPricing && <View style={styles.checkboxDot} />}
              </View>
              <Text style={styles.checkboxLabel}>Use SQFT pricing (Flex/Vinyl)</Text>
            </TouchableOpacity>
            <Text style={styles.label}>Sale price</Text>
            <TextInput
              style={styles.input}
              value={defaultRate}
              onChangeText={setDefaultRate}
              placeholder="0"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>GST %</Text>
            <TextInput
              style={styles.input}
              value={taxRate}
              onChangeText={setTaxRate}
              placeholder="0"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Purchase price</Text>
            <TextInput
              style={styles.input}
              value={purchasePrice}
              onChangeText={setPurchasePrice}
              placeholder="0"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Opening stock</Text>
            <TextInput
              style={styles.input}
              value={openingStock}
              onChangeText={setOpeningStock}
              placeholder="0"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setActive((a) => !a)}
            >
              <View style={[styles.checkbox, active && styles.checkboxChecked]}>
                {active && <View style={styles.checkboxDot} />}
              </View>
              <Text style={styles.checkboxLabel}>Active</Text>
            </TouchableOpacity>
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
            </ScrollView>
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
    root: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
    fab: {
      position: "absolute",
      bottom: 24,
      alignSelf: "center",
      backgroundColor: "#FF6600",
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#FF6600",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 8,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "700",
    },
    headerIcons: { flexDirection: "row", gap: spacing.md },
    iconBtn: { padding: spacing.xs },
    filterRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    filterPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 999,
      backgroundColor: colors.surface,
    },
    filterPillActive: {
      backgroundColor: colors.accentBlue + "30",
    },
    filterPillText: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    filterPillTextActive: {
      color: colors.textPrimary,
      fontWeight: "600",
    },
    loadingWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    loadingText: { color: colors.textMuted, fontSize: 12 },
    listContent: { paddingBottom: 170 },
    emptyText: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: "center",
      marginTop: spacing.xl,
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
    checkboxRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    checkboxChecked: {
      borderColor: colors.accentGreen,
      backgroundColor: colors.accentGreen + "33",
    },
    checkboxDot: {
      width: 12,
      height: 12,
      borderRadius: 999,
      backgroundColor: colors.accentGreen,
    },
    checkboxLabel: { color: colors.textPrimary, fontSize: 13 },
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
      maxHeight: "85%",
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
    primaryButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.accentBlue,
    },
    primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
    secondaryButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    secondaryButtonText: { color: colors.textSecondary, fontSize: 14 },
  });
