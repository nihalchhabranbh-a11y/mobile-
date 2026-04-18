import React, { useEffect, useRef, useState } from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<any>();
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BottomTabBar, createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  Animated,
  Easing,
  Modal,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

// ── Core screens (in src/src/screens/) ──────────────────────────────────────
import { DashboardScreen } from "./src/src/screens/DashboardScreen";
import { PartiesScreen } from "./src/src/screens/PartiesScreen";
import { ItemsScreen } from "./src/src/screens/ItemsScreen";
import { TasksScreen } from "./src/src/screens/TasksScreen";
import { MoreScreen } from "./src/src/screens/MoreScreen";
import { BillingScreen } from "./src/src/screens/BillingScreen";
import { PaymentsScreen } from "./src/src/screens/PaymentsScreen";
import { ReportsScreen } from "./src/src/screens/ReportsScreen";
import { SettingsScreen } from "./src/src/screens/SettingsScreen";
import { HelpScreen } from "./src/src/screens/HelpScreen";
import { GstFinderScreen } from "./src/src/screens/GstFinderScreen";
import { ManageUserScreen } from "./src/src/screens/ManageUserScreen";
import { RecoverDeletedScreen } from "./src/src/screens/RecoverDeletedScreen";
import { AdminPanelScreen } from "./src/src/screens/AdminPanelScreen";
import { PartyDetailScreen } from "./src/src/screens/PartyDetailScreen";
import { JobsScreen } from "./src/src/screens/JobsScreen";
import { RegisterScreen } from "./src/src/screens/RegisterScreen";
import { OtpVerifyScreen } from "./src/src/screens/OtpVerifyScreen";
import { LoginScreen } from "./src/src/screens/LoginScreen";
import { ProductsScreen } from "./src/src/screens/ProductsScreen";
import { CustomersScreen } from "./src/src/screens/CustomersScreen";
import { CompanyDetailsScreen } from "./src/src/screens/CompanyDetailsScreen";
import { UserProfileScreen } from "./src/src/screens/UserProfileScreen";

// ── Newer screens (in src/screens/) ──────────────────────────────────────────
import { EInvoiceScreen } from "./src/screens/EInvoiceScreen";
import { EWayBillScreen } from "./src/screens/EWayBillScreen";
import { GstFilingScreen } from "./src/screens/GstFilingScreen";
import { PaymentReminderScreen } from "./src/screens/PaymentReminderScreen";
import { ChatScreen } from "./src/screens/ChatScreen";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";
import { GstSuiteScreen } from "./src/screens/GstSuiteScreen";
import { InvoiceDetailScreen } from "./src/screens/InvoiceDetailScreen";
import { WebSidebarLayout } from "./src/src/components/WebSidebarLayout";

// ── Recreated screens (in src/src/screens/) ─────────────────────────────────
import { ChallansScreen } from "./src/src/screens/ChallansScreen";
import { TransfersScreen } from "./src/src/screens/TransfersScreen";
import { ScanPurchaseScreen } from "./src/src/screens/ScanPurchaseScreen";
import { ScanPurchasePreviewScreen } from "./src/src/screens/ScanPurchasePreviewScreen";
import { InvoiceCreateScreen } from "./src/src/screens/InvoiceCreateScreen";
import { PurchasesScreen } from "./src/src/screens/PurchasesScreen";
import { AiOrderScreen } from "./src/src/screens/AiOrderScreen";
import { SubscriptionScreen } from "./src/src/screens/SubscriptionScreen";

// ── Context ──────────────────────────────────────────────────────────────────
import { ThemeProvider, useTheme } from "./src/src/themeContext";
import { User, UserProvider, useUser } from "./src/src/userContext";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ─────────────────────────────────────────────────────────────────────────────
//  QUICK-ACTION DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const ACTION_GROUPS = [
  {
    title: "Billing",
    color: "#2563EB",
    items: [
      { key: "bill",     label: "New Bill",       icon: "receipt-outline",          route: "InvoiceCreate",   params: {} },
      { key: "ai",       label: "AI Order",        icon: "sparkles-outline",         route: "AiOrder",         params: {} },
      { key: "einvoice", label: "E-Invoice",       icon: "document-text-outline",    route: "EInvoice",        params: {} },
      { key: "ewaybill", label: "E-Way Bill",      icon: "car-outline",              route: "EWayBill",        params: {} },
      { key: "pay",      label: "Record Payment",  icon: "wallet-outline",           route: "Payments",        params: {} },
    ],
  },
  {
    title: "GST & Tax",
    color: "#D97706",
    items: [
      { key: "gstfiling", label: "GST Filing",     icon: "folder-outline",           route: "GstFiling",       params: {} },
      { key: "gstfinder", label: "GST Finder",     icon: "search-circle-outline",    route: "GstFinder",       params: {} },
    ],
  },
  {
    title: "Parties & Items",
    color: "#7C3AED",
    items: [
      { key: "party",  label: "Add Party",         icon: "person-add-outline",       route: "Parties",         params: { openCreate: true } },
      { key: "item",   label: "Add Item",           icon: "cube-outline",             route: "Items",           params: { openCreate: true } },
    ],
  },
  {
    title: "Work",
    color: "#059669",
    items: [
      { key: "task",   label: "New Task",           icon: "checkmark-circle-outline", route: "Tasks",            params: {} },
      { key: "job",    label: "New Job",             icon: "hammer-outline",           route: "Jobs",            params: {} },
      { key: "remind", label: "Set Reminder",        icon: "alarm-outline",            route: "PaymentReminder", params: {} },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  TAB NAVIGATOR
// ─────────────────────────────────────────────────────────────────────────────
function Tabs() {
  const { colors, spacing, radius, mode } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);

  const idlePulse   = useRef(new Animated.Value(0)).current;
  const pressScale  = useRef(new Animated.Value(1)).current;
  const pulseRing   = useRef(new Animated.Value(0)).current;
  const sheetAnim   = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(new Animated.Value(0)).current;

  const openSheet = () => {
    setSheetOpen(true);
    sheetAnim.setValue(0);
    Animated.timing(sheetAnim, {
      toValue: 1, duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetAnim, {
      toValue: 0, duration: 240,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => { if (finished) setSheetOpen(false); });
  };

  const onFabPress = () => {
    pressScale.setValue(1);
    pulseRing.setValue(0);
    openSheet();
    Animated.parallel([
      Animated.sequence([
        Animated.timing(pressScale, { toValue: 1.1,  duration: 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(pressScale, { toValue: 1,    duration: 130, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(pulseRing, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => { pulseRing.setValue(0); });
  };

  useEffect(() => {
    if (sheetOpen) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(idlePulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(idlePulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [idlePulse, sheetOpen]);

  return (
    <>
      <Tab.Navigator
        tabBar={(props) => (
          Platform.OS === "web" ? null :
          <View>
            <BottomTabBar {...props} />

            {/* ── FAB ─────────────────────────────────────────────── */}
            <View pointerEvents="box-none" style={styles.fabOverlay}>
              {/* idle ring */}
              <Animated.View pointerEvents="none" style={[
                styles.fabRing,
                {
                  opacity: idlePulse.interpolate({ inputRange: [0,1], outputRange: [0.30, 0.08] }),
                  transform: [{ scale: idlePulse.interpolate({ inputRange:[0,1], outputRange:[1,1.14] }) }],
                  borderColor: colors.accentOrange ?? "#FF6600",
                },
              ]} />
              {/* tap ring */}
              <Animated.View pointerEvents="none" style={[
                styles.fabRingTap,
                {
                  opacity: pulseRing.interpolate({ inputRange:[0,1], outputRange:[0.40,0] }),
                  transform: [{ scale: pulseRing.interpolate({ inputRange:[0,1], outputRange:[1,1.6] }) }],
                  borderColor: colors.accentOrange ?? "#FF6600",
                },
              ]} />
              <Animated.View style={{ transform: [{ scale: pressScale }] }}>
                <TouchableOpacity activeOpacity={0.9} style={styles.fabShadow} onPress={onFabPress}>
                  <LinearGradient colors={["#FF8A33", "#FF5500"]} start={[0,0]} end={[1,1]} style={styles.fab}>
                    <Ionicons name={sheetOpen ? "close" : "add"} size={30} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>

            {/* ── Quick-Action Sheet ───────────────────────────────── */}
            <Modal visible={sheetOpen} transparent animationType="none" onRequestClose={closeSheet}>
              <View style={styles.sheetRoot}>
                <Animated.View style={[styles.sheetBackdrop, { opacity: sheetAnim.interpolate({ inputRange:[0,1], outputRange:[0,1] }) }]}>
                  <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeSheet} />
                </Animated.View>

                <Animated.View style={[
                  styles.sheet,
                  {
                    backgroundColor: colors.surface ?? "#FFFFFF",
                    borderTopLeftRadius: 28,
                    borderTopRightRadius: 28,
                    transform: [{ translateY: sheetAnim.interpolate({ inputRange:[0,1], outputRange:[600,0] }) }],
                  },
                ]}>
                  {/* drag handle */}
                  <View style={styles.dragHandle} />
                  <Text style={[styles.sheetTitle, { color: colors.textPrimary ?? "#111" }]}>Quick Actions</Text>

                  {ACTION_GROUPS.map((group) => (
                    <View key={group.title} style={{ marginBottom: 18 }}>
                      <Text style={[styles.groupTitle, { color: group.color }]}>{group.title}</Text>
                      <View style={styles.actionRow}>
                        {group.items.map((a) => (
                          <TouchableOpacity
                            key={a.key}
                            activeOpacity={0.82}
                            style={[
                              styles.actionCard,
                              {
                                backgroundColor: "#F8FAFF",
                                borderColor: group.color + "26",
                              },
                            ]}
                            onPress={() => {
                              closeSheet();
                              setTimeout(() => {
                                (props.navigation.navigate as any)(a.route, a.params);
                              }, 40);
                            }}
                          >
                            <View style={[styles.actionIconWrap, { backgroundColor: group.color + "18" }]}>
                              <Ionicons name={a.icon as any} size={22} color={group.color} />
                            </View>
                            <Text style={[styles.actionLabel, { color: colors.textPrimary ?? "#111" }]} numberOfLines={2}>
                              {a.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.cancelBtn, { backgroundColor: "#F3F4F6", borderColor: colors.cardBorder ?? "#E5E7EB" }]}
                    onPress={closeSheet}
                  >
                    <Text style={[styles.cancelText, { color: colors.textSecondary ?? "#6B7280" }]}>Cancel</Text>
                  </TouchableOpacity>

                  {/* bottom safe area */}
                  <View style={{ height: Platform.OS === "ios" ? 28 : 12 }} />
                </Animated.View>
              </View>
            </Modal>
          </View>
        )}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.tabBarActive ?? colors.accentOrange ?? "#FF6600",
          tabBarInactiveTintColor: colors.tabBarInactive ?? colors.textMuted ?? "#6B7B8E",
          tabBarStyle: {
            backgroundColor: colors.tabBarBg ?? "#FFFFFF",
            borderTopWidth: 1,
            borderTopColor: colors.cardBorder ?? "#E2E8F0",
            height: 68,
            paddingBottom: 10,
            paddingTop: 8,
            elevation: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.05,
            shadowRadius: 10,
          },
          tabBarLabelStyle: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }}
        />
        <Tab.Screen
          name="Parties"
          component={PartiesScreen}
          options={{ tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }}
        />
        {/* ── FAB placeholder tab ─ hidden label ── */}
        <Tab.Screen
          name="__FAB__"
          component={DashboardScreen}
          options={{
            tabBarLabel: "",
            tabBarIcon: () => null,
            tabBarButton: () => <View style={{ width: 72 }} />,
          }}
          listeners={{ tabPress: (e) => { e.preventDefault(); onFabPress(); } }}
        />
        <Tab.Screen
          name="GstSuite"
          component={GstSuiteScreen}
          options={{
            tabBarLabel: "GST Suite",
            tabBarIcon: ({ color, size }) => <Ionicons name="document-attach" size={size} color={color} />,
          }}
        />
        <Tab.Screen
          name="More"
          component={MoreScreen}
          options={{ tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal" size={size} color={color} /> }}
        />
      </Tab.Navigator>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN STACK
// ─────────────────────────────────────────────────────────────────────────────
function MainStack() {
  const { user } = useUser();
  return (
    <WebSidebarLayout>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* ── Entry point ─────────────────────────────── */}
        <Stack.Screen name="Tabs"                 component={Tabs} />

        {/* ── Overview (also in Android tabs) ─────────── */}
        <Stack.Screen name="Dashboard"            component={DashboardScreen} />
        <Stack.Screen name="Parties"              component={PartiesScreen} />
        <Stack.Screen name="Items"                component={ItemsScreen} />

        {/* ── Sales & Purchases ────────────────────────── */}
        <Stack.Screen name="Billing"              component={BillingScreen} />
        <Stack.Screen name="InvoiceCreate"        component={InvoiceCreateScreen} />
        <Stack.Screen name="InvoiceDetail"        component={InvoiceDetailScreen} />
        <Stack.Screen name="Purchases"            component={PurchasesScreen} />
        <Stack.Screen name="Payments"             component={PaymentsScreen} />
        <Stack.Screen name="Tasks"                component={TasksScreen} />
        <Stack.Screen name="Jobs"                 component={JobsScreen} />

        {/* ── Business ─────────────────────────────────── */}
        <Stack.Screen name="GstSuite"             component={GstSuiteScreen} />
        <Stack.Screen name="EInvoice"             component={EInvoiceScreen} />
        <Stack.Screen name="EWayBill"             component={EWayBillScreen} />
        <Stack.Screen name="GstFiling"            component={GstFilingScreen} />
        <Stack.Screen name="GstFinder"            component={GstFinderScreen} />
        <Stack.Screen name="Reports"              component={ReportsScreen} />
        <Stack.Screen name="AiOrder"              component={AiOrderScreen} />

        {/* ── More ─────────────────────────────────────── */}
        <Stack.Screen name="More"                 component={MoreScreen} />
        <Stack.Screen name="CompanyDetails"       component={CompanyDetailsScreen} />
        <Stack.Screen name="UserProfile"          component={UserProfileScreen} />
        <Stack.Screen name="ManageUser"           component={ManageUserScreen} />
        <Stack.Screen name="Settings"             component={SettingsScreen} />
        <Stack.Screen name="Subscription"         component={SubscriptionScreen} />
        <Stack.Screen name="Help"                 component={HelpScreen} />

        {/* ── Other ────────────────────────────────────── */}
        <Stack.Screen name="Chat"                 component={ChatScreen} />
        <Stack.Screen name="Notifications"        component={NotificationsScreen} />
        <Stack.Screen name="PaymentReminder"      component={PaymentReminderScreen} />
        <Stack.Screen name="Challans"             component={ChallansScreen} />
        <Stack.Screen name="Transfers"            component={TransfersScreen} />
        <Stack.Screen name="ScanPurchase"         component={ScanPurchaseScreen} />
        <Stack.Screen name="ScanPurchasePreview"  component={ScanPurchasePreviewScreen} />
        <Stack.Screen name="PartyDetail"          component={PartyDetailScreen} />
        <Stack.Screen name="RecoverDeleted"       component={RecoverDeletedScreen} />
        <Stack.Screen name="Products"             component={ProductsScreen} />
        <Stack.Screen name="OtpVerify"            component={OtpVerifyScreen} />
        <Stack.Screen name="Admin" component={AdminPanelScreen} />
      </Stack.Navigator>
    </WebSidebarLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ROOT APP
// ─────────────────────────────────────────────────────────────────────────────

const IncompleteRegistrationScreen = () => {
  const { user, setUser } = useUser();
  
  useEffect(() => {
    console.error("[App] Orphaned user account missing organisationId:", user?.username);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#0F1117", justifyContent: "center", alignItems: "center" }}>
      <Ionicons name="warning" size={48} color="#FF6600" />
      <Text style={{ marginTop: 24, color: "#fff", fontSize: 20, fontWeight: "bold" }}>Incomplete Registration</Text>
      <Text style={{ marginTop: 8, color: "#94A3B8", fontSize: 14, textAlign: "center", paddingHorizontal: 32 }}>
        Your account is missing an organisation ID. Please contact support or register again.
      </Text>
      <TouchableOpacity 
        style={{ padding: 12, backgroundColor: "#FF6600", borderRadius: 8, marginTop: 24 }}
        onPress={() => setUser(null)}
      >
        <Text style={{ color: "#fff", fontWeight: "bold" }}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function App() {
  const [user, setUser]       = useState<User>(null);
  const [hydrated, setHydrated] = useState(false);
  const USER_KEY = "app_user_v1";

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(USER_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && typeof parsed.username === "string") {
            setUser(parsed);
          }
        }
      } catch (e) {
        console.warn("[App] Failed to hydrate user", e);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      try {
        if (user) await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
        else       await AsyncStorage.removeItem(USER_KEY);
      } catch (e) {
        console.warn("[App] Failed to persist user", e);
      }
    })();
  }, [user, hydrated]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!fontsLoaded || !hydrated) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          })
        ])
      );
      animation.start();

      return () => animation.stop();
    }
  }, [fontsLoaded, hydrated, fadeAnim, pulseAnim]);

  if (!fontsLoaded || !hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0F1117", justifyContent: "center", alignItems: "center" }}>
        <Animated.View style={{ opacity: fadeAnim, alignItems: "center", transform: [{ scale: pulseAnim }] }}>
          <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: "#7C3AED", justifyContent: "center", alignItems: "center", shadowColor: "#7C3AED", shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 }}>
            <Ionicons name="print" size={40} color="#fff" />
          </View>
          <Text style={{ marginTop: 24, color: "#fff", fontSize: 24, fontWeight: "bold", letterSpacing: 1 }}>PrintMaster</Text>
          <Text style={{ marginTop: 8, color: "#94A3B8", fontSize: 14 }}>Setting up your workspace...</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <UserProvider value={{ user, setUser }}>
          <NavigationContainer ref={navigationRef}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              {user ? (
                user.organisationId ? (
                  <Stack.Screen name="Main" component={MainStack} />
                ) : (
                  <Stack.Screen name="Incomplete" component={IncompleteRegistrationScreen} />
                )
              ) : (
                <>
                  <Stack.Screen name="Register"  component={RegisterScreen} />
                  <Stack.Screen name="Login">
                    {() => <LoginScreen onLogin={setUser} />}
                  </Stack.Screen>
                  <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
                </>
              )}
            </Stack.Navigator>
          </NavigationContainer>
        </UserProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // FAB
  fabOverlay: {
    position: "absolute", left: 0, right: 0, bottom: 72,
    alignItems: "center", pointerEvents: "box-none",
  } as any,
  fabShadow: {
    borderRadius: 32,
    shadowColor: "#2563EB", shadowOpacity: 0.35,
    shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  fab: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: "center", alignItems: "center",
  },
  fabRing: {
    position: "absolute", width: 80, height: 80,
    borderRadius: 40, borderWidth: 2,
  },
  fabRingTap: {
    position: "absolute", width: 82, height: 82,
    borderRadius: 41, borderWidth: 2,
  },
  // Sheet
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    paddingTop: 6, paddingHorizontal: 18,
    borderTopWidth: 0,
    shadowColor: "#000", shadowOpacity: 0.18,
    shadowRadius: 24, shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },
  dragHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignSelf: "center", marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18, fontFamily: "Inter_700Bold",
    marginBottom: 16,
  },
  groupTitle: {
    fontSize: 11, fontFamily: "Inter_700Bold",
    letterSpacing: 1.1, textTransform: "uppercase",
    marginBottom: 10, marginLeft: 2,
  },
  actionRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
  },
  actionCard: {
    width: "22.5%", borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 8,
    alignItems: "center", borderWidth: 1,
  },
  actionIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
    marginBottom: 7,
  },
  actionLabel: {
    fontSize: 10, fontFamily: "Inter_600SemiBold",
    textAlign: "center", lineHeight: 13,
  },
  cancelBtn: {
    borderRadius: 14, borderWidth: 1,
    paddingVertical: 14, alignItems: "center",
    marginTop: 4,
  },
  cancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
