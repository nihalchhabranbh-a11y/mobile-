import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, ScrollView, Platform, StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../themeContext";
import { useUser } from "../userContext";
import { useSafeScreen } from "../hooks/useSafeScreen";
import { fetchChallans, createChallan, updateChallanStatus, deleteChallan, Challan, ChallanItem } from "../services/challanService";
import { getProducts, Product } from "../services/productsService";
import { Customer, getCustomers } from "../services/customersService";

type Nav = { navigate: (n: string, p?: any) => void; goBack: () => void };

export const ChallansScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const { user } = useUser();
  const insets = useSafeScreen();
  const navigation = useNavigation<Nav>();

  const [loading, setLoading] = useState(true);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customer, setCustomer] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ChallanItem[]>([{ name: "", qty: 1, unit: "PCS" }]);
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [itemQtyStrings, setItemQtyStrings] = useState<string[]>(["1"]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const org = user?.organisationId ?? undefined;
      const [c, p, custs] = await Promise.all([fetchChallans(org), getProducts(org), getCustomers(org)]);
      setChallans(c);
      setProducts(p.filter((x) => x.active));
      setCustomers(custs);
    } catch { Alert.alert("Error", "Failed to load challans."); }
    finally { setLoading(false); }
  }, [user?.organisationId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    if (!search.trim()) return products.slice(0, 25);
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 25);
  }, [products, search]);

  const resetForm = () => { setCustomer(""); setPhone(""); setVehicle(""); setNotes(""); setItems([{ name: "", qty: 1, unit: "PCS" }]); setItemQtyStrings(["1"]); setPickerIdx(null); setSearch(""); setShowCustomerDropdown(false); };

  const handleSave = async () => {
    if (!customer.trim()) { Alert.alert("Required", "Enter customer name."); return; }
    const cleaned = items.filter((i) => i.name.trim());
    if (!cleaned.length) { Alert.alert("Required", "Add at least one item."); return; }
    try {
      setSaving(true);
      const c = await createChallan({ customer: customer.trim(), phone: phone.trim() || undefined, vehicle_number: vehicle.trim() || undefined, notes: notes.trim() || undefined, items: cleaned, status: "Draft", organisationId: user?.organisationId ?? undefined });
      setChallans((prev) => [c, ...prev]);
      setModalOpen(false); resetForm();
    } catch { Alert.alert("Error", "Failed to create challan."); }
    finally { setSaving(false); }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert("Delete Challan", `Are you sure you want to delete challan for ${name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await deleteChallan(id);
          setChallans((prev) => prev.filter(c => c.id !== id));
        } catch (e) {
          Alert.alert("Error", "Failed to delete challan");
        }
      }}
    ]);
  };
  const handleCycleStatus = async (challan: Challan) => {
    const nextStatus = challan.status === "Draft" ? "Sent" : challan.status === "Sent" ? "Delivered" : "Draft";
    try {
      await updateChallanStatus(challan.id, nextStatus);
      setChallans((prev) => prev.map((c) => c.id === challan.id ? { ...c, status: nextStatus } : c));
    } catch {
      Alert.alert("Error", "Failed to update challan status.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#2563EB" }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#2563EB", "#1E40AF"]} style={{ paddingHorizontal: 20, paddingBottom: 28 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: Platform.OS === "ios" ? 50 : 36, paddingBottom: 16 }}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold", flex: 1, marginLeft: 16 }}>Delivery Challans</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingVertical: 10, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" }}>{challans.length}</Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>Total</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingVertical: 10, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" }}>{challans.filter((c) => c.status === "Delivered").length}</Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>Delivered</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingVertical: 10, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" }}>{challans.filter((c) => c.status === "Draft").length}</Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>Draft</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={{ flex: 1, backgroundColor: "#F1F5F9", borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -16 }}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><ActivityIndicator color="#2563EB" size="large" /></View>
        ) : challans.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
            <Ionicons name="document-text-outline" size={56} color="#CBD5E1" />
            <Text style={{ color: "#0F172A", fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 16 }}>No Challans Yet</Text>
            <Text style={{ color: "#94A3B8", fontSize: 13, textAlign: "center", marginTop: 6 }}>Tap + to create your first delivery challan.</Text>
          </View>
        ) : (
          <FlatList data={challans} keyExtractor={(c) => c.id} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 10, elevation: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#0F172A", fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 4 }}>{item.customer}</Text>
                    <View style={{ alignSelf: "flex-start", backgroundColor: item.status === "Delivered" ? "#D1FAE5" : item.status === "Sent" ? "#DBEAFE" : "#F1F5F9", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 }}>
                      <Text style={{ color: item.status === "Delivered" ? "#059669" : item.status === "Sent" ? "#2563EB" : "#64748B", fontSize: 11, fontWeight: "700" }}>{item.status}</Text>
                    </View>
                    <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 6 }}>{item.items.length} item(s) • {item.created_at?.slice(0, 10) || "—"}</Text>
                  </View>
                  <View style={{ gap: 6 }}>
                    <TouchableOpacity onPress={() => handleDelete(item.id, item.customer)} style={{ padding: 8 }}>
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ backgroundColor: "#2563EB18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}
                      onPress={() => handleCycleStatus(item)}
                    >
                      <Text style={{ color: "#2563EB", fontSize: 10, fontWeight: "700" }}>
                        {item.status === "Draft" ? "→ Sent" : item.status === "Sent" ? "→ Done" : "↺ Draft"}
                      </Text>
                    </TouchableOpacity>
                  </View>
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
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "90%" }}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={{ color: "#0F172A", fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 16 }}>New Challan</Text>
              <Text style={{ color: "#94A3B8", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.6, marginBottom: 6 }}>CUSTOMER NAME *</Text>
              <View style={{ zIndex: 10 }}>
                <TouchableOpacity
                  style={{ backgroundColor: "#F8FAFC", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: showCustomerDropdown ? "#2563EB" : "#E2E8F0", flexDirection: "row", alignItems: "center" }}
                  onPress={() => setShowCustomerDropdown(!showCustomerDropdown)}
                >
                  <Text style={{ color: customer ? "#0F172A" : "#94A3B8", fontSize: 14, flex: 1 }}>{customer || "Select or type customer name"}</Text>
                  <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                </TouchableOpacity>

                {showCustomerDropdown && (
                  <View style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, marginTop: 4, maxHeight: 200, zIndex: 20, elevation: 5 }}>
                    <TextInput
                      style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", color: "#0F172A", fontSize: 14 }}
                      placeholder="Search or type new..."
                      placeholderTextColor="#94A3B8"
                      value={customer}
                      onChangeText={setCustomer}
                      autoFocus
                    />
                    <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 154 }} nestedScrollEnabled>
                      {customers
                        .filter((c) => c.name.toLowerCase().includes(customer.toLowerCase()))
                        .map((c) => (
                          <TouchableOpacity
                            key={c.id}
                            style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}
                            onPress={() => {
                              setCustomer(c.name);
                              if (c.phone) setPhone(c.phone);
                              setShowCustomerDropdown(false);
                            }}
                          >
                            <Text style={{ color: "#0F172A", fontSize: 14 }}>{c.name}</Text>
                          </TouchableOpacity>
                        ))}
                      {customer.trim() !== "" && !customers.some(c => c.name.toLowerCase() === customer.toLowerCase()) && (
                        <TouchableOpacity
                          style={{ padding: 12, backgroundColor: "#F0FDF4" }}
                          onPress={() => setShowCustomerDropdown(false)}
                        >
                          <Text style={{ color: "#059669", fontSize: 14, fontWeight: "600" }}>+ Use "{customer}"</Text>
                        </TouchableOpacity>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              <Text style={{ color: "#94A3B8", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.6, marginBottom: 6, marginTop: 12 }}>ITEMS</Text>
              {items.map((it, i) => (
                <View key={i} style={{ marginBottom: 8 }}>
                  <TouchableOpacity style={{ backgroundColor: "#F8FAFC", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: "#E2E8F0", flexDirection: "row", justifyContent: "space-between" }} onPress={() => { setPickerIdx(pickerIdx === i ? null : i); setSearch(""); }}>
                    <Text style={{ color: it.name ? "#0F172A" : "#94A3B8", fontSize: 14 }}>{it.name || "Select product…"}</Text>
                    <Ionicons name="search" size={14} color="#94A3B8" />
                  </TouchableOpacity>
                  {pickerIdx === i && (
                    <View style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", maxHeight: 200, marginTop: 4, elevation: 6 }}>
                      <TextInput style={{ backgroundColor: "#F8FAFC", borderRadius: 10, margin: 8, paddingHorizontal: 12, paddingVertical: 10, color: "#0F172A", fontSize: 13, borderWidth: 1, borderColor: "#E2E8F0" }} value={search} onChangeText={setSearch} placeholder="Search…" placeholderTextColor="#94A3B8" autoFocus />
                      <ScrollView style={{ maxHeight: 140 }} nestedScrollEnabled>
                        {filtered.map((p) => (
                          <TouchableOpacity key={p.id} style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }} onPress={() => { const next = items.slice(); next[i] = { ...next[i], name: p.name, unit: p.unit || "PCS" }; setItems(next); setPickerIdx(null); setSearch(""); }}>
                            <Text style={{ color: "#0F172A", fontSize: 14, fontWeight: "600" }}>{p.name}</Text>
                            <Text style={{ color: "#94A3B8", fontSize: 12 }}>{p.unit || "PCS"} • ₹{p.default_rate ?? 0}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                    <TextInput style={{ flex: 2, backgroundColor: "#F8FAFC", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: "#0F172A", fontSize: 14, borderWidth: 1, borderColor: "#E2E8F0" }} value={it.name} onChangeText={(v) => { const n = items.slice(); n[i] = { ...n[i], name: v }; setItems(n); }} placeholder="Or type name" placeholderTextColor="#94A3B8" />
                    <TextInput style={{ flex: 0.7, backgroundColor: "#F8FAFC", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: "#0F172A", fontSize: 14, borderWidth: 1, borderColor: "#E2E8F0" }} value={itemQtyStrings[i] ?? String(it.qty)} onChangeText={(v) => { const ns = [...itemQtyStrings]; ns[i] = v; setItemQtyStrings(ns); const n = items.slice(); n[i] = { ...n[i], qty: Number(v) || 0 }; setItems(n); }} keyboardType="decimal-pad" placeholder="Qty" placeholderTextColor="#94A3B8" />
                  </View>
                </View>
              ))}
              <TouchableOpacity onPress={() => { setItems((p) => [...p, { name: "", qty: 1, unit: "PCS" }]); setItemQtyStrings(s => [...s, "1"]); }}>
                <Text style={{ color: "#2563EB", fontWeight: "700", fontSize: 13, marginTop: 4 }}>+ Add item</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
                <TouchableOpacity style={{ flex: 0.5, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center" }} onPress={() => { setModalOpen(false); resetForm(); }}>
                  <Text style={{ color: "#64748B", fontWeight: "600" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "#2563EB", alignItems: "center" }} onPress={handleSave} disabled={saving}>
                  <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" }}>{saving ? "Saving…" : "Create Challan"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};
