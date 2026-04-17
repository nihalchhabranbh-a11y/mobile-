import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../themeContext";
import { useUser } from "../userContext";
import { loadBrand, saveBrand, Brand } from "../services/settingsService";
import { supabase } from "../services/supabaseClient";
import { useSafeScreen } from "../hooks/useSafeScreen";

export const SettingsScreen: React.FC = () => {
  const { colors, spacing, radius, mode, toggleTheme } = useTheme();
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const insets = useSafeScreen();
  const styles = useMemo(
    () => createStyles({ colors, spacing, radius }),
    [colors, spacing, radius]
  );
  const scrollRef = React.useRef<ScrollView | null>(null);
  const [anchors, setAnchors] = useState({
    businessY: 0,
    invoiceY: 0,
    accountY: 0,
  });
  const safeSetAnchor = useCallback(
    (key: "businessY" | "invoiceY" | "accountY", e: any) => {
      const y = e?.nativeEvent?.layout?.y;
      if (typeof y !== "number") return;
      setAnchors((p) => ({ ...p, [key]: y }));
    },
    []
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brand, setBrand] = useState<Brand>({
    shopName: null,
    address: null,
    phone: null,
    whatsapp: null,
    gstNumber: null,
    panNumber: null,
    bankName: null,
    accountName: null,
    accountNumber: null,
    ifscCode: null,
    branchName: null,
    authorisedSignatory: null,
    upiId: null,
    businessEmail: null,
    invoicePrintType: null,
    thermalPaperMm: null,
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [waTemplate, setWaTemplate] = useState("");
  const [waRemindersEnabled, setWaRemindersEnabled] = useState(false);
  const [waLoading, setWaLoading] = useState(true);

  const WA_TEMPLATE_KEY = "pm_whatsapp_template_v1";
  const WA_REMINDERS_KEY = "pm_whatsapp_reminders_enabled_v1";

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const b = await loadBrand(user?.organisationId ?? null);
      setBrand(b);
      setWaLoading(true);
      const [tpl, rem] = await Promise.all([
        AsyncStorage.getItem(WA_TEMPLATE_KEY),
        AsyncStorage.getItem(WA_REMINDERS_KEY),
      ]);
      setWaTemplate(
        tpl ||
          "*Invoice from {shopName}*\n\nHi {customerName},\nYour invoice *{invoiceId}* is ready.\nTotal: {total}\nStatus: {status}\n\nView: {invLink}\nPay: {payLink}\n\nThank you,\n{shopName}"
      );
      setWaRemindersEnabled(rem === "1");
    } catch (e) {
      console.warn("[Settings] load failed", e);
    } finally {
      setLoading(false);
      setWaLoading(false);
    }
  }, [user?.organisationId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSaveBrand = async () => {
    try {
      setSaving(true);
      await saveBrand(brand, user?.organisationId ?? null);
      Alert.alert("Saved", "Brand settings saved.");
    } catch (e) {
      console.warn("[Settings] saveBrand failed", e);
      Alert.alert("Error", "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 4) {
      Alert.alert("Invalid", "Password must be at least 4 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "Passwords do not match.");
      return;
    }
    if (!user?.username) {
      Alert.alert("Error", "You must be logged in to change password.");
      return;
    }
    try {
      setSavingPassword(true);
      // Update org_admins by username (single-org: one admin per username)
      const { error } = await supabase
        .from("org_admins")
        .update({ password: newPassword })
        .eq("username", user.username);
      if (error) {
        // Fallback: try workers table
        const { error: err2 } = await supabase
          .from("workers")
          .update({ password: newPassword })
          .eq("username", user.username);
        if (err2) throw err2;
      }
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Done", "Password updated.");
    } catch (e) {
      console.warn("[Settings] change password failed", e);
      Alert.alert("Error", "Failed to update password. Check your account type.");
    } finally {
      setSavingPassword(false);
    }
  };

  const updateBrand = (key: keyof Brand, value: string | number | null) => {
    setBrand((prev) => ({ ...prev, [key]: value }));
  };

  const saveWhatsAppSettings = async () => {
    try {
      await AsyncStorage.setItem(WA_TEMPLATE_KEY, waTemplate);
      await AsyncStorage.setItem(WA_REMINDERS_KEY, waRemindersEnabled ? "1" : "0");
      Alert.alert("Saved", "WhatsApp settings saved.");
    } catch (e) {
      Alert.alert("Error", "Failed to save WhatsApp settings.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accentBlue} />
          <Text style={styles.loadingText}>Loading settings…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        ref={scrollRef as any}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.paddingTop || spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Settings</Text>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>Business</Text>
          <View style={styles.groupCard}>
            <Row
              icon="business-outline"
              label="Company Details"
              onPress={() => navigation.navigate("CompanyDetails")}
              styles={styles}
              colors={colors}
            />
            <Row
              icon="document-text-outline"
              label="Invoice Printer Settings"
              onPress={() => scrollRef.current?.scrollTo({ y: anchors.invoiceY, animated: true })}
              styles={styles}
              colors={colors}
            />
          </View>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>Account</Text>
          <View style={styles.groupCard}>
            <Row
              icon="person-circle-outline"
              label="Account Settings"
              onPress={() => scrollRef.current?.scrollTo({ y: anchors.accountY, animated: true })}
              styles={styles}
              colors={colors}
            />
            <Row
              icon="people-outline"
              label="Manage Users"
              onPress={() => navigation.navigate("ManageUser")}
              styles={styles}
              colors={colors}
            />
            <Row
              icon="star-outline"
              label="Subscription & Billing"
              onPress={() => navigation.navigate("Subscription")}
              styles={styles}
              colors={colors}
              isLast
            />
          </View>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>Tools</Text>
          <View style={styles.groupCard}>
            <Row
              icon="search-outline"
              label="GST Rate Finder"
              onPress={() => navigation.navigate("GstFinder")}
              styles={styles}
              colors={colors}
            />
            <Row
              icon="trash-outline"
              label="Recover Deleted Invoices"
              onPress={() => navigation.navigate("RecoverDeleted")}
              styles={styles}
              colors={colors}
              isLast
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <TouchableOpacity style={styles.toggleRow} onPress={toggleTheme}>
            <Text style={styles.toggleLabel}>Dark mode</Text>
            <View style={[styles.toggleBox, mode === "dark" && styles.toggleBoxOn]}>
              <View style={[styles.toggleKnob, mode === "dark" && styles.toggleKnobOn]} />
            </View>
          </TouchableOpacity>
        </View>

        <View
          style={styles.section}
          onLayout={(e) => safeSetAnchor("invoiceY", e)}
        >
          <Text style={styles.sectionTitle}>Printer</Text>
          <Text style={styles.label}>Invoice print type</Text>
          <View style={styles.printerRow}>
            <TouchableOpacity
              style={[styles.printerOption, brand.invoicePrintType === "a4" && styles.printerOptionActive]}
              onPress={async () => {
                updateBrand("invoicePrintType", "a4");
                try {
                  await saveBrand({ ...brand, invoicePrintType: "a4" }, user?.organisationId ?? null);
                  Alert.alert("Saved", "A4 printer selected.");
                } catch (e) {
                  Alert.alert("Error", "Failed to save.");
                }
              }}
            >
              <Text style={[styles.printerOptionText, brand.invoicePrintType === "a4" && styles.printerOptionTextActive]}>A4 Printer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.printerOption, brand.invoicePrintType === "thermal" && styles.printerOptionActive]}
              onPress={async () => {
                updateBrand("invoicePrintType", "thermal");
                try {
                  await saveBrand({ ...brand, invoicePrintType: "thermal" }, user?.organisationId ?? null);
                  Alert.alert("Saved", "Thermal printer selected.");
                } catch (e) {
                  Alert.alert("Error", "Failed to save.");
                }
              }}
            >
              <Text style={[styles.printerOptionText, brand.invoicePrintType === "thermal" && styles.printerOptionTextActive]}>Thermal Printer</Text>
            </TouchableOpacity>
          </View>
        </View>



        <View
          style={styles.section}
          onLayout={(e) => safeSetAnchor("accountY", e)}
        >
          <Text style={styles.sectionTitle}>Change password</Text>
          <Text style={styles.label}>New password</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />
          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />
          <TouchableOpacity style={styles.primaryButton} onPress={handleChangePassword} disabled={savingPassword}>
            {savingPassword ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryButtonText}>Update password</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WhatsApp</Text>
          <Text style={styles.helper}>
            Template placeholders: {"{shopName} {customerName} {invoiceId} {total} {paid} {remaining} {date} {invLink} {payLink} {status}"}
          </Text>
          <Text style={styles.label}>Invoice message template</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={waTemplate}
            onChangeText={setWaTemplate}
            placeholder="Enter WhatsApp template"
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setWaRemindersEnabled((v) => !v)}
          >
            <Text style={styles.toggleLabel}>Enable payment reminders</Text>
            <View style={[styles.toggleBox, waRemindersEnabled && styles.toggleBoxOn]}>
              <View style={[styles.toggleKnob, waRemindersEnabled && styles.toggleKnobOn]} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={saveWhatsAppSettings} disabled={waLoading}>
            {waLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryButtonText}>Save WhatsApp</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

function Row({
  icon,
  label,
  onPress,
  styles,
  colors,
  isLast,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  styles: any;
  colors: any;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.groupRow, !isLast && styles.groupRowDivider]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon as any} size={20} color={colors.textSecondary} />
      <Text style={styles.groupRowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function Field({
  label,
  value,
  onChange,
  styles: s,
  colors,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  styles: any;
  colors: any;
}) {
  return (
    <>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor={colors.textMuted}
      />
    </>
  );
}

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
    safeArea: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
    loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.sm },
    loadingText: { color: colors.textMuted, fontSize: 12 },
    title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: spacing.lg },
    group: { marginBottom: spacing.lg },
    groupTitle: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: spacing.sm, marginLeft: spacing.xs },
    groupCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      overflow: "hidden",
    },
    groupRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      gap: spacing.md,
    },
    groupRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
    groupRowLabel: { flex: 1, color: colors.textPrimary, fontSize: 15, fontFamily: "Inter_500Medium" },
    section: { marginBottom: spacing.xl },
    sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "600", marginBottom: spacing.md },
    label: { color: colors.textSecondary, fontSize: 12, marginBottom: 4, marginTop: spacing.sm },
    helper: { color: colors.textMuted, fontSize: 11, marginTop: -spacing.xs, lineHeight: 16 },
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
    inputMultiline: { minHeight: 120, textAlignVertical: "top" },
    primaryButton: {
      marginTop: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.accentBlue,
      alignItems: "center",
    },
    primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.sm,
    },
    toggleLabel: { color: colors.textPrimary, fontSize: 15 },
    toggleBox: {
      width: 50,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.cardBorder,
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    toggleBoxOn: { backgroundColor: colors.accentBlue },
    toggleKnob: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "#fff",
      alignSelf: "flex-start",
    },
    toggleKnobOn: { alignSelf: "flex-end" },
    printerRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
    printerOption: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
    },
    printerOptionActive: { borderColor: colors.accentBlue, backgroundColor: colors.accentBlue + "18" },
    printerOptionText: { color: colors.textSecondary, fontSize: 14 },
    printerOptionTextActive: { color: colors.accentBlue, fontWeight: "600" },
  });
