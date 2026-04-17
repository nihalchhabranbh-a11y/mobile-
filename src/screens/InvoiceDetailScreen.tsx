import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useTheme } from "../src/themeContext";
import {
  fetchBillById,
  fetchBillPayments,
  BillWithItems,
  BillPayment,
  deleteBill,
} from "../src/services/billingService";
import { getBillPaymentInfo, fmtCurrency } from "../src/utils/billingUtils";
import { shareBillViaWhatsApp } from "../src/utils/invoiceShare";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Image } from "react-native";
import { InvoiceViewModal } from "../src/components/InvoiceViewModal";
import { loadBrand } from "../src/services/settingsService";
import { useUser } from "../src/userContext";

// Modern Light Grey Background theme per screenshot
const BG = "#F4F5F7";
const TX_MAIN = "#1F2937";
const TX_MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const CARD_BG = "#FFFFFF";

export function InvoiceDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [bill, setBill] = useState<BillWithItems | null>(null);
  const [payments, setPayments] = useState<BillPayment[]>([]);
  
  const [signatureUri, setSignatureUri] = useState<string | null>(null);
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const { user } = useUser();
  const [brand, setBrand] = useState<any>(null);

  const billId = route.params?.billId;

  useEffect(() => {
    if (!billId) {
      Alert.alert("Error", "No Bill ID provided");
      navigation.goBack();
      return;
    }
    loadData();
  }, [billId]);

  async function loadData() {
    try {
      setLoading(true);
      const [b, p, sig, att] = await Promise.all([
        fetchBillById(billId),
        fetchBillPayments(),
        AsyncStorage.getItem(`invoice_signature_${billId}`),
        AsyncStorage.getItem(`invoice_attachment_${billId}`),
      ]);
      setBill(b);
      setPayments(p.filter((x) => x.billId === billId));
      if (sig) setSignatureUri(sig);
      if (att) setAttachmentUri(att);
      // Load brand for invoice header
      const br = await loadBrand(user?.organisationId ?? null);
      setBrand(br);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e.message || "Failed to load bill");
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = () => {
    Alert.alert("Delete Invoice", `Are you sure you want to delete ${billId}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteBill(billId);
            navigation.goBack();
          } catch (e: any) {
            Alert.alert("Error", e.message || "Failed");
          }
        },
      },
    ]);
  };

  const handleShare = async () => {
    if (!bill) return;
    try {
      await shareBillViaWhatsApp({
        bill: { ...bill, customerPhone: bill.phone } as any,
        billPayments: payments,
        brand: brand ?? undefined,
      });
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e.message || "Could not launch Share");
    }
  };

  const info = useMemo(() => {
    if (!bill) return null;
    return getBillPaymentInfo(bill as any, payments);
  }, [bill, payments]);

  const handlePickImage = async (type: "signature" | "attachment") => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        if (type === "signature") {
          setSignatureUri(uri);
          await AsyncStorage.setItem(`invoice_signature_${billId}`, uri);
        } else {
          setAttachmentUri(uri);
          await AsyncStorage.setItem(`invoice_attachment_${billId}`, uri);
        }
      }
    } catch (e: any) {
      Alert.alert("Error", "Could not pick image");
    }
  };

  if (loading || !bill || !info) {
    return (
      <View style={[styles.loading, { backgroundColor: BG }]}>
        <ActivityIndicator size="large" color="#1F2937" />
      </View>
    );
  }

  const isPaid = info.isPaid;
  const statusColor = isPaid ? "#16A34A" : "#EA580C"; // Green if paid, Orange if pending
  const statusText = isPaid ? "Paid" : "Pending";

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={TX_MAIN} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{bill.id}</Text>
          <View style={styles.headerSubtitleRow}>
            <Text style={styles.headerSubtitle}>Invoice • </Text>
            <Text style={[styles.headerSubtitle, { color: statusColor, fontWeight: "600" }]}>
              {statusText.toLowerCase()}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate("InvoiceCreate", { editBillId: bill.id })}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.moreBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* CUSTOMER DETAILS */}
        <Text style={styles.sectionHeader}>Customer Details</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.rowBetween}>
            <Text style={styles.customerName}>{bill.customer}</Text>
            <Ionicons name="chevron-down" size={20} color={TX_MAIN} />
          </TouchableOpacity>
          <Text style={styles.labelMuted}>Invoice Date</Text>
          <Text style={styles.dateVal}>
            {new Date(bill.createdAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </Text>
          {(bill.phone) && <Text style={styles.dateVal}>Ph: {bill.phone}</Text>}
          <TouchableOpacity onPress={() => navigation.navigate("InvoiceCreate", { editBillId: bill.id })}>
            <Text style={styles.seeMore}>Edit Customer</Text>
          </TouchableOpacity>
        </View>

        {/* ITEMS */}
        <Text style={styles.sectionHeader}>Items ({bill.items?.length || 0})</Text>
        <View style={styles.card}>
          {bill.items?.map((item, idx) => {
            const rowAmount = (item.amount || (item.qty || 1) * (item.rate || 0));
            return (
              <View key={`${item.name ?? 'item'}-${idx}`} style={idx > 0 ? styles.itemBorderTop : {}}>
                <View style={styles.itemTitleRow}>
                  <Text style={styles.itemTitle}>{item.name ?? "Item"} <Ionicons name="chevron-up" size={14} color={TX_MAIN} /></Text>
                  <Text style={styles.itemTitleVal}>{fmtCurrency(rowAmount)}</Text>
                </View>
                
                <View style={styles.itemPropRow}>
                  <Text style={styles.itemPropLabel}>Price with Tax</Text>
                  <Text style={styles.itemPropVal}>{fmtCurrency(item.rate || 0)}</Text>
                </View>

                <View style={styles.itemPropRow}>
                  <Text style={styles.itemPropLabel}>Quantity</Text>
                  <Text style={styles.itemPropVal}>{item.qty || 1} OTH</Text>
                </View>

                <View style={styles.itemPropRow}>
                  <Text style={styles.itemPropLabel}>Net Amount</Text>
                  <Text style={styles.itemPropVal}>{fmtCurrency(rowAmount)}</Text>
                </View>
                                <View style={styles.itemPropRow}>
                  <Text style={styles.itemPropLabel}>Total Tax <Text style={{fontSize:9}}>({(item as any).taxRate ?? 0}%)</Text></Text>
                  <Text style={styles.itemPropVal}>{fmtCurrency(((item.amount || (item.qty || 1) * (item.rate || 0))) * ((item as any).taxRate ?? 0) / 100)}</Text>
                </View>

                {String((item as any).description || "").trim() ? (
                  <Text style={styles.itemDesc} numberOfLines={2}>
                    {String((item as any).description).trim()}
                  </Text>
                ) : (
                  <Text style={styles.itemDesc}>Invoice item</Text>
                )}
              </View>
            );
          })}
          <TouchableOpacity style={{ marginTop: 8 }} onPress={() => navigation.navigate("InvoiceCreate", { editBillId: bill.id })}>
            <Text style={styles.seeMore}>Edit Items</Text>
          </TouchableOpacity>
        </View>

        {/* SUMMARY */}
        <Text style={styles.sectionHeader}>Bill Summary</Text>
        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal ({bill.items?.length || 0} item{bill.items?.length !== 1 && 's'})</Text>
            <Text style={styles.summaryVal}>{fmtCurrency(bill.subtotal ?? bill.total)}</Text>
          </View>
          <View style={[styles.summaryRow, { marginTop: 12, marginBottom: 8 }]}>
            <Text style={[styles.summaryLabel, { fontWeight: "700", color: TX_MAIN }]}>Total Amount</Text>
            <Text style={[styles.summaryVal, { fontWeight: "700", color: TX_MAIN }]}>{fmtCurrency(bill.total)}</Text>
          </View>
          {info.remaining > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Pending</Text>
              <Text style={styles.summaryPendingVal}>{fmtCurrency(info.remaining)}</Text>
            </View>
          )}
        </View>

        {/* OTHERS */}
        <Text style={styles.sectionHeader}>Others...</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.otherRow} onPress={() => navigation.navigate("Payments", { billId: bill.id })}>
            <Ionicons name="cash-outline" size={24} color={TX_MAIN} style={{marginRight: 12}} />
            <View style={{ flex: 1 }}>
              <Text style={styles.otherTitle}>Total Paid</Text>
              <Text style={styles.otherSubtitle}>{fmtCurrency(info.paidAmount)}</Text>
            </View>
            <Text style={styles.seeMore}>Change</Text>
          </TouchableOpacity>

          <View style={styles.otherDivider} />
          
          <TouchableOpacity style={styles.otherRow} onPress={() => handlePickImage("signature")}>
            {signatureUri ? (
              <Image source={{ uri: signatureUri }} style={{ width: 40, height: 40, borderRadius: 8, marginRight: 12 }} resizeMode="cover" />
            ) : (
              <Ionicons name="pencil-outline" size={24} color={TX_MAIN} style={{marginRight: 12}} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.otherTitle}>{signatureUri ? "Signature Added" : "No Signature is selected"}</Text>
              <Text style={styles.otherSubtitle}>Signature</Text>
            </View>
            <Text style={styles.seeMore}>{signatureUri ? "Change" : "Add"}</Text>
          </TouchableOpacity>

          <View style={styles.otherDivider} />

          <TouchableOpacity style={styles.otherRow} onPress={() => handlePickImage("attachment")}>
            {attachmentUri ? (
              <Image source={{ uri: attachmentUri }} style={{ width: 40, height: 40, borderRadius: 8, marginRight: 12 }} resizeMode="cover" />
            ) : (
              <Ionicons name="attach-outline" size={24} color={TX_MAIN} style={{marginRight: 12}} />
            )}
            <View style={{ flex: 1 }}>
               <Text style={styles.otherTitle}>{attachmentUri ? "1 Attachment Added" : "Add Attachment"}</Text>
               <Text style={styles.otherSubtitle}>Attachment</Text>
            </View>
            <Text style={[styles.seeMore, {fontSize: attachmentUri ? 14 : 20}]}>{attachmentUri ? "Change" : "+"}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* BOTTOM ACTIONS */}
      <View style={styles.bottomBarContainer}>
        <View style={styles.bottomBarCard}>
          <TouchableOpacity style={styles.bottomBarBtn} onPress={() => setViewModalOpen(true)}>
            <Ionicons name="document-text-outline" size={18} color={TX_MAIN} style={{marginRight: 6}} />
            <Text style={styles.bottomBarText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBarBtn} onPress={() => navigation.navigate("Payments", { billId: bill.id })}>
            <Ionicons name="wallet-outline" size={18} color={TX_MAIN} style={{marginRight: 6}} />
            <Text style={styles.bottomBarText}>Record</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBarBtnShare} onPress={handleShare}>
            <Ionicons name="paper-plane-outline" size={18} color="#16A34A" style={{marginRight: 6}} />
            <Text style={styles.bottomBarTextShare}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBarBtnMore} onPress={() => navigation.navigate("InvoiceCreate", { editBillId: bill.id })}>
            <Ionicons name="create-outline" size={18} color={TX_MAIN} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Professional Invoice View Modal */}
      {bill && (
        <InvoiceViewModal
          visible={viewModalOpen}
          bill={bill}
          payments={payments}
          onClose={() => setViewModalOpen(false)}
          onShare={() => { setViewModalOpen(false); handleShare(); }}
          brand={brand}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === "ios" ? 50 : 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BG,
  },
  headerBtn: { padding: 4 },
  headerTitleContainer: { flex: 1, paddingLeft: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: TX_MAIN },
  headerSubtitleRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  headerSubtitle: { fontSize: 13, color: TX_MUTED },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  editBtn: { backgroundColor: "#E5E7EB", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 },
  editBtnText: { color: TX_MAIN, fontWeight: "600", fontSize: 13 },
  moreBtn: { padding: 4 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionHeader: { fontSize: 14, fontWeight: "600", color: "#6B7280", marginTop: 20, marginBottom: 8, paddingLeft: 4 },
  card: { backgroundColor: CARD_BG, borderRadius: 12, padding: 16, elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  customerName: { fontSize: 16, fontWeight: "700", color: TX_MAIN },
  labelMuted: { fontSize: 13, color: TX_MUTED, marginTop: 4 },
  dateVal: { fontSize: 14, color: TX_MAIN, fontWeight: "500", marginTop: 2 },
  seeMore: { color: "#2563EB", fontWeight: "600", fontSize: 14, marginTop: 12 },
  itemBorderTop: { borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 16, marginTop: 16 },
  itemTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  itemTitle: { fontSize: 15, fontWeight: "700", color: TX_MAIN },
  itemTitleVal: { fontSize: 15, fontWeight: "700", color: TX_MAIN },
  itemPropRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  itemPropLabel: { fontSize: 13, color: TX_MUTED },
  itemPropVal: { fontSize: 13, color: TX_MUTED },
  itemDesc: { fontSize: 13, color: TX_MUTED, marginTop: 4, fontStyle: "italic" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  summaryLabel: { fontSize: 15, color: TX_MUTED },
  summaryVal: { fontSize: 15, color: TX_MAIN, fontWeight: "500" },
  summaryPendingVal: { fontSize: 15, color: "#DC2626", fontWeight: "600" },
  otherRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  otherTitle: { fontSize: 15, fontWeight: "600", color: TX_MAIN },
  otherSubtitle: { fontSize: 13, color: TX_MUTED, marginTop: 2 },
  otherDivider: { height: 1, backgroundColor: BORDER },
  bottomBarContainer: { position: "absolute", bottom: 20, left: 16, right: 16 },
  bottomBarCard: { flexDirection: "row", alignItems: "center", backgroundColor: CARD_BG, borderRadius: 30, paddingHorizontal: 12, paddingVertical: 10, elevation: 6, shadowColor: "#000", shadowOpacity: 0.1, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, justifyContent: "space-between" },
  bottomBarBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: BG, borderRadius: 20, flex: 1, justifyContent: "center", marginHorizontal: 4 },
  bottomBarText: { fontSize: 13, fontWeight: "600", color: TX_MAIN },
  bottomBarBtnShare: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#DCFCE7", borderRadius: 20, flex: 1, justifyContent: "center", marginHorizontal: 4 },
  bottomBarTextShare: { fontSize: 13, fontWeight: "600", color: "#16A34A" },
  bottomBarBtnMore: { padding: 8, marginHorizontal: 4 },
});
