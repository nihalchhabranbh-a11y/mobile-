/**
 * BarcodeBillingScreen — Kirana Fast Billing
 *
 * - Live camera barcode scanner (CameraView from expo-camera, SDK 55)
 * - Graceful text-input fallback if camera permission denied or web
 * - Instant product lookup by item_code (barcode field)
 * - Cart with qty controls, customer picker, quick checkout
 * - Creates a full invoice with one tap
 */

import React, {
  useState, useCallback, useRef, useEffect, useReducer
} from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  Alert, Platform, StatusBar, ActivityIndicator, Modal, ScrollView, Vibration,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useSafeScreen } from "../hooks/useSafeScreen";
import { useUser } from "../userContext";
import { lookupByBarcode, getProducts, Product, createProductQuick } from "../services/productsService";
import { getCustomers } from "../services/customersService";
import { createBill, addBillPayment } from "../services/billingService";

// ── Lazy-load expo-camera (graceful fallback if not installed) ─────────────
let CameraView: any = null;
let useCameraPermissions: any = () => [{ granted: false }, async () => {}];
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cam = require("expo-camera");
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch (_) {
  // expo-camera not installed – text-only mode works fine
}

// ── Types ───────────────────────────────────────────────────────────────────
type CartItem = {
  id: string;           /** unique cart row id */
  productId: string | null;
  name: string;
  rate: number;
  qty: number;
  unit: string;
};

type Nav = { navigate: (s: string, p?: any) => void; goBack: () => void; replace: (s: string, p?: any) => void };

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeId() { return Math.random().toString(36).slice(2, 10); }
const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

// ── Cart reducer ─────────────────────────────────────────────────────────────
type CartAction =
  | { type: "ADD"; item: Omit<CartItem, "id" | "qty"> }
  | { type: "INC"; id: string }
  | { type: "DEC"; id: string }
  | { type: "REMOVE"; id: string }
  | { type: "CLEAR" };

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case "ADD": {
      // If same product already in cart, just increment qty
      const existing = action.item.productId
        ? state.findIndex((c) => c.productId === action.item.productId)
        : -1;
      if (existing >= 0) {
        return state.map((c, i) => i === existing ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...state, { ...action.item, id: makeId(), qty: 1 }];
    }
    case "INC":
      return state.map((c) => c.id === action.id ? { ...c, qty: c.qty + 1 } : c);
    case "DEC":
      return state.map((c) => c.id === action.id ? { ...c, qty: Math.max(1, c.qty - 1) } : c);
    case "REMOVE":
      return state.filter((c) => c.id !== action.id);
    case "CLEAR":
      return [];
    default:
      return state;
  }
}

// ── Scan overlay ─────────────────────────────────────────────────────────────
function ScanOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* dark corners */}
      <View style={ovlStyles.topBar} />
      <View style={{ flexDirection: "row", flex: 1 }}>
        <View style={ovlStyles.sideBar} />
        <View style={ovlStyles.window}>
          {/* corner markers */}
          <View style={[ovlStyles.corner, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }]} />
          <View style={[ovlStyles.corner, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }]} />
          <View style={[ovlStyles.corner, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
          <View style={[ovlStyles.corner, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }]} />
          {/* scan line */}
          <View style={ovlStyles.scanLine} />
          <Text style={ovlStyles.scanHint}>Align barcode in frame</Text>
        </View>
        <View style={ovlStyles.sideBar} />
      </View>
      <View style={ovlStyles.bottomBar} />
    </View>
  );
}

const CORNER_SIZE = 28;
const ovlStyles = StyleSheet.create({
  topBar:    { height: 80, backgroundColor: "rgba(0,0,0,0.55)" },
  bottomBar: { height: 80, backgroundColor: "rgba(0,0,0,0.55)" },
  sideBar:   { width: 40, backgroundColor: "rgba(0,0,0,0.55)" },
  window:    { flex: 1, borderWidth: 0 },
  corner:    { position: "absolute", width: CORNER_SIZE, height: CORNER_SIZE, borderColor: "#FF6600" },
  scanLine:  { position: "absolute", left: 8, right: 8, top: "48%", height: 2, backgroundColor: "#FF660090" },
  scanHint:  { position: "absolute", bottom: 10, alignSelf: "center", color: "#ffffff99", fontSize: 12 },
});

// ── Cart row ──────────────────────────────────────────────────────────────────
function CartRow({ item, dispatch }: { item: CartItem; dispatch: React.Dispatch<CartAction> }) {
  return (
    <View style={rowStyles.row}>
      <View style={{ flex: 1 }}>
        <Text style={rowStyles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={rowStyles.rate}>{fmt(item.rate)} / {item.unit || "pc"}</Text>
      </View>
      <View style={rowStyles.qtyWrap}>
        <TouchableOpacity onPress={() => dispatch({ type: "DEC", id: item.id })} style={rowStyles.qtyBtn}>
          <Ionicons name="remove" size={16} color="#FF6600" />
        </TouchableOpacity>
        <Text style={rowStyles.qty}>{item.qty}</Text>
        <TouchableOpacity onPress={() => dispatch({ type: "INC", id: item.id })} style={rowStyles.qtyBtn}>
          <Ionicons name="add" size={16} color="#FF6600" />
        </TouchableOpacity>
      </View>
      <Text style={rowStyles.amt}>{fmt(item.rate * item.qty)}</Text>
      <TouchableOpacity onPress={() => dispatch({ type: "REMOVE", id: item.id })} style={{ paddingLeft: 10 }}>
        <Ionicons name="trash-outline" size={18} color="#DC2626" />
      </TouchableOpacity>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  name:    { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  rate:    { fontSize: 11, color: "#6B7280", marginTop: 2 },
  qtyWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12 },
  qtyBtn:  { width: 28, height: 28, borderRadius: 14, backgroundColor: "#FFF4ED", borderWidth: 1, borderColor: "#FF660033", justifyContent: "center", alignItems: "center" },
  qty:     { fontSize: 14, fontFamily: "Inter_700Bold", color: "#111", minWidth: 20, textAlign: "center" },
  amt:     { fontSize: 14, fontFamily: "Inter_700Bold", color: "#111827", minWidth: 64, textAlign: "right" },
});

// ── Open Food Facts barcode lookup ────────────────────────────────────────────
async function lookupBarcodeOnline(barcode: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { headers: { "User-Agent": "PrintMaster/1.0" } }
    );
    const json = await res.json();
    if (json?.status === 1 && json?.product) {
      const p = json.product;
      // Prefer the most specific name available
      return (
        p.product_name_en ||
        p.product_name ||
        p.abbreviated_product_name ||
        null
      );
    }
    return null;
  } catch {
    return null;
  }
}

// ── Unknown barcode modal ─────────────────────────────────────────────────────
function UnknownBarcodeModal({
  barcode, onAdd, onClose,
}: {
  barcode: string;
  onAdd: (name: string, rate: number) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [fetching, setFetching] = useState(true);   // auto-lookup loading state
  const [autoFound, setAutoFound] = useState(false); // did we find it online?

  // Auto-lookup on mount
  useEffect(() => {
    let cancelled = false;
    setFetching(true);
    lookupBarcodeOnline(barcode).then((found) => {
      if (cancelled) return;
      if (found) {
        setName(found);
        setAutoFound(true);
      }
      setFetching(false);
    });
    return () => { cancelled = true; };
  }, [barcode]);

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <Ionicons name="barcode-outline" size={22} color="#FF6600" />
            <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#111", marginLeft: 8 }}>
              {fetching ? "Looking up barcode…" : autoFound ? "Product Found Online! 🎉" : "New Product"}
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16, fontFamily: "Inter_400Regular" }}>
            Barcode: {barcode}
          </Text>

          {/* Loading spinner while fetching */}
          {fetching ? (
            <View style={{ alignItems: "center", paddingVertical: 24, gap: 10 }}>
              <ActivityIndicator color="#FF6600" size="large" />
              <Text style={{ color: "#6B7280", fontSize: 13 }}>Searching product database…</Text>
            </View>
          ) : (
            <>
              {/* Banner explaining auto-fill status */}
              {autoFound ? (
                <View style={{ backgroundColor: "#F0FDF4", borderRadius: 10, padding: 10, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  <Text style={{ fontSize: 12, color: "#065F46", flex: 1 }}>Name auto-filled from product database. Just enter the price!</Text>
                </View>
              ) : (
                <View style={{ backgroundColor: "#FFFBEB", borderRadius: 10, padding: 10, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="information-circle" size={18} color="#D97706" />
                  <Text style={{ fontSize: 12, color: "#92400E", flex: 1 }}>This barcode is new to our system. Enter the details once, and it will be remembered forever!</Text>
                </View>
              )}

              {/* Product Name */}
              <Text style={{ fontSize: 12, color: "#374151", marginBottom: 6, fontFamily: "Inter_600SemiBold" }}>Product Name *</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: autoFound ? "#10B981" : "#E5E7EB", borderRadius: 12, padding: 12, fontSize: 14, color: "#111", marginBottom: 14, backgroundColor: autoFound ? "#F0FDF4" : "#fff" }}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Maggi 70g"
                autoFocus={!autoFound}
              />

              {/* Price */}
              <Text style={{ fontSize: 12, color: "#374151", marginBottom: 6, fontFamily: "Inter_600SemiBold" }}>Selling Price (₹) *</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, fontSize: 14, color: "#111", marginBottom: 20 }}
                value={rate}
                onChangeText={setRate}
                placeholder="0.00"
                keyboardType="decimal-pad"
                autoFocus={autoFound}
              />

              {/* Buttons */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  onPress={onClose}
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center" }}
                >
                  <Text style={{ color: "#6B7280", fontFamily: "Inter_600SemiBold" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (!name.trim()) return;
                    onAdd(name.trim(), parseFloat(rate) || 0);
                  }}
                  style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: "#FF6600", alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
                >
                  <Ionicons name="save-outline" size={16} color="#fff" />
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold" }}>Save & Add to Cart</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={{ height: Platform.OS === "ios" ? 20 : 4 }} />
        </View>
      </View>
    </Modal>
  );
}


// ── Customer picker modal ─────────────────────────────────────────────────────
function CustomerPickerModal({
  customers, onSelect, onClose,
}: {
  customers: any[];
  onSelect: (c: any | null) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = customers.filter(
    (c) => !q || c.name?.toLowerCase().includes(q.toLowerCase()) || (c.phone || "").includes(q)
  ).slice(0, 20);

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "70%" }}>
          <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#111", marginBottom: 12 }}>Select Customer</Text>
          <TextInput
            style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 10, fontSize: 14, color: "#111", marginBottom: 12 }}
            value={q} onChangeText={setQ} placeholder="Search name or phone…" autoFocus
          />
          <TouchableOpacity onPress={() => onSelect(null)} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}>
            <Text style={{ color: "#FF6600", fontFamily: "Inter_600SemiBold" }}>Walk-in Customer (Cash)</Text>
          </TouchableOpacity>
          <ScrollView style={{ maxHeight: 300 }}>
            {filtered.map((c) => (
              <TouchableOpacity key={c.id} onPress={() => onSelect(c)} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111" }}>{c.name}</Text>
                {c.phone ? <Text style={{ fontSize: 12, color: "#6B7280" }}>{c.phone}</Text> : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={onClose} style={{ paddingVertical: 14, alignItems: "center", marginTop: 8 }}>
            <Text style={{ color: "#6B7280" }}>Cancel</Text>
          </TouchableOpacity>
          <View style={{ height: Platform.OS === "ios" ? 20 : 4 }} />
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 14,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  headerSub:   { color: "#94A3B8", fontSize: 11, marginTop: 1 },
  cartBadge:   { padding: 8, position: "relative" },
  badge: {
    position: "absolute", top: 2, right: 2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#FF6600", justifyContent: "center", alignItems: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },

  cameraSection: {
    height: 220, backgroundColor: "#0F172A", overflow: "hidden",
    borderBottomWidth: 1, borderBottomColor: "#1E293B",
  },

  permBox: {
    flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24,
  },
  permText:    { color: "#94A3B8", fontSize: 13, textAlign: "center" },
  permBtn:     { backgroundColor: "#FF6600", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  permBtnText: { color: "#fff", fontFamily: "Inter_700Bold" },

  noCamBox: {
    flex: 1, justifyContent: "center", alignItems: "center", gap: 8,
  },
  noCamText: { color: "#94A3B8", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center", alignItems: "center",
  },

  // ── Success toast shown after scan finds a product ────────────────
  toastOverlay: {
    position: "absolute",
    bottom: 14,
    left: 16,
    right: 16,
    backgroundColor: "rgba(16,185,129,0.92)",   // green
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  toastText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },

  manualRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#1E293B",
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#0F172A",
  },
  manualInput: {
    flex: 1, color: "#F8FAFC", fontSize: 14, fontFamily: "Inter_400Regular",
    paddingVertical: 6,
  },
  manualGo: {
    backgroundColor: "#FF6600", borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 7, marginLeft: 8,
  },

  cartSection: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 6,
  },
  cartHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  cartHeaderTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151" },
  cartHeaderAmt:   { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827" },

  customerRow: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: "#F3F4F6",
  },
  totalsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: "#F3F4F6",
  },
  totalAmt: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#111827" },
  billBtn:  { borderRadius: 14, overflow: "hidden" },
  billBtnGrad: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 22, paddingVertical: 14,
  },
  billBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});



export const BarcodeBillingScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { user } = useUser();
  const insets = useSafeScreen();

  // Camera permission
  const [permission, requestPermission] = useCameraPermissions();

  // State
  const [cart, dispatch] = useReducer(cartReducer, []);
  const [scanning, setScanning] = useState(false);        // loading after scan
  const [paused, setPaused] = useState(false);            // pause camera after each scan
  const [manualBarcode, setManualBarcode] = useState(""); // text fallback
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showUnknown, setShowUnknown] = useState<string | null>(null); // barcode value
  const [saving, setSaving] = useState(false);
  const [showCart, setShowCart] = useState(false);        // toggle cart drawer on mobile
  const lastScanned = useRef("");                          // debounce duplicate scans

  const subtotal = cart.reduce((s, c) => s + c.rate * c.qty, 0);
  const totalQty  = cart.reduce((s, c) => s + c.qty, 0);
  const orgId = user?.organisationId;

  // Load customers once
  useEffect(() => {
    getCustomers(orgId).then(setCustomers).catch(() => {});
  }, [orgId]);

  // Toast state for quick success feedback
  const [toast, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  // ── Handle barcode detected ────────────────────────────────────────────────
  const handleBarcode = useCallback(async (code: string) => {
    const clean = (code || "").trim();
    if (!clean || clean === lastScanned.current) return;
    lastScanned.current = clean;
    setPaused(true);     // stop camera scanning until processed
    Vibration.vibrate(80);

    try {
      setScanning(true);

      // Safety check — if no orgId, we can't look anything up
      if (!orgId) {
        Alert.alert("Not logged in", "Please log in before using the barcode scanner.");
        setPaused(false);
        lastScanned.current = "";
        return;
      }

      const product = await lookupByBarcode(clean, orgId);
      if (product) {
        dispatch({
          type: "ADD",
          item: {
            productId: product.id,
            name: product.name,
            rate: product.default_rate,
            unit: product.unit || "pc",
          },
        });
        showToast(`✓ ${product.name}  ₹${product.default_rate}`);
        // Resume scan after short pause
        setTimeout(() => { setPaused(false); lastScanned.current = ""; }, 1200);
      } else {
        // Product not in DB — open modal to register it
        setShowUnknown(clean);
      }
    } catch (e) {
      Alert.alert("Scan error", "Could not look up product. Check your connection.");
      setPaused(false);
      lastScanned.current = "";
    } finally {
      setScanning(false);
    }
  }, [orgId]);

  // ── Manual barcode submit ──────────────────────────────────────────────────
  const submitManual = () => {
    const v = manualBarcode.trim();
    if (v) { handleBarcode(v); setManualBarcode(""); }
  };

  // ── Create bill ────────────────────────────────────────────────────────────
  const handleCreateBill = async () => {
    if (!cart.length) { Alert.alert("Empty cart", "Add at least one item."); return; }
    try {
      setSaving(true);
      const id = Math.random().toString(36).slice(2, 18);
      const customerName = selectedCustomer?.name || "Walk-in Customer";
      const phone = selectedCustomer?.phone || null;
      const items = cart.map((c) => ({
        name: c.name,
        qty: c.qty,
        rate: c.rate,
        taxRate: 0,
        amount: parseFloat((c.rate * c.qty).toFixed(2)),
      }));
      await createBill({
        id,
        customer: customerName,
        phone,
        items,
        subtotal,
        gstAmt: 0,
        total: subtotal,
        gst: false,
        paid: false,
        status: "final",
        organisationId: orgId,
      });
      dispatch({ type: "CLEAR" });
      navigation.replace("InvoiceDetail", { billId: id });
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to create bill.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const useCameraScanner = Platform.OS !== "web" && CameraView !== null;
  const hasCamera = useCameraScanner && permission?.granted;

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={["#0F172A", "#1E293B"]}
        style={[styles.header, { paddingTop: insets.paddingTop || 44 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Fast Billing</Text>
          <Text style={styles.headerSub}>Scan barcodes to add items</Text>
        </View>
        {/* Cart badge */}
        <TouchableOpacity onPress={() => setShowCart(!showCart)} style={styles.cartBadge}>
          <Ionicons name="cart" size={22} color="#fff" />
          {cart.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{totalQty}</Text>
            </View>
          )}
        </TouchableOpacity>
      </LinearGradient>

      <View style={{ flex: 1 }}>
        {/* ── Camera section ──────────────────────────────────────────── */}
        {!showCart && (
          <View style={styles.cameraSection}>
            {useCameraScanner && !permission?.granted ? (
              /* Permission prompt */
              <View style={styles.permBox}>
                <Ionicons name="camera-outline" size={52} color="#475569" />
                <Text style={styles.permText}>Camera access needed for barcode scanning</Text>
                <TouchableOpacity onPress={requestPermission} style={styles.permBtn}>
                  <Text style={styles.permBtnText}>Allow Camera</Text>
                </TouchableOpacity>
              </View>
            ) : hasCamera ? (
              /* Live camera */
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                onBarcodeScanned={paused ? undefined : ({ data }: { data: string }) => handleBarcode(data)}
                barcodeScannerSettings={{
                  barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"],
                }}
              >
                <ScanOverlay />
                {scanning && (
                  <View style={styles.scanningOverlay}>
                    <ActivityIndicator color="#FF6600" size="large" />
                    <Text style={{ color: "#fff", marginTop: 8 }}>Looking up product…</Text>
                  </View>
                )}
                {/* ── Success toast ─── */}
                {toast && !scanning && (
                  <View style={styles.toastOverlay}>
                    <Text style={styles.toastText}>{toast}</Text>
                  </View>
                )}
              </CameraView>
            ) : (
              /* Web / no camera fallback */
              <View style={styles.noCamBox}>
                <Ionicons name="barcode-outline" size={56} color="#475569" />
                <Text style={styles.noCamText}>Camera scanner not available</Text>
                <Text style={{ color: "#64748B", fontSize: 12, textAlign: "center", marginTop: 4 }}>Use the text field below to enter barcodes manually</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Manual barcode input ─────────────────────────────────────── */}
        <View style={styles.manualRow}>
          <Ionicons name="barcode-outline" size={20} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.manualInput}
            value={manualBarcode}
            onChangeText={setManualBarcode}
            onSubmitEditing={submitManual}
            placeholder="Enter or scan barcode…"
            placeholderTextColor="#64748B"
            returnKeyType="search"
            keyboardType="default"
            blurOnSubmit={false}
          />
          {manualBarcode.length > 0 && (
            <TouchableOpacity onPress={submitManual} style={styles.manualGo}>
              <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 }}>GO</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Cart ────────────────────────────────────────────────────── */}
        <View style={[styles.cartSection, showCart && { flex: 1 }]}>
          {/* Header strip */}
          <TouchableOpacity
            onPress={() => setShowCart(!showCart)}
            style={styles.cartHeader}
            activeOpacity={0.8}
          >
            <Text style={styles.cartHeaderTitle}>
              {cart.length === 0 ? "Cart is empty" : `${totalQty} item${totalQty !== 1 ? "s" : ""} in cart`}
            </Text>
            <Text style={styles.cartHeaderAmt}>{fmt(subtotal)}</Text>
            <Ionicons name={showCart ? "chevron-down" : "chevron-up"} size={18} color="#6B7280" style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          {showCart && (
            <>
              <FlatList
                data={cart}
                keyExtractor={(c) => c.id}
                renderItem={({ item }) => <CartRow item={item} dispatch={dispatch} />}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
                ListEmptyComponent={
                  <View style={{ alignItems: "center", paddingVertical: 24 }}>
                    <Ionicons name="cart-outline" size={36} color="#D1D5DB" />
                    <Text style={{ color: "#9CA3AF", marginTop: 8 }}>Scan items to add</Text>
                  </View>
                }
                style={{ maxHeight: 260 }}
              />

              {/* Customer */}
              <TouchableOpacity
                onPress={() => setShowCustomerPicker(true)}
                style={styles.customerRow}
              >
                <Ionicons name="person-circle-outline" size={20} color="#FF6600" style={{ marginRight: 8 }} />
                <Text style={{ flex: 1, color: selectedCustomer ? "#111827" : "#9CA3AF", fontSize: 14 }}>
                  {selectedCustomer ? selectedCustomer.name : "Walk-in Customer (tap to change)"}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>

              {/* Totals */}
              <View style={styles.totalsRow}>
                <View>
                  <Text style={{ color: "#6B7280", fontSize: 12 }}>Grand Total</Text>
                  <Text style={styles.totalAmt}>{fmt(subtotal)}</Text>
                </View>
                <TouchableOpacity
                  onPress={handleCreateBill}
                  disabled={saving || cart.length === 0}
                  style={[styles.billBtn, (saving || cart.length === 0) && { opacity: 0.5 }]}
                >
                  <LinearGradient colors={["#FF8A33", "#FF5500"]} start={[0, 0]} end={[1, 1]} style={styles.billBtnGrad}>
                    {saving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <>
                          <Ionicons name="receipt-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                          <Text style={styles.billBtnText}>Create Bill</Text>
                        </>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>

      {/* ── Unknown barcode modal ────────────────────────────────────── */}
      {showUnknown && (
        <UnknownBarcodeModal
          barcode={showUnknown}
          onAdd={async (name, rate) => {
            const barcode = showUnknown;
            setShowUnknown(null);

            if (!orgId) {
              Alert.alert("Not logged in", "Cannot save product — please log in first.");
              return;
            }
            
            try {
              setScanning(true);
              const created = await createProductQuick({
                name,
                defaultRate: rate,
                taxRate: 0,
                itemCode: barcode,          // ← this is the scanned barcode code
                organisationId: orgId,
              });
              
              if (created) {
                dispatch({ 
                  type: "ADD", 
                  item: { productId: created.id, name: created.name, rate: created.default_rate, unit: "pc" } 
                });
                showToast(`✓ Saved: ${created.name}  ₹${created.default_rate}`);
              }
            } catch (e: any) {
              // Log the real error so we can debug it
              console.error("[BarcodeBilling] createProductQuick failed:", e?.message ?? e);
              Alert.alert("Save failed", `Product NOT saved to database.\n\nReason: ${e?.message ?? "Unknown error"}\n\nCheck Metro logs for details.`);
              // Still add to cart so the current sale isn't blocked
              dispatch({ type: "ADD", item: { productId: null, name, rate, unit: "pc" } });
            } finally {
              setScanning(false);
              setPaused(false);
              lastScanned.current = "";
            }
          }}
          onClose={() => { setShowUnknown(null); setPaused(false); lastScanned.current = ""; }}
        />
      )}

      {/* ── Customer picker modal ────────────────────────────────────── */}
      {showCustomerPicker && (
        <CustomerPickerModal
          customers={customers}
          onSelect={(c) => { setSelectedCustomer(c); setShowCustomerPicker(false); }}
          onClose={() => setShowCustomerPicker(false)}
        />
      )}
    </View>
  );
};
