/**
 * EWayBillScreen.tsx
 * Create & manage E-Way Bills (EWB) for goods movement > ₹50,000.
 * Real generation via Sandbox.co.in API + Supabase persistence.
 */
import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, StatusBar, Platform, KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../themeContext";
import { useUser } from "../userContext";
import { supabase } from "../src/services/supabaseClient";
import { generateEWayBill, cancelEWayBill } from "../src/services/sandboxService";

type EWBForm = {
  billNo:      string;
  partyName:   string;
  pinFrom:     string;
  pinTo:       string;
  vehicleNo:   string;
  transporter: string;
  value:       string;
  hsnCode:     string;
  distance:    string;
};

const BLANK: EWBForm = {
  billNo: "", partyName: "", pinFrom: "", pinTo: "",
  vehicleNo: "", transporter: "", value: "", hsnCode: "", distance: "",
};

type EWB = {
  id: string;
  ewb_no: string;
  valid_upto?: string;
  party_name: string;
  total_value: number;
  status: string;
  created_at: string;
};

// ─────────────────────────────────────────────────────────────
export function EWayBillScreen() {
  const { colors, mode } = useTheme();
  const { user }         = useUser();
  const navigation       = useNavigation<any>();
  const [tab,         setTab]         = useState<"list" | "create">("list");
  const [form,        setForm]        = useState<EWBForm>(BLANK);
  const [loading,     setLoading]     = useState(false);
  const [ewbs,        setEwbs]        = useState<EWB[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const dark   = mode === "dark";
  const bg     = dark ? "#0F1117" : "#F0F4FF";
  const card   = dark ? "#1C1C2E" : "#FFFFFF";
  const txt    = dark ? "#F1F5F9" : "#111827";
  const sub    = dark ? "#94A3B8" : "#6B7280";
  const border = dark ? "#2A2A3C" : "#E5E7EB";

  const setField = (k: keyof EWBForm, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  // ── Load saved EWBs from Supabase ────────────────────────────
  const loadEWBs = useCallback(async () => {
    if (!user?.organisationId) return;
    setListLoading(true);
    try {
      const { data } = await supabase
        .from("eway_bills")
        .select("*")
        .eq("organisation_id", user.organisationId)
        .order("created_at", { ascending: false })
        .limit(50);
      setEwbs((data as EWB[]) ?? []);
    } catch (_) {}
    setListLoading(false);
  }, [user?.organisationId]);

  useFocusEffect(useCallback(() => { loadEWBs(); }, [loadEWBs]));

  // ── Generate E-Way Bill ───────────────────────────────────────
  const handleGenerate = async () => {
    if (!form.billNo || !form.partyName || !form.value || !form.pinFrom || !form.pinTo) {
      Alert.alert("Missing fields", "Please fill Bill No, Party Name, Value and PIN codes.");
      return;
    }
    setLoading(true);
    try {
      const { data: settings } = await supabase
        .from("settings")
        .select("gst_number")
        .eq("organisation_id", user?.organisationId ?? "")
        .limit(1)
        .maybeSingle();

      const sellerGstin = settings?.gst_number;
      if (!sellerGstin) {
        throw new Error("Your GST number is not set.\nGo to Company Details → GST Number and add it.");
      }

      const now = new Date();
      const docDate = [
        String(now.getDate()).padStart(2, "0"),
        String(now.getMonth() + 1).padStart(2, "0"),
        now.getFullYear(),
      ].join("/");

      const totalValue   = parseFloat(form.value) || 0;
      const taxableValue = totalValue * 0.85;
      const halfGst      = (totalValue - taxableValue) / 2;

      const result = await generateEWayBill({
        seller_gstin:    sellerGstin,
        buyer_name:      form.partyName,
        supply_type:     "O",
        sub_supply_type: "1",
        document_type:   "INV",
        document_number: form.billNo,
        document_date:   docDate,
        from_gstin:      sellerGstin,
        from_pincode:    form.pinFrom,
        to_pincode:      form.pinTo,
        total_value:     totalValue,
        taxable_value:   taxableValue,
        cgst:            halfGst,
        sgst:            halfGst,
        igst:            0,
        transport_mode:  "1",
        vehicle_number:  form.vehicleNo || undefined,
        transporter_name: form.transporter || undefined,
        distance:        parseInt(form.distance) || undefined,
        hsn_code:        form.hsnCode || undefined,
      });

      await supabase.from("eway_bills").insert({
        organisation_id: user?.organisationId ?? "",
        ewb_no:          result.ewb_no,
        ewb_date:        result.ewb_date,
        valid_upto:      result.valid_upto,
        party_name:      form.partyName,
        total_value:     totalValue,
        document_number: form.billNo,
        vehicle_number:  form.vehicleNo || null,
        transporter:     form.transporter || null,
        status:          "ACTIVE",
      });

      await loadEWBs();
      setForm(BLANK);
      setTab("list");
      Alert.alert(
        "E-Way Bill Generated ✅",
        `EWB No: ${result.ewb_no}\n` +
        (result.valid_upto ? `Valid Till: ${result.valid_upto}\n` : "") +
        (result.alert ? `\n⚠️ ${result.alert}` : "")
      );
    } catch (e: any) {
      Alert.alert("Generation Failed", e?.message || "Could not generate E-Way Bill. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Cancel EWB ───────────────────────────────────────────────
  const handleCancel = (ewb: EWB) => {
    Alert.alert(
      "Cancel E-Way Bill",
      `Cancel EWB No: ${ewb.ewb_no}?\n\nThis cannot be undone.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel EWB", style: "destructive",
          onPress: async () => {
            try {
              await cancelEWayBill(ewb.ewb_no, "Others", "Cancelled from app");
              await supabase
                .from("eway_bills")
                .update({ status: "CANCELLED" })
                .eq("id", ewb.id);
              await loadEWBs();
              Alert.alert("Cancelled", `EWB ${ewb.ewb_no} has been cancelled.`);
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Could not cancel E-Way Bill.");
            }
          },
        },
      ]
    );
  };

  const Field = ({
    label, fieldKey, placeholder, keyboardType = "default", maxLength,
  }: {
    label: string; fieldKey: keyof EWBForm; placeholder: string;
    keyboardType?: "default" | "numeric" | "phone-pad"; maxLength?: number;
  }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.fieldLabel, { color: sub }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: card, borderColor: border, color: txt }]}
        placeholder={placeholder} placeholderTextColor={sub}
        value={form[fieldKey]} onChangeText={(v) => setField(fieldKey, v)}
        keyboardType={keyboardType} maxLength={maxLength}
      />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />

      {/* Header */}
      <LinearGradient colors={["#7C3AED", "#5B21B6"]} start={[0,0]} end={[1,1]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>E-Way Bill</Text>
          <Text style={styles.headerSub}>Generate · Track · Cancel EWB</Text>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: card, borderColor: border }]}>
        {(["list", "create"] as const).map((t) => (
          <TouchableOpacity
            key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabLabel, { color: tab === t ? "#7C3AED" : sub }]}>
              {t === "list" ? "📋  My E-Way Bills" : "➕  Generate New"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "list" ? (
        // ── List view ───────────────────────────────────────────
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {listLoading ? (
            <ActivityIndicator color="#7C3AED" size="large" style={{ marginTop: 40 }} />
          ) : ewbs.length === 0 ? (
            <View style={{ alignItems: "center", padding: 40, gap: 12 }}>
              <Ionicons name="car-sport-outline" size={48} color={sub} />
              <Text style={{ color: sub, fontSize: 15, fontFamily: "Inter_600SemiBold" }}>
                No E-Way Bills yet
              </Text>
              <Text style={{ color: sub, fontSize: 13, textAlign: "center" }}>
                Tap "Generate New" to create your first EWB.
              </Text>
            </View>
          ) : (
            ewbs.map((ewb) => (
              <View key={ewb.id} style={[styles.ewbCard, { backgroundColor: card }]}>
                <View style={[styles.ewbIconWrap, { backgroundColor: "#7C3AED18" }]}>
                  <Ionicons name="car-sport" size={24} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ewbParty, { color: txt }]}>{ewb.party_name}</Text>
                  <Text style={[styles.ewbMeta, { color: sub }]}>EWB: {ewb.ewb_no}</Text>
                  {ewb.valid_upto && (
                    <Text style={[styles.ewbMeta, { color: sub }]}>Valid till: {ewb.valid_upto}</Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end", gap: 8 }}>
                  <Text style={[styles.ewbValue, { color: txt }]}>
                    ₹{Number(ewb.total_value).toLocaleString("en-IN")}
                  </Text>
                  {ewb.status === "ACTIVE" ? (
                    <TouchableOpacity style={styles.activeBadge} onPress={() => handleCancel(ewb)}>
                      <Text style={styles.activeBadgeText}>Active · Cancel</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.activeBadge, { backgroundColor: "#FEE2E2" }]}>
                      <Text style={[styles.activeBadgeText, { color: "#991B1B" }]}>Cancelled</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
          <View style={[styles.infoBox, { backgroundColor: "#7C3AED10", borderColor: "#7C3AED30" }]}>
            <Ionicons name="information-circle-outline" size={16} color="#7C3AED" />
            <Text style={{ color: dark ? "#C4B5FD" : "#5B21B6", fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 }}>
              E-Way Bill required for inter-state movement of goods worth ≥ ₹50,000. Must be generated before dispatch.
            </Text>
          </View>
        </ScrollView>
      ) : (
        // ── Create view ─────────────────────────────────────────
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
            <Text style={[styles.sectionHead, { color: txt }]}>Consignment Details</Text>
            <Field label="Invoice / Bill No *"     fieldKey="billNo"      placeholder="e.g. INV-2025-001" />
            <Field label="Consignee / Party Name *" fieldKey="partyName"  placeholder="e.g. Mehta Textiles" />
            <Field label="Taxable Value (₹) *"     fieldKey="value"       placeholder="e.g. 75000" keyboardType="numeric" />
            <Field label="HSN Code"                 fieldKey="hsnCode"    placeholder="e.g. 4901" keyboardType="numeric" maxLength={8} />

            <Text style={[styles.sectionHead, { color: txt, marginTop: 8 }]}>Transport Details</Text>
            <Field label="Vehicle Number"           fieldKey="vehicleNo"  placeholder="e.g. GJ01AB1234" />
            <Field label="Transporter Name"         fieldKey="transporter" placeholder="e.g. Fast Couriers" />
            <Field label="Approx Distance (km)"     fieldKey="distance"   placeholder="e.g. 250" keyboardType="numeric" />

            <Text style={[styles.sectionHead, { color: txt, marginTop: 8 }]}>PIN Codes</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: sub }]}>From PIN *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: card, borderColor: border, color: txt }]}
                  placeholder="380001" placeholderTextColor={sub}
                  value={form.pinFrom} onChangeText={(v) => setField("pinFrom", v)}
                  keyboardType="numeric" maxLength={6}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: sub }]}>To PIN *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: card, borderColor: border, color: txt }]}
                  placeholder="110001" placeholderTextColor={sub}
                  value={form.pinTo} onChangeText={(v) => setField("pinTo", v)}
                  keyboardType="numeric" maxLength={6}
                />
              </View>
            </View>

            <TouchableOpacity onPress={handleGenerate} disabled={loading} style={{ marginTop: 24 }}>
              <LinearGradient colors={["#7C3AED", "#5B21B6"]} start={[0,0]} end={[1,1]} style={styles.generateBtn}>
                {loading
                  ? <><ActivityIndicator color="#fff" size="small" /><Text style={styles.generateBtnText}> Generating…</Text></>
                  : <><Ionicons name="flash" size={18} color="#fff" /><Text style={styles.generateBtnText}> Generate E-Way Bill</Text></>
                }
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 18, paddingTop: Platform.OS === "android" ? 14 : 6, paddingBottom: 18,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 2 },
  tabRow: {
    flexDirection: "row", borderBottomWidth: 1, marginHorizontal: 0,
  },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: "#7C3AED" },
  tabLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  ewbCard: {
    flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 16, gap: 12,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  ewbIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  ewbParty:    { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  ewbMeta:     { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  ewbValue:    { fontSize: 15, fontFamily: "Inter_700Bold" },
  activeBadge: { backgroundColor: "#D1FAE5", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  activeBadgeText: { color: "#065F46", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  infoBox: { flexDirection: "row", gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  sectionHead: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 14 },
  fieldLabel:  { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  generateBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center" },
  generateBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
