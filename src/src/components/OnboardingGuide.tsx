import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");
const ONBOARDING_KEY = "pm_onboarding_done_v1";

interface Step {
  icon: string;
  iconLib?: "ion" | "mci";
  title: string;
  description: string;
  action?: string;
  actionColor?: string;
}

const STEPS: Step[] = [
  {
    icon: "hand-wave",
    iconLib: "mci",
    title: "Welcome to Business Manager! 🎉",
    description:
      "Let's set up your business profile in just 3 steps. It only takes 2 minutes!",
    action: "Let's Go",
    actionColor: "#2563EB",
  },
  {
    icon: "business-outline",
    iconLib: "ion",
    title: "Step 1 — Company Details",
    description:
      "Go to More → Company Details. Fill your:\n\n• Business Name\n• Phone Number\n• GST Number (optional)\n• Billing Address",
    action: "Got it, Next →",
    actionColor: "#7C3AED",
  },
  {
    icon: "card-outline",
    iconLib: "ion",
    title: "Step 2 — UPI / Bank Details",
    description:
      "In Company Details, scroll down to 'Bank & UPI Details'.\n\nEnter your UPI ID (e.g. 9876543210@ybl) so customers can pay you directly.",
    action: "Got it, Next →",
    actionColor: "#059669",
  },
  {
    icon: "flash-outline",
    iconLib: "ion",
    title: "Step 3 — Create Your First Invoice",
    description:
      "Go to Dashboard → Create Invoice.\n\nAdd a customer, add items, and send via WhatsApp directly from the app!",
    action: "Got it, Next →",
    actionColor: "#F97316",
  },
  {
    icon: "crown",
    iconLib: "mci",
    title: "Upgrade for More Power ⚡",
    description:
      "You are on the FREE plan. Upgrade to Pro (₹99/mo) to unlock:\n\n• Unlimited Invoices\n• WhatsApp Reminders\n• AI Tools & Reports\n\nPay via UPI in More → Upgrade.",
    action: "Start Using Business Manager",
    actionColor: "#2563EB",
  },
];

interface Props {
  visible: boolean;
  onDone: () => void;
}

export const OnboardingGuide: React.FC<Props> = ({ visible, onDone }) => {
  const [step, setStep] = useState(0);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      setStep(0);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const animateToNext = (nextStep: number) => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 120,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
    setStep(nextStep);
  };

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      animateToNext(step + 1);
    } else {
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => onDone());
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    onDone();
  };

  const current = STEPS[step];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View style={[S.overlay, { opacity: fadeAnim }]}>
        {/* Tap outside to skip */}
        <TouchableOpacity style={S.backdrop} activeOpacity={1} onPress={handleSkip} />

        <Animated.View
          style={[
            S.card,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Close / Skip */}
          <TouchableOpacity style={S.skipBtn} onPress={handleSkip}>
            <Text style={S.skipText}>Skip</Text>
          </TouchableOpacity>

          {/* Icon */}
          <View style={[S.iconCircle, { backgroundColor: (current.actionColor || "#2563EB") + "1A" }]}>
            {current.iconLib === "mci" ? (
              <MaterialCommunityIcons
                name={current.icon as any}
                size={40}
                color={current.actionColor || "#2563EB"}
              />
            ) : (
              <Ionicons
                name={current.icon as any}
                size={40}
                color={current.actionColor || "#2563EB"}
              />
            )}
          </View>

          {/* Content */}
          <Text style={S.title}>{current.title}</Text>
          <Text style={S.desc}>{current.description}</Text>

          {/* Step Dots */}
          <View style={S.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  S.dot,
                  i === step
                    ? { backgroundColor: current.actionColor || "#2563EB", width: 20 }
                    : { backgroundColor: "#E5E7EB" },
                ]}
              />
            ))}
          </View>

          {/* CTA Button */}
          <TouchableOpacity
            style={[S.ctaBtn, { backgroundColor: current.actionColor || "#2563EB" }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={S.ctaBtnText}>{current.action}</Text>
            {step < STEPS.length - 1 && (
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            )}
          </TouchableOpacity>

          {/* Step counter */}
          <Text style={S.counter}>{step + 1} of {STEPS.length}</Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

/** Call this to check if onboarding should be shown (returns true if not done yet) */
export async function shouldShowOnboarding(isNewUser: boolean): Promise<boolean> {
  if (!isNewUser) return false;
  const done = await AsyncStorage.getItem(ONBOARDING_KEY);
  return done !== "true";
}

const S = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    width: "100%",
    maxWidth: 380,
    padding: 28,
    paddingTop: 20,
    alignItems: "center",
    elevation: 20,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  skipBtn: {
    alignSelf: "flex-end",
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  skipText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 12,
  },
  desc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 24,
    alignItems: "center",
  },
  dot: {
    height: 6,
    borderRadius: 3,
    width: 6,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    marginBottom: 12,
  },
  ctaBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  counter: {
    fontSize: 12,
    color: "#9CA3AF",
    fontFamily: "Inter_400Regular",
  },
});
