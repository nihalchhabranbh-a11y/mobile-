import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "../userContext";
import { useTheme } from "../themeContext";
import { navigationRef } from "../../../App";   // root-level ref — can navigate to ANY screen

// Safe navigate helper — works from any context
function navTo(route: string, params?: object) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(route as any, params as any);
  }
}

export const WebSidebarLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width } = useWindowDimensions();
  const { user } = useUser();
  const { colors } = useTheme();

  // Only render Sidebar on Web if screen is wide enough
  if (Platform.OS !== "web" || width < 768) {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  const S = StyleSheet.create({
    container: { flex: 1, flexDirection: "row", backgroundColor: "#F9FAFB" },
    sidebar: {
      width: 250,
      backgroundColor: "#ffffff",
      borderRightWidth: 1,
      borderRightColor: "#E5E7EB",
      paddingVertical: 24,
      justifyContent: "space-between",
    },
    topSection: { paddingHorizontal: 16 },
    logoContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 32,
      paddingHorizontal: 8,
    },
    logoText: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#ea580c" },
    menuGroup: { marginBottom: 24 },
    menuLabel: {
      fontSize: 11,
      fontFamily: "Inter_700Bold",
      color: "#9CA3AF",
      textTransform: "uppercase",
      marginBottom: 8,
      paddingHorizontal: 12,
      letterSpacing: 0.5,
    },
    navItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      marginBottom: 4,
      cursor: "pointer" as any,
    },
    navItemActive: { backgroundColor: "#FFF7ED" },
    navIcon: { marginRight: 12 },
    navText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#4B5563" },
    navTextActive: { color: "#ea580c" },
    bottomSection: {
      paddingHorizontal: 16,
      borderTopWidth: 1,
      borderTopColor: "#E5E7EB",
      paddingTop: 16,
    },
    userCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      backgroundColor: "#F3F4F6",
      borderRadius: 12,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "#ea580c",
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
    userInfo: { marginLeft: 10, flex: 1 },
    userName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827" },
    userRole: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#6B7280" },
    contentArea: { flex: 1, backgroundColor: "#F9FAFB" },
  });

  const menu = [
    {
      label: "Overview",
      items: [
        { title: "Dashboard",   icon: "home-outline",          route: "Dashboard" },
        { title: "Parties",     icon: "people-outline",        route: "PartyDetail" },
        { title: "Items",       icon: "cube-outline",          route: "Items" },
      ],
    },
    {
      label: "Sales & Purchases",
      items: [
        { title: "Invoices / Bills", icon: "document-text-outline", route: "Billing" },
        { title: "Create Invoice",   icon: "add-circle-outline",    route: "InvoiceCreate" },
        { title: "Purchases",        icon: "cart-outline",          route: "Purchases" },
        { title: "Payments",         icon: "wallet-outline",        route: "Payments" },
        { title: "Tasks",            icon: "checkmark-done-outline", route: "Tasks" },
        { title: "Jobs",             icon: "briefcase-outline",     route: "Jobs" },
      ],
    },
    {
      label: "Business",
      items: [
        { title: "E-Invoicing", icon: "flash-outline",           route: "EInvoice" },
        { title: "E-Way Bill",  icon: "car-outline",             route: "EWayBill" },
        { title: "GST Suite",   icon: "document-attach-outline", route: "GstSuite" },
        { title: "Reports",     icon: "bar-chart-outline",       route: "Reports" },
        { title: "AI Orders",   icon: "sparkles-outline",        route: "AiOrder" },
      ],
    },
    {
      label: "More",
      items: [
        { title: "Company Details", icon: "business-outline",   route: "CompanyDetails" },
        { title: "User Profile",    icon: "person-outline",     route: "UserProfile" },
        { title: "Users & Roles",   icon: "shield-outline",     route: "ManageUser" },
        { title: "Settings",        icon: "settings-outline",   route: "Settings" },
        { title: "Help",            icon: "help-circle-outline", route: "Help" },
      ],
    },
  ];

  return (
    <View style={S.container}>
      {/* Sidebar */}
      <View style={S.sidebar}>
        <View style={S.topSection}>
          <View style={S.logoContainer}>
            <Ionicons name="pricetags" size={26} color="#ea580c" />
            <Text style={S.logoText}>PrintMaster</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {menu.map((section, idx) => (
              <View key={idx} style={S.menuGroup}>
                <Text style={S.menuLabel}>{section.label}</Text>
                {section.items.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    style={S.navItem}
                    activeOpacity={0.7}
                    onPress={() => navTo(item.route)}
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={20}
                      color="#4B5563"
                      style={S.navIcon}
                    />
                    <Text style={S.navText}>{item.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={S.bottomSection}>
          <TouchableOpacity style={S.userCard} onPress={() => navTo("Settings")}>
            <View style={S.avatar}>
              <Text style={S.avatarText}>{(user?.name || "U")[0].toUpperCase()}</Text>
            </View>
            <View style={S.userInfo}>
              <Text style={S.userName} numberOfLines={1}>{user?.name || "User"}</Text>
              <Text style={S.userRole}>{user?.role || "Member"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={S.contentArea}>{children}</View>
    </View>
  );
};
