import React, { useCallback, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StatusBar, ActivityIndicator, Platform, KeyboardAvoidingView, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import { useUser } from "../userContext";
import { useTheme } from "../themeContext";
import { useSafeScreen } from "../hooks/useSafeScreen";
import { getProducts } from "../services/productsService";
import { getCustomers } from "../services/customersService";
import { createBill, fetchBills } from "../services/billingService";
import {
  processAgentMessage,
  agentResponseToDisplay,
  createEmptyMemory,
  AgentMemory,
  AgentResponse,
  TrainedProduct,
} from "../services/aiOrderService";
import {
  learnFromBill, getAllSuggestionsForCustomer,
  getRecurringRadar, getWeeklyDigest,
  saveConversation, loadConversation,
} from "../services/aiLearnMemory";
import { fetchWebAnswer, isGeneralQuestion } from "../services/aiWebSearch";

type Nav = { navigate: (n: string, p?: any) => void; goBack: () => void };

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  response?: AgentResponse;
  draftCreated?: boolean;
  time: string;
}

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const AiOrderScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { user } = useUser();
  const { colors } = useTheme();
  const insets = useSafeScreen();

  const [products, setProducts] = useState<TrainedProduct[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [memory, setMemory] = useState<AgentMemory>(createEmptyMemory());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const C = {
    bg: colors.background,
    card: colors.cardBackground,
    border: colors.cardBorder,
    bright: colors.textPrimary,
    muted: colors.textSecondary,
    orange: "#FF6600",
    green: "#16A34A",
    red: "#DC2626",
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const org = user?.organisationId ?? undefined;
      const [prods, custs, bls] = await Promise.all([
        getProducts(org),
        getCustomers(org),
        fetchBills(org).catch(() => []),
      ]);
      setProducts(prods.filter((p: any) => p.active !== false).map((p: any) => ({
        id: p.id,
        name: p.name,
        defaultRate: Number(p.default_rate ?? p.defaultRate ?? 0),
        keywords: p.keywords ?? "",
        unit: p.unit ?? "SQFT",
      })));
      setCustomers(custs);
      setBills(bls);
    } catch { } finally { setLoading(false); }
  }, [user?.organisationId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const scrollToBottom = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

  // L10: Load conversation from previous session on mount
  useFocusEffect(
    useCallback(() => {
      loadConversation().then(saved => {
        if (!messagesLoaded) {
          setMessages(saved && saved.length > 0 ? saved : [{
            id: "welcome", role: "agent", time: nowTime(),
            text: `🤖 Business AI ready! Tap the mic or type naturally.

Type "help" to see who you haven't billed recently + weekly digest.`,
          }]);
          setMessagesLoaded(true);
        }
      });
    }, [messagesLoaded])
  );

  const addMsg = (msg: Omit<ChatMessage, "id">): ChatMessage => {
    const full = { ...msg, id: uuid() };
    setMessages(prev => [...prev, full]);
    scrollToBottom();
    return full;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const userMsg: ChatMessage = { id: uuid(), role: "user", text, time: nowTime() };
    setMessages(prev => { const next = [...prev, userMsg]; saveConversation(next); return next; });
    scrollToBottom();
    setThinking(true);

    // L7+L9: "help" command — recurring radar + weekly digest
    if (/^help$|who to bill|remind me/i.test(text.trim())) {
      const radar = getRecurringRadar(bills, 7);
      const digest = getWeeklyDigest(bills);
      let helpText = "";
      if (radar.length > 0) helpText += `Customers not billed in 7+ days:\n${radar.map(r => `\u2022 ${r.customerName} (${r.daysSince}d ago)`).join("\n")}\n\n`;
      if (digest) {
        helpText += `This week: ${digest.billCount} bills / Rs.${digest.total.toLocaleString()}`;
        if (digest.topCustomer) helpText += ` | Top: ${digest.topCustomer.name}`;
        if (digest.unpaidCount > 0) helpText += `\n${digest.unpaidCount} unpaid bills need attention.`;
      }
      setThinking(false);
      const agentMsg: ChatMessage = { id: uuid(), role: "agent", time: nowTime(), text: helpText || "All clear! No pending reminders." };
      setMessages(prev => { const next = [...prev, agentMsg]; saveConversation(next); return next; });
      scrollToBottom();
      return;
    }

    // L2: Memory recall — check if input matches a known customer
    const isShortInput = text.split(" ").length <= 4;
    const hasDimensions = /\d+\s*x\s*\d+/i.test(text);
    const hasKeywords = /bill|sales|paid|unpaid|report|help|today|month/i.test(text);
    if (isShortInput && !hasDimensions && !hasKeywords) {
      const suggestions = await getAllSuggestionsForCustomer(text);
      if (suggestions.length > 0) {
        const topCustomer = suggestions[0].customerName;
        const itemLines = suggestions.map(s => `\u2022 ${s.productName} \u2014 Rs.${s.rate}/sqft (x${s.count})`).join("\n");
        setThinking(false);
        const agentMsg: ChatMessage = {
          id: uuid(), role: "agent", time: nowTime(),
          text: `I remember ${topCustomer}! Here's what they've ordered before:\n\n${itemLines}\n\nSame again, or new items?`,
        };
        setMessages(prev => { const next = [...prev, agentMsg]; saveConversation(next); return next; });
        scrollToBottom();
        return;
      }
    }

    // INTERNET SEARCH: General knowledge questions (not billing commands)
    if (isGeneralQuestion(text)) {
      const webResult = await fetchWebAnswer(text);
      setThinking(false);
      const searchText = webResult
        ? `${webResult.answer}\n\n(Source: ${webResult.source}${webResult.url ? " — " + webResult.url : ""})`
        : "I couldn't find an answer online. Try rephrasing or check your connection.";
      const agentMsg: ChatMessage = { id: uuid(), role: "agent", time: nowTime(), text: searchText };
      setMessages(prev => { const next = [...prev, agentMsg]; saveConversation(next); return next; });
      scrollToBottom();
      return;
    }

    await new Promise(r => setTimeout(r, 400));

    try {
      const { response, updatedMemory } = await processAgentMessage(
        text,
        memory,
        products,
        { bills, customers }
      );

      setMemory(updatedMemory);
      const display = agentResponseToDisplay(response, updatedMemory);
      addMsg({ role: "agent", text: display, response, time: nowTime() });
    } catch (e: any) {
      addMsg({ role: "agent", text: "❌ Error processing request. Try again.", time: nowTime() });
    } finally {
      setThinking(false);
    }
  };

  const handleCreateDraft = async (msg: ChatMessage) => {
    const r = msg.response;
    if (!r || r.task !== "BILL_CREATE") return;

    try {
      const invoiceId = uuid();
      const item = r.items[0];

      await createBill({
        id: invoiceId,
        customer: r.customer || "Customer",
        phone: r.phone || null,
        subtotal: r.total,
        gstAmt: 0,
        total: r.total,
        gst: false,
        paid: false,
        notes: `AI Draft — ${item?.description || ""} ${item?.name || ""}`,
        organisationId: user?.organisationId ?? undefined,
        status: "draft",
        items: r.items,
      });

      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, draftCreated: true } : m));
      setBills(prev => [{ id: invoiceId, customer: r.customer, total: r.total, paid: false, createdAt: new Date().toISOString() }, ...prev]);

      // L1: Learn from this bill for future memory recall
      learnFromBill({
        customerName: r.customer || "Customer",
        customerId: user?.organisationId ? `${user.organisationId}::${r.customer}` : r.customer || undefined,
        items: r.items || [],
      });

      const successMsg: ChatMessage = {
        id: uuid(), role: "agent", time: nowTime(),
        text: `Draft invoice created!\n${r.customer || "Customer"} | ${r.product} | ${r.area?.toFixed(2) ?? ""} sqft\nRs.${r.total?.toFixed(2)}\n\nGo to Bills to find your draft.`,
      };
      setMessages(prev => { const next = [...prev, successMsg]; saveConversation(next); return next; });
      scrollToBottom();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to create draft");
    }
  };

  const handleEditFirst = (msg: ChatMessage) => {
    const r = msg.response;
    if (!r || r.task !== "BILL_CREATE") return;
    const item = r.items[0];
    navigation.navigate("InvoiceCreate", {
      prefill: {
        customerName: r.customer || "",
        customerPhone: r.phone || "",
        productName: r.product || "",
        sqft: item?.qty,
        rate: item?.rate,
        description: item?.description || "",
      },
    });
  };

  // ── TASK TYPE COLOR BADGE ───────────────────────────────────────────────
  function taskBadge(task: string) {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      BILL_CREATE:   { label: "BILL_CREATE",   color: "#16A34A", bg: "#DCFCE7" },
      ORDER_CREATE:  { label: "ORDER_CREATE",  color: "#2563EB", bg: "#DBEAFE" },
      ASK:           { label: "ASK",           color: "#D97706", bg: "#FEF3C7" },
      QUERY:         { label: "QUERY",         color: "#7C3AED", bg: "#EDE9FE" },
      UPDATE:        { label: "UPDATE",        color: "#0891B2", bg: "#CFFAFE" },
      DATA_FILL:     { label: "DATA_FILL",     color: "#059669", bg: "#D1FAE5" },
      ERROR:         { label: "ERROR",         color: "#DC2626", bg: "#FEE2E2" },
      SUGGEST:       { label: "SUGGEST",       color: "#9333EA", bg: "#F3E8FF" },
    };
    const cfg = map[task];
    if (!cfg) return null;
    return (
      <View style={{ alignSelf: "flex-start", backgroundColor: cfg.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8 }}>
        <Text style={{ color: cfg.color, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 }}>{cfg.label}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={C.orange} size="large" />
        <Text style={{ color: C.muted, marginTop: 12 }}>Loading your database...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: insets.paddingTop || 44, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={C.bright} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.bright, fontSize: 17, fontFamily: "Inter_700Bold" }}>AI Agent</Text>
          <Text style={{ color: C.orange, fontSize: 11, fontFamily: "Inter_500Medium" }}>
            🧠 {products.length} products · Memory ON · Offline
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setMemory(createEmptyMemory());
            setMessages([{ id: "welcome", role: "agent", time: nowTime(), text: "🧠 Memory cleared! Starting fresh. Paste an order or ask something." }]);
          }}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.border, justifyContent: "center", alignItems: "center" }}
        >
          <Ionicons name="refresh" size={18} color={C.muted} />
        </TouchableOpacity>
      </View>

      {/* Memory bar */}
      {(memory.customerName || memory.lastProductName || memory.lastWidth) && (
        <View style={{ backgroundColor: C.orange + "10", borderBottomWidth: 1, borderBottomColor: C.orange + "30", paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <Text style={{ color: C.orange, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>💾 Memory:</Text>
          {memory.customerName && <Text style={{ fontSize: 11, color: C.muted }}>👤 {memory.customerName}</Text>}
          {memory.lastProductName && <Text style={{ fontSize: 11, color: C.muted }}>🖨️ {memory.lastProductName}</Text>}
          {memory.lastWidth && memory.lastHeight && <Text style={{ fontSize: 11, color: C.muted }}>📐 {memory.lastWidth}×{memory.lastHeight}</Text>}
          {memory.lastRate && <Text style={{ fontSize: 11, color: C.muted }}>₹{memory.lastRate}/sqft</Text>}
          {memory.sessionOrderCount > 0 && <Text style={{ fontSize: 11, color: C.orange }}>#{memory.sessionOrderCount} orders</Text>}
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          onContentSizeChange={scrollToBottom}
        >
          {messages.map((msg) => (
            <View key={msg.id} style={{ alignItems: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
              <View style={{
                maxWidth: "90%",
                backgroundColor: msg.role === "user" ? C.orange : C.card,
                borderRadius: 16,
                borderTopRightRadius: msg.role === "user" ? 4 : 16,
                borderTopLeftRadius: msg.role === "agent" ? 4 : 16,
                padding: 14,
                borderWidth: 1,
                borderColor: msg.role === "user" ? C.orange : C.border,
                shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
              }}>
                {msg.role === "agent" && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.orange + "20", justifyContent: "center", alignItems: "center" }}>
                      <Text style={{ fontSize: 12 }}>🤖</Text>
                    </View>
                    <Text style={{ color: C.orange, fontSize: 11, fontFamily: "Inter_700Bold" }}>AI AGENT</Text>
                  </View>
                )}

                {/* Task type badge */}
                {msg.response && taskBadge(msg.response.task)}

                {/* Action buttons for BILL_CREATE */}
                {msg.response?.task === "BILL_CREATE" && msg.response.items ? (
                  <View style={{ marginTop: 8, backgroundColor: C.card, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.border }}>
                    {msg.response.customer ? <Text style={{ fontSize: 13, color: C.bright, fontFamily: "Inter_700Bold", marginBottom: 8 }}>👤 {msg.response.customer}{msg.response.phone ? ` · 📞 ${msg.response.phone}` : ""}</Text> : null}
                    
                    {/* Header Row */}
                    <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6, marginBottom: 6 }}>
                      <Text style={{ flex: 2, color: C.muted, fontSize: 10, fontFamily: "Inter_700Bold" }}>PRODUCT</Text>
                      <Text style={{ flex: 0.8, color: C.muted, fontSize: 10, fontFamily: "Inter_700Bold", textAlign: "center" }}>QTY</Text>
                      <Text style={{ flex: 1, color: C.muted, fontSize: 10, fontFamily: "Inter_700Bold", textAlign: "right" }}>RATE</Text>
                      <Text style={{ flex: 1.2, color: C.muted, fontSize: 10, fontFamily: "Inter_700Bold", textAlign: "right" }}>AMT</Text>
                    </View>

                    {/* Items */}
                    {(msg.response.isMulti ? msg.response.items : (msg.response.items[0] ? [msg.response.items[0]] : [])).map((it: any, i: number) => (
                      <View key={i} style={{ flexDirection: "row", paddingVertical: 4, alignItems: "center" }}>
                        <View style={{ flex: 2 }}>
                          <Text style={{ color: C.bright, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>{it.name || "-"}</Text>
                          {it.description ? <Text style={{ color: C.muted, fontSize: 10 }}>{it.description}</Text> : null}
                        </View>
                        <Text style={{ flex: 0.8, color: C.bright, fontSize: 12, textAlign: "center" }}>{it.qty}</Text>
                        <Text style={{ flex: 1, color: C.bright, fontSize: 12, textAlign: "right" }}>₹{it.rate}</Text>
                        <Text style={{ flex: 1.2, color: C.bright, fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "right" }}>₹{it.amount?.toFixed(2) || (it.qty * it.rate).toFixed(2)}</Text>
                      </View>
                    ))}

                    {/* Total Row */}
                    <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
                      <Text style={{ color: C.orange, fontSize: 14, fontFamily: "Inter_700Bold" }}>🧾 Total: ₹{msg.response.total?.toFixed(2)}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={{
                    color: msg.role === "user" ? "#fff" : C.bright,
                    fontSize: 14, lineHeight: 22, fontFamily: "Inter_400Regular",
                  }}>
                    {msg.text}
                  </Text>
                )}

                {/* Action buttons for BILL_CREATE */}
                {msg.response?.task === "BILL_CREATE" && (
                  <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 }}>
                    {!msg.draftCreated ? (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => handleCreateDraft(msg)}
                          style={{ flex: 1, backgroundColor: C.orange, borderRadius: 10, paddingVertical: 11, alignItems: "center" }}
                        >
                          <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 }}>📋 Create Draft</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleEditFirst(msg)}
                          style={{ flex: 1, backgroundColor: C.card, borderRadius: 10, paddingVertical: 11, alignItems: "center", borderWidth: 1, borderColor: C.border }}
                        >
                          <Text style={{ color: C.bright, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>✏️ Edit First</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: "#16A34A15", borderRadius: 10, padding: 10, alignItems: "center" }}>
                        <Text style={{ color: C.green, fontFamily: "Inter_700Bold" }}>✅ Draft Invoice Created</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* SUGGEST tappable chips */}
                {msg.response?.task === "SUGGEST" && (
                  <View style={{ marginTop: 10, gap: 6 }}>
                    {(msg.response as any).suggestions.map((s: string) => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => setInput(s)}
                        style={{ backgroundColor: C.orange + "12", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.orange + "30" }}
                      >
                        <Text style={{ color: C.orange, fontSize: 13, fontFamily: "Inter_500Medium" }}>→ {s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* ASK response styling */}
                {msg.response?.task === "ASK" && (
                  <View style={{ marginTop: 8, backgroundColor: "#FEF3C720", borderRadius: 8, padding: 8 }}>
                    <Text style={{ color: "#D97706", fontSize: 12, fontFamily: "Inter_500Medium" }}>
                      💡 Type your answer below ↓
                    </Text>
                  </View>
                )}

                <Text style={{ color: msg.role === "user" ? "rgba(255,255,255,0.55)" : C.muted, fontSize: 10, marginTop: 6, textAlign: "right" }}>
                  {msg.time}
                </Text>
              </View>
            </View>
          ))}

          {thinking && (
            <View style={{ alignItems: "flex-start", marginBottom: 8 }}>
              <View style={{ backgroundColor: C.card, borderRadius: 16, borderTopLeftRadius: 4, padding: 14, borderWidth: 1, borderColor: C.border, flexDirection: "row", gap: 8, alignItems: "center" }}>
                <ActivityIndicator size="small" color={C.orange} />
                <Text style={{ color: C.muted, fontSize: 13 }}>Processing...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick prompts */}
        <View style={{ paddingHorizontal: 12, paddingBottom: 4 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {[
              "6x3 normal",
              "6x3 normal, 4x2 star",
              "Sales today?",
              "This week?",
              "Top customer?",
              "Unpaid?",
              "Last bill?",
              "help",
            ].map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => setInput(p)}
                style={{ backgroundColor: C.orange + "15", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8, borderWidth: 1, borderColor: C.orange + "40" }}
              >
                <Text style={{ color: C.orange, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Input bar */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingBottom: (insets.paddingBottom || 0) + 10, gap: 8, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 }}>
          <TextInput
            style={{ flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: C.border, color: C.bright, fontSize: 14, maxHeight: 120 }}
            value={input}
            onChangeText={setInput}
            placeholder="Type order or question..."
            placeholderTextColor={C.muted}
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || thinking}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: input.trim() ? C.orange : C.border, justifyContent: "center", alignItems: "center" }}
          >
            <Ionicons name="send" size={18} color={input.trim() ? "#fff" : C.muted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};
