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
import { useUser } from "../userContext";
import { useFocusEffect } from "@react-navigation/native";
import {
  Product,
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
} from "../services/productsService";

export const ProductsScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const { user } = useUser();
  const styles = useMemo(
    () => createStyles({ colors, spacing, radius }),
    [colors, spacing, radius]
  );
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
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
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [active, setActive] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getProducts(user?.organisationId || undefined);
      setProducts(list);
    } catch (e) {
      console.warn("[Products] load failed", e);
      Alert.alert("Error", "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, [user?.organisationId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.item_code || "").toLowerCase().includes(q) ||
        (p.hsn_code || "").toLowerCase().includes(q) ||
        (p.unit || "").toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

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
    setDescription("");
    setKeywords("");
    setActive(true);
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
    setDescription(p.description || "");
    setKeywords((p as any).keywords || "");
    setActive(p.active);
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
          description: description.trim() || null,
          keywords: keywords.trim() || null,
          active,
          organisationId: user?.organisationId ?? undefined,
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
                  description: description.trim() || null,
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
          description: description.trim() || null,
          keywords: keywords.trim() || null,
          active,
        });
        if (created) setProducts((prev) => [created, ...prev]);
      }
      setModalVisible(false);
    } catch (e) {
      console.warn("[Products] save failed", e);
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
              await deleteProduct(p.id, user?.organisationId ?? undefined);
              setProducts((prev) => prev.filter((item) => item.id !== p.id));
            } catch (e) {
              Alert.alert("Error", "Failed to delete item.");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Products / Services</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={openNew}>
            <Text style={styles.primaryButtonText}>Create Item</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, code, HSN, unit…"
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
            keyExtractor={(p) => p.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No items found.</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => openEdit(item)}
                activeOpacity={0.7}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  {!!item.description && (
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{item.description}</Text>
                  )}
                  <View style={styles.rowMeta}>
                    {(item.item_code || item.unit) && (
                      <Text style={styles.rowMetaText}>
                        {item.item_code || ""}
                        {item.item_code && item.unit ? " • " : ""}
                        {item.unit || ""}
                      </Text>
                    )}
                    <Text style={styles.rowPrice}>
                      ₹{Number(item.default_rate || 0).toLocaleString("en-IN")}
                      {item.tax_rate ? ` (${item.tax_rate}% GST)` : ""}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item)}
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
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
                placeholder="PCS, SQFT, etc."
                placeholderTextColor={colors.textMuted}
              />
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
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional details"
                placeholderTextColor={colors.textMuted}
              />
              <View style={{ backgroundColor: "#FFF7ED", borderRadius: 8, padding: 10, marginBottom: 4 }}>
                <Text style={[styles.label, { color: "#ea580c", marginBottom: 4 }]}>🧠 AI Keywords (comma-separated)</Text>
                <TextInput
                  style={[styles.input, { borderColor: "#ea580c40" }]}
                  value={keywords}
                  onChangeText={setKeywords}
                  placeholder="e.g. normal, flex, plain, ordinary"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={{ fontSize: 11, color: "#ea580c", marginTop: 4 }}>Words customers use to order this product. AI uses these to auto-detect the product.</Text>
              </View>
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
      fontWeight: "700",
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
    searchInput: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
      backgroundColor: colors.cardBackground,
      fontSize: 13,
      marginBottom: spacing.md,
    },
    loadingWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    loadingText: { color: colors.textMuted, fontSize: 12 },
    listContent: { paddingBottom: spacing.xl * 2 },
    emptyText: { color: colors.textMuted, fontSize: 13 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      backgroundColor: colors.cardBackground,
      borderRadius: radius.md,
      marginBottom: spacing.xs,
    },
    rowMain: { flex: 1 },
    rowName: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    rowMeta: { marginTop: 2 },
    rowMetaText: { color: colors.textMuted, fontSize: 12 },
    rowPrice: { color: colors.accentBlue, fontSize: 13, fontWeight: "600", marginTop: 2 },
    deleteBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    deleteBtnText: { color: colors.accentRed, fontSize: 12 },
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
    checkboxChecked: { borderColor: colors.accentGreen, backgroundColor: colors.accentGreen + "33" },
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
  });
