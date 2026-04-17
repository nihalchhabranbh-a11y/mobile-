import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Linking, Image, ScrollView } from 'react-native';
import { useTheme } from '../themeContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  featureName?: string;
  requiredPlan?: 'pro' | 'premium';
}

export const PaywallModal: React.FC<PaywallModalProps> = ({ 
  visible, 
  onClose, 
  featureName = "This feature", 
  requiredPlan = 'pro' 
}) => {
  const { colors } = useTheme();
  const isPremiumRequired = requiredPlan === 'premium';
  
  const handleUpgrade = () => {
    Linking.openURL('https://wa.me/917073164253?text=Hi, I made the payment for the ' + requiredPlan.toUpperCase() + ' plan.');
  };

  const amount = isPremiumRequired ? "499" : "99";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=7073164253-2@ybl%26pn=Business%26am=${amount}%26cu=INR`;

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={[
              styles.iconCircle, 
              { backgroundColor: isPremiumRequired ? colors.accentOrange : colors.accentBlue }
            ]}>
              <Icon name="crown" size={32} color="#fff" />
            </View>

            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Upgrade to {isPremiumRequired ? "Premium" : "Pro"}
            </Text>
            
            <Text style={[styles.desc, { color: colors.textSecondary }]}>
              {featureName} is only available on the {isPremiumRequired ? "Premium" : "Pro"} plan.
            </Text>

            <View style={[styles.qrContainer, { borderColor: colors.divider, backgroundColor: colors.background }]}>
              <Text style={styles.qrTitle}>Pay with Paytm / UPI</Text>
              
              <Image source={{ uri: qrUrl }} style={styles.qrImage} />
              
              <Text style={[styles.upiLabel, { color: colors.textPrimary }]}>
                UPI ID: <Text style={[styles.upiId, { color: colors.accentBlue }]}>7073164253-2@ybl</Text>
              </Text>
              <Text style={[styles.amountLabel, { color: colors.accentOrange }]}>
                Amount: ₹{amount}/month
              </Text>
            </View>

            <View style={[styles.noteBox, { backgroundColor: colors.background }]}>
              <Icon name="information-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.noteText, { color: colors.textSecondary }]}>
                After paying, send a screenshot to WhatsApp to activate your plan.
              </Text>
            </View>

            <View style={styles.actionRow}>
               <TouchableOpacity style={[styles.btn, { backgroundColor: colors.accentOrange }]} onPress={handleUpgrade}>
                <Icon name="whatsapp" size={18} color="#fff" />
                <Text style={styles.btnTextPrimary}>Send Screenshot</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>I'll do it later</Text>
            </TouchableOpacity>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 30,
    paddingBottom: 20,
    paddingHorizontal: 20,
    maxHeight: '90%',
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  desc: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  qrContainer: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  qrTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  qrImage: {
    width: 160,
    height: 160,
    borderRadius: 12,
    marginBottom: 16,
  },
  upiLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginBottom: 4,
  },
  upiId: {
    fontFamily: 'Inter_700Bold',
  },
  amountLabel: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    marginTop: 4,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
  },
  noteText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginLeft: 8,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnTextPrimary: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
});
