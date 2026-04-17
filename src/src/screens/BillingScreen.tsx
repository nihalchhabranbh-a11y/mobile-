import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  FlatList,
  Modal,
  Keyboard,
  Animated,
  Linking,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../themeContext";
import { useUser } from "../userContext";
import {
  BillingCustomer,
  BillingProduct,
  NewBillItem,
  createBill,
  fetchCustomers,
  fetchProducts,
  fetchRecentBills,
  fetchBills,
  fetchBillPayments,
  addBillPayment,
  deleteBill,
  fetchBillById,
  RecentBill,
  BillPayment,
  BillWithItems,
} from "../services/billingService";
import { createCustomerQuick } from "../services/customersService";
import { createProductQuick } from "../services/productsService";
import {
  shareBillViaWhatsApp,
  buildInvoiceWhatsAppMessage,
  WEB_BASE_URL,
} from "../utils/invoiceShare";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBillPaymentInfo } from "../utils/billingUtils";
import { useSafeScreen } from "../hooks/useSafeScreen";
import { ListRow } from "../components/ui";
import { PaywallModal } from "../components/PaywallModal";

type PaymentMethod = "Cash" | "UPI" | "Bank" | "Card";

export const BillingScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeScreen();
  const { user } = useUser();
  const styles = useMemo(
    () => createStyles({ colors, spacing, radius }),
    [colors, spacing, radius]
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /** List view: 'list' = bills list, 'create' = new invoice form */
  const [viewMode, setViewMode] = useState<"list" | "create">("list");
  const [bills, setBills] = useState<RecentBill[]>([]);
  const [billPayments, setBillPayments] = useState<BillPayment[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [invoiceModalBill, setInvoiceModalBill] = useState<RecentBill | null>(null);
  const [invoiceFullBill, setInvoiceFullBill] = useState<BillWithItems | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [paymentModalBill, setPaymentModalBill] = useState<RecentBill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethodForModal, setPaymentMethodForModal] = useState<PaymentMethod>("Cash");
  const [savingPayment, setSavingPayment] = useState(false);
  const [whatsAppPreviewBill, setWhatsAppPreviewBill] = useState<RecentBill | null>(null);
  const [whatsAppTemplate, setWhatsAppTemplate] = useState<string | null>(null);

  const [customers, setCustomers] = useState<BillingCustomer[]>([]);
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [recentBills, setRecentBills] = useState<RecentBill[]>([]);

  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<BillingCustomer | null>(
    null
  );

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<NewBillItem[]>([
    { name: "", description: "", qty: 1, rate: 0, taxRate: 0, amount: 0 },
  ]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [markAsPaid, setMarkAsPaid] = useState(true);
  const [isGstInvoice, setIsGstInvoice] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");

  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductRate, setNewProductRate] = useState("");
  const [newProductTaxRate, setNewProductTaxRate] = useState("");
  const [newProductUnit, setNewProductUnit] = useState("");
  const [newProductHsn, setNewProductHsn] = useState("");

  const [partyPickerVisible, setPartyPickerVisible] = useState(false);
  const [itemPickerVisible, setItemPickerVisible] = useState<null | number>(null);
  const [itemSearch, setItemSearch] = useState("");

  // SQFT calculator (UI helper for printing jobs)
  const [sqftModalIndex, setSqftModalIndex] = useState<number | null>(null);
  const [sqftWidth, setSqftWidth] = useState("");
  const [sqftHeight, setSqftHeight] = useState("");
  const [sqftRate, setSqftRate] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);

  const limitReached = useMemo(() => {
    if (user?.organisationPlan && user.organisationPlan !== "free") return false;
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todaysBills = bills.filter(b => b.createdAt && new Date(b.createdAt) >= todayStart);
    return todaysBills.length >= 11;
  }, [bills, user]);

  const startNewBill = useCallback(() => {
    if (limitReached) {
      setShowPaywall(true);
      return;
    }
    navigation.navigate("InvoiceCreate");
  }, [navigation, limitReached]);

  useEffect(() => {
    if (route.params?.openCreate) {
      startNewBill();
      navigation.setParams({ openCreate: false });
    }
  }, [route.params?.openCreate, route.params?.nonce, startNewBill]);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        const [cs, ps, recent] = await Promise.all([
          fetchCustomers(user?.organisationId || undefined),
          fetchProducts(user?.organisationId || undefined),
          fetchRecentBills(10, user?.organisationId || undefined),
        ]);
        if (!isMounted) return;
        setCustomers(cs);
        setProducts(ps.filter((p) => p.active));
        setRecentBills(recent);
      } catch (e) {
        console.warn("[Billing] Failed to load initial data", e);
        Alert.alert("Error", "Failed to load billing data. Please try again.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [user?.organisationId]);

  useEffect(() => {
    if (!whatsAppPreviewBill) return;
    (async () => {
      try {
        const tpl = await AsyncStorage.getItem("pm_whatsapp_template_v1");
        setWhatsAppTemplate(tpl);
      } catch {
        setWhatsAppTemplate(null);
      }
    })();
  }, [whatsAppPreviewBill]);

  const loadBillsList = useCallback(async () => {
    try {
      setListLoading(true);
      const [b, p] = await Promise.all([
        fetchBills(user?.organisationId || undefined),
        fetchBillPayments(user?.organisationId || undefined),
      ]);
      setBills(b);
      setBillPayments(p);
    } catch (e) {
      console.warn("[Billing] Failed to load bills list", e);
      Alert.alert("Error", "Failed to load bills.");
    } finally {
      setListLoading(false);
    }
  }, [user?.organisationId]);

  useEffect(() => {
    if (viewMode === "list") loadBillsList();
  }, [viewMode, loadBillsList]);

  const filteredBills = useMemo(() => {
    if (!searchQuery.trim()) return bills;
    const q = searchQuery.toLowerCase().trim();
    return bills.filter(
      (b) =>
        b.id.toLowerCase().includes(q) ||
        (b.customer || "").toLowerCase().includes(q) ||
        (b.phone || "").replace(/\D/g, "").includes(q.replace(/\D/g, ""))
    );
  }, [bills, searchQuery]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const term = customerSearch.toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(term));
  }, [customers, customerSearch]);

  const scrollY = useRef(new Animated.Value(0)).current;

  const searchTranslateY = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, -40],
    extrapolate: "clamp",
  });

  const searchOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const currentInvoiceBill: RecentBill | null = invoiceModalBill
    ? {
        id: invoiceModalBill.id,
        customer: invoiceModalBill.customer,
        phone: invoiceModalBill.phone ?? null,
        total: invoiceModalBill.total,
        createdAt: invoiceModalBill.createdAt,
        paid: invoiceModalBill.paid,
        gst: (invoiceFullBill as any)?.gst ?? null,
      }
    : null;

  const openInvoiceInBrowser = () => {
    if (!currentInvoiceBill) return;
    const base = WEB_BASE_URL.replace(/\/$/, "");
    const url = `${base}?inv=${encodeURIComponent(currentInvoiceBill.id)}`;
    Linking.openURL(url).catch((e) => {
      console.warn("[Billing] Failed to open invoice URL", e);
    });
  };

  const handleShareInvoice = () => {
    if (!currentInvoiceBill) return;
    shareBillViaWhatsApp({
      bill: {
        ...currentInvoiceBill,
        customerPhone: currentInvoiceBill.phone ?? undefined,
      },
      billPayments,
      template: whatsAppTemplate,
    });
  };

  const handleChangeItem = (index: number, patch: Partial<NewBillItem>) => {
    setItems((prev) => {
      const next = [...prev];
      const current = { ...next[index], ...patch };
      const qty = Number(current.qty || 0);
      const rate = Number(current.rate || 0);
      const taxRate = Number(current.taxRate || 0);
      const lineSubtotal = qty * rate;
      const lineTax = (lineSubtotal * taxRate) / 100;
      current.amount = lineSubtotal + lineTax;
      next[index] = current;
      return next;
    });
  };

  const handleSelectProduct = (index: number, product: BillingProduct) => {
    handleChangeItem(index, {
      name: product.name,
      rate: product.defaultRate,
      taxRate: product.taxRate,
    });
  };

  const sqftValue = useMemo(() => {
    const w = Number(sqftWidth);
    const h = Number(sqftHeight);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 0;
    // Keep 2 decimals for practical billing
    return Math.round(w * h * 100) / 100;
  }, [sqftWidth, sqftHeight]);

  const applySqftToItem = () => {
    if (sqftModalIndex === null) return;
    const rate = Number(sqftRate);
    if (!sqftValue || !Number.isFinite(rate) || rate < 0) return;
    handleChangeItem(sqftModalIndex, { qty: sqftValue, rate });
    setSqftModalIndex(null);
  };

  const addEmptyItemRow = () => {
    setItems((prev) => [
      ...prev,
      { name: "", description: "", qty: 1, rate: 0, taxRate: 0, amount: 0 },
    ]);
  };

  const { subtotal, gstAmt, total } = useMemo(() => {
    let subtotalAcc = 0;
    let gstAcc = 0;
    for (const item of items) {
      const qty = Number(item.qty || 0);
      const rate = Number(item.rate || 0);
      const taxRate = Number(item.taxRate || 0);
      const lineSubtotal = qty * rate;
      const lineTax = isGstInvoice ? (lineSubtotal * taxRate) / 100 : 0;
      subtotalAcc += lineSubtotal;
      gstAcc += lineTax;
    }
    return {
      subtotal: subtotalAcc,
      gstAmt: gstAcc,
      total: subtotalAcc + gstAcc,
    };
  }, [items, isGstInvoice]);

  const fmtCurrency = (n: number) =>
    `₹${Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const generateBillId = () => {
    const now = new Date();
    const y = String(now.getFullYear()).slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `MOB-${y}${m}${d}-${rand}`;
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) {
      Alert.alert("Name required", "Please enter a name for the party.");
      return;
    }
    try {
      const created = await createCustomerQuick({
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || undefined,
        email: newCustomerEmail.trim() || undefined,
        organisationId: user?.organisationId || undefined,
      });
      const createdCustomer: BillingCustomer = {
        id: created.id,
        name: created.name,
        phone: created.phone,
      };
      setCustomers((prev) => [createdCustomer, ...prev]);
      setSelectedCustomer(createdCustomer);
      setCustomerSearch("");
      setShowNewCustomerForm(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
    } catch (e) {
      console.warn("[Billing] Failed to create customer", e);
      Alert.alert("Error", "Failed to create party. Please try again.");
    }
  };

  const handleCreateProduct = async () => {
    if (!newProductName.trim()) {
      Alert.alert("Name required", "Please enter an item name.");
      return;
    }
    const rate = Number(newProductRate || 0);
    const tax = Number(newProductTaxRate || 0);
    try {
      const created = await createProductQuick({
        name: newProductName.trim(),
        defaultRate: rate,
        taxRate: tax,
        unit: newProductUnit.trim() || undefined,
        hsnCode: newProductHsn.trim() || undefined,
        organisationId: user?.organisationId || undefined,
      });

      const newBillingProduct: BillingProduct = {
        id: created.id,
        name: created.name,
        category: created.category,
        itemCode: created.item_code ?? null,
        hsnCode: created.hsn_code ?? null,
        unit: created.unit ?? null,
        defaultRate: Number(created.default_rate ?? 0),
        taxRate: Number(created.tax_rate ?? 0),
        active: created.active !== false,
      };

      setProducts((prev) => [newBillingProduct, ...prev]);
      setShowNewProductForm(false);
      setNewProductName("");
      setNewProductRate("");
      setNewProductTaxRate("");
      setNewProductUnit("");
      setNewProductHsn("");
    } catch (e) {
      console.warn("[Billing] Failed to create product", e);
      Alert.alert("Error", "Failed to create item. Please try again.");
    }
  };

  const handleSave = async () => {
    if (!selectedCustomer) {
      Alert.alert("Missing customer", "Please select a customer.");
      return;
    }

    const validItems = items.filter(
      (i) => i.name.trim() && Number(i.qty) > 0 && Number(i.rate) >= 0
    );

    if (validItems.length === 0) {
      Alert.alert("No items", "Please add at least one item with quantity and rate.");
      return;
    }

    try {
      setSaving(true);
      const id = generateBillId();

      const payload = {
        id,
        customer: selectedCustomer.name,
        phone: selectedCustomer.phone ?? null,
        subtotal,
        gstAmt: isGstInvoice ? gstAmt : 0,
        total: isGstInvoice ? total : subtotal,
        gst: isGstInvoice,
        paid: markAsPaid,
        dueDate: date,
        notes: null,
        status: "final",
        items: validItems,
        organisationId: user?.organisationId || undefined,
      };

      const created = await createBill(payload);
      const billForShare: RecentBill = {
        id: created.id,
        customer: created.customer,
        phone: selectedCustomer.phone ?? null,
        total: created.total,
        createdAt: created.createdAt,
        paid: created.paid ?? null,
      };
      setWhatsAppPreviewBill(billForShare);

      setItems([{ name: "", qty: 1, rate: 0, taxRate: 0, amount: 0 }]);
      setMarkAsPaid(true);
      setPaymentMethod("Cash");

      const refreshed = await fetchRecentBills(10);
      setRecentBills(refreshed);
      setViewMode("list");
      loadBillsList();
    } catch (e) {
      console.warn("[Billing] Failed to save bill", e);
      Alert.alert("Error", "Failed to save bill. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPaymentSubmit = async () => {
    if (!paymentModalBill) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid payment amount.");
      return;
    }
    try {
      setSavingPayment(true);
      await addBillPayment({
        billId: paymentModalBill.id,
        amount,
        method: paymentMethodForModal.toLowerCase(),
      });
      setPaymentModalBill(null);
      setPaymentAmount("");
      await loadBillsList();
    } catch (e) {
      console.warn("[Billing] addBillPayment failed", e);
      Alert.alert("Error", "Failed to record payment.");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeleteBill = (bill: RecentBill) => {
    Alert.alert(
      "Delete bill",
      `Delete invoice ${bill.id}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteBill(bill.id, user?.organisationId);
              await loadBillsList();
            } catch (e) {
              console.warn("[Billing] deleteBill failed", e);
              Alert.alert("Error", "Failed to delete bill.");
            }
          },
        },
      ]
    );
  };

  const renderBillRow = ({ item: bill }: { item: RecentBill }) => {
    const info = getBillPaymentInfo(bill, billPayments);

    const openInvoice = () => {
      Keyboard.dismiss();
      if (bill.status === "draft") {
        navigation.navigate("InvoiceCreate", { editBillId: bill.id });
      } else {
        navigation.navigate("InvoiceDetail", { billId: bill.id });
      }
    };

    return (
      <View style={styles.listBillCard}>
        <ListRow
          title={bill.customer}
          subtitle={`INV-${bill.id.slice(-4).toUpperCase()} • ${new Date(
            bill.createdAt
          ).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
          amount={fmtCurrency(bill.total)}
          statusLabel={info.status.toUpperCase()}
          statusVariant={
            info.status === "Paid"
              ? "paid"
              : info.status === "Draft"
                ? "partial"
                : info.status === "Partially Paid"
                  ? "partial"
                  : "unpaid"
          }
          avatarLabel={(bill.customer || "?").charAt(0).toUpperCase()}
          onPress={openInvoice}
        />
        <View style={styles.listBillActions}>
          {info.status !== "Draft" && (
            <TouchableOpacity
              style={styles.listBillActionBtn}
              onPress={() => {
                setPaymentModalBill(bill);
                setPaymentAmount("");
                setPaymentMethodForModal("Cash");
              }}
            >
              <Text style={styles.listBillActionText}>Add Payment</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.listBillActionBtn} onPress={openInvoice}>
            <Text style={styles.listBillActionText}>{info.status === "Draft" ? "Edit Draft" : "Invoice"}</Text>
          </TouchableOpacity>
          {info.status !== "Draft" && (
            <TouchableOpacity
              style={styles.listBillActionBtn}
              onPress={() =>
                shareBillViaWhatsApp({
                  bill: { ...bill, customerPhone: bill.phone ?? undefined },
                  billPayments,
                  template: whatsAppTemplate,
                })
              }
            >
              <Text style={styles.listBillActionText}>WhatsApp</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.listBillActionBtn, styles.listBillActionDanger]}
            onPress={() => handleDeleteBill(bill)}
          >
            <Text style={styles.listBillActionDangerText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.root, { paddingTop: insets.paddingTop ?? spacing.lg }]}>
        {viewMode === "list" ? (
          <>
            <View style={styles.listHeader}>
              <Text style={styles.title}>Bills</Text>
              <TouchableOpacity
                style={styles.newBillButton}
                onPress={startNewBill}
              >
                <Text style={styles.newBillButtonText}>New Bill</Text>
              </TouchableOpacity>
            </View>
            <Animated.View
              style={[
                styles.searchContainer,
                {
                  transform: [{ translateY: searchTranslateY }],
                  opacity: searchOpacity,
                },
              ]}
            >
              <TextInput
                style={styles.searchInput}
                placeholder="Search by invoice, party, phone…"
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </Animated.View>
            {listLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={colors.accentBlue} />
                <Text style={styles.loadingText}>Loading bills…</Text>
              </View>
            ) : (
              <Animated.FlatList
                data={filteredBills}
                keyExtractor={(b) => b.id}
                renderItem={renderBillRow}
                contentContainerStyle={styles.listContent}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                  { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No bills found.</Text>
                }
              />
            )}

            <Modal
              visible={invoiceModalBill !== null}
              transparent
              animationType="fade"
              onRequestClose={() => {
                setInvoiceModalBill(null);
                setInvoiceFullBill(null);
              }}
            >
              <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => {
                  setInvoiceModalBill(null);
                  setInvoiceFullBill(null);
                }}
              >
                <TouchableOpacity
                  style={styles.invoiceModalBox}
                  activeOpacity={1}
                  onPress={() => {}}
                >
                  {invoiceModalBill && (
                    <>
                      {invoiceLoading ? (
                        <View style={styles.invoiceLoadingWrap}>
                          <ActivityIndicator color={colors.accentBlue} size="large" />
                          <Text style={styles.invoiceLoadingText}>Loading invoice…</Text>
                        </View>
                      ) : (
                        <ScrollView style={styles.invoiceScroll} showsVerticalScrollIndicator={false}>
                          <Text style={styles.invoiceDocTitle}>INVOICE</Text>
                          <Text style={styles.invoiceNumber}>{invoiceFullBill?.id ?? invoiceModalBill.id}</Text>
                          <Text style={styles.invoiceDate}>
                            {invoiceFullBill?.createdAt
                              ? new Date(invoiceFullBill.createdAt).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : ""}
                          </Text>
                          <View style={styles.invoiceDivider} />
                          <Text style={styles.invoiceLabel}>Bill to</Text>
                          <Text style={styles.invoiceParty}>{invoiceFullBill?.customer ?? invoiceModalBill.customer}</Text>
                          {(invoiceFullBill?.phone ?? invoiceModalBill.phone) ? (
                            <Text style={styles.invoiceMeta}>
                              Phone: {invoiceFullBill?.phone ?? invoiceModalBill.phone}
                            </Text>
                          ) : null}
                          {(invoiceFullBill?.items && invoiceFullBill.items.length > 0) && (
                            <>
                              <View style={styles.invoiceDivider} />
                              <Text style={styles.invoiceLabel}>Items</Text>
                              {invoiceFullBill.items.map((line, i) => (
                                <View key={i} style={styles.invoiceItemRow}>
                                  <View style={{ flex: 1, minWidth: 0, paddingRight: spacing.sm }}>
                                    <Text style={styles.invoiceItemName} numberOfLines={1}>
                                      {line.name ?? "—"} × {Number(line.qty ?? 0)}
                                    </Text>
                                    {String((line as any).description || "").trim() ? (
                                      <Text style={styles.invoiceItemDesc} numberOfLines={2}>
                                        {String((line as any).description).trim()}
                                      </Text>
                                    ) : null}
                                  </View>
                                  <Text style={styles.invoiceItemAmt}>
                                    {fmtCurrency(Number(line.amount ?? 0))}
                                  </Text>
                                </View>
                              ))}
                            </>
                          )}
                          <View style={styles.invoiceDivider} />
                          {(invoiceFullBill?.subtotal != null && invoiceFullBill.subtotal > 0) && (
                            <View style={styles.invoiceSummaryRow}>
                              <Text style={styles.invoiceSummaryLabel}>Subtotal</Text>
                              <Text style={styles.invoiceSummaryValue}>{fmtCurrency(invoiceFullBill.subtotal)}</Text>
                            </View>
                          )}
                          {(invoiceFullBill?.gst && (invoiceFullBill?.gst_amt ?? 0) > 0) && (
                            <View style={styles.invoiceSummaryRow}>
                              <Text style={styles.invoiceSummaryLabel}>GST</Text>
                              <Text style={styles.invoiceSummaryValue}>{fmtCurrency(invoiceFullBill.gst_amt ?? 0)}</Text>
                            </View>
                          )}
                          <View style={styles.invoiceSummaryRow}>
                            <Text style={styles.invoiceTotalLabel}>Total</Text>
                            <Text style={styles.invoiceTotalValue}>{fmtCurrency(invoiceFullBill?.total ?? invoiceModalBill.total)}</Text>
                          </View>
                          <View style={styles.invoiceSummaryRow}>
                            <Text style={styles.invoiceSummaryLabel}>Paid</Text>
                            <Text style={styles.invoiceSummaryValue}>
                              {fmtCurrency(
                                getBillPaymentInfo(invoiceFullBill ?? invoiceModalBill, billPayments).paidAmount
                              )}
                            </Text>
                          </View>
                          <View style={styles.invoiceSummaryRow}>
                            <Text style={styles.invoiceSummaryLabel}>Remaining</Text>
                            <Text style={styles.invoiceSummaryValue}>
                              {fmtCurrency(
                                getBillPaymentInfo(invoiceFullBill ?? invoiceModalBill, billPayments).remaining
                              )}
                            </Text>
                          </View>
                          <Text style={styles.invoiceStatus}>
                            Status:{" "}
                            {
                              getBillPaymentInfo(
                                invoiceFullBill ?? invoiceModalBill,
                                billPayments
                              ).status
                            }
                          </Text>
                          <View style={styles.invoiceDivider} />
                          <View style={styles.invoiceSummaryRow}>
                            <Text style={styles.invoiceSummaryLabel}>
                              Received Payment
                            </Text>
                            <Text style={styles.invoiceSummaryValue}>
                              {fmtCurrency(
                                getBillPaymentInfo(
                                  invoiceFullBill ?? invoiceModalBill,
                                  billPayments
                                ).paidAmount
                              )}
                            </Text>
                          </View>
                          <View style={styles.invoiceSummaryRow}>
                            <Text style={styles.invoiceSummaryLabel}>
                              Amount Received
                            </Text>
                            <Text style={styles.invoiceSummaryValue}>
                              {fmtCurrency(
                                getBillPaymentInfo(
                                  invoiceFullBill ?? invoiceModalBill,
                                  billPayments
                                ).paidAmount
                              )}
                            </Text>
                          </View>
                        </ScrollView>
                      )}
                      <View style={styles.invoiceActionsRow}>
                        <TouchableOpacity
                          onPress={openInvoiceInBrowser}
                          style={styles.invoiceActionBtn}
                        >
                          <Text style={styles.invoiceActionText}>Download</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={openInvoiceInBrowser}
                          style={styles.invoiceActionBtn}
                        >
                          <Text style={styles.invoiceActionText}>Print</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleShareInvoice}
                          style={styles.invoiceActionBtn}
                        >
                          <Text style={styles.invoiceActionText}>Share</Text>
                        </TouchableOpacity>
                        {invoiceModalBill && (
                          <TouchableOpacity
                            onPress={() => handleDeleteBill(invoiceModalBill)}
                            style={styles.invoiceActionDanger}
                          >
                            <Text style={styles.invoiceActionDangerText}>
                              Delete
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.modalCloseBtn}
                        onPress={() => {
                          setInvoiceModalBill(null);
                          setInvoiceFullBill(null);
                        }}
                      >
                        <Text style={styles.modalCloseBtnText}>Close</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>

            <Modal
              visible={paymentModalBill !== null}
              transparent
              animationType="fade"
              onRequestClose={() => setPaymentModalBill(null)}
            >
              <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setPaymentModalBill(null)}
              >
                <TouchableOpacity
                  style={styles.modalBox}
                  activeOpacity={1}
                  onPress={() => {}}
                >
                  {paymentModalBill && (
                    <>
                      <Text style={styles.modalTitle}>Add Payment</Text>
                      <Text style={styles.modalRow}>
                        Bill: {paymentModalBill.id} • {paymentModalBill.customer}
                      </Text>
                      <Text style={styles.modalRow}>
                        Total: {fmtCurrency(paymentModalBill.total)} • Remaining:{" "}
                        {fmtCurrency(
                          getBillPaymentInfo(paymentModalBill, billPayments).remaining
                        )}
                      </Text>
                      <Text style={styles.label}>Amount</Text>
                      <TextInput
                        style={styles.input}
                        value={paymentAmount}
                        onChangeText={setPaymentAmount}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                        placeholderTextColor={colors.textMuted}
                      />
                      <Text style={styles.label}>Method</Text>
                      <View style={styles.paymentMethods}>
                        {(["Cash", "UPI", "Bank", "Card"] as PaymentMethod[]).map(
                          (m) => (
                            <TouchableOpacity
                              key={m}
                              style={[
                                styles.paymentChip,
                                paymentMethodForModal === m && styles.paymentChipActive,
                              ]}
                              onPress={() => setPaymentMethodForModal(m)}
                            >
                              <Text
                                style={[
                                  styles.paymentChipText,
                                  paymentMethodForModal === m &&
                                    styles.paymentChipTextActive,
                                ]}
                              >
                                {m}
                              </Text>
                            </TouchableOpacity>
                          )
                        )}
                      </View>
                      <View style={styles.modalActions}>
                        <TouchableOpacity
                          style={styles.inlineFormSecondary}
                          onPress={() => setPaymentModalBill(null)}
                        >
                          <Text style={styles.inlineFormSecondaryText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.inlineFormPrimary}
                          onPress={handleAddPaymentSubmit}
                          disabled={savingPayment}
                        >
                          {savingPayment ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <Text style={styles.inlineFormPrimaryText}>Save</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>
          </>
        ) : (
          <>
            <View style={styles.listHeader}>
              <TouchableOpacity
                style={styles.backToListBtn}
                onPress={() => setViewMode("list")}
              >
                <Text style={styles.backToListBtnText}>← List</Text>
              </TouchableOpacity>
              <Text style={styles.title}>New Invoice</Text>
            </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accentBlue} />
            <Text style={styles.loadingText}>Loading billing data…</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer & Date</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Customer</Text>
                <TouchableOpacity
                  style={styles.pickerInput}
                  onPress={() => {
                    setCustomerSearch("");
                    setPartyPickerVisible(true);
                  }}
                >
                  <Text
                    style={
                      selectedCustomer
                        ? styles.pickerInputText
                        : styles.pickerInputPlaceholder
                    }
                  >
                    {selectedCustomer ? selectedCustomer.name : "Search / Select party"}
                  </Text>
                </TouchableOpacity>
                <View style={styles.inlineActionsRow}>
                  <TouchableOpacity
                    onPress={() => setShowNewCustomerForm((v) => !v)}
                    style={styles.inlineActionButton}
                  >
                    <Text style={styles.inlineActionText}>+ Create party</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {showNewCustomerForm && (
                <View style={styles.inlineFormCard}>
                  <Text style={styles.inlineFormTitle}>New party</Text>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                      style={styles.input}
                      value={newCustomerName}
                      onChangeText={setNewCustomerName}
                      placeholder="Party name"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Phone</Text>
                    <TextInput
                      style={styles.input}
                      value={newCustomerPhone}
                      onChangeText={setNewCustomerPhone}
                      placeholder="Phone"
                      keyboardType="phone-pad"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                      style={styles.input}
                      value={newCustomerEmail}
                      onChangeText={setNewCustomerEmail}
                      placeholder="Email"
                      keyboardType="email-address"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.inlineFormActions}>
                    <TouchableOpacity
                      onPress={() => {
                        setShowNewCustomerForm(false);
                        setNewCustomerName("");
                        setNewCustomerPhone("");
                        setNewCustomerEmail("");
                      }}
                      style={styles.inlineFormSecondary}
                    >
                      <Text style={styles.inlineFormSecondaryText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleCreateCustomer}
                      style={styles.inlineFormPrimary}
                    >
                      <Text style={styles.inlineFormPrimaryText}>Save party</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Date</Text>
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.itemsHeaderRow}>
                <Text style={styles.sectionTitle}>Items</Text>
                <TouchableOpacity
                  onPress={() => setShowNewProductForm((v) => !v)}
                  style={styles.inlineActionButton}
                >
                  <Text style={styles.inlineActionText}>+ Create item</Text>
                </TouchableOpacity>
              </View>
              {items.map((item, index) => {
                return (
                  <View key={index} style={styles.itemCard}>
                    {items.length > 1 && (
                      <View style={styles.itemHeaderRow}>
                        <TouchableOpacity
                          onPress={() => {
                            setSqftModalIndex(index);
                            setSqftWidth("");
                            setSqftHeight("");
                            setSqftRate(String(item.rate || ""));
                          }}
                          style={styles.sqftBtn}
                        >
                          <Text style={styles.sqftBtnText}>SQFT</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            setItems((prev) =>
                              prev.filter((_, itemIndex) => itemIndex !== index)
                            )
                          }
                          style={styles.deleteItemButton}
                        >
                          <Text style={styles.deleteItemText}>Delete row</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {items.length === 1 && (
                      <View style={styles.itemHeaderRow}>
                        <TouchableOpacity
                          onPress={() => {
                            setSqftModalIndex(index);
                            setSqftWidth("");
                            setSqftHeight("");
                            setSqftRate(String(item.rate || ""));
                          }}
                          style={styles.sqftBtn}
                        >
                          <Text style={styles.sqftBtnText}>SQFT</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.pickerInput}
                      onPress={() => {
                        setItemSearch("");
                        setItemPickerVisible(index);
                      }}
                    >
                      <Text
                        style={
                          item.name
                            ? styles.pickerInputText
                            : styles.pickerInputPlaceholder
                        }
                      >
                        {item.name || "Select item"}
                      </Text>
                    </TouchableOpacity>

                    <TextInput
                      style={styles.itemDescriptionInput}
                      value={item.description ?? ""}
                      onChangeText={(text) =>
                        handleChangeItem(index, { description: text })
                      }
                      placeholder="Item description (optional)"
                      placeholderTextColor={colors.textMuted}
                      multiline
                    />

                    <View style={styles.row}>
                      <View style={styles.rowItem}>
                        <Text style={styles.label}>Qty</Text>
                        <TextInput
                          style={styles.input}
                          keyboardType="numeric"
                          value={String(item.qty || "")}
                          onChangeText={(text) =>
                            handleChangeItem(index, { qty: Number(text) || 0 })
                          }
                        />
                      </View>
                      <View style={styles.rowItem}>
                        <Text style={styles.label}>Rate</Text>
                        <TextInput
                          style={styles.input}
                          keyboardType="numeric"
                          value={String(item.rate || "")}
                          onChangeText={(text) =>
                            handleChangeItem(index, { rate: Number(text) || 0 })
                          }
                        />
                      </View>
                      {isGstInvoice && (
                        <View style={styles.rowItem}>
                          <Text style={styles.label}>Tax %</Text>
                          <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={String(item.taxRate || "")}
                            onChangeText={(text) =>
                              handleChangeItem(index, { taxRate: Number(text) || 0 })
                            }
                          />
                        </View>
                      )}
                    </View>

                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Amount</Text>
                      <Text style={styles.amountValue}>{fmtCurrency(item.amount)}</Text>
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity style={styles.addItemButton} onPress={addEmptyItemRow}>
                <Text style={styles.addItemText}>+ Add Item</Text>
              </TouchableOpacity>
            </View>

            {showNewProductForm && (
              <View style={styles.inlineFormCard}>
                <Text style={styles.inlineFormTitle}>New item</Text>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    style={styles.input}
                    value={newProductName}
                    onChangeText={setNewProductName}
                    placeholder="Item name"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <Text style={styles.label}>Rate</Text>
                    <TextInput
                      style={styles.input}
                      value={newProductRate}
                      onChangeText={setNewProductRate}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.rowItem}>
                    <Text style={styles.label}>Tax %</Text>
                    <TextInput
                      style={styles.input}
                      value={newProductTaxRate}
                      onChangeText={setNewProductTaxRate}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <Text style={styles.label}>Unit</Text>
                    <TextInput
                      style={styles.input}
                      value={newProductUnit}
                      onChangeText={setNewProductUnit}
                      placeholder="pcs, sq.ft, etc."
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.rowItem}>
                    <Text style={styles.label}>HSN</Text>
                    <TextInput
                      style={styles.input}
                      value={newProductHsn}
                      onChangeText={setNewProductHsn}
                      placeholder="HSN code"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
                <View style={styles.inlineFormActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowNewProductForm(false);
                      setNewProductName("");
                      setNewProductRate("");
                      setNewProductTaxRate("");
                      setNewProductUnit("");
                      setNewProductHsn("");
                    }}
                    style={styles.inlineFormSecondary}
                  >
                    <Text style={styles.inlineFormSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleCreateProduct}
                    style={styles.inlineFormPrimary}
                  >
                    <Text style={styles.inlineFormPrimaryText}>Save item</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Summary</Text>

              <View style={styles.invoiceTypeRow}>
                <Text style={styles.label}>Invoice type</Text>
                <View style={styles.invoiceTypeChips}>
                  {[
                    { key: "gst", label: "GST", value: true },
                    { key: "non-gst", label: "Non-GST", value: false },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.invoiceChip,
                        isGstInvoice === opt.value && styles.invoiceChipActive,
                      ]}
                      onPress={() => setIsGstInvoice(opt.value)}
                    >
                      <Text
                        style={[
                          styles.invoiceChipText,
                          isGstInvoice === opt.value && styles.invoiceChipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{fmtCurrency(subtotal)}</Text>
              </View>
              {isGstInvoice && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>GST</Text>
                  <Text style={styles.summaryValue}>{fmtCurrency(gstAmt)}</Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total</Text>
                <Text style={styles.summaryTotal}>{fmtCurrency(isGstInvoice ? total : subtotal)}</Text>
              </View>

              <View style={styles.paymentRow}>
                <Text style={styles.label}>Payment</Text>
                <View style={styles.paymentMethods}>
                  {(["Cash", "UPI", "Bank", "Card"] as PaymentMethod[]).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.paymentChip,
                        paymentMethod === m && styles.paymentChipActive,
                      ]}
                      onPress={() => setPaymentMethod(m)}
                    >
                      <Text
                        style={[
                          styles.paymentChipText,
                          paymentMethod === m && styles.paymentChipTextActive,
                        ]}
                      >
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.paymentRow}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setMarkAsPaid((v) => !v)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      markAsPaid && styles.checkboxChecked,
                    ]}
                  >
                    {markAsPaid && <View style={styles.checkboxDot} />}
                  </View>
                  <Text style={styles.checkboxLabel}>Mark as paid</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Bill</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Bills</Text>
              {recentBills.length === 0 ? (
                <Text style={styles.emptyText}>No bills yet.</Text>
              ) : (
                recentBills.map((b) => (
                  <View key={b.id} style={styles.billRow}>
                    <View>
                      <Text style={styles.billId}>{b.id}</Text>
                      <Text style={styles.billCustomer}>{b.customer}</Text>
                    </View>
                    <View style={styles.billRight}>
                      <Text style={styles.billAmount}>{fmtCurrency(b.total)}</Text>
                      <Text
                        style={[
                          styles.billStatus,
                          b.paid ? styles.billStatusPaid : styles.billStatusUnpaid,
                        ]}
                      >
                        {b.paid ? "Paid" : "Unpaid"}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}
          </>
        )}

        <Modal
          visible={sqftModalIndex !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setSqftModalIndex(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSqftModalIndex(null)}
          >
            <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>SQFT Calculator</Text>
              <Text style={styles.modalRow}>Width × Height = SQFT</Text>
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <Text style={styles.label}>Width (ft)</Text>
                  <TextInput
                    style={styles.input}
                    value={sqftWidth}
                    onChangeText={setSqftWidth}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={styles.rowItem}>
                  <Text style={styles.label}>Height (ft)</Text>
                  <TextInput
                    style={styles.input}
                    value={sqftHeight}
                    onChangeText={setSqftHeight}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
              <Text style={styles.label}>Rate / SQFT</Text>
              <TextInput
                style={styles.input}
                value={sqftRate}
                onChangeText={setSqftRate}
                placeholder="0"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>SQFT</Text>
                <Text style={styles.amountValue}>{sqftValue ? String(sqftValue) : "—"}</Text>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.inlineFormSecondary}
                  onPress={() => setSqftModalIndex(null)}
                >
                  <Text style={styles.inlineFormSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.inlineFormPrimary,
                    (!sqftValue || !sqftRate.trim()) && { opacity: 0.6 },
                  ]}
                  onPress={applySqftToItem}
                  disabled={!sqftValue || !sqftRate.trim()}
                >
                  <Text style={styles.inlineFormPrimaryText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={whatsAppPreviewBill !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setWhatsAppPreviewBill(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setWhatsAppPreviewBill(null)}
          >
            <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
              {whatsAppPreviewBill && (
                <>
                  <Text style={styles.modalTitle}>Bill saved – Share via WhatsApp</Text>
                  <Text style={styles.modalRow}>
                    Preview (includes invoice link & payment link):
                  </Text>
                  <ScrollView
                    style={styles.whatsAppPreviewScroll}
                    nestedScrollEnabled
                  >
                    <Text style={styles.whatsAppPreviewText} selectable>
                      {buildInvoiceWhatsAppMessage({
                        bill: {
                          ...whatsAppPreviewBill,
                          customerPhone: whatsAppPreviewBill.phone ?? undefined,
                        },
                        billPayments: [],
                        template: whatsAppTemplate,
                      })}
                    </Text>
                  </ScrollView>
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.inlineFormSecondary}
                      onPress={() => setWhatsAppPreviewBill(null)}
                    >
                      <Text style={styles.inlineFormSecondaryText}>Close</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.inlineFormPrimary}
                      onPress={() => {
                        shareBillViaWhatsApp({
                          bill: {
                            ...whatsAppPreviewBill,
                            customerPhone: whatsAppPreviewBill.phone ?? undefined,
                          },
                          billPayments: [],
                          template: whatsAppTemplate,
                        });
                        setWhatsAppPreviewBill(null);
                      }}
                    >
                      <Text style={styles.inlineFormPrimaryText}>Send on WhatsApp</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
        <Modal
          visible={partyPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPartyPickerVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setPartyPickerVisible(false)}
          >
            <TouchableOpacity
              style={styles.modalBox}
              activeOpacity={1}
              onPress={() => {}}
            >
              <Text style={styles.modalTitle}>Select Party</Text>
              <TextInput
                style={styles.input}
                placeholder="Search party"
                placeholderTextColor={colors.textMuted}
                value={customerSearch}
                onChangeText={setCustomerSearch}
              />
              <FlatList
                data={filteredCustomers}
                keyExtractor={(c) => c.id}
                style={{ marginTop: spacing.sm }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.suggestionRow}
                    onPress={() => {
                      setSelectedCustomer(item);
                      setCustomerSearch("");
                      setPartyPickerVisible(false);
                    }}
                  >
                    <Text style={styles.suggestionText}>{item.name}</Text>
                    {item.phone ? (
                      <Text style={styles.suggestionSubText}>{item.phone}</Text>
                    ) : null}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No parties found.</Text>
                }
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
        <Modal
          visible={itemPickerVisible !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setItemPickerVisible(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setItemPickerVisible(null)}
          >
            <TouchableOpacity
              style={styles.modalBox}
              activeOpacity={1}
              onPress={() => {}}
            >
              <Text style={styles.modalTitle}>Select Item</Text>
              <TextInput
                style={styles.input}
                placeholder="Search item"
                placeholderTextColor={colors.textMuted}
                value={itemSearch}
                onChangeText={setItemSearch}
              />
              <FlatList
                data={products.filter((p) =>
                  itemSearch.trim()
                    ? p.name.toLowerCase().includes(itemSearch.toLowerCase())
                    : true
                )}
                keyExtractor={(p) => p.id}
                style={{ marginTop: spacing.sm }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.suggestionRow}
                    onPress={() => {
                      if (itemPickerVisible !== null) {
                        handleSelectProduct(itemPickerVisible, item);
                      }
                      setItemPickerVisible(null);
                      setItemSearch("");
                    }}
                  >
                    <Text style={styles.suggestionText}>{item.name}</Text>
                    {item.hsnCode ? (
                      <Text style={styles.suggestionSubText}>
                        HSN {item.hsnCode}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No items found.</Text>
                }
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const createStyles = ({
  colors,
  spacing,
  radius,
}: {
  colors: any;
  spacing: any;
  radius: any;
}) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    root: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      backgroundColor: colors.background,
    },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: spacing.lg,
  },
  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl * 2,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  inlineActionsRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  inlineActionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  inlineActionText: {
    color: colors.accentBlue,
    fontSize: 11,
    fontWeight: "500",
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.cardBackground,
    fontSize: 13,
  },
  suggestions: {
    marginTop: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  pickerInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardBackground,
  },
  pickerInputText: {
    color: colors.textPrimary,
    fontSize: 13,
  },
  pickerInputPlaceholder: {
    color: colors.textMuted,
    fontSize: 13,
  },
  suggestionRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  suggestionText: {
    color: colors.textPrimary,
    fontSize: 13,
  },
  suggestionSubText: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  rowItem: {
    flex: 1,
  },
  itemCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  itemsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  itemHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  sqftBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accentBlue,
  },
  sqftBtnText: {
    color: colors.accentBlue,
    fontSize: 11,
    fontWeight: "700",
  },
  deleteItemButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  deleteItemText: {
    color: colors.accentRed,
    fontSize: 11,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  amountLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  amountValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  itemDescriptionInput: {
    marginTop: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    color: colors.textPrimary,
    backgroundColor: colors.cardBackground,
    fontSize: 12,
  },
  addItemButton: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentBlue,
    marginTop: spacing.sm,
  },
  addItemText: {
    color: colors.accentBlue,
    fontSize: 13,
    fontWeight: "600",
  },
  inlineFormCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  inlineFormTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  inlineFormActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  inlineFormSecondary: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  inlineFormSecondaryText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  inlineFormPrimary: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.accentBlue,
  },
  inlineFormPrimaryText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  summaryValue: {
    color: colors.textPrimary,
    fontSize: 13,
  },
  summaryTotal: {
    color: colors.accentGreen,
    fontSize: 15,
    fontWeight: "700",
  },
  invoiceTypeRow: {
    marginBottom: spacing.md,
  },
  invoiceTypeChips: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  invoiceChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  invoiceChipActive: {
    borderColor: colors.accentBlue,
    backgroundColor: colors.accentBlue + "22",
  },
  invoiceChipText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  invoiceChipTextActive: {
    color: colors.accentBlue,
    fontWeight: "600",
  },
  paymentRow: {
    marginTop: spacing.md,
  },
  paymentMethods: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  paymentChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  paymentChipActive: {
    borderColor: colors.accentBlue,
    backgroundColor: colors.accentBlue + "22",
  },
  paymentChipText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  paymentChipTextActive: {
    color: colors.accentBlue,
    fontWeight: "600",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.cardBackground,
  },
  checkboxChecked: {
    borderColor: colors.accentGreen,
    backgroundColor: colors.accentGreen + "33",
  },
  checkboxDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.accentGreen,
  },
  checkboxLabel: {
    color: colors.textPrimary,
    fontSize: 13,
  },
  saveButton: {
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
    backgroundColor: colors.accentBlue,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  billId: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  billCustomer: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  billRight: {
    alignItems: "flex-end",
  },
  billAmount: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  billStatus: {
    marginTop: 2,
    fontSize: 11,
  },
  billStatusPaid: {
    color: colors.accentGreen,
  },
  billStatusPartial: {
    color: colors.accentOrange,
  },
  billStatusUnpaid: {
    color: colors.accentRed,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  searchContainer: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.cardBackground,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  newBillButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.accentBlue,
    shadowColor: "#2563EB",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  newBillButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  backToListBtn: {
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  backToListBtnText: {
    color: colors.accentBlue,
    fontSize: 14,
  },
  searchInput: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.xl * 2,
  },
  listBillCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  listBillMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  listBillId: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  listBillParty: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  listBillRight: {
    alignItems: "flex-end",
  },
  listBillTotal: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  listBillMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  listBillActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  listBillActionBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accentBlue,
  },
  listBillActionText: {
    color: colors.accentBlue,
    fontSize: 12,
  },
  listBillActionDanger: {
    borderColor: colors.accentRed,
  },
  listBillActionDangerText: {
    color: colors.accentRed,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalBox: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.cardBackground,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  modalRow: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  invoiceModalBox: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "85%",
    backgroundColor: colors.cardBackground,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  invoiceScroll: { maxHeight: 340 },
  invoiceLoadingWrap: { paddingVertical: spacing.xl, alignItems: "center", gap: spacing.sm },
  invoiceLoadingText: { color: colors.textMuted, fontSize: 13 },
  invoiceDocTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  invoiceNumber: { color: colors.accentBlue, fontSize: 15, fontWeight: "700", marginBottom: 2 },
  invoiceDate: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  invoiceDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.sm,
  },
  invoiceLabel: { color: colors.textMuted, fontSize: 11, marginBottom: 2, textTransform: "uppercase" },
  invoiceParty: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  invoiceMeta: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  invoiceItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  invoiceItemName: { color: colors.textPrimary, fontSize: 13, flex: 1 },
  invoiceItemDesc: { color: colors.textMuted, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  invoiceItemAmt: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  invoiceSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  invoiceSummaryLabel: { color: colors.textSecondary, fontSize: 13 },
  invoiceSummaryValue: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  invoiceTotalLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  invoiceTotalValue: { color: colors.accentGreen, fontSize: 16, fontWeight: "700" },
  invoiceStatus: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  invoiceActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  invoiceActionBtn: {
    flex: 1,
    minWidth: "20%",
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
  },
  invoiceActionText: {
    color: colors.accentBlue,
    fontSize: 13,
    fontWeight: "600",
  },
  invoiceActionDanger: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentRed,
    alignItems: "center",
  },
  invoiceActionDangerText: {
    color: colors.accentRed,
    fontSize: 13,
    fontWeight: "600",
  },
  modalCloseBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  modalCloseBtnText: {
    color: colors.accentBlue,
    fontSize: 14,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  whatsAppPreviewScroll: {
    maxHeight: 220,
    marginVertical: spacing.sm,
  },
  whatsAppPreviewText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  });

