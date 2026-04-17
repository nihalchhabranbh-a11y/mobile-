import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../themeContext";
import { verifyOtp, requestOtp, OtpPurpose } from "../services/otpService";
import { findUserByPhone, registerUserByPhone } from "../services/authService";
import { useUser } from "../userContext";

type RouteParams = {
  mode: "register" | "login" | "verify_phone" | "forgot_password";
  phone: string;
  payload?: any;
};

export const OtpVerifyScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const styles = createStyles({ colors, spacing, radius });
  const navigation = useNavigation<any>();
  const { setUser } = useUser();
  const route = useRoute<any>();
  const params = route.params as RouteParams;

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleVerify = async () => {
    setError(null);
    setInfoMsg(null);

    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }

    try {
      setLoading(true);

      // ── Step 1: Verify the OTP code ──────────────────────────────────────
      const ok = await verifyOtp(params.phone, code.trim(), params.mode as OtpPurpose);
      if (!ok) {
        setError("Invalid or expired code. Please try again.");
        return;
      }

      // ── Step 2: Handle each mode ─────────────────────────────────────────

      if (params.mode === "verify_phone") {
        // Just link this phone to the existing logged-in user
        setUser((prev: any) =>
          prev ? { ...prev, phone: params.phone, phoneVerified: true } : prev
        );
        navigation.goBack();
        return;
      }

      if (params.mode === "forgot_password") {
        navigation.navigate("ResetPassword", { phone: params.phone });
        return;
      }

      // ── LOGIN mode: find existing account only ───────────────────────────
      if (params.mode === "login") {
        const found = await findUserByPhone(params.phone);
        if (!found) {
          setError("❌ No account found for this number. Please register first.");
          return;
        }
        setInfoMsg("✅ Welcome back! Logging you in…");
        await new Promise((r) => setTimeout(r, 600));
        setUser({ ...found, phone: params.phone, phoneVerified: true });
        setTimeout(() => {
          navigation.reset({ index: 0, routes: [{ name: "Main" as never }] });
        }, 400);
        return;
      }

      // ── REGISTER mode: create new account OR log into existing ──────────
      if (params.mode === "register") {
        const existing = await findUserByPhone(params.phone);
        if (existing) {
          // Account already exists — log them in, don't create duplicate
          setInfoMsg("✅ Account found! Logging you in…");
          await new Promise((r) => setTimeout(r, 700));
          setUser({ ...existing, phone: params.phone, phoneVerified: true });
          setTimeout(() => {
            navigation.reset({ index: 0, routes: [{ name: "Main" as never }] });
          }, 400);
          return;
        }
        // Brand new number — create isolated account
        const newUser = await registerUserByPhone(params.phone, params.payload);
        setUser({ ...newUser, phone: params.phone, phoneVerified: true });
        setTimeout(() => {
          navigation.reset({ index: 0, routes: [{ name: "Main" as never }] });
          // Note: Onboarding guide should handle taking them to Settings.
        }, 400);
        return;
      }
    } catch (e) {
      console.warn("[OTP] verify failed", e);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };


  const handleResend = async () => {
    try {
      setError(null);
      setInfoMsg(null);
      setLoading(true);
      await requestOtp(params.phone, params.mode as OtpPurpose);
      setInfoMsg("Code re-sent!");
    } catch {
      setError("Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.safeArea}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Verify your number</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to {params.phone}.{"\n"}Enter it below to continue.
        </Text>

        <Text style={styles.label}>One-time password</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="000000"
          placeholderTextColor={colors.textMuted}
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {infoMsg ? <Text style={styles.infoText}>{infoMsg}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Verify & Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.resendLink} onPress={handleResend} disabled={loading}>
          <Text style={styles.resendText}>Resend code</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Change number</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

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
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    card: {
      width: "100%",
      marginHorizontal: spacing.lg,
      borderRadius: radius.lg,
      padding: spacing.lg,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      marginBottom: spacing.xs,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      marginBottom: spacing.lg,
      fontFamily: "Inter_400Regular",
      lineHeight: 20,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 4,
      fontFamily: "Inter_500Medium",
    },
    input: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      fontSize: 22,
      letterSpacing: 6,
      textAlign: "center",
      fontFamily: "Inter_600SemiBold",
    },
    errorText: {
      color: colors.accentRed,
      fontSize: 12,
      marginTop: spacing.sm,
    },
    infoText: {
      color: colors.accentBlue ?? "#2563EB",
      fontSize: 12,
      marginTop: spacing.sm,
      fontFamily: "Inter_500Medium",
    },
    primaryButton: {
      marginTop: spacing.lg,
      borderRadius: radius.xl,
      paddingVertical: spacing.md,
      alignItems: "center",
      backgroundColor: colors.accentBlue,
      shadowColor: "#2563EB",
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    primaryButtonDisabled: {
      opacity: 0.7,
    },
    primaryButtonText: {
      color: "#fff",
      fontSize: 15,
      fontFamily: "Inter_700Bold",
    },
    resendLink: {
      marginTop: spacing.md,
      alignItems: "center",
    },
    resendText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: "Inter_500Medium",
    },
    backLink: {
      marginTop: spacing.sm,
      alignItems: "center",
    },
    backText: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: "Inter_400Regular",
    },
  });
