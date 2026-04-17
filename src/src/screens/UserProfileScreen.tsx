import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../themeContext";
import { useSafeScreen } from "../hooks/useSafeScreen";
import { useUser } from "../userContext";
import { supabase } from "../services/supabaseClient";

export const UserProfileScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeScreen();
  const { user, setUser } = useUser();

  const handleLogout = async () => {
    Alert.alert("Confirm Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          setUser(null);
        },
      },
    ]);
  };

  const S = React.useMemo(() => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#F7F8FA" },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingBottom: spacing.sm, backgroundColor: "#fff", zIndex: 10 },
    headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#000", marginLeft: spacing.sm },
    scroll: { flex: 1 },
    sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.textPrimary, marginLeft: spacing.lg, marginBottom: spacing.xs, marginTop: spacing.lg },
    card: { backgroundColor: "#fff", marginHorizontal: spacing.md, borderRadius: radius.lg, overflow: "hidden", elevation: 1 },
    row: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
    iconWrap: { width: 32, justifyContent: "center", alignItems: "center" },
    rowContent: { flex: 1, marginLeft: spacing.sm },
    rowTitle: { fontSize: 14, color: colors.textPrimary, fontFamily: "Inter_500Medium" },
    rowSubtitle: { fontSize: 12, color: colors.textMuted, fontFamily: "Inter_400Regular", marginTop: 2 },
    footerData: { backgroundColor: "#fff", margin: spacing.md, marginTop: 40, borderRadius: radius.lg, padding: spacing.md, alignItems: "center", elevation: 1 },
    footerText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.textPrimary },
    footerLink: { color: colors.accentBlue },
  }), [colors, spacing, radius]);

  const Row = ({ icon, title, subtitle, onPress, destructive }: { icon: any; title: string; subtitle?: string; onPress?: () => void; destructive?: boolean }) => (
    <TouchableOpacity style={S.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={S.iconWrap}>
        <Ionicons name={icon} size={20} color={destructive ? colors.accentRed : "#4B5563"} />
      </View>
      <View style={S.rowContent}>
        <Text style={[S.rowTitle, destructive && { color: colors.accentRed }]}>{title}</Text>
        {subtitle && <Text style={S.rowSubtitle}>{subtitle}</Text>}
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.accentBlue} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={S.safeArea}>
      <View style={[S.header, { paddingTop: insets.paddingTop || spacing.md }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>User Profile</Text>
      </View>

      <ScrollView style={S.scroll} contentContainerStyle={{ paddingBottom: 60 }}>
        <Text style={S.sectionTitle}>User Details</Text>
        <View style={S.card}>
          <Row
            icon="person-outline"
            title="User Name"
            subtitle={user?.name || "Add User Name"}
          />
          <Row
            icon="mail-outline"
            title="Email Address"
            subtitle="If you are facing trouble getting OTP on mobile, it will be sent to this email as well."
          />
          <Row
            icon="call-outline"
            title="Phone Number"
            subtitle={user?.phone || "Not set"}
          />
        </View>

        <Text style={S.sectionTitle}>Privacy Settings</Text>
        <View style={S.card}>
          <Row icon="refresh-outline" title="Reset Data" destructive
            onPress={() => Alert.alert("Reset Data", "This will permanently erase all your local data. This cannot be undone.", [
              { text: "Cancel", style: "cancel" },
              { text: "Reset", style: "destructive", onPress: () => Alert.alert("Coming Soon", "Reset is not yet available.") }
            ])}
          />
          <Row icon="trash-outline" title="Delete Account" destructive
            onPress={() => Alert.alert("Delete Account", "Are you sure? All your data will be permanently deleted.", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => Alert.alert("Coming Soon", "Account deletion is not yet available.") }
            ])}
          />
          <Row icon="log-out-outline" title="Logout" onPress={handleLogout} />
          <Row icon="log-out" title="Logout from all devices" onPress={handleLogout} />
        </View>

        <View style={S.footerData}>
          <Text style={S.footerText}>
            Support Code: <Text style={S.footerLink}>{user?.phone || user?.organisationId || "N/A"}</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
