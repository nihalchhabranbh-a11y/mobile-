import React, { useState, useMemo } from "react";
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
import { useTheme } from "../themeContext";
import type { User as AppUser } from "../userContext";
import { loginWithCredentials } from "../services/authService";
import { requestOtp } from "../services/otpService";
import { useNavigation } from "@react-navigation/native";

type Props = {
  onLogin: (user: AppUser) => void;
};



export const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const { colors, spacing, radius } = useTheme();
  const styles = useMemo(() => createStyles({ colors, spacing, radius }), [colors, spacing, radius]);
  const navigation = useNavigation<any>();

  const [activeTab, setActiveTab] = useState<"password" | "otp">("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phoneForOtp, setPhoneForOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError("Enter username and password.");
      return;
    }
    setLoading(true);
    try {
      const user = await loginWithCredentials(username, password);
      if (!user) {
        setError("Invalid credentials.");
        return;
      }
      onLogin(user);
    } catch (e: any) {
      console.error("[Login] Auth failed:", e);
      let msg = e?.message || "Something went wrong.";
      if (msg.includes("Database error")) {
        msg = "Could not connect to the database. Please try again later.";
      } else if (msg.includes("Organisation is disabled")) {
        msg = "Your organisation is disabled or not approved yet.";
      } else if (msg.includes("Invalid credentials")) {
        msg = "Incorrect username or password.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginWithOtp = async () => {
    setError(null);
    if (!phoneForOtp.trim()) {
      setError("Enter phone number for OTP login.");
      return;
    }
    try {
      setLoading(true);
      await requestOtp(phoneForOtp.trim(), "login");
      navigation.navigate("OtpVerify", {
        mode: "login",
        phone: phoneForOtp.trim(),
        payload: { username },
      });
    } catch (e) {
      console.warn("[Login] OTP request failed", e);
      setError("Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.safeArea}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.root}>
        <View style={styles.card}>
          <Text style={styles.title}>Business Manager</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={activeTab === "password" ? styles.tabActive : styles.tab}
              onPress={() => { setActiveTab("password"); setError(null); }}
            >
              <Text style={activeTab === "password" ? styles.tabActiveText : styles.tabText}>Password</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={activeTab === "otp" ? styles.tabActive : styles.tab}
              onPress={() => { setActiveTab("otp"); setError(null); }}
            >
              <Text style={activeTab === "otp" ? styles.tabActiveText : styles.tabText}>Login with OTP</Text>
            </TouchableOpacity>
          </View>

          {activeTab === "password" && (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Username</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  placeholder="e.g. Nihal"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <TouchableOpacity
                style={styles.forgotLink}
                onPress={() => {
                  setActiveTab("otp");
                  setError(null);
                }}
              >
                <Text style={styles.forgotText}>Forgot password? Login with OTP</Text>
              </TouchableOpacity>
            </>
          )}

          {activeTab === "otp" && (
            <>
              <View style={styles.divider} />
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Phone (login with OTP)</Text>
                <TextInput
                  style={styles.input}
                  value={phoneForOtp}
                  onChangeText={setPhoneForOtp}
                  keyboardType="phone-pad"
                  placeholder="+91 98xxxxxxx"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {activeTab === "password" && (
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </TouchableOpacity>
          )}

          {activeTab === "otp" && (
            <TouchableOpacity
              style={[styles.buttonSecondary, loading && styles.buttonDisabled]}
              onPress={handleLoginWithOtp}
              disabled={loading}
            >
              <Text style={styles.buttonSecondaryText}>Send OTP & Login</Text>
            </TouchableOpacity>
          )}
        </View>
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
    root: {
      width: "100%",
      paddingHorizontal: spacing.lg,
    },
    card: {
      borderRadius: radius.lg,
      padding: spacing.lg,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: spacing.md,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 20,
      fontFamily: "Inter_700Bold",
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    tabRow: {
      flexDirection: "row",
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    tab: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: "center",
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabActive: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: "center",
      borderBottomWidth: 2,
      borderBottomColor: colors.accentBlue,
    },
    tabText: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    tabActiveText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "600",
    },
    fieldGroup: {
      marginTop: spacing.md,
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
      fontSize: 14,
      fontFamily: "Inter_400Regular",
    },
    errorText: {
      color: colors.accentRed,
      fontSize: 12,
      marginTop: spacing.sm,
    },
    button: {
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
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      color: "#fff",
      fontSize: 15,
      fontFamily: "Inter_700Bold",
    },
    buttonSecondary: {
      marginTop: spacing.sm,
      borderRadius: radius.xl,
      paddingVertical: spacing.md,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    buttonSecondaryText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
    },
    divider: {
      height: 1,
      backgroundColor: colors.cardBorder,
      marginVertical: spacing.md,
    },
    forgotLink: {
      marginTop: spacing.sm,
      alignItems: "flex-end",
    },
    forgotText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: "Inter_500Medium",
    },
  });

