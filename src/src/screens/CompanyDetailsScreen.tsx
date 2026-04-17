import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../themeContext";
import { useSafeScreen } from "../hooks/useSafeScreen";
import { loadBrand, saveBrand, Brand } from "../services/settingsService";
import { useUser } from "../userContext";
import * as ImagePicker from "expo-image-picker";

export const CompanyDetailsScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeScreen();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  const [form, setForm] = useState<Partial<Brand>>({});
  const [logoUri, setLogoUri] = useState<string | null>(null);

  useEffect(() => {
    fetchBrand();
  }, [user]);

  const fetchBrand = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const b = await loadBrand(user.organisationId);
      // Pre-fill phone from login if company phone is blank
      if (!b.phone && user.phone) {
        b.phone = user.phone.replace(/\D/g, "").slice(-10);
      }
      setForm(b);
    } catch (e) {
      console.warn("Failed to load company details", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveBrand(form, user?.organisationId);
      setEditing(false);
      Alert.alert("Success", "Company details saved successfully!");
    } catch (e) {
      Alert.alert("Error", "Failed to save details");
    } finally {
      setSaving(false);
    }
  };

  const pickLogo = async () => {
    if (!editing) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLogoUri(result.assets[0].uri);
      }
    } catch (e) {
      console.warn("Failed to pick image", e);
    }
  };

  const S = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#F7F8FA" }, // gray background to match screenshot
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      backgroundColor: "#fff",
      zIndex: 10,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      color: "#000",
      marginLeft: spacing.sm,
    },
    editBtn: {
      backgroundColor: "#FFF3CD",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.md,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    editBtnText: {
      color: "#856404",
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
    },
    saveBtn: {
      backgroundColor: colors.accentBlue,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.md,
    },
    saveBtnText: {
      color: "#fff",
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
    },
    scroll: { flex: 1 },
    contentCard: {
      backgroundColor: "#fff",
      margin: spacing.md,
      marginTop: 40,
      borderRadius: radius.lg,
      padding: spacing.md,
      paddingTop: 50,
      elevation: 2,
    },
    logoWrap: {
      position: "absolute",
      top: -30,
      alignSelf: "center",
      width: 70,
      height: 70,
      borderRadius: 16,
      backgroundColor: "#fff",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#E5E7EB",
      elevation: 3,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      overflow: "hidden",
    },
    logoImg: { width: "100%", height: "100%" },
    fieldWrap: {
      marginBottom: spacing.md,
    },
    fieldLabel: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: "Inter_500Medium",
      marginBottom: 2,
    },
    fieldValue: {
      fontSize: 15,
      color: colors.textPrimary,
      fontFamily: "Inter_500Medium",
      paddingVertical: 4,
    },
    input: {
      fontSize: 15,
      color: colors.textPrimary,
      fontFamily: "Inter_500Medium",
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      paddingVertical: 4,
    },
    addressCard: {
      backgroundColor: "#fff",
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      elevation: 1,
    },
    addressCardTitle: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.textPrimary,
    },
    sectionTitle: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.textPrimary,
      marginLeft: spacing.lg,
      marginBottom: spacing.xs,
      marginTop: spacing.sm,
    },
    optionalRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    optionalTitle: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.textPrimary,
    },
    optionalSubtitle: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    upiHint: {
      fontSize: 11,
      color: "#2563EB",
      fontFamily: "Inter_400Regular",
      marginTop: 2,
      marginBottom: 4,
    },
  });

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.accentBlue} />
      </View>
    );
  }

  const Field = ({ label, value, keyName, autoCapitalize = "none" }: { label: string; value: string; keyName: keyof Brand; autoCapitalize?: "none" | "sentences" | "words" | "characters" }) => (
    <View style={S.fieldWrap}>
      <Text style={S.fieldLabel}>{label}</Text>
      {editing ? (
        <TextInput
          style={S.input}
          value={value}
          onChangeText={(v) => setForm({ ...form, [keyName]: v })}
          placeholder={`Enter ${label}`}
          placeholderTextColor={colors.textMuted}
          autoCapitalize={autoCapitalize}
        />
      ) : (
        <Text style={S.fieldValue}>{value || "NA"}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={S.safeArea}>
      <View style={[S.header, { paddingTop: insets.paddingTop || spacing.md }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>Company Details</Text>
        {editing ? (
          <TouchableOpacity onPress={handleSave} style={S.saveBtn} disabled={saving}>
            <Text style={S.saveBtnText}>{saving ? "Saving..." : "Save"}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)} style={S.editBtn}>
            <Ionicons name="create-outline" size={16} color="#856404" />
            <Text style={S.editBtnText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={S.scroll} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={S.contentCard}>
          <TouchableOpacity style={S.logoWrap} onPress={pickLogo} activeOpacity={editing ? 0.7 : 1}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={S.logoImg} />
            ) : (
              <Ionicons name="image-outline" size={32} color="#4B5563" />
            )}
          </TouchableOpacity>

          <Field label="Business/Company Name" value={form.shopName || ""} keyName="shopName" autoCapitalize="words" />
          <Field label="GST Number" value={form.gstNumber || ""} keyName="gstNumber" autoCapitalize="characters" />
          <Field label="Business Phone No." value={form.phone || ""} keyName="phone" />
          <Field label="Business Email" value={form.businessEmail || ""} keyName="businessEmail" />
        </View>

        <Text style={S.sectionTitle}>Bank & UPI Details</Text>
        <View style={S.contentCard}>
          <Field label="Bank Name" value={form.bankName || ""} keyName="bankName" autoCapitalize="words" />
          <Field label="Account Name" value={form.accountName || ""} keyName="accountName" autoCapitalize="words" />
          <Field label="Account Number" value={form.accountNumber || ""} keyName="accountNumber" />
          <Field label="IFSC Code" value={form.ifscCode || ""} keyName="ifscCode" autoCapitalize="characters" />
          <Field label="Branch Name" value={form.branchName || ""} keyName="branchName" autoCapitalize="words" />
          <Field label="UPI ID" value={form.upiId || ""} keyName="upiId" />
          {editing && (
            <Text style={S.upiHint}>
              💡 e.g. 9876543210@ybl · 9876543210@okaxis · yourname@gpay
            </Text>
          )}
        </View>

        <Text style={S.sectionTitle}>Billing Address</Text>
        <View style={S.contentCard}>
          <Field label="Billing Address" value={form.address || ""} keyName="address" autoCapitalize="sentences" />
        </View>

        <Text style={S.sectionTitle}>Shipping Address</Text>
        <TouchableOpacity style={S.addressCard}>
          <Ionicons name="add-circle" size={20} color="#6B7280" />
          <Text style={S.addressCardTitle}>Shipping Address</Text>
        </TouchableOpacity>

        <TouchableOpacity style={S.optionalRow} onPress={() => setShowOptional(!showOptional)}>
          <View>
            <Text style={S.optionalTitle}>Optional Fields</Text>
            <Text style={S.optionalSubtitle}>Pan Number, Alternate Contact Number, Signature</Text>
          </View>
          <Ionicons name={showOptional ? "chevron-up" : "chevron-down"} size={20} color="#000" />
        </TouchableOpacity>

        {showOptional && (
          <View style={[S.contentCard, { marginTop: 0, paddingTop: spacing.md }]}>
            <Field label="PAN Number" value={form.panNumber || ""} keyName="panNumber" autoCapitalize="characters" />
            <Field label="WhatsApp/Alternate No." value={form.whatsapp || ""} keyName="whatsapp" />
            <Field label="Authorised Signatory Name" value={form.authorisedSignatory || ""} keyName="authorisedSignatory" autoCapitalize="words" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
