/**
 * RegisterScreen — Cinematic airplane registration
 *
 * Flow (4 steps):
 * 1. Phone number
 * 2. Business info
 * 3. Password & optional details
 * 4. Choose plan → ₹30/mo launch (2 months) or ₹199/mo after
 * Then → airplane landing → OTP verify → main app
 */
import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { requestOtp } from "../services/otpService";

const { width: SW, height: SH } = Dimensions.get("window");
const STEP_COUNT = 4;

const C = {
  nightTop: "#020617",
  nightMid: "#0F172A",
  nightBot: "#1E293B",
  card: "#0F172A",
  cardBorder: "#1E293B",
  bright: "#F8FAFC",
  white: "#E2E8F0",
  muted: "#64748B",
  orange: "#F97316",
  orangeGlow: "#FB923C",
  blue: "#3B82F6",
  emerald: "#10B981",
  purple: "#A855F7",
  red: "#EF4444",
  runway: "#F97316",
};

const ACCENT = [C.orange, C.blue, C.emerald, C.purple];
const ICON: Array<keyof typeof Ionicons.glyphMap> = [
  "call-outline",
  "business-outline",
  "lock-closed-outline",
  "rocket-outline",
];
const TITLE = ["Your phone", "Your business", "Secure it", "Choose your plan"];
const SUB = [
  "We'll verify with a quick OTP.",
  "Tell us about your company.",
  "Set a password & optional details.",
  "Start with our launch offer — upgrade anytime.",
];

// Stars
const STARS = Array.from({ length: 30 }, () => ({
  x: Math.random() * SW,
  y: Math.random() * SH * 0.5,
  size: 1 + Math.random() * 2.5,
  op: 0.15 + Math.random() * 0.5,
}));

// Smoke — multiple layers with varying size/opacity for depth
const SMOKE = Array.from({ length: 12 }, (_, i) => ({
  x: SW * 0.1 + Math.random() * SW * 0.8,
  y: SH * 0.02 + (i / 12) * SH * 0.4,
  size: 40 + Math.random() * 80,
  baseOpacity: 0.08 + Math.random() * 0.18,
  driftSpeed: 4000 + Math.random() * 6000,
  driftRange: 20 + Math.random() * 40,
}));

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  // Form
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState("");
  const [orgName, setOrgName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [gst, setGst] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [plan, setPlan] = useState<"launch" | "standard">("launch");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Animations
  const planeY = useRef(new Animated.Value(-80)).current;
  const planeX = useRef(new Animated.Value(SW * 0.5 - 28)).current;
  const planeRotate = useRef(new Animated.Value(0)).current;
  const planeScale = useRef(new Animated.Value(0.5)).current;
  const smokeOpacity = useRef(new Animated.Value(1)).current;
  const engineGlow = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardSlideY = useRef(new Animated.Value(40)).current;
  const fieldAnims = useRef(Array.from({ length: 6 }, () => new Animated.Value(0))).current;
  const runwayOpacity = useRef(new Animated.Value(0)).current;
  const bobAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Individual smoke drift animations
  const smokeDrifts = useRef(SMOKE.map(() => new Animated.Value(0))).current;
  // Individual smoke fade-outs (staggered)
  const smokeFades = useRef(SMOKE.map(() => new Animated.Value(1))).current;

  // ── Intro ──
  useEffect(() => {
    // Smoke drifts (each puff floats side-to-side independently)
    const driftLoops = smokeDrifts.map((drift, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(drift, {
            toValue: SMOKE[i].driftRange,
            duration: SMOKE[i].driftSpeed,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(drift, {
            toValue: -SMOKE[i].driftRange,
            duration: SMOKE[i].driftSpeed,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return loop;
    });

    // Staggered smoke fade-out
    const smokeFadeOut = Animated.stagger(
      180,
      smokeFades.map((fade) =>
        Animated.timing(fade, {
          toValue: 0,
          duration: 1200,
          delay: 800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      )
    );

    // Plane descent
    const descent = Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(planeY, {
          toValue: SH * 0.14,
          duration: 2400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(planeScale, {
          toValue: 1,
          duration: 2400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(planeRotate, {
          toValue: 0.12,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(engineGlow, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(planeRotate, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    // Card + fields
    const showCard = Animated.sequence([
      Animated.delay(2800),
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(cardSlideY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }),
      ]),
    ]);
    const fieldStagger = Animated.sequence([
      Animated.delay(3200),
      Animated.stagger(
        100,
        fieldAnims.map((fa) =>
          Animated.spring(fa, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 })
        )
      ),
    ]);

    // Idle bob
    const bob = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, { toValue: -7, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bobAnim, { toValue: 7, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    bob.start();

    // Progress
    Animated.timing(progressAnim, { toValue: 1, duration: 600, delay: 2900, useNativeDriver: false }).start();

    Animated.parallel([descent, smokeFadeOut, showCard, fieldStagger]).start();

    return () => {
      bob.stop();
      driftLoops.forEach((l) => l.stop());
    };
  }, []);

  // ── Step transition ──
  const sweepToStep = useCallback(
    (nextStep: number) => {
      Animated.parallel([
        Animated.timing(planeRotate, { toValue: -0.25, duration: 280, useNativeDriver: true }),
        Animated.timing(planeX, { toValue: SW + 60, duration: 480, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        setStep(nextStep);
        setError(null);
        fieldAnims.forEach((fa) => fa.setValue(0));

        Animated.timing(progressAnim, { toValue: nextStep + 1, duration: 400, useNativeDriver: false }).start();

        planeX.setValue(-80);
        planeRotate.setValue(0.18);
        cardSlideY.setValue(30);

        Animated.parallel([
          Animated.timing(planeX, { toValue: SW * 0.5 - 28, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(planeRotate, { toValue: 0, duration: 650, useNativeDriver: true }),
          Animated.timing(cardOpacity, { toValue: 1, duration: 350, delay: 180, useNativeDriver: true }),
          Animated.spring(cardSlideY, { toValue: 0, delay: 180, useNativeDriver: true, tension: 60, friction: 12 }),
          ...fieldAnims.map((fa, i) =>
            Animated.sequence([
              Animated.delay(280 + i * 90),
              Animated.spring(fa, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }),
            ])
          ),
        ]).start();

        // Runway on final step
        if (nextStep === STEP_COUNT - 1) {
          Animated.timing(runwayOpacity, { toValue: 1, duration: 700, delay: 400, useNativeDriver: true }).start();
        } else {
          runwayOpacity.setValue(0);
        }
      });
    },
    [planeRotate, planeX, cardOpacity, progressAnim, cardSlideY, fieldAnims, runwayOpacity]
  );

  // ── Next handler ──
  const handleNext = async () => {
    setError(null);

    if (step === 0) {
      const p = phone.trim().replace(/\D/g, "");
      if (p.length < 10) { setError("Enter a valid 10-digit phone number"); return; }
      sweepToStep(1);
      return;
    }
    if (step === 1) {
      if (!orgName.trim()) { setError("Organisation name is required"); return; }
      sweepToStep(2);
      return;
    }
    if (step === 2) {
      if (!password.trim() || password.length < 4) { setError("Password must be at least 4 characters"); return; }
      if (password !== confirmPassword) { setError("Passwords do not match"); return; }
      sweepToStep(3);
      return;
    }
    if (step === 3) {
      // ── LANDING + OTP ──
      try {
        setLoading(true);
        // Landing animation
        await new Promise<void>((resolve) => {
          Animated.parallel([
            Animated.timing(planeY, { toValue: SH * 0.72, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(planeRotate, { toValue: 0.08, duration: 700, useNativeDriver: true }),
            Animated.timing(planeScale, { toValue: 1.3, duration: 1400, useNativeDriver: true }),
          ]).start(() => resolve());
        });

        await requestOtp(phone.trim(), "register");
        navigation.navigate("OtpVerify", {
          mode: "register",
          phone: phone.trim(),
          payload: {
            orgName: orgName.trim(),
            brandName: brandName.trim(),
            address: address.trim(),
            email: email.trim(),
            gst: gst.trim(),
            logoUrl: "",
            password,
            plan: plan === "launch" ? "monthly" : "yearly",
          },
        });
      } catch {
        setError("Failed to send OTP. Check your number and try again.");
        Animated.parallel([
          Animated.timing(planeY, { toValue: SH * 0.14, duration: 600, useNativeDriver: true }),
          Animated.timing(planeScale, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(planeRotate, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (step > 0) sweepToStep(step - 1);
    else navigation.navigate("Login");
  };

  // Interpolations
  const rotateDeg = planeRotate.interpolate({
    inputRange: [-0.5, 0, 0.5],
    outputRange: ["-25deg", "0deg", "15deg"],
  });
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, STEP_COUNT],
    outputRange: [0, SW - 48],
  });

  // ── Field renderer with staggered fade-in ──
  const renderField = (content: React.ReactNode, index: number, key: string) => (
    <Animated.View
      key={key}
      style={{
        opacity: fieldAnims[index] || 1,
        transform: [{
          translateY: (fieldAnims[index] || new Animated.Value(1)).interpolate({
            inputRange: [0, 1], outputRange: [20, 0],
          }),
        }],
      }}
    >
      {content}
    </Animated.View>
  );

  const renderFields = () => {
    // Step 0: Phone only
    if (step === 0) return (
      <>
        {renderField(
          <>
            <Text style={st.label}>MOBILE NUMBER</Text>
            <View style={st.inputRow}>
              <View style={st.prefixBox}><Text style={st.prefixTxt}>🇮🇳 +91</Text></View>
              <TextInput style={[st.input, { flex: 1 }]} value={phone} onChangeText={setPhone}
                keyboardType="phone-pad" placeholder="98000 00000" placeholderTextColor={C.muted} maxLength={10} />
            </View>
          </>, 0, "phone"
        )}
      </>
    );

    // Step 1: Business
    if (step === 1) return (
      <>
        {renderField(
          <>
            <Text style={st.label}>ORGANISATION NAME *</Text>
            <TextInput style={st.input} value={orgName} onChangeText={setOrgName}
              placeholder="ABC Printers Pvt. Ltd." placeholderTextColor={C.muted} />
          </>, 0, "org"
        )}
        {renderField(
          <>
            <Text style={[st.label, { marginTop: 14 }]}>BRAND / SHOP NAME</Text>
            <TextInput style={st.input} value={brandName} onChangeText={setBrandName}
              placeholder="Shown on invoices (optional)" placeholderTextColor={C.muted} />
          </>, 1, "brand"
        )}
      </>
    );

    // Step 2: Password + optional details
    if (step === 2) return (
      <>
        {renderField(
          <>
            <Text style={st.label}>PASSWORD *</Text>
            <TextInput style={st.input} value={password} onChangeText={setPassword}
              placeholder="Min 4 characters" placeholderTextColor={C.muted} secureTextEntry />
          </>, 0, "pw"
        )}
        {renderField(
          <>
            <Text style={[st.label, { marginTop: 12 }]}>CONFIRM PASSWORD *</Text>
            <TextInput style={st.input} value={confirmPassword} onChangeText={setConfirmPassword}
              placeholder="Re-enter password" placeholderTextColor={C.muted} secureTextEntry />
          </>, 1, "cpw"
        )}
        {renderField(
          <>
            <Text style={[st.label, { marginTop: 12 }]}>EMAIL</Text>
            <TextInput style={st.input} value={email} onChangeText={setEmail}
              keyboardType="email-address" autoCapitalize="none"
              placeholder="name@example.com (optional)" placeholderTextColor={C.muted} />
          </>, 2, "email"
        )}
        {renderField(
          <>
            <Text style={[st.label, { marginTop: 12 }]}>GST NUMBER</Text>
            <TextInput style={st.input} value={gst} onChangeText={setGst}
              placeholder="22AAAAA0000A1Z5 (optional)" placeholderTextColor={C.muted} autoCapitalize="characters" />
          </>, 3, "gst"
        )}
        {renderField(
          <>
            <Text style={[st.label, { marginTop: 12 }]}>ADDRESS</Text>
            <TextInput style={[st.input, { minHeight: 48, textAlignVertical: "top" }]} value={address}
              onChangeText={setAddress} placeholder="Business address (optional)"
              placeholderTextColor={C.muted} multiline />
          </>, 4, "addr"
        )}
      </>
    );

    // Step 3: PRICING (at the end!)
    if (step === 3) return (
      <>
        {renderField(
          <View style={st.offerBanner}>
            <Text style={st.offerEmoji}>🚀</Text>
            <Text style={st.offerTitle}>Launch Offer</Text>
            <Text style={st.offerSub}>Get started for just ₹30/month for the first 2 months!</Text>
          </View>,
          0, "offer"
        )}
        {renderField(
          <TouchableOpacity
            style={[st.planCard, plan === "launch" && st.planCardActive]}
            onPress={() => setPlan("launch")}
            activeOpacity={0.85}
          >
            <View style={st.planCardHeader}>
              <View style={[st.planDot, plan === "launch" && st.planDotActive]} />
              <Text style={[st.planCardTitle, plan === "launch" && { color: C.orange }]}>
                Launch Offer
              </Text>
              <View style={st.planBadge}>
                <Text style={st.planBadgeTxt}>SAVE 85%</Text>
              </View>
            </View>
            <View style={st.planPriceRow}>
              <Text style={st.planPrice}>₹30</Text>
              <Text style={st.planPriceSuffix}>/month</Text>
            </View>
            <Text style={st.planNote}>First 2 months only • Then ₹199/month</Text>
          </TouchableOpacity>,
          1, "plan-launch"
        )}
        {renderField(
          <TouchableOpacity
            style={[st.planCard, { marginTop: 10 }, plan === "standard" && st.planCardActive]}
            onPress={() => setPlan("standard")}
            activeOpacity={0.85}
          >
            <View style={st.planCardHeader}>
              <View style={[st.planDot, plan === "standard" && { backgroundColor: C.blue, borderColor: C.blue }]} />
              <Text style={[st.planCardTitle, plan === "standard" && { color: C.blue }]}>
                Standard
              </Text>
            </View>
            <View style={st.planPriceRow}>
              <Text style={st.planPrice}>₹199</Text>
              <Text style={st.planPriceSuffix}>/month</Text>
            </View>
            <Text style={st.planNote}>All features • Priority support</Text>
          </TouchableOpacity>,
          2, "plan-standard"
        )}
      </>
    );
  };

  return (
    <KeyboardAvoidingView style={st.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={C.nightTop} translucent={false} />

      {/* Sky */}
      <LinearGradient colors={[C.nightTop, C.nightMid, C.nightBot]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />

      {/* Stars */}
      {STARS.map((s, i) => (
        <View key={`s${i}`} style={{
          position: "absolute", left: s.x, top: s.y,
          width: s.size, height: s.size, borderRadius: s.size,
          backgroundColor: "#fff", opacity: s.op,
        }} />
      ))}

      {/* ── Smoke puffs — multi-layered with individual drift + staggered fade ── */}
      {SMOKE.map((puff, i) => (
        <Animated.View
          key={`sm${i}`}
          style={{
            position: "absolute",
            left: puff.x - puff.size / 2,
            top: puff.y - puff.size / 2,
            width: puff.size,
            height: puff.size,
            borderRadius: puff.size / 2,
            opacity: Animated.multiply(smokeOpacity, smokeFades[i]),
            transform: [{ translateX: smokeDrifts[i] }],
            overflow: "hidden",
          }}
        >
          <LinearGradient
            colors={[
              `rgba(148, 163, 184, ${puff.baseOpacity})`,
              `rgba(100, 116, 139, ${puff.baseOpacity * 0.6})`,
              "rgba(71, 85, 105, 0)",
            ]}
            style={{ width: puff.size, height: puff.size, borderRadius: puff.size / 2 }}
            start={{ x: 0.5, y: 0.3 }}
            end={{ x: 0.5, y: 1 }}
          />
        </Animated.View>
      ))}

      {/* Engine glow */}
      <Animated.View style={{
        position: "absolute", width: 70, height: 5, borderRadius: 3,
        backgroundColor: C.orangeGlow,
        opacity: Animated.multiply(engineGlow, 0.35),
        transform: [
          { translateX: Animated.subtract(planeX, 60) },
          { translateY: Animated.add(planeY, Animated.add(bobAnim, 20)) },
        ],
      }} />

      {/* Airplane */}
      <Animated.View style={{
        position: "absolute",
        transform: [
          { translateX: planeX },
          { translateY: Animated.add(planeY, bobAnim) },
          { scale: planeScale },
          { rotate: rotateDeg },
        ],
      }}>
        <Text style={{ fontSize: 44 }}>✈️</Text>
      </Animated.View>

      {/* Runway lights */}
      <Animated.View style={[st.runway, { opacity: runwayOpacity }]}>
        {Array.from({ length: 10 }).map((_, i) => (
          <View key={`rw${i}`} style={[st.runwayLight, { opacity: 0.3 + (i / 10) * 0.7 }]} />
        ))}
      </Animated.View>

      {/* Progress bar */}
      <View style={st.progressTrack}>
        <Animated.View style={[st.progressFill, { width: progressWidth, backgroundColor: ACCENT[step] }]} />
      </View>

      {/* Step dots */}
      <View style={st.dotsRow}>
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={[st.dot, i <= step && { backgroundColor: ACCENT[i], borderColor: ACCENT[i] }]}>
              {i < step
                ? <Ionicons name="checkmark" size={12} color="#fff" />
                : <Text style={[st.dotNum, i === step && { color: "#fff" }]}>{i + 1}</Text>}
            </View>
            {i < STEP_COUNT - 1 && <View style={[st.dotLine, i < step && { backgroundColor: ACCENT[i] }]} />}
          </View>
        ))}
      </View>

      {/* Form card */}
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}>
        <Animated.View style={[st.card, { opacity: cardOpacity, transform: [{ translateY: cardSlideY }] }]}>
          <View style={[st.cardIcon, { backgroundColor: ACCENT[step] + "20" }]}>
            <Ionicons name={ICON[step]} size={22} color={ACCENT[step]} />
          </View>
          <Text style={st.cardTitle}>{TITLE[step]}</Text>
          <Text style={st.cardSub}>{SUB[step]}</Text>

          {renderFields()}

          {error && (
            <View style={st.errorBox}>
              <Ionicons name="alert-circle" size={16} color={C.red} />
              <Text style={st.errorTxt}>{error}</Text>
            </View>
          )}

          <TouchableOpacity style={[st.cta, { backgroundColor: ACCENT[step] }]}
            onPress={handleNext} disabled={loading} activeOpacity={0.88}>
            <Text style={st.ctaTxt}>
              {loading ? "Preparing for landing…"
                : step < STEP_COUNT - 1 ? "Continue →"
                : "Create Account & Verify →"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={{ marginTop: 14, alignSelf: "center" }} onPress={handleBack}>
            <Text style={{ color: C.muted, fontSize: 13 }}>
              {step === 0 ? "Already have an account? " : "← Back "}
              {step === 0 && <Text style={{ color: C.orange, fontWeight: "700" }}>Sign in</Text>}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.nightTop },

  runway: {
    position: "absolute", bottom: 36,
    left: SW * 0.12, right: SW * 0.12,
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", height: 6,
  },
  runwayLight: { width: 10, height: 4, borderRadius: 2, backgroundColor: C.runway },

  progressTrack: {
    height: 4, backgroundColor: "#1E293B",
    marginTop: Platform.OS === "ios" ? 54 : 36,
    marginHorizontal: 24, borderRadius: 2, overflow: "hidden",
  },
  progressFill: { height: 4, borderRadius: 2 },

  dotsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginTop: 14, marginBottom: 6,
  },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#1E293B", borderWidth: 1.5, borderColor: "#334155",
    alignItems: "center", justifyContent: "center",
  },
  dotNum: { color: "#475569", fontSize: 11, fontWeight: "700" },
  dotLine: { width: 28, height: 2, backgroundColor: "#334155", marginHorizontal: 3 },

  card: {
    marginHorizontal: 20, marginTop: SH * 0.14,
    borderRadius: 24, padding: 24,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },
  cardIcon: {
    width: 48, height: 48, borderRadius: 16,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  cardTitle: { color: C.bright, fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 4 },
  cardSub: { color: C.muted, fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 18, lineHeight: 20 },

  label: { color: C.muted, fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, marginBottom: 6 },
  inputRow: { flexDirection: "row", gap: 8 },
  prefixBox: {
    backgroundColor: C.nightTop, borderRadius: 12,
    paddingHorizontal: 12, justifyContent: "center",
    borderWidth: 1, borderColor: C.cardBorder,
  },
  prefixTxt: { color: C.white, fontSize: 14 },
  input: {
    backgroundColor: C.nightTop, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    color: C.bright, fontSize: 15, fontFamily: "Inter_500Medium",
    borderWidth: 1, borderColor: C.cardBorder,
  },

  // ── Pricing cards ──
  offerBanner: {
    backgroundColor: C.orange + "14",
    borderRadius: 16, borderWidth: 1, borderColor: C.orange + "30",
    padding: 16, alignItems: "center", marginBottom: 12,
  },
  offerEmoji: { fontSize: 28, marginBottom: 6 },
  offerTitle: { color: C.orange, fontSize: 18, fontFamily: "Inter_700Bold" },
  offerSub: { color: C.muted, fontSize: 13, textAlign: "center", marginTop: 4, lineHeight: 20 },

  planCard: {
    borderRadius: 16, borderWidth: 1.5, borderColor: "#1E293B",
    padding: 18, backgroundColor: "#0B1120",
  },
  planCardActive: {
    borderColor: C.orange, backgroundColor: C.orange + "0A",
  },
  planCardHeader: {
    flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8,
  },
  planDot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: "#334155", backgroundColor: "transparent",
  },
  planDotActive: {
    backgroundColor: C.orange, borderColor: C.orange,
  },
  planCardTitle: {
    color: C.muted, fontSize: 15, fontFamily: "Inter_700Bold", flex: 1,
  },
  planBadge: {
    backgroundColor: C.orange + "20", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  planBadgeTxt: {
    color: C.orange, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5,
  },
  planPriceRow: {
    flexDirection: "row", alignItems: "baseline", gap: 4, marginLeft: 28,
  },
  planPrice: { color: C.bright, fontSize: 32, fontFamily: "Inter_700Bold" },
  planPriceSuffix: { color: C.muted, fontSize: 14 },
  planNote: { color: C.muted, fontSize: 12, marginTop: 4, marginLeft: 28, lineHeight: 18 },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.red + "12", borderRadius: 10,
  },
  errorTxt: { color: C.red, fontSize: 12, flex: 1 },

  cta: {
    marginTop: 20, borderRadius: 16, paddingVertical: 16, alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 16, elevation: 4,
  },
  ctaTxt: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
