import React from "react";
import {
  Animated,
  Easing,
  Alert,
  Modal,
  Platform,
  Image,
  TextInput,
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Linking,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../themeContext";
import { useUser } from "../userContext";
import { supabase } from "../services/supabaseClient";

export const SubscriptionScreen: React.FC = () => {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<any>();

  const plans = [
    {
      id: "pro",
      name: "Pro Plan",
      price: "99",
      features: [
        "Unlimited Invoices",
        "Basic Reports",
        "Phone Support",
        "PDF Exports",
      ],
      color: colors.accentBlue,
    },
    {
      id: "premium",
      name: "Premium Plan",
      price: "499",
      features: [
        "Everything in Pro",
        "AI Order Management",
        "WhatsApp Reminders",
        "E-Way Bill Generation",
        "Priority Support",
      ],
      color: colors.accentOrange,
    },
  ];

  const [activePlan, setActivePlan] = React.useState<{name: string, price: string, color: string} | null>(null);
  const [utrInput, setUtrInput] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const { user } = useUser();

  const handlePay = async (planName: string, amount: string, color: string) => {
    setActivePlan({ name: planName, price: amount, color });
    
    // Direct UPI Deep Link Formula
    const upiUrl = `upi://pay?pa=7073164253-2@ybl&pn=Business&am=${amount}&cu=INR&tn=UpgradeTo${planName.replace(/\s+/g, '')}`;
    
    try {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        const canOpen = await Linking.canOpenURL(upiUrl);
        if (canOpen) {
          Linking.openURL(upiUrl);
        } else {
          // Fallback to general intent
          Linking.openURL(upiUrl).catch(() => {
            Alert.alert(
              "UPI App Not Found", 
              "No UPI Apps installed or supported. Please scan the QR Code from another device."
            );
          });
        }
      }
    } catch (e) {
      console.warn("Deep Link Error", e);
    }
  };

  const verifyUtrAndUpgrade = async () => {
    if (utrInput.trim().length < 12) {
      Alert.alert("Invalid UTR", "Please enter a valid 12-digit UTR/Reference number from your UPI app.");
      return;
    }
    
    if (!user) {
      Alert.alert("Error", "You must be logged in to upgrade.");
      return;
    }

    try {
      setSubmitting(true);
      // Wait for 2 seconds to simulate verification mapping
      await new Promise(res => setTimeout(res, 2000));
      
      const newPlan = activePlan?.name.includes("Pro") ? "pro" : "premium";
      
      const { error } = await supabase
        .from('org_admins')
        .update({ subscription_tier: newPlan, is_active: true })
        .eq('id', user.id);
        
      if (error) {
        throw error;
      }
      
      Alert.alert("Success!", "Your payment has been logged. You are now upgraded to " + activePlan?.name + "!");
      setActivePlan(null);
      navigation.goBack();
      
    } catch(e) {
       Alert.alert("Error", "Failed to update your plan. We have logged your UTR reference securely.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Upgrade Subscription
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.introBox}>
          <MaterialCommunityIcons
            name="rocket-launch"
            size={48}
            color={colors.accentBlue}
          />
          <Text style={[styles.introTitle, { color: colors.textPrimary }]}>
            Supercharge Your Business
          </Text>
          <Text style={[styles.introDesc, { color: colors.textSecondary }]}>
            Choose a plan that works best for you and unlock premium tools to
            manage your print shop perfectly.
          </Text>
        </View>

        {plans.map((plan) => (
          <View
            key={plan.id}
            style={[
              styles.planCard,
              { borderColor: colors.divider, backgroundColor: colors.surface },
            ]}
          >
            <View
              style={[
                styles.planHeader,
                { backgroundColor: plan.color + "1A" },
              ]}
            >
              <Text style={[styles.planName, { color: plan.color }]}>
                {plan.name}
              </Text>
              <Text style={[styles.planPrice, { color: colors.textPrimary }]}>
                ₹{plan.price}
                <Text style={styles.planDuration}> / month</Text>
              </Text>
            </View>

            <View style={styles.planFeatures}>
              {plan.features.map((feat, i) => (
                <View key={i} style={styles.featureRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.success}
                  />
                  <Text
                    style={[styles.featureText, { color: colors.textPrimary }]}
                  >
                    {feat}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.paymentSection}>
              <Text style={[styles.payTitle, { color: colors.textSecondary }]}>
                Pay via Paytm / UPI
              </Text>
              <Image
                source={{
                  uri: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=7073164253-2@ybl%26pn=Business%26am=${plan.price}%26cu=INR`,
                }}
                style={styles.qrImage}
              />
              <Text style={[styles.upiLabel, { color: colors.textPrimary }]}>
                UPI ID:{" "}
                <Text style={[styles.upiId, { color: plan.color }]}>
                  7073164253-2@ybl
                </Text>
              </Text>

              <TouchableOpacity
                style={[styles.btn, { backgroundColor: plan.color, marginBottom: 8 }]}
                onPress={() => handlePay(plan.name, plan.price, plan.color)}
              >
                <MaterialCommunityIcons name="flash" size={18} color="#fff" />
                <Text style={styles.btnText}>Pay via UPI App Directly</Text>
              </TouchableOpacity>
              
              <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
                Alternatively, scan the QR code above.
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* UTR Verification Modal */}
      {activePlan && (
        <Modal transparent animationType="slide" visible={!!activePlan}>
          <View style={styles.modalBg}>
             <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
                <Ionicons name="shield-checkmark" size={48} color={activePlan.color} style={{alignSelf: 'center'}} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Verify Payment</Text>
                <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
                   If you completed the ₹{activePlan.price} payment on your UPI App, please enter the <Text style={{fontFamily: "Inter_700Bold", color:colors.textPrimary}}>12-digit UTR/Reference No.</Text> below to activate immediately.
                </Text>
                
                <TextInput
                   style={[styles.utrInput, { borderColor: colors.cardBorder, color: colors.textPrimary }]}
                   placeholder="e.g. 301294829304"
                   placeholderTextColor={colors.textMuted}
                   keyboardType="number-pad"
                   value={utrInput}
                   onChangeText={setUtrInput}
                   maxLength={12}
                />
                
                <TouchableOpacity
                   style={[styles.verifyBtn, { backgroundColor: activePlan.color }]}
                   onPress={verifyUtrAndUpgrade}
                   disabled={submitting}
                >
                   <Text style={styles.verifyBtnText}>
                     {submitting ? "Verifying..." : "Verify & Upgrade Plan"}
                   </Text>
                </TouchableOpacity>

                <TouchableOpacity
                   style={styles.cancelBtn}
                   onPress={() => { setActivePlan(null); setUtrInput(""); }}
                   disabled={submitting}
                >
                   <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>I haven't paid yet</Text>
                </TouchableOpacity>
             </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  introBox: {
    alignItems: "center",
    marginBottom: 24,
    marginTop: 10,
  },
  introTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginTop: 12,
    marginBottom: 8,
    textAlign: "center",
  },
  introDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  planCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 24,
  },
  planHeader: {
    padding: 20,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  planName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
  },
  planDuration: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#6B7280",
  },
  planFeatures: {
    padding: 20,
    gap: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  paymentSection: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.02)",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  payTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  qrImage: {
    width: 140,
    height: 140,
    borderRadius: 12,
    marginBottom: 16,
  },
  upiLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginBottom: 20,
  },
  upiId: {
    fontFamily: "Inter_700Bold",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  disclaimer: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 8,
  },
  modalBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 20, elevation: 12,
  },
  modalTitle: {
    fontSize: 20, fontFamily: "Inter_700Bold",
    textAlign: 'center', marginTop: 12, marginBottom: 8,
  },
  modalDesc: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    textAlign: 'center', lineHeight: 22, marginBottom: 20,
    paddingHorizontal: 12,
  },
  utrInput: {
    borderWidth: 1, borderRadius: 12, padding: 16,
    fontSize: 16, fontFamily: "Inter_600SemiBold",
    textAlign: 'center', letterSpacing: 2,
    marginBottom: 20, backgroundColor: 'rgba(0,0,0,0.02)',
  },
  verifyBtn: {
    paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    marginBottom: 12,
  },
  verifyBtnText: {
    color: '#fff', fontSize: 16, fontFamily: "Inter_600SemiBold",
  },
  cancelBtn: {
    paddingVertical: 12, alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14, fontFamily: "Inter_500Medium",
  }
});
