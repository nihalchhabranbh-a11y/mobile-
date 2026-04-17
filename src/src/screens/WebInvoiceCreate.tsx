import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, Platform, KeyboardAvoidingView, useWindowDimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export const WebInvoiceCreate: React.FC<{ state: any; actions: any; navigation: any; C: any }> = ({
  state, actions, navigation, C
}) => {
  const { width } = useWindowDimensions();
  const {
    loading, saving, customerName, customerPhone, custPickerOpen, custSearch,
    items, gstEnabled, paymentStatus, advanceAmount, paymentMethod, notes,
    pickerIdx, search, filteredProducts, filteredCustomers, subtotal, gstAmount, total
  } = state;
  const {
    setCustomerPhone, setCustPickerOpen, setCustSearch, setItems, setGstEnabled,
    setPaymentStatus, setAdvanceAmount, setPaymentMethod, setNotes, setPickerIdx,
    setSearch, selectCustomer, updateItem, selectProduct, handleSave, setCustomerName
  } = actions;

  // SQFT Calculator local state
  const [sqftModalOpen, setSqftModalOpen] = useState(false);
  const [sqftIdx, setSqftIdx] = useState<number | null>(null);
  const [sqftW, setSqftW] = useState("");
  const [sqftH, setSqftH] = useState("");

  const handleApplySqft = () => {
    if (sqftIdx === null) return;
    const w = parseFloat(sqftW) || 0;
    const h = parseFloat(sqftH) || 0;
    const sqft = parseFloat((w * h).toFixed(2));
    if (sqft > 0) {
      updateItem(sqftIdx, { qty: sqft, description: `${w}x${h}` });
    }
    setSqftModalOpen(false);
  };

  if (loading) {
    return (
      <View style={[S.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={C.orange} size="large" />
      </View>
    );
  }

  return (
    <View style={S.root}>
      {/* Header */}
      <View style={S.header}>
        <View style={S.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#4B5563" />
          </TouchableOpacity>
          <Text style={S.headerTitle}>New Invoice</Text>
        </View>
        <TouchableOpacity style={S.saveBtn} onPress={handleSave} disabled={saving}>
          <Text style={S.saveBtnText}>{saving ? "Saving..." : "Save Invoice"}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>
          
          {/* Top Section (3 Columns on wide screens) */}
          <View style={S.topSection}>
            <View style={S.col}>
              <Text style={S.label}>CUSTOMER BILLING TO</Text>
              <View style={{ zIndex: 10 }}>
                <TouchableOpacity style={S.inputRoot} onPress={() => { setCustPickerOpen(!custPickerOpen); setCustSearch(""); }}>
                  <Text style={{ color: customerName ? "#111827" : "#9CA3AF" }}>{customerName || "Search or enter customer…"}</Text>
                  <Ionicons name="search" size={16} color="#9CA3AF" />
                </TouchableOpacity>
                {custPickerOpen && (
                  <View style={S.dropdown}>
                    <TextInput
                      style={S.dropdownInput}
                      value={custSearch}
                      onChangeText={(v) => { setCustSearch(v); setCustomerName(v); }}
                      placeholder="Search or type new…"
                      placeholderTextColor="#9CA3AF"
                      autoFocus
                    />
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      {filteredCustomers.map((c: any) => (
                        <TouchableOpacity key={c.id} style={S.dropdownItem} onPress={() => selectCustomer(c)}>
                          <Text style={S.dropdownItemTitle}>{c.name}</Text>
                          {c.phone ? <Text style={S.dropdownItemSub}>{c.phone}</Text> : null}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
              <TextInput
                style={[S.inputRoot, { marginTop: 12 }]}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                placeholder="Phone (optional)"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={S.col}>
              <Text style={S.label}>PAYMENT DETAILS</Text>
              <View style={S.btnGroup}>
                {(["unpaid", "advance", "paid"] as const).map((m) => (
                  <TouchableOpacity key={m} style={[S.groupBtn, paymentStatus === m && S.groupBtnActive]} onPress={() => setPaymentStatus(m)}>
                    <Text style={[S.groupBtnText, paymentStatus === m && S.groupBtnTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {paymentStatus !== "unpaid" && (
                <View style={{ marginTop: 12 }}>
                  <View style={S.btnGroup}>
                    {(["cash", "online"] as const).map((m) => (
                      <TouchableOpacity key={m} style={[S.groupBtn, paymentMethod === m && S.groupBtnActive]} onPress={() => setPaymentMethod(m)}>
                        <Text style={[S.groupBtnText, paymentMethod === m && S.groupBtnTextActive]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {paymentStatus === "advance" && (
                    <TextInput
                      style={[S.inputRoot, { marginTop: 12 }]}
                      value={advanceAmount}
                      onChangeText={setAdvanceAmount}
                      placeholder="Advance Amount"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                    />
                  )}
                </View>
              )}
            </View>

            <View style={S.col}>
              <Text style={S.label}>ADDITIONAL OPTIONS</Text>
              <TouchableOpacity style={S.toggleRow} onPress={() => setGstEnabled(!gstEnabled)}>
                <Text style={S.toggleText}>Calculate GST</Text>
                <Ionicons name={gstEnabled ? "checkbox" : "square-outline"} size={22} color={gstEnabled ? "#ea580c" : "#9CA3AF"} />
              </TouchableOpacity>
              <TextInput
                style={[S.inputRoot, { marginTop: 12, minHeight: 80, textAlignVertical: "top" }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Notes or terms (optional)"
                placeholderTextColor="#9CA3AF"
                multiline
              />
            </View>
          </View>

          {/* Table Section */}
          <View style={S.tableCard}>
            <View style={S.tableHeader}>
              <Text style={[S.th, { flex: 2 }]}>Item</Text>
              <Text style={[S.th, { flex: 3 }]}>Description</Text>
              <Text style={[S.th, { flex: 1, textAlign: "center" }]}>Qty</Text>
              <Text style={[S.th, { flex: 1, textAlign: "right" }]}>Rate</Text>
              {gstEnabled && <Text style={[S.th, { flex: 1, textAlign: "right" }]}>Tax %</Text>}
              <Text style={[S.th, { flex: 1, textAlign: "right" }]}>Amount</Text>
              <Text style={[S.th, { width: 40, textAlign: "center" }]}></Text>
            </View>

            {items.map((it: any, i: number) => (
              <View key={i} style={S.tableRow}>
                {/* Item Lookup */}
                <View style={{ flex: 2, marginRight: 8, zIndex: pickerIdx === i ? 20 : 1 }}>
                  <TouchableOpacity style={S.tableInput} onPress={() => { setPickerIdx(pickerIdx === i ? null : i); setSearch(""); }}>
                    <Text style={{ color: it.name ? "#111827" : "#9CA3AF" }} numberOfLines={1}>{it.name || "Select..."}</Text>
                  </TouchableOpacity>
                  {pickerIdx === i && (
                    <View style={S.dropdownItemTable}>
                      <TextInput
                        style={S.dropdownInput}
                        value={search}
                        onChangeText={(v) => { setSearch(v); updateItem(i, { name: v }); }}
                        placeholder="Search..."
                        placeholderTextColor="#9CA3AF"
                        autoFocus
                      />
                      <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                        {filteredProducts.map((p: any) => (
                          <TouchableOpacity key={p.id} style={S.dropdownItem} onPress={() => selectProduct(p, i)}>
                            <Text style={S.dropdownItemTitle}>{p.name}</Text>
                            <Text style={S.dropdownItemSub}>₹{p.defaultRate} {p.taxRate ? `(+${p.taxRate}% GST)` : ""}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
                
                <TextInput
                  style={[S.tableInput, { flex: 3, marginRight: 8 }]}
                  value={it.description}
                  onChangeText={(v) => updateItem(i, { description: v })}
                  placeholder="Optional details"
                  placeholderTextColor="#9CA3AF"
                />
                
<View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: "row", gap: 4, marginBottom: 2, alignItems: "center" }}>
                    <TextInput
                      style={[S.tableInput, { flex: 1, textAlign: "center" }]}
                      value={String(it.qty)}
                      onChangeText={(v) => updateItem(i, { qty: Number(v) || 1 })}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      onPress={() => { setSqftIdx(i); setSqftW(""); setSqftH(""); setSqftModalOpen(true); }}
                      style={{ backgroundColor: "#FFF7ED", borderWidth: 1, borderColor: "#ea580c", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 3 }}
                    >
                      <Text style={{ color: "#ea580c", fontSize: 9, fontWeight: "700" }}>SQFT</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                <TextInput
                  style={[S.tableInput, { flex: 1, textAlign: "right", marginRight: 8 }]}
                  value={it.rate ? String(it.rate) : ""}
                  onChangeText={(v) => updateItem(i, { rate: parseFloat(v) || 0 })}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
                
                {gstEnabled && (
                  <TextInput
                    style={[S.tableInput, { flex: 1, textAlign: "right", marginRight: 8 }]}
                    value={String(it.taxRate || 0)}
                    onChangeText={(v) => updateItem(i, { taxRate: parseFloat(v) || 0 })}
                    keyboardType="numeric"
                  />
                )}
                
                <View style={{ flex: 1, justifyContent: "center", alignItems: "flex-end" }}>
                  <Text style={S.amountText}>₹{(it.amount || 0).toFixed(2)}</Text>
                </View>

                <TouchableOpacity 
                  style={{ width: 40, alignItems: "center", justifyContent: "center" }}
                  onPress={() => {
                    if (items.length > 1) {
                      setItems((prev: any) => prev.filter((_: any, idx: number) => idx !== i));
                    }
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={S.addRowBtn} onPress={() => setItems((p: any) => [...p, { name: "", description: "", qty: 1, rate: 0, taxRate: 0, amount: 0 }])}>
              <Ionicons name="add-circle" size={16} color="#ea580c" />
              <Text style={S.addRowText}>Add another line</Text>
            </TouchableOpacity>

            {/* Totals Section */}
            <View style={S.totalsArea}>
              <View style={S.totalRow}>
                <Text style={S.totalLabel}>Subtotal</Text>
                <Text style={S.totalValue}>₹{subtotal.toFixed(2)}</Text>
              </View>
              {gstEnabled && gstAmount > 0 && (
                <View style={S.totalRow}>
                  <Text style={S.totalLabel}>Total Tax (GST)</Text>
                  <Text style={S.totalValue}>+ ₹{gstAmount.toFixed(2)}</Text>
                </View>
              )}
              <View style={[S.totalRow, S.grandTotalRow]}>
                <Text style={S.grandTotalLabel}>Grand Total</Text>
                <Text style={S.grandTotalValue}>₹{total.toFixed(2)}</Text>
              </View>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* SQFT Modal overlay */}
      {sqftModalOpen && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 16, width: 360, padding: 24, borderWidth: 1, borderColor: "#E5E7EB", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 20, elevation: 20 }}>
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 20 }}>SQFT Calculator</Text>

            <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: "#6B7280", marginBottom: 6 }}>Width (ft)</Text>
                <TextInput style={[S.tableInput, { fontSize: 16, height: 48 }]} value={sqftW} onChangeText={setSqftW} keyboardType="numeric" placeholder="0" autoFocus />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: "#6B7280", marginBottom: 6 }}>Height (ft)</Text>
                <TextInput style={[S.tableInput, { fontSize: 16, height: 48 }]} value={sqftH} onChangeText={setSqftH} keyboardType="numeric" placeholder="0" />
              </View>
            </View>

            <View style={{ backgroundColor: "#FFF7ED", borderRadius: 8, padding: 12, marginBottom: 20, alignItems: "center" }}>
              <Text style={{ color: "#ea580c", fontWeight: "700", fontSize: 15 }}>Total: {((parseFloat(sqftW)||0) * (parseFloat(sqftH)||0)).toFixed(2)} sq ft</Text>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 8, borderWidth: 1, borderColor: "#D1D5DB", alignItems: "center" }} onPress={() => setSqftModalOpen(false)}>
                <Text style={{ color: "#6B7280", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 8, backgroundColor: "#ea580c", alignItems: "center" }} onPress={handleApplySqft}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fff", paddingHorizontal: 24, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: "#E5E7EB"
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  saveBtn: { backgroundColor: "#ea580c", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  saveBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },

  content: { padding: 24, gap: 24, paddingBottom: 100 },
  
  topSection: { flexDirection: Platform.OS === 'web' && window.innerWidth > 900 ? "row" : "column", gap: 24 },
  col: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 20, borderWidth: 1, borderColor: "#E5E7EB", ...Platform.select({ web: { zIndex: 10 }}) },
  label: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#6B7280", letterSpacing: 0.5, marginBottom: 12 },
  
  inputRoot: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8, padding: 12, fontSize: 14, color: "#111827", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  
  dropdown: { position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "#fff", borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8, marginTop: 4, zIndex: 50, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  dropdownInput: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB", fontSize: 13 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  dropdownItemTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827" },
  dropdownItemSub: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  
  dropdownItemTable: { position: "absolute", top: "100%", left: 0, width: 250, backgroundColor: "#fff", borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8, marginTop: 4, zIndex: 100, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },

  btnGroup: { flexDirection: "row", gap: 8 },
  groupBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#D1D5DB", alignItems: "center" },
  groupBtnActive: { borderColor: "#ea580c", backgroundColor: "#FFF7ED" },
  groupBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#6B7280", textTransform: "capitalize" },
  groupBtnTextActive: { color: "#ea580c" },

  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  toggleText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#111827" },

  tableCard: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", overflow: "visible" },
  tableHeader: { flexDirection: "row", padding: 16, borderBottomWidth: 1, borderBottomColor: "#E5E7EB", backgroundColor: "#F9FAFB", borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  th: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
  
  tableRow: { flexDirection: "row", padding: 16, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", alignItems: "center", zIndex: 1 },
  tableInput: { borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 6, padding: 10, fontSize: 13, color: "#111827", backgroundColor: "#fff", height: 40, justifyContent: "center" },
  amountText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  
  addRowBtn: { flexDirection: "row", alignItems: "center", gap: 6, padding: 16, alignSelf: "flex-start" },
  addRowText: { color: "#ea580c", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  totalsArea: { borderTopWidth: 1, borderTopColor: "#E5E7EB", padding: 24, backgroundColor: "#FAFAFA", borderBottomLeftRadius: 12, borderBottomRightRadius: 12, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", width: 250, paddingVertical: 6 },
  totalLabel: { fontSize: 13, color: "#6B7280" },
  totalValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  grandTotalRow: { borderTopWidth: 1, borderTopColor: "#E5E7EB", marginTop: 8, paddingTop: 12 },
  grandTotalLabel: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#111827" },
  grandTotalValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#ea580c" },
});
