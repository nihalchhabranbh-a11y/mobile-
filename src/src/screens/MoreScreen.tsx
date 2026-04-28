import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../themeContext";
import { useUser } from "../userContext";
import { loadBrand, Brand } from "../services/settingsService";
import { useSafeScreen } from "../hooks/useSafeScreen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { OnboardingGuide, shouldShowOnboarding } from "../components/OnboardingGuide";

type Nav = { navigate: (name: string) => void };

export const MoreScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const { user, setUser } = useUser();
  const navigation = useNavigation<Nav>();
  const insets = useSafeScreen();
  
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Profile completion states
  const [completionScore, setCompletionScore] = useState(0);
  const [missingFields, setMissingFields] = useState<{label: string, screen: string}[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const b = await loadBrand(user?.organisationId);
      setBrand(b);
      await calculateProfileCompletion(b);
    } catch (e) {
      console.warn("[More] loadBrand failed", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Show onboarding for new users (once)
  useEffect(() => {
    if (user?.isNewUser) {
      shouldShowOnboarding(true).then((should) => {
        if (should) setShowOnboarding(true);
      });
    }
  }, [user?.isNewUser]);

  const calculateProfileCompletion = async (b: Brand) => {
    const checks = [
      { label: "+ Company", isDone: !!b.shopName && !!b.phone, screen: "CompanyDetails" },
      { label: "+ Bank", isDone: !!b.bankName || !!b.accountNumber, screen: "CompanyDetails" },
      { label: "+ Address", isDone: !!b.address, screen: "CompanyDetails" },
      { label: "+ Email", isDone: !!b.businessEmail || !!user?.name, screen: "UserProfile" }, // Assuming user profile implies email
      { label: "+ Signature", isDone: !!b.authorisedSignatory && b.authorisedSignatory.trim().length > 0, screen: "Settings" }
    ];

    const completed = checks.filter(c => c.isDone).length;
    const score = Math.round((completed / checks.length) * 100);
    setCompletionScore(score);
    setMissingFields(checks.filter(c => !c.isDone));

    if (score === 100) {
      const congratsShown = await AsyncStorage.getItem("profile_congrats_shown");
      if (congratsShown !== "true") {
        Alert.alert("🎉 Congratulations!", "Your profile is 100% complete! Great job setting up your business.");
        await AsyncStorage.setItem("profile_congrats_shown", "true");
      }
    }
  };

  const companyName = (brand?.shopName || user?.name || "My Business").toUpperCase();
  const initial = companyName.charAt(0) || "B";

  const S = React.useMemo(() => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing.md, paddingBottom: 100 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: insets.paddingTop || spacing.md,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.cardBackground,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.accentBlue + "20",
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: {
      color: colors.accentBlue,
      fontSize: 16,
      fontFamily: "Inter_700Bold",
    },
    headerName: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: colors.textPrimary,
    },
    watermarkBanner: {
      backgroundColor: "#F97316",
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      borderRadius: radius.md,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
      gap: spacing.sm,
      elevation: 3,
      shadowColor: "#F97316",
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    watermarkTitle: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: "#fff",
    },
    watermarkSubtitle: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: "rgba(255,255,255,0.85)",
    },
    completionCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.lg,
      elevation: 2,
    },
    completionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    completionTitle: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: colors.textPrimary,
    },
    completionSubtitle: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.textSecondary,
    },
    completionScoreWrap: {
      flexDirection: "row",
      alignItems: "baseline",
    },
    completionScore: {
      fontSize: 24,
      fontFamily: "Inter_700Bold",
      color: colors.textPrimary,
    },
    completionPercent: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.textSecondary,
    },
    progressBarBg: {
      height: 6,
      backgroundColor: colors.divider,
      borderRadius: 3,
      marginVertical: spacing.sm,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      backgroundColor: colors.accentBlue,
      borderRadius: 3,
    },
    missingFieldsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginTop: spacing.sm,
    },
    missingFieldBtn: {
      paddingVertical: 4,
    },
    missingFieldText: {
      color: colors.accentBlue,
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
    },
    sectionTitle: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: colors.textPrimary,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
    },
    sectionCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: radius.lg,
      marginBottom: spacing.lg,
      overflow: "hidden",
      elevation: 1,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    rowIcon: {
      width: 28,
      alignItems: "center",
    },
    rowText: {
      flex: 1,
      marginLeft: spacing.sm,
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.textPrimary,
    },
    planFooter: {
      backgroundColor: colors.accentBlue,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: spacing.md,
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
    },
    planFooterContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    planFooterTitle: {
      color: "#fff",
      fontSize: 15,
      fontFamily: "Inter_700Bold",
    },
    planFooterSubtitle: {
      color: "#fff",
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      opacity: 0.9,
    },
  }), [spacing, radius, insets, colors]);

  const profileItems = [
    { icon: "business-outline", label: "Company Details", screen: "CompanyDetails" },
    { icon: "person-outline", label: "User Profile", screen: "UserProfile" },
    { icon: "people-outline", label: "Users & Roles", screen: "ManageUser" },
  ];

  const settingsItems = [
    { icon: "settings-outline", label: "General Settings", screen: "Settings" },
    { icon: "business-outline", label: "Bank Details", screen: "CompanyDetails" },
    { icon: "log-out-outline", label: "Log Out", action: "logout", color: "#EF4444" },
  ];

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Log Out", style: "destructive", onPress: () => setUser(null) }
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.accentBlue} />
      </View>
    );
  }

  const renderSection = (title: string, items: any[]) => (
    <View>
      <Text style={S.sectionTitle}>{title}</Text>
      <View style={S.sectionCard}>
        {items.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={S.row}
            onPress={() => item.action === "logout" ? handleLogout() : item.screen && navigation.navigate(item.screen)}
            activeOpacity={0.7}
          >
            <View style={S.rowIcon}>
              <Ionicons name={item.icon} size={20} color={item.color || colors.textSecondary} />
            </View>
            <Text style={[S.rowText, item.color && { color: item.color }]}>{item.label}</Text>
            {item.action !== "logout" && <Ionicons name="chevron-forward" size={16} color={colors.accentBlue} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={S.safeArea}>
      <OnboardingGuide
        visible={showOnboarding}
        onDone={() => setShowOnboarding(false)}
      />
      <View style={S.header}>
        <View style={S.headerLeft}>
          <View style={S.avatar}>
            <Text style={S.avatarText}>{initial}</Text>
          </View>
          <Text style={S.headerName}>{companyName}</Text>
        </View>
        <TouchableOpacity>
          <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={S.scroll} contentContainerStyle={S.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Upgrade Banner */}
        <TouchableOpacity style={S.watermarkBanner} onPress={() => navigation.navigate("Subscription")} activeOpacity={0.85}>
          <MaterialCommunityIcons name="crown" size={24} color="#FEF9C3" />
          <View style={{ flex: 1 }}>
            <Text style={S.watermarkTitle}>⚡ Upgrade to Business Manager Pro</Text>
            <Text style={S.watermarkSubtitle}>Pay via UPI — Activate Instantly</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>

        {/* Profile Completed Card */}
        <View style={S.completionCard}>
          <View style={S.completionHeader}>
            <View>
              <Text style={S.completionTitle}>Profile Completed</Text>
              <Text style={S.completionSubtitle}>Complete your pending action(s) to reach 100%</Text>
            </View>
            <View style={S.completionScoreWrap}>
              <Text style={S.completionScore}>{completionScore}</Text>
              <Text style={S.completionPercent}>%</Text>
            </View>
          </View>
          
          <View style={S.progressBarBg}>
            <View style={[S.progressBarFill, { width: `${completionScore}%` }]} />
          </View>

          {missingFields.length > 0 && (
            <View style={S.missingFieldsRow}>
              {missingFields.map((f, i) => (
                <TouchableOpacity key={i} style={S.missingFieldBtn} onPress={() => navigation.navigate(f.screen)}>
                  <Text style={S.missingFieldText}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {renderSection("Profile", profileItems)}
        {renderSection("Settings", settingsItems)}

      </ScrollView>

      {/* Persistent Bottom Banner */}
      <TouchableOpacity style={S.planFooter} onPress={() => navigation.navigate("Subscription")} activeOpacity={0.85}>
        <View style={S.planFooterContent}>
          <MaterialCommunityIcons name="crown" size={20} color="#FBBF24" />
          <View>
            <Text style={S.planFooterTitle}>Current Plan: FREE</Text>
            <Text style={S.planFooterSubtitle}>Tap to Upgrade via UPI →</Text>
          </View>
        </View>
        <Ionicons name="arrow-forward-circle" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};
