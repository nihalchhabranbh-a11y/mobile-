/**
 * ChatScreen.tsx
 * In-app team / worker chat with message bubbles.
 * Uses Supabase realtime subscriptions for live updates.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, StatusBar,
  ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../themeContext";
import { useUser } from "../userContext";
import { supabase } from "../src/services/supabaseClient";
import { RealtimeChannel } from "@supabase/supabase-js";

type Message = {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
};

type ChatRoom = { id: string; name: string; avatar: string };

// Demo rooms — in production fetch from a `chat_rooms` table
const ROOMS: ChatRoom[] = [
  { id: "general",    name: "General",        avatar: "💬" },
  { id: "billing",    name: "Billing Team",   avatar: "🧾" },
  { id: "production", name: "Production",     avatar: "⚙️" },
  { id: "delivery",   name: "Delivery",       avatar: "🚚" },
];

// ─────────────────────────────────────────────────────────────
export function ChatScreen() {
  const { colors, mode } = useTheme();
  const { user }         = useUser();
  const navigation       = useNavigation<any>();

  const [room,     setRoom]     = useState<ChatRoom>(ROOMS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text,     setText]     = useState("");
  const [loading,  setLoading]  = useState(false);

  const listRef = useRef<FlatList>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const dark = mode === "dark";
  const bg   = dark ? "#0F1117" : "#F0F4FF";
  const card = dark ? "#1C1C2E" : "#FFFFFF";
  const txt  = dark ? "#F1F5F9" : "#111827";
  const sub  = dark ? "#94A3B8" : "#6B7280";
  const myId = user?.id ?? "";

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, sender_id, sender_name, content, created_at")
        .eq("room_id", room.id)
        .eq("organisation_id", user?.organisationId ?? "")
        .order("created_at", { ascending: true })
        .limit(60);
      if (data) setMessages(data as Message[]);
    } catch (_) {
      // If table doesn't exist yet, show empty state gracefully
      setMessages([]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [room, user]);

  // Realtime subscription
  useEffect(() => {
    loadMessages();
    
    // In Supabase Realtime JS, 'filter' strictly supports only one column (e.g. 'room_id=eq.X').
    // We filter by room_id server-side, and apply organisation_id filtering client-side
    // to prevent cross-organisation leaks while retaining valid filter syntax.
    const ch = supabase
      .channel(`chat:${room.id}:${user?.organisationId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        filter: `room_id=eq.${room.id}`,
      }, (payload) => {
        const newMsg = payload.new as Message & { organisation_id?: string; room_id?: string };
        
        // Data leakage guard: ignore messages from other orgs
        if (newMsg.organisation_id && newMsg.organisation_id !== user?.organisationId) {
          return;
        }

        setMessages((m) => {
          // Deduplication: if the sender is me, try to replace the optimistic message
          if (newMsg.sender_id === myId) {
            const tempIdx = m.findIndex((x) => x.id.startsWith("temp_") && x.content === newMsg.content);
            if (tempIdx !== -1) {
              const newList = [...m];
              newList[tempIdx] = newMsg;
              return newList;
            }
          }
          // Prevent standard duplicates
          if (m.some((x) => x.id === newMsg.id)) return m;
          return [...m, newMsg];
        });
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      })
      .subscribe();
    channelRef.current = ch;
    return () => { ch.unsubscribe(); };
  }, [loadMessages, room.id, user, myId]);

  const sendMessage = async () => {
    const content = text.trim();
    if (!content) return;
    if (!user?.id) {
      Alert.alert("Error", "You must be logged in to send messages.");
      return;
    }
    setText("");

    const tempId = `temp_${Date.now()}`;
    const msg: Message = {
      id:          tempId,
      sender_id:   myId,
      sender_name: user?.username ?? "You",
      content,
      created_at:  new Date().toISOString(),
    };
    // Optimistic update
    setMessages((m) => [...m, msg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      const { error } = await supabase.from("chat_messages").insert({
        room_id:         room.id,
        organisation_id: user?.organisationId,
        sender_id:       user.id,
        sender_name:     user?.username ?? "Unknown",
        content,
      });
      if (error) throw error;
    } catch (_) {
      Alert.alert("Error", "Failed to send message. Check your connection.");
      // Rollback optimistic update on failure
      setMessages((m) => m.filter((x) => x.id !== tempId));
    }
  };

  const handleAttach = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to share images."); return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      Alert.alert("Image selected", "Image sharing coming soon! (pending storage setup)");
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender_id === myId;
    const prevItem = messages[index - 1];
    const showName = !isMe && (!prevItem || prevItem.sender_id !== item.sender_id);
    const time = new Date(item.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isMe && (
          <View style={[styles.msgAvatar, { backgroundColor: "#2563EB18" }]}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#2563EB" }}>
              {item.sender_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ maxWidth: "72%" }}>
          {showName && (
            <Text style={[styles.msgSender, { color: sub }]}>{item.sender_name}</Text>
          )}
          <View style={[
            styles.bubble,
            isMe
              ? { backgroundColor: "#2563EB", borderBottomRightRadius: 4 }
              : { backgroundColor: card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: dark ? "#2A2A3C" : "#E5E7EB" },
          ]}>
            <Text style={[styles.bubbleTxt, { color: isMe ? "#fff" : txt }]}>{item.content}</Text>
          </View>
          <Text style={[styles.bubbleTime, { color: sub, textAlign: isMe ? "right" : "left" }]}>{time}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />

      {/* Header */}
      <LinearGradient colors={["#1E293B", "#0F172A"]} start={[0,0]} end={[1,1]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, marginHorizontal: 8 }}>{room.avatar}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{room.name}</Text>
          <Text style={styles.headerSub}>Team Chat · Live</Text>
        </View>
        <View style={styles.liveDot} />
      </LinearGradient>

      {/* Room chips */}
      <View style={{ backgroundColor: bg }}>
        <FlatList
          data={ROOMS}
          horizontal showsHorizontalScrollIndicator={false}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setRoom(item)}
              style={[
                styles.roomChip,
                {
                  backgroundColor: room.id === item.id ? "#2563EB" : card,
                  borderColor: room.id === item.id ? "#2563EB" : (dark ? "#2A2A3C" : "#E5E7EB"),
                },
              ]}
            >
              <Text style={{ fontSize: 14 }}>{item.avatar}</Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: room.id === item.id ? "#fff" : txt }}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={0}>

        {/* Messages */}
        {loading ? (
          <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 60 }} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: 14, gap: 4, paddingBottom: 8 }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", marginTop: 80, gap: 12 }}>
                <Text style={{ fontSize: 40 }}>{room.avatar}</Text>
                <Text style={{ color: txt, fontSize: 16, fontFamily: "Inter_600SemiBold" }}>
                  {room.name}
                </Text>
                <Text style={{ color: sub, fontSize: 13 }}>No messages yet. Say hi! 👋</Text>
              </View>
            }
          />
        )}

        {/* Input */}
        <View style={[styles.inputBar, { backgroundColor: card, borderTopColor: dark ? "#2A2A3C" : "#E5E7EB" }]}>
          <TouchableOpacity style={[styles.attachBtn, { backgroundColor: dark ? "#1E293B" : "#F1F5F9" }]} onPress={handleAttach}>
            <Ionicons name="attach" size={20} color={sub} />
          </TouchableOpacity>
          <TextInput
            style={[styles.msgInput, { color: txt, backgroundColor: dark ? "#1E293B" : "#F8FAFF" }]}
            placeholder="Type a message…"
            placeholderTextColor={sub}
            value={text}
            onChangeText={setText}
            multiline
            blurOnSubmit={false}
          />
          <TouchableOpacity
            onPress={sendMessage}
            style={[styles.sendBtn, { backgroundColor: text.trim() ? "#2563EB" : (dark ? "#1E293B" : "#E5E7EB") }]}
          >
            <Ionicons name="send" size={18} color={text.trim() ? "#fff" : sub} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: Platform.OS === "android" ? 14 : 6, paddingBottom: 16,
  },
  backBtn:    { padding: 4 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub:   { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginTop: 1 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" },
  roomChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  msgRow:      { flexDirection: "row", marginVertical: 2, alignItems: "flex-end", gap: 6 },
  msgRowRight: { justifyContent: "flex-end" },
  msgRowLeft:  { justifyContent: "flex-start" },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  msgSender: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 3, marginLeft: 4 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleTxt: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  bubbleTime: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 3, marginHorizontal: 4 },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1,
  },
  attachBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  msgInput: {
    flex: 1, borderRadius: 18, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 9,
    maxHeight: 100, fontSize: 14, fontFamily: "Inter_400Regular",
  },
  sendBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
});
