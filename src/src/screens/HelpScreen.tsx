import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../themeContext";
import { useSafeScreen } from "../hooks/useSafeScreen";

const CONTACT_PHONE = "+91 9876543210";
const CONTACT_WHATSAPP = "919876543210";
const CONTACT_EMAIL = "support@shiromani.com";

export const HelpScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeScreen();
  const navigation = useNavigation<any>();
  const styles = useMemo(
    () => createStyles({ colors, spacing, radius }),
    [colors, spacing, radius]
  );

  const openPhone = () => Linking.openURL(`tel:${CONTACT_PHONE.replace(/\s/g, "")}`);
  const openWhatsApp = () => Linking.openURL(`https://wa.me/${CONTACT_WHATSAPP}`);
  const openEmail = () => Linking.openURL(`mailto:${CONTACT_EMAIL}`);

  return (
    <View style={[styles.safe, { paddingTop: insets.paddingTop }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Help</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Contact us</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={openPhone}>
            <Ionicons name="call" size={22} color={colors.accentBlue} />
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{CONTACT_PHONE}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={openWhatsApp}>
            <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
            <Text style={styles.label}>WhatsApp</Text>
            <Text style={styles.value}>{CONTACT_PHONE}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={openEmail}>
            <Ionicons name="mail" size={22} color={colors.accentBlue} />
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{CONTACT_EMAIL}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <Text style={styles.para}>
          For support with Shiromani billing, invoices, or account, use the contact details above.
        </Text>
      </ScrollView>
    </View>
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
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    backBtn: { marginRight: spacing.sm, padding: spacing.xs },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    scroll: { flex: 1 },
    content: { padding: spacing.lg, paddingBottom: 40 },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      gap: spacing.md,
    },
    label: { flex: 1, fontSize: 15, color: colors.textPrimary },
    value: { fontSize: 14, color: colors.accentBlue, fontWeight: "600" },
    para: {
      marginTop: spacing.lg,
      fontSize: 13,
      color: colors.textMuted,
    },
  });
