import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Alert, Platform, StatusBar, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useUser } from "../userContext";
import { OcrPurchaseResult, OcrPurchaseItem } from "../services/ocrPurchaseService";
import { createPurchase, matchOrCreateProductsFromItems } from "../services/purchasesService";
import { Customer, getCustomers } from "../services/customersService";

type Params = { ocrResult: OcrPurchaseResult; rawImage?: string };
type Nav = { navigate: (n: string) => void; goBack: () => void };

const C = { bg: "#F1F5F9", card: "#fff", dark: "#0F172A", muted: "#94A3B8", border: "#E2E8F0", blue: "#2563EB", green: "#059669", red: "#EF4444" };

export const ScanPurchasePreviewScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<{ ScanPurchasePreview: Params }, "ScanPurchasePreview">>();
  const { user } = useUser();

  const ocr = route.params?.ocrResult || ({} as OcrPurchaseResult);
  const [vendorName, setVendorName] = useState(ocr.vendorName || "");
  const [billNumber, setBillNumber] = useState(ocr.billNumber || "");
  const [billDate, setBillDate] = useState(ocr.billDate || new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<OcrPurchaseItem[]>(
    Array.isArray(ocr.items) && ocr.items.length > 0
      ? ocr.items
      : [{ name: "", qty: 1, rate: 0, amount: 0 }]
  );
  const [gstTotal, setGstTotal] = useState(
    Number(ocr.gstTotal ?? 0) ||
    (ocr.items || []).reduce((s: number, it: any) => s + ((Number(it.amount ?? 0) * Number(it.taxRate ?? 0)) / 100), 0)
  );
  const [saving, setSaving] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [itemQtyStrings, setItemQtyStrings] = useState<string[]>(
    (Array.isArray(ocr.items) && ocr.items.length > 0 ? ocr.items : [{ name: "", qty: 1, rate: 0, amount: 0 }]).map(it => String(it.qty ?? 1))
  );
  const [itemRateStrings, setItemRateStrings] = useState<string[]>(
    (Array.isArray(ocr.items) && ocr.items.length > 0 ? ocr.items : [{ name: "", qty: 1, rate: 0, amount: 0 }]).map(it => it.rate ? String(it.rate) : "")
  );
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);

  React.useEffect(() => {
    getCustomers(user?.organisationId ?? undefined).then(setCustomers).catch(() => {});
  }, [user?.organisationId]);

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + (Number(it.amount ?? 0) || 0), 0),
    [items]
  );
  const total = subtotal + gstTotal;

  const updateItem = (i: number, patch: Partial<OcrPurchaseItem>) => {
    setItems((prev) => {
      const next = prev.slice();
      const cur = next[i] || { name: "", qty: 1, rate: 0, amount: 0 };
      const merged = { ...cur, ...patch };
      if (patch.qty !== undefined || patch.rate !== undefined) {
        merged.amount = Number(((Number(merged.qty ?? 1) || 1) * (Number(merged.rate ?? 0) || 0)).toFixed(2));
      }
      next[i] = merged;
      return next;
    });
  };

  const handleSave = async () => {
    if (!vendorName.trim()) { Alert.alert("Required", "Enter vendor name."); return; }
    const cleaned = items
      .map((it) => ({ name: (it.name || "").trim(), qty: Number(it.qty ?? 1) || 1, rate: Number(it.rate ?? 0) || 0, amount: Number(it.amount ?? 0) || 0, taxRate: it.taxRate ?? null, productId: null }))
      .filter((it) => it.name && it.amount > 0);
    if (!cleaned.length) { Alert.alert("Required", "Add at least one item."); return; }

    try {
      setSaving(true);
      await matchOrCreateProductsFromItems({ items: cleaned, organisationId: user?.organisationId ?? undefined });
      await createPurchase({
        vendorName: vendorName.trim(),
        billNumber: billNumber.trim() || null,
        billDate: billDate.trim() || null,
        items: cleaned,
        subtotal,
        gstTotal,
        total,
        organisationId: user?.organisationId ?? undefined,
      });
      Alert.alert("✅ Saved", "Purchase saved successfully.", [{ text: "OK", onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save purchase.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: Platform.OS === "ios" ? 50 : 36, paddingHorizontal: 20, paddingBottom: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={C.dark} />
        </TouchableOpacity>
        <Text style={{ color: C.dark, fontSize: 18, fontFamily: "Inter_700Bold", marginLeft: 12, flex: 1 }}>Review Purchase</Text>
        <TouchableOpacity style={{ backgroundColor: C.green, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }} onPress={handleSave} disabled={saving}>
          <Text style={{ color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" }}>{saving ? "Saving…" : "Save"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}>
        {/* Vendor */}
        <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, zIndex: 10 }}>
          <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, marginBottom: 6 }}>VENDOR / SUPPLIER</Text>
          <View style={{ position: "relative", zIndex: 10 }}>
            <TouchableOpacity
              style={{ backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: showVendorDropdown ? C.blue : C.border, flexDirection: "row", alignItems: "center" }}
              onPress={() => setShowVendorDropdown(!showVendorDropdown)}
            >
              <Text style={{ color: vendorName ? C.dark : C.muted, fontSize: 14, flex: 1 }}>{vendorName || "Select or type vendor name"}</Text>
              <Ionicons name="chevron-down" size={16} color={C.muted} />
            </TouchableOpacity>

            {showVendorDropdown && (
              <View style={{ position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "#fff", borderWidth: 1, borderColor: C.border, borderRadius: 12, marginTop: 4, maxHeight: 200, zIndex: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 }}>
                <TextInput
                  style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: C.border, color: C.dark, fontSize: 14 }}
                  placeholder="Search or type new..."
                  placeholderTextColor={C.muted}
                  value={vendorName}
                  onChangeText={setVendorName}
                  autoFocus
                />
                <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 154 }}>
                  {customers
                    .filter((c) => c.name.toLowerCase().includes(vendorName.toLowerCase()))
                    .map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}
                        onPress={() => {
                          setVendorName(c.name);
                          setShowVendorDropdown(false);
                        }}
                      >
                        <Text style={{ color: C.dark, fontSize: 14 }}>{c.name}</Text>
                      </TouchableOpacity>
                    ))}
                  {vendorName.trim() !== "" && !customers.some(c => c.name.toLowerCase() === vendorName.toLowerCase()) && (
                    <TouchableOpacity
                      style={{ padding: 12, backgroundColor: "#F0FDF4" }}
                      onPress={() => setShowVendorDropdown(false)}
                    >
                      <Text style={{ color: C.green, fontSize: 14, fontWeight: "600" }}>+ Use "{vendorName}"</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10, zIndex: 1 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>BILL NO</Text>
              <TextInput style={{ backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, color: C.dark }} value={billNumber} onChangeText={setBillNumber} placeholder="—" placeholderTextColor={C.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>DATE</Text>
              <TextInput style={{ backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, color: C.dark }} value={billDate} onChangeText={setBillDate} placeholder="YYYY-MM-DD" placeholderTextColor={C.muted} />
            </View>
          </View>
        </View>

        {/* Items */}
        <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, marginBottom: 10 }}>ITEMS ({items.length})</Text>
          {items.map((it, i) => (
            <View key={i} style={{ marginBottom: 10, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: "#F1F5F9", paddingBottom: 10 }}>
              <TextInput style={{ backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.border, color: C.dark, fontSize: 14, fontWeight: "600" }} value={it.name} onChangeText={(v) => updateItem(i, { name: v })} placeholder="Item name" placeholderTextColor={C.muted} />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                <TextInput style={{ flex: 0.7, backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.border, color: C.dark }} value={itemQtyStrings[i] ?? String(it.qty ?? "")} onChangeText={(v) => { const ns = [...itemQtyStrings]; ns[i] = v; setItemQtyStrings(ns); updateItem(i, { qty: Number(v) || 0 }); }} keyboardType="numeric" placeholder="Qty" placeholderTextColor={C.muted} />
                <TextInput style={{ flex: 1, backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.border, color: C.dark }} value={itemRateStrings[i] ?? (it.rate ? String(it.rate) : "")} onChangeText={(v) => { const ns = [...itemRateStrings]; ns[i] = v; setItemRateStrings(ns); updateItem(i, { rate: parseFloat(v) || 0 }); }} keyboardType="decimal-pad" placeholder="Rate" placeholderTextColor={C.muted} />
                <View style={{ flex: 1, backgroundColor: "#F0FDF4", borderRadius: 10, padding: 10, justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ color: C.green, fontSize: 14, fontWeight: "700" }}>₹{(Number(it.amount ?? 0) || 0).toFixed(2)}</Text>
                </View>
              </View>
            </View>
          ))}
          <TouchableOpacity onPress={() => { setItems((p) => [...p, { name: "", qty: 1, rate: 0, amount: 0 }]); setItemQtyStrings(s => [...s, "1"]); setItemRateStrings(s => [...s, ""]); }}>
            <Text style={{ color: C.blue, fontWeight: "700", fontSize: 13 }}>+ Add item</Text>
          </TouchableOpacity>
        </View>

        {/* Totals */}
        <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
            <Text style={{ color: C.muted, fontSize: 13 }}>Subtotal</Text>
            <Text style={{ color: C.dark, fontSize: 14 }}>₹{subtotal.toFixed(2)}</Text>
          </View>
          {gstTotal > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
              <Text style={{ color: C.muted, fontSize: 13 }}>GST</Text>
              <Text style={{ color: C.blue, fontSize: 14 }}>₹{gstTotal.toFixed(2)}</Text>
            </View>
          )}
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 1, borderTopColor: C.border, marginTop: 4 }}>
            <Text style={{ color: C.dark, fontSize: 15, fontWeight: "700" }}>Total</Text>
            <Text style={{ color: C.dark, fontSize: 16, fontFamily: "Inter_700Bold" }}>₹{total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Raw OCR text */}
        {ocr.rawText && (
          <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>
            <TouchableOpacity onPress={() => setShowRaw(!showRaw)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: "700" }}>Raw Scanned Text</Text>
              <Ionicons name={showRaw ? "chevron-up" : "chevron-down"} size={16} color={C.muted} />
            </TouchableOpacity>
            {showRaw && (
              <Text style={{ color: "#475569", fontSize: 11, marginTop: 8, lineHeight: 18, fontFamily: "monospace" }}>{ocr.rawText}</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};
