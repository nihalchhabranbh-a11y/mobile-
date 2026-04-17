import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Alert, Platform, StatusBar, ActivityIndicator, KeyboardAvoidingView, Linking
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { useUser } from "../userContext";
import { useTheme } from "../themeContext";
import { useSafeScreen } from "../hooks/useSafeScreen";
import { getProducts as fetchProducts, Product } from "../services/productsService";
import { getCustomers as fetchCustomers } from "../services/customersService";
import { createBill as saveBill, updateBill, fetchBillById, addBillPayment, BillingProduct, BillPayment } from "../services/billingService";
import { shareBillViaWhatsApp } from "../utils/invoiceShare";
import { WebInvoiceCreate } from "./WebInvoiceCreate";

type Nav = { navigate: (n: string) => void; goBack: () => void; replace: (n: string, p?: any) => void };

type InvoiceItem = { name: string; description: string; qty: number; rate: number; taxRate: number; amount: number };

function makeUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const InvoiceCreateScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const editBillId = route.params?.editBillId;
  const { user } = useUser();
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeScreen();

  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [custPickerOpen, setCustPickerOpen] = useState(false);
  const [custSearch, setCustSearch] = useState("");

  const [items, setItems] = useState<InvoiceItem[]>([{ name: "", description: "", qty: 1, rate: 0, taxRate: 0, amount: 0 }]);
  const [gstEnabled, setGstEnabled] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"unpaid" | "advance" | "paid">("unpaid");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");
  const [notes, setNotes] = useState("");
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  // Fix #3: track qty as strings to avoid snapping while typing decimals
  const [qtyStrings, setQtyStrings] = useState<Record<number, string>>({});

  // SQFT Modal State
  const [sqftModalOpen, setSqftModalOpen] = useState(false);
  const [sqftIdx, setSqftIdx] = useState<number | null>(null);
  const [sqftWidth, setSqftWidth] = useState("");
  const [sqftHeight, setSqftHeight] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const org = user?.organisationId ?? undefined;
      const [prods, custs] = await Promise.all([fetchProducts(org), fetchCustomers(org)]);
      setProducts(prods.filter((p: any) => p.active).map((p: any) => ({
        id: p.id, name: p.name, defaultRate: p.default_rate ?? 0, taxRate: p.tax_rate ?? 0,
        unit: p.unit ?? "PCS", hsnCode: p.hsn_code ?? null, active: p.active,
      })));
      setCustomers(custs);

      if (editBillId) {
        const bill = await fetchBillById(editBillId);
        if (bill) {
          setCustomerName(bill.customer);
          setCustomerPhone(bill.phone ?? "");
          if (bill.items && bill.items.length > 0) {
            // Support legacy formats where items were saved with different keys or as strings
            setItems(bill.items.map((it: any) => {
              const parsedQty = parseFloat(it.qty ?? it.quantity ?? 1);
              const parsedRate = parseFloat(it.rate ?? it.unit_price ?? it.price ?? 0);
              const parsedTax = parseFloat(it.taxRate ?? it.tax_rate ?? it.tax ?? 0);
              const parsedAmt = parseFloat(it.amount ?? it.total ?? (parsedQty * parsedRate));
              return {
                name: it.name || it.desc || it.item_name || it.description || "",
                description: it.description || "",
                qty: isNaN(parsedQty) ? 1 : parsedQty,
                rate: isNaN(parsedRate) ? 0 : parsedRate,
                taxRate: isNaN(parsedTax) ? 0 : parsedTax,
                amount: isNaN(parsedAmt) ? 0 : parsedAmt
              };
            }));
          }
          setGstEnabled(bill.gst ?? false);
          setPaymentStatus(bill.paid ? "paid" : "unpaid");
          setNotes(bill.notes ?? "");
        }
      } else if (route.params?.prefill) {
        const pf = route.params.prefill;
        if (pf.customerName) setCustomerName(pf.customerName);
        if (pf.customerPhone) setCustomerPhone(pf.customerPhone);
        
        const foundProd = prods.find((p: any) => p.name === pf.productName);
        const qty = pf.sqft || 1;
        const rate = pf.rate || (foundProd?.default_rate ?? 0);
        setItems([{
          name: pf.productName || "",
          description: pf.description || "",
          qty,
          rate,
          taxRate: foundProd?.tax_rate ?? 0,
          amount: parseFloat((qty * rate).toFixed(2))
        }]);
      }
    } catch { } finally { setLoading(false); }
  }, [user?.organisationId, editBillId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products.slice(0, 25);
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 25);
  }, [products, search]);

  const filteredCustomers = useMemo(() => {
    if (!custSearch.trim()) return customers.slice(0, 15);
    const q = custSearch.toLowerCase();
    return customers.filter((c) => (c.name || "").toLowerCase().includes(q) || (c.phone || "").includes(q)).slice(0, 15);
  }, [customers, custSearch]);

  const selectCustomer = (c: any) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone || "");
    setCustPickerOpen(false);
    setCustSearch("");
  };

  const updateItem = (i: number, patch: Partial<InvoiceItem>) => {
    setItems((prev) => {
      const next = prev.slice();
      const cur = next[i] || { name: "", qty: 1, rate: 0, taxRate: 0, amount: 0 };
      const merged = { ...cur, ...patch };
      if (patch.qty !== undefined || patch.rate !== undefined) {
        merged.amount = Number(((merged.qty || 1) * (merged.rate || 0)).toFixed(2));
      }
      next[i] = merged;
      return next;
    });
  };

  const selectProduct = (p: BillingProduct, idx: number) => {
    updateItem(idx, { name: p.name, description: p.description || "", rate: p.defaultRate, taxRate: p.taxRate });
    // Reset qty string when a new product is selected
    setQtyStrings(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setPickerIdx(null); setSearch("");
  };

  const subtotal = useMemo(() => items.reduce((s, it) => s + (Number(it.amount) || 0), 0), [items]);
  const gstAmount = gstEnabled ? items.reduce((s, it) => s + ((Number(it.amount) || 0) * (Number(it.taxRate) || 0) / 100), 0) : 0;
  const total = subtotal + gstAmount;

  const handleApplySqft = () => {
    if (sqftIdx === null) return;
    const w = parseFloat(sqftWidth) || 0;
    const h = parseFloat(sqftHeight) || 0;
    const sqft = parseFloat((w * h).toFixed(2));
    if (sqft > 0) {
      updateItem(sqftIdx, {
        qty: sqft,
        description: `${w}x${h}`,
      });
    }
    setSqftModalOpen(false);
  };

  const handleSave = async () => {
    if (!customerName.trim()) { Alert.alert("Required", "Enter customer name."); return; }
    const cleaned = items.filter((it) => it.name.trim() && it.amount > 0);
    if (!cleaned.length) { Alert.alert("Required", "Add at least one item."); return; }

    try {
      setSaving(true);
      const invoiceId = editBillId || makeUUID();
      
      const payload = {
        id: invoiceId,
        customer: customerName.trim(),
        phone: customerPhone.trim() || null,
        items: cleaned.map((it) => ({
          name: it.name, description: it.description || null, qty: it.qty, rate: it.rate, taxRate: it.taxRate, amount: it.amount,
        })),
        subtotal, gstAmt: gstAmount, total,
        gst: gstEnabled,
        paid: paymentStatus === "paid",
        notes: notes.trim() || null,
        status: "final",
        organisationId: user?.organisationId ?? undefined,
      };

      if (editBillId) {
        await updateBill(invoiceId, payload as any);
      } else {
        await saveBill(payload);
      }

      // Only add payment if creating new bill or if explicitly marked in edit maybe? 
      // In edit mode we shouldn't add duplicate payments. Just for new bills:
      if (!editBillId) {
        let payments: BillPayment[] = [];
        if (paymentStatus === "paid" || (paymentStatus === "advance" && Number(advanceAmount) > 0)) {
          const amt = paymentStatus === "paid" ? total : Number(advanceAmount);
          const p = await addBillPayment({
            billId: invoiceId,
            amount: amt,
            method: paymentMethod,
            organisationId: user?.organisationId ?? undefined,
          });
          payments.push(p);
        }
      }

      navigation.replace("InvoiceDetail", { billId: invoiceId });
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to create invoice.");
    } finally { setSaving(false); }
  };

  const C = {
    bg: colors.background, card: colors.cardBackground, border: colors.cardBorder, 
    bright: colors.textPrimary, muted: colors.textSecondary, blue: colors.accentBlue, 
    green: colors.accentGreen, red: colors.accentRed, orange: "#FF6600"
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" }}><ActivityIndicator color={C.orange} size="large" /></View>;

  if (Platform.OS === "web") {
    const stateObj = { loading, saving, customerName, customerPhone, custPickerOpen, custSearch, items, gstEnabled, paymentStatus, advanceAmount, paymentMethod, notes, pickerIdx, search, filteredProducts, filteredCustomers, subtotal, gstAmount, total };
    const actionsObj = { setCustomerName, setCustomerPhone, setCustPickerOpen, setCustSearch, setItems, setGstEnabled, setPaymentStatus, setAdvanceAmount, setPaymentMethod, setNotes, setPickerIdx, setSearch, selectCustomer, updateItem, selectProduct, handleSave };
    return <WebInvoiceCreate state={stateObj} actions={actionsObj} navigation={navigation} C={C} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: insets.paddingTop || 40, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={C.bright} /></TouchableOpacity>
        <Text style={{ color: C.bright, fontSize: 18, fontFamily: "Inter_700Bold", marginLeft: 12, flex: 1 }}>{editBillId ? "Edit Invoice" : "New Invoice"}</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 120 }}>
          
          {/* Customer */}
          <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, elevation: 1 }}>
            <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, marginBottom: 8 }}>CUSTOMER *</Text>
            
            <TouchableOpacity style={{ backgroundColor: C.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }} onPress={() => { setCustPickerOpen(!custPickerOpen); setCustSearch(""); }}>
              <Text style={{ color: customerName ? C.bright : C.muted, fontSize: 14 }}>{customerName || "Search or enter customer…"}</Text>
              <Ionicons name="search" size={16} color={C.muted} />
            </TouchableOpacity>
            
            {custPickerOpen && (
               <View style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, maxHeight: 200, marginTop: 4, elevation: 3 }}>
                 <TextInput style={{ backgroundColor: C.bg, borderRadius: 10, margin: 8, padding: 10, borderWidth: 1, borderColor: C.border, color: C.bright, fontSize: 13 }} value={custSearch} onChangeText={(v) => { setCustSearch(v); setCustomerName(v); }} placeholder="Search existing or type new…" placeholderTextColor={C.muted} autoFocus />
                 <ScrollView style={{ maxHeight: 140 }} nestedScrollEnabled>
                   {filteredCustomers.map((c) => (
                     <TouchableOpacity key={c.id} style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }} onPress={() => selectCustomer(c)}>
                       <Text style={{ color: C.bright, fontSize: 14, fontWeight: "600" }}>{c.name}</Text>
                       {c.phone ? <Text style={{ color: C.muted, fontSize: 12 }}>{c.phone}</Text> : null}
                     </TouchableOpacity>
                   ))}
                 </ScrollView>
               </View>
            )}

            <TextInput style={{ backgroundColor: C.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, color: C.bright, fontSize: 14, marginTop: 10 }} value={customerPhone} onChangeText={setCustomerPhone} placeholder="Phone (optional)" placeholderTextColor={C.muted} keyboardType="phone-pad" />
          </View>

          {/* Items */}
          <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, elevation: 1 }}>
            <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, marginBottom: 12 }}>ITEMS</Text>
            {items.map((it, i) => (
              <View key={i} style={{ marginBottom: 16, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: C.border, paddingBottom: i < items.length - 1 ? 16 : 0 }}>
                <TouchableOpacity style={{ backgroundColor: C.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }} onPress={() => { setPickerIdx(pickerIdx === i ? null : i); setSearch(""); }}>
                  <Text style={{ color: it.name ? C.bright : C.muted, fontSize: 14 }}>{it.name || "Select product…"}</Text>
                  <Ionicons name="search" size={16} color={C.muted} />
                </TouchableOpacity>
                {pickerIdx === i && (
                  <View style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, maxHeight: 200, marginTop: 4, elevation: 3 }}>
                    <TextInput style={{ backgroundColor: C.bg, borderRadius: 10, margin: 8, padding: 10, borderWidth: 1, borderColor: C.border, color: C.bright, fontSize: 13 }} value={search} onChangeText={(v) => { setSearch(v); updateItem(i, { name: v }); }} placeholder="Search existing or type new…" placeholderTextColor={C.muted} autoFocus />
                    <ScrollView style={{ maxHeight: 140 }} nestedScrollEnabled>
                      {filteredProducts.map((p) => (
                        <TouchableOpacity key={p.id} style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }} onPress={() => selectProduct(p, i)}>
                          <Text style={{ color: C.bright, fontSize: 14, fontWeight: "600" }}>{p.name}</Text>
                          <Text style={{ color: C.muted, fontSize: 12 }}>₹{p.defaultRate ?? 0} {p.taxRate ? `(+${p.taxRate}% GST)` : ''}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
                 {/* Description */}
                 <TextInput
                   style={{ backgroundColor: C.bg, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.border, color: C.bright, fontSize: 13, marginTop: 6, marginBottom: 4 }}
                   value={it.description}
                   onChangeText={(v) => updateItem(i, { description: v })}
                   placeholder="Description (optional)…"
                   placeholderTextColor={C.muted}
                 />
                 <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  <View style={{ flex: 1 }}>
                     <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                       <Text style={{ color: C.muted, fontSize: 10, marginLeft: 4 }}>QTY</Text>
                       <TouchableOpacity onPress={() => { setSqftIdx(i); setSqftWidth(""); setSqftHeight(""); setSqftModalOpen(true); }} style={{ backgroundColor: C.orange+"20", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                         <Text style={{ color: C.orange, fontSize: 9, fontWeight: "700" }}>SQFT</Text>
                       </TouchableOpacity>
                     </View>
                     <TextInput style={{ backgroundColor: C.bg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, color: C.bright }} value={String(it.qty)} onChangeText={(v) => updateItem(i, { qty: Number(v) || 1 })} keyboardType="numeric" placeholder="1" placeholderTextColor={C.muted} />
                  </View>
                  <View style={{ flex: 1.5 }}>
                     <Text style={{ color: C.muted, fontSize: 10, marginBottom: 4, marginLeft: 4 }}>RATE</Text>
                     <TextInput style={{ backgroundColor: C.bg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, color: C.bright }} value={it.rate ? String(it.rate) : ""} onChangeText={(v) => updateItem(i, { rate: parseFloat(v) || 0 })} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.muted} />
                  </View>
                  {gstEnabled && (
                    <View style={{ flex: 1 }}>
                       <Text style={{ color: C.muted, fontSize: 10, marginBottom: 4, marginLeft: 4 }}>TAX %</Text>
                       <TextInput style={{ backgroundColor: C.bg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, color: C.bright }} value={String(it.taxRate || 0)} onChangeText={(v) => updateItem(i, { taxRate: parseFloat(v) || 0 })} keyboardType="numeric" placeholder="0" placeholderTextColor={C.muted} />
                    </View>
                  )}
                  <View style={{ flex: 1.2, backgroundColor: "#FFF4ED", borderRadius: 10, padding: 12, justifyContent: "center", alignItems: "center", marginTop: 17 }}>
                    <Text style={{ color: C.orange, fontSize: 14, fontWeight: "700" }}>₹{(it.amount || 0).toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            ))}
            <TouchableOpacity style={{ marginTop: 8, flexDirection: "row", alignItems: "center" }} onPress={() => setItems((p) => [...p, { name: "", description: "", qty: 1, rate: 0, taxRate: 0, amount: 0 }])}>
              <Ionicons name="add-circle" size={18} color={C.orange} style={{ marginRight: 6 }} />
              <Text style={{ color: C.orange, fontWeight: "700", fontSize: 14 }}>Add another item</Text>
            </TouchableOpacity>
          </View>

          {/* GST Toggle */}
          <TouchableOpacity style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, flexDirection: "row", justifyContent: "space-between", elevation: 1 }} onPress={() => setGstEnabled(!gstEnabled)}>
            <Text style={{ color: C.bright, fontSize: 14, fontWeight: "600" }}>Calculate GST</Text>
            <Ionicons name={gstEnabled ? "checkbox" : "square-outline"} size={22} color={gstEnabled ? C.orange : C.muted} />
          </TouchableOpacity>

          {/* Totals */}
          <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, elevation: 1 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
              <Text style={{ color: C.muted }}>Subtotal</Text>
              <Text style={{ color: C.bright, fontWeight: "600" }}>₹{subtotal.toFixed(2)}</Text>
            </View>
            {gstEnabled && gstAmount > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <Text style={{ color: C.muted }}>Total Tax (GST)</Text>
                <Text style={{ color: C.orange, fontWeight: "600" }}>+ ₹{gstAmount.toFixed(2)}</Text>
              </View>
            )}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border, marginTop: 8 }}>
              <Text style={{ color: C.bright, fontSize: 16, fontWeight: "700" }}>Grand Total</Text>
              <Text style={{ color: C.bright, fontSize: 20, fontFamily: "Inter_700Bold" }}>₹{total.toFixed(2)}</Text>
            </View>
          </View>

          {/* Payment + Notes */}
          <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, elevation: 1 }}>
            <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", marginBottom: 8 }}>PAYMENT STATUS</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {(["unpaid", "advance", "paid"] as const).map((m) => (
                <TouchableOpacity key={m} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: paymentStatus === m ? C.orange : C.border, alignItems: "center", backgroundColor: paymentStatus === m ? C.orange + "15" : "transparent" }} onPress={() => setPaymentStatus(m)}>
                  <Text style={{ color: paymentStatus === m ? C.orange : C.muted, fontSize: 12, fontWeight: "700", textTransform: "capitalize" }}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {paymentStatus !== "unpaid" && (
              <>
                {paymentStatus === "advance" && (
                  <TextInput
                    style={{ backgroundColor: C.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, color: C.bright, fontSize: 14, marginBottom: 12 }}
                    value={advanceAmount}
                    onChangeText={setAdvanceAmount}
                    placeholder="Advance Amount Received…"
                    placeholderTextColor={C.muted}
                    keyboardType="numeric"
                  />
                )}
                <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", marginBottom: 8, marginTop: 4 }}>PAYMENT METHOD</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {(["cash", "online", "upi", "bank"] as const).map((m) => (
                    <TouchableOpacity key={m} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: paymentMethod === m ? C.orange : C.border, alignItems: "center", backgroundColor: paymentMethod === m ? C.orange + "15" : "transparent", minWidth: 72 }} onPress={() => setPaymentMethod(m as any)}>
                      <Text style={{ color: paymentMethod === m ? C.orange : C.muted, fontSize: 12, fontWeight: "700", textTransform: "capitalize" }}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TextInput style={{ backgroundColor: C.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, color: C.bright, fontSize: 14, marginTop: 16, minHeight: 48, textAlignVertical: "top" }} value={notes} onChangeText={setNotes} placeholder="Notes (optional)" placeholderTextColor={C.muted} multiline />
          </View>

          {/* Save */}
          <TouchableOpacity style={{ backgroundColor: C.orange, borderRadius: 16, paddingVertical: 18, alignItems: "center", marginTop: 8, shadowColor: C.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }} onPress={handleSave} disabled={saving}>
            <Text style={{ color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" }}>{saving ? "Saving…" : (editBillId ? "Update Invoice" : "Save Final Invoice")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* SQFT Modal */}
      {sqftModalOpen && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 999 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 16, width: "85%", padding: 20, elevation: 10, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.bright, fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 16 }}>SQFT Calculator</Text>
            
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>Width (ft)</Text>
                <TextInput style={{ backgroundColor: C.bg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, color: C.bright, fontSize: 16 }} value={sqftWidth} onChangeText={setSqftWidth} keyboardType="numeric" placeholder="0" placeholderTextColor={C.muted} autoFocus />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>Height (ft)</Text>
                <TextInput style={{ backgroundColor: C.bg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, color: C.bright, fontSize: 16 }} value={sqftHeight} onChangeText={setSqftHeight} keyboardType="numeric" placeholder="0" placeholderTextColor={C.muted} />
              </View>
            </View>

            <View style={{ backgroundColor: C.orange + "15", padding: 12, borderRadius: 8, marginBottom: 20, alignItems: "center" }}>
              <Text style={{ color: C.orange, fontSize: 14, fontWeight: "600" }}>Total: {((parseFloat(sqftWidth)||0) * (parseFloat(sqftHeight)||0)).toFixed(2)} sq ft</Text>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: "center" }} onPress={() => setSqftModalOpen(false)}>
                <Text style={{ color: C.muted, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: C.orange, alignItems: "center" }} onPress={handleApplySqft}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};
