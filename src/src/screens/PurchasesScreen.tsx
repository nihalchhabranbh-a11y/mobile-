import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert,
  Modal, TextInput, ScrollView, Platform, StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useUser } from "../userContext";
import { fetchPurchases, createPurchase, Purchase, PurchaseItem } from "../services/purchasesService";
import { getProducts as fetchProducts, Product } from "../services/productsService";

type Nav = { navigate: (n: string, p?: any) => void; goBack: () => void };

const C = { bg: "#F1F5F9", hero1: "#059669", hero2: "#047857", card: "#fff", border: "#E2E8F0", dark: "#0F172A", muted: "#94A3B8", green: "#10B981", blue: "#2563EB" };

export const PurchasesScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<PurchaseItem[]>([{ name: "", qty: 1, rate: 0, amount: 0 }]);
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const org = user?.organisationId ?? undefined;
      const [list, prods] = await Promise.all([fetchPurchases(org), fetchProducts(org)]);
      setPurchases(list); setProducts(prods.filter((p) => p.active));
    } catch { } finally { setLoading(false); }
  }, [user?.organisationId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    if (!search.trim()) return products.slice(0, 25);
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 25);
  }, [products, search]);

  const resetForm = () => { setVendorName(""); setBillNumber(""); setBillDate(new Date().toISOString().slice(0, 10)); setItems([{ name: "", qty: 1, rate: 0, amount: 0 }]); setPickerIdx(null); setSearch(""); };

  const updateItem = (i: number, patch: Partial<PurchaseItem>) => {
    setItems((prev) => {
      const next = prev.slice();
      const cur = next[i] || { name: "", qty: 1, rate: 0, amount: 0 };
      const merged = { ...cur, ...patch };
      if (patch.qty !== undefined || patch.rate !== undefined) {
        merged.amount = Number(((merged.qty || 1) * (merged.rate || 0)).toFixed(2));
      }
      next[i] = merged;
      return next;
    });
  };

  const subtotal = useMemo(() => items.reduce((s, i) => s + (Number(i.amount ?? 0) || 0), 0), [items]);

  const fmtCurrency = (n: number) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const totalPurchases = purchases.reduce((s, p) => s + (Number(p.total) || 0), 0);

  const handleDelete = (id: string, vendor: string) => {
    Alert.alert("Delete Purchase", `Delete purchase from "${vendor}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          const { supabase } = await import("../services/supabaseClient");
          await supabase.from("purchases").delete().eq("id", id);
          setPurchases(prev => prev.filter(p => p.id !== id));
        } catch { Alert.alert("Error", "Failed to delete purchase."); }
      }},
    ]);
  };

  const handleSave = async () => {
    if (!vendorName.trim()) { Alert.alert("Required", "Enter vendor / supplier name."); return; }
    const cleaned = items.map((it) => ({ name: (it.name || "").trim(), qty: Number(it.qty ?? 1) || 1, rate: Number(it.rate ?? 0) || 0, amount: Number(it.amount ?? 0) || 0, taxRate: it.taxRate ?? null, productId: it.productId ?? null })).filter((it) => it.name && it.amount > 0);
    if (!cleaned.length) { Alert.alert("Required", "Add at least one item with an amount."); return; }
    try {
      setSaving(true);
      const created = await createPurchase({ vendorName: vendorName.trim(), billNumber: billNumber.trim() || null, billDate: billDate.trim() || null, items: cleaned, subtotal, gstTotal: 0, total: subtotal, organisationId: user?.organisationId ?? undefined });
      setPurchases((prev) => [created, ...prev]);
      setModalOpen(false); resetForm();
      Alert.alert("✅ Saved", "Purchase entry created successfully.");
    } catch { Alert.alert("Error", "Failed to create purchase."); }
    finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.hero1 }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[C.hero1, C.hero2]} style={{ paddingHorizontal: 20, paddingBottom: 28 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: Platform.OS === "ios" ? 50 : 36, paddingBottom: 16 }}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" }}>Purchases</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }} onPress={() => setModalOpen(true)}>
              <Ionicons name="add" size={20} color={C.hero1} />
            </TouchableOpacity>
            <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }} onPress={() => navigation.navigate("ScanPurchase")}>
              <Ionicons name="scan-outline" size={18} color={C.hero1} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingVertical: 10, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" }}>{purchases.length}</Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>Total</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingVertical: 10, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" }}>{fmtCurrency(totalPurchases)}</Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>All Time</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={{ flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -16 }}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><ActivityIndicator color={C.hero1} size="large" /></View>
        ) : purchases.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
            <Ionicons name="cart-outline" size={56} color="#CBD5E1" />
            <Text style={{ color: C.dark, fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 16 }}>No Purchases Yet</Text>
            <Text style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 6 }}>Add manually or scan a bill.</Text>
          </View>
        ) : (
          <FlatList data={purchases} keyExtractor={(p) => p.id} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.dark, fontSize: 15, fontFamily: "Inter_700Bold" }}>{item.vendor_name || "Vendor"}</Text>
                    <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{item.bill_number ? `Bill: ${item.bill_number}` : "—"} • {item.bill_date || "—"}</Text>
                    <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{Array.isArray(item.items) ? `${item.items.length} item(s)` : "—"}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 8 }}>
                    <Text style={{ color: C.dark, fontSize: 16, fontFamily: "Inter_700Bold" }}>{fmtCurrency(item.total)}</Text>
                    <TouchableOpacity onPress={() => handleDelete(item.id, item.vendor_name || "Vendor")} style={{ padding: 4 }}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )} />
        )}
      </View>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "90%" }}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={{ color: C.dark, fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 16 }}>New Purchase Entry</Text>
              <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, marginBottom: 6 }}>VENDOR *</Text>
              <TextInput style={{ backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, color: C.dark, fontSize: 14 }} value={vendorName} onChangeText={setVendorName} placeholder="Vendor name" placeholderTextColor={C.muted} />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>BILL NO</Text>
                  <TextInput style={{ backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, color: C.dark }} value={billNumber} onChangeText={setBillNumber} placeholder="1234" placeholderTextColor={C.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>DATE</Text>
                  <TextInput style={{ backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, color: C.dark }} value={billDate} onChangeText={setBillDate} placeholder="YYYY-MM-DD" placeholderTextColor={C.muted} />
                </View>
              </View>

              <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, marginBottom: 6, marginTop: 12 }}>ITEMS</Text>
              {items.map((it, i) => (
                <View key={i} style={{ marginBottom: 10 }}>
                  <TouchableOpacity style={{ backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, flexDirection: "row", justifyContent: "space-between" }} onPress={() => { setPickerIdx(pickerIdx === i ? null : i); setSearch(""); }}>
                    <Text style={{ color: it.name ? C.dark : C.muted, fontSize: 14 }}>{it.name || "Select product…"}</Text>
                    <Ionicons name="search" size={14} color={C.muted} />
                  </TouchableOpacity>
                  {pickerIdx === i && (
                    <View style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: C.border, maxHeight: 200, marginTop: 4, elevation: 6 }}>
                      <TextInput style={{ backgroundColor: "#F8FAFC", borderRadius: 10, margin: 8, padding: 10, borderWidth: 1, borderColor: C.border, color: C.dark, fontSize: 13 }} value={search} onChangeText={setSearch} placeholder="Search…" placeholderTextColor={C.muted} autoFocus />
                      <ScrollView style={{ maxHeight: 140 }} nestedScrollEnabled>
                        {filtered.map((p) => (
                          <TouchableOpacity key={p.id} style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }} onPress={() => { updateItem(i, { name: p.name, rate: p.default_rate ?? 0 }); setPickerIdx(null); setSearch(""); }}>
                            <Text style={{ color: C.dark, fontSize: 14, fontWeight: "600" }}>{p.name}</Text>
                            <Text style={{ color: C.muted, fontSize: 12 }}>₹{p.default_rate ?? 0}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                    <TextInput style={{ flex: 2, backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, color: C.dark }} value={it.name} onChangeText={(v) => updateItem(i, { name: v })} placeholder="Or type name" placeholderTextColor={C.muted} />
                    <TextInput style={{ flex: 0.7, backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, color: C.dark }} value={String(it.qty)} onChangeText={(v) => updateItem(i, { qty: Number(v) || 1 })} keyboardType="numeric" placeholder="Qty" placeholderTextColor={C.muted} />
                    <TextInput style={{ flex: 1, backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, color: C.dark }} value={it.rate ? String(it.rate) : ""} onChangeText={(v) => updateItem(i, { rate: parseFloat(v) || 0 })} keyboardType="decimal-pad" placeholder="Rate" placeholderTextColor={C.muted} />
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: "#F0FDF4", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 6 }}>
                    <Text style={{ color: C.muted, fontSize: 12 }}>Amount</Text>
                    <Text style={{ color: C.hero1, fontSize: 14, fontFamily: "Inter_700Bold" }}>₹{(Number(it.amount ?? 0) || 0).toFixed(2)}</Text>
                  </View>
                </View>
              ))}
              <TouchableOpacity onPress={() => setItems((p) => [...p, { name: "", qty: 1, rate: 0, amount: 0 }])}>
                <Text style={{ color: C.hero1, fontWeight: "700", fontSize: 13, marginTop: 4 }}>+ Add item</Text>
              </TouchableOpacity>

              <View style={{ borderTopWidth: 1, borderTopColor: C.border, marginTop: 16, paddingTop: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: C.muted }}>Subtotal</Text>
                  <Text style={{ color: C.dark, fontSize: 16, fontFamily: "Inter_700Bold" }}>{fmtCurrency(subtotal)}</Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
                <TouchableOpacity style={{ flex: 0.5, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: "center" }} onPress={() => { setModalOpen(false); resetForm(); }}>
                  <Text style={{ color: "#64748B", fontWeight: "600" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: C.hero1, alignItems: "center" }} onPress={handleSave} disabled={saving}>
                  <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" }}>{saving ? "Saving…" : "Create Purchase"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};
