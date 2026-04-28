import React, { useEffect, useState, useMemo, useCallback } from "react";
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



  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [b, p, sig, att] = await Promise.all([
        fetchBillById(billId, user?.organisationId),
        fetchBillPayments(user?.organisationId ?? undefined),
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
  }, [billId, user?.organisationId]);

  useEffect(() => {
    if (!billId) {
      Alert.alert("Error", "No Bill ID provided");
      navigation.goBack();
      return;
    }
    loadData();
  }, [billId, loadData, navigation]);

  const handleDelete = () => {
    Alert.alert("Delete Invoice", `Are you sure you want to delete ${billId}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteBill(billId, user?.organisationId);
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
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.textPrimary} />
      </View>
    );
  }

  const isPaid = info.isPaid;
  const statusColor = isPaid ? "#16A34A" : "#EA580C"; // Green if paid, Orange if pending
  const statusText = isPaid ? "Paid" : "Pending";

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
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
            <Ionicons name="trash-outline" size={20} color={colors.accentRed || "#DC2626"} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* CUSTOMER DETAILS */}
        <Text style={styles.sectionHeader}>Customer Details</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.rowBetween}>
            <Text style={styles.customerName}>{bill.customer}</Text>
            <Ionicons name="chevron-down" size={20} color={colors.textPrimary} />
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
                  <Text style={styles.itemTitle}>{item.name ?? "Item"} <Ionicons name="chevron-up" size={14} color={colors.textPrimary} /></Text>
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
                  <Text style={styles.itemPropLabel}>Total Tax <Text style={{ fontSize: 9 }}>({(item as any).taxRate ?? 0}%)</Text></Text>
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
            <Text style={[styles.summaryLabel, { fontWeight: "700", color: colors.textPrimary }]}>Total Amount</Text>
            <Text style={[styles.summaryVal, { fontWeight: "700", color: colors.textPrimary }]}>{fmtCurrency(bill.total)}</Text>
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
            <Ionicons name="cash-outline" size={24} color={colors.textPrimary} style={{ marginRight: 12 }} />
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
              <Ionicons name="pencil-outline" size={24} color={colors.textPrimary} style={{ marginRight: 12 }} />
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
              <Ionicons name="attach-outline" size={24} color={colors.textPrimary} style={{ marginRight: 12 }} />
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
            <Ionicons name="document-text-outline" size={18} color={colors.textPrimary} style={{ marginRight: 6 }} />
            <Text style={styles.bottomBarText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBarBtn} onPress={() => navigation.navigate("Payments", { billId: bill.id })}>
            <Ionicons name="wallet-outline" size={18} color={colors.textPrimary} style={{ marginRight: 6 }} />
            <Text style={styles.bottomBarText}>Record</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBarBtnShare} onPress={handleShare}>
            <Ionicons name="paper-plane-outline" size={18} color="#16A34A" style={{ marginRight: 6 }} />
            <Text style={styles.bottomBarTextShare}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBarBtnMore} onPress={() => navigation.navigate("InvoiceCreate", { editBillId: bill.id })}>
            <Ionicons name="create-outline" size={18} color={colors.textPrimary} />
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

const createStyles = (colors: any) => StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: Platform.OS === "ios" ? 50 : 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  headerBtn: { padding: 4 },
  headerTitleContainer: { flex: 1, paddingLeft: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  headerSubtitleRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  headerSubtitle: { fontSize: 13, color: colors.textSecondary },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  editBtn: { backgroundColor: colors.cardBorder, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 },
  editBtnText: { color: colors.textPrimary, fontWeight: "600", fontSize: 13 },
  moreBtn: { padding: 4 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionHeader: { fontSize: 14, fontWeight: "600", color: colors.textSecondary, marginTop: 20, marginBottom: 8, paddingLeft: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, borderWidth: 1, borderColor: colors.cardBorder },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  customerName: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  labelMuted: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  dateVal: { fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginTop: 2 },
  seeMore: { color: colors.accentBlue || "#2563EB", fontWeight: "600", fontSize: 14, marginTop: 12 },
  itemBorderTop: { borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 16, marginTop: 16 },
  itemTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  itemTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  itemTitleVal: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  itemPropRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  itemPropLabel: { fontSize: 13, color: colors.textSecondary },
  itemPropVal: { fontSize: 13, color: colors.textSecondary },
  itemDesc: { fontSize: 13, color: colors.textMuted, marginTop: 4, fontStyle: "italic" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  summaryLabel: { fontSize: 15, color: colors.textSecondary },
  summaryVal: { fontSize: 15, color: colors.textPrimary, fontWeight: "500" },
  summaryPendingVal: { fontSize: 15, color: colors.accentRed || "#DC2626", fontWeight: "600" },
  otherRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  otherTitle: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  otherSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  otherDivider: { height: 1, backgroundColor: colors.cardBorder },
  bottomBarContainer: { position: "absolute", bottom: 20, left: 16, right: 16 },
  bottomBarCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 30, paddingHorizontal: 12, paddingVertical: 10, elevation: 6, shadowColor: "#000", shadowOpacity: 0.1, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, justifyContent: "space-between", borderWidth: 1, borderColor: colors.cardBorder },
  bottomBarBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.background, borderRadius: 20, flex: 1, justifyContent: "center", marginHorizontal: 4 },
  bottomBarText: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  bottomBarBtnShare: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.mode === 'dark' ? "rgba(22, 163, 74, 0.2)" : "#DCFCE7", borderRadius: 20, flex: 1, justifyContent: "center", marginHorizontal: 4 },
  bottomBarTextShare: { fontSize: 13, fontWeight: "600", color: "#16A34A" },
  bottomBarBtnMore: { padding: 8, marginHorizontal: 4 },
});
