import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, ScrollView, Platform, StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useUser } from "../userContext";
import { fetchTransfers, createTransfer, deleteTransfer, Transfer, TransferItem } from "../services/transferService";
import { getProducts, Product } from "../services/productsService";

type Nav = { goBack: () => void };

export const TransfersScreen: React.FC = () => {
  const { user } = useUser();
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fromLoc, setFromLoc] = useState("");
  const [toLoc, setToLoc] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferItem[]>([{ product_id: "", name: "", qty: 1, unit: "PCS" }]);
  const [itemQtyStrings, setItemQtyStrings] = useState<string[]>(["1"]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const org = user?.organisationId ?? undefined;
      const [t, p] = await Promise.all([fetchTransfers(org), getProducts(org)]);
      setTransfers(t); setProducts(p.filter((x) => x.active));
    } catch { Alert.alert("Error", "Failed to load transfers."); }
    finally { setLoading(false); }
  }, [user?.organisationId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resetForm = () => { setFromLoc(""); setToLoc(""); setNotes(""); setItems([{ product_id: "", name: "", qty: 1, unit: "PCS" }]); setItemQtyStrings(["1"]); };

  const handleSave = async () => {
    if (!fromLoc.trim() || !toLoc.trim()) { Alert.alert("Required", "Enter from & to locations."); return; }
    const cleaned = items.filter((i) => i.name.trim());
    if (!cleaned.length) { Alert.alert("Required", "Add at least one item."); return; }
    try {
      setSaving(true);
      const t = await createTransfer({ from_location: fromLoc.trim(), to_location: toLoc.trim(), notes: notes.trim() || undefined, items: cleaned, status: "Pending", organisationId: user?.organisationId ?? undefined });
      setTransfers((prev) => [t, ...prev]);
      setModalOpen(false); resetForm();
    } catch { Alert.alert("Error", "Failed to create transfer."); }
    finally { setSaving(false); }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert("Delete Transfer", `Are you sure you want to delete transfer from ${name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await deleteTransfer(id);
          setTransfers((prev) => prev.filter(t => t.id !== id));
        } catch (e) {
          Alert.alert("Error", "Failed to delete transfer");
        }
      }}
    ]);
  };

  const statusColor = (s: string) => s === "Completed" ? "#059669" : s === "In Transit" ? "#2563EB" : "#94A3B8";

  return (
    <View style={{ flex: 1, backgroundColor: "#7C3AED" }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#7C3AED", "#6D28D9"]} style={{ paddingHorizontal: 20, paddingBottom: 28 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: Platform.OS === "ios" ? 50 : 36, paddingBottom: 16 }}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold", flex: 1, marginLeft: 16 }}>Inventory Transfers</Text>
        </View>
      </LinearGradient>

      <View style={{ flex: 1, backgroundColor: "#F1F5F9", borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -16 }}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><ActivityIndicator color="#7C3AED" size="large" /></View>
        ) : transfers.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
            <Ionicons name="swap-horizontal-outline" size={56} color="#CBD5E1" />
            <Text style={{ color: "#0F172A", fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 16 }}>No Transfers Yet</Text>
          </View>
        ) : (
          <FlatList data={transfers} keyExtractor={(t) => t.id} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#0F172A", fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 4 }}>{item.from_location} → {item.to_location}</Text>
                    <Text style={{ color: statusColor(item.status), fontSize: 11, fontWeight: "700" }}>{item.status}</Text>
                    <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 6 }}>{item.items.length} item(s) • {item.created_at?.slice(0, 10) || "—"}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(item.id, item.from_location)} style={{ padding: 8 }}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            )} />
        )}

        {/* Center Bottom FAB */}
        <TouchableOpacity 
          style={{ position: "absolute", bottom: 24, alignSelf: "center", backgroundColor: "#FF6600", width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", shadowColor: "#FF6600", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8 }}
          onPress={() => setModalOpen(true)}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "85%" }}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={{ color: "#0F172A", fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 16 }}>New Transfer</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "700", marginBottom: 4 }}>FROM *</Text>
                  <TextInput style={{ backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#E2E8F0", color: "#0F172A" }} value={fromLoc} onChangeText={setFromLoc} placeholder="Warehouse A" placeholderTextColor="#94A3B8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "700", marginBottom: 4 }}>TO *</Text>
                  <TextInput style={{ backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#E2E8F0", color: "#0F172A" }} value={toLoc} onChangeText={setToLoc} placeholder="Warehouse B" placeholderTextColor="#94A3B8" />
                </View>
              </View>
              <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "700", marginBottom: 4, marginTop: 12 }}>ITEMS</Text>
              {items.map((it, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                  <TextInput style={{ flex: 2, backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#E2E8F0", color: "#0F172A" }} value={it.name} onChangeText={(v) => { const n = items.slice(); n[i] = { ...n[i], name: v }; setItems(n); }} placeholder="Product name" placeholderTextColor="#94A3B8" />
                  <TextInput style={{ flex: 0.7, backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#E2E8F0", color: "#0F172A" }}
                    value={itemQtyStrings[i] ?? String(it.qty)}
                    onChangeText={(v) => {
                      const n = itemQtyStrings.slice(); n[i] = v; setItemQtyStrings(n);
                      const qi = items.slice(); qi[i] = { ...qi[i], qty: parseFloat(v) || 1 }; setItems(qi);
                    }}
                    keyboardType="decimal-pad" placeholder="Qty" placeholderTextColor="#94A3B8" />
                </View>
              ))}
              <TouchableOpacity onPress={() => { setItems((p) => [...p, { product_id: "", name: "", qty: 1, unit: "PCS" }]); setItemQtyStrings(s => [...s, "1"]); }}>
                <Text style={{ color: "#7C3AED", fontWeight: "700", fontSize: 13 }}>+ Add item</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
                <TouchableOpacity style={{ flex: 0.5, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center" }} onPress={() => { setModalOpen(false); resetForm(); }}>
                  <Text style={{ color: "#64748B", fontWeight: "600" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "#7C3AED", alignItems: "center" }} onPress={handleSave} disabled={saving}>
                  <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" }}>{saving ? "Saving…" : "Create Transfer"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};
