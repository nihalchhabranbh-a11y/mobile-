import React, { useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../themeContext';

const COLORS = [
  null, // Default
  '#FF6600', '#3B82F6', '#10B981', '#8B5CF6', '#0F172A', '#14B8A6', '#EF4444', '#EC4899', '#F59E0B'
];
const OPACITIES = [0.1, 0.3, 0.5, 0.7, 0.85, 1.0];

export const CustomizationScreen = () => {
  const { 
    colors, spacing, radius, 
    topColor, setTopColor,
    bottomColor, setBottomColor,
    dashboardColor, setDashboardColor,
    customTextColor, setCustomTextColor,
    glassOpacity, setGlassOpacity,
    transparentTabBar, setTransparentTabBar,
    hasWallpaper, setWallpaper
  } = useTheme();
  
  const navigation = useNavigation<any>();

  // Use a transparent or dark background to preview glassmorphism
  const s = useMemo(() => createStyles({ colors, spacing, radius }), [colors, spacing, radius]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Corrected MediaTypeOptions from MediaType
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled) {
      setWallpaper(result.assets[0].uri, 'image');
    }
  };

  const pickVideo = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos, // Corrected MediaTypeOptions from MediaType
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled) {
      setWallpaper(result.assets[0].uri, 'video');
    }
  };

  const ColorPicker = ({ label, selectedOption, onSelectOption }: any) => (
    <View style={s.pickerContainer}>
      <Text style={s.pickerLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.swatchScroll}>
        {COLORS.map((c, i) => (
          <TouchableOpacity
             key={i}
             style={[
               s.swatch,
               { backgroundColor: c || (colors.mode === 'dark' ? '#333' : '#e0e0e0') },
               selectedOption === c && s.swatchActive,
               c === null && s.swatchDefault
             ]}
             onPress={() => onSelectOption(c)}
          >
            {c === null && <Text style={s.defaultText}>Dflt</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Customization UI</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        
        {/* Live Preview Box */}
        <View style={[s.livePreview, { backgroundColor: dashboardColor || colors.background }]}>
           <View style={[s.previewHeader, { backgroundColor: topColor || colors.headerGradientStart }]}>
             <Text style={s.previewHeaderText}>App Header</Text>
           </View>
           <View style={s.previewBody}>
             <View style={[s.previewCard, { backgroundColor: colors.surface }]}>
                <Text style={{ color: customTextColor || colors.textPrimary, fontWeight: 'bold' }}>Sample Card</Text>
                <Text style={{ color: customTextColor || colors.textSecondary, fontSize: 12, marginTop: 4 }}>Glass opacity: {glassOpacity}</Text>
             </View>
           </View>
           <View style={[s.previewTabBar, { backgroundColor: colors.tabBarBg }]}>
             <Ionicons name="home" size={20} color={colors.tabBarActive} />
             <Ionicons name="search" size={20} color={colors.textMuted} />
             <Ionicons name="settings" size={20} color={colors.textMuted} />
           </View>
        </View>

        <View style={s.settingsCard}>
          <Text style={s.sectionTitle}>Colors</Text>
          <ColorPicker label="Header Color (top)" selectedOption={topColor} onSelectOption={setTopColor} />
          <ColorPicker label="Tab Bar Color (bottom)" selectedOption={bottomColor} onSelectOption={setBottomColor} />
          <ColorPicker label="Dashboard Layout (middle)" selectedOption={dashboardColor} onSelectOption={setDashboardColor} />
          <ColorPicker label="Text & Icons" selectedOption={customTextColor} onSelectOption={setCustomTextColor} />
        </View>

        <View style={s.settingsCard}>
          <Text style={s.sectionTitle}>Glassmorphism</Text>
          <Text style={s.pickerLabel}>Card & Surface Opacity</Text>
          <View style={s.opacityWrap}>
            {OPACITIES.map(op => (
              <TouchableOpacity
                key={op}
                style={[s.opacityBtn, glassOpacity === op && { borderColor: colors.accentOrange, backgroundColor: colors.accentOrange + '20' }]}
                onPress={() => setGlassOpacity(op)}
              >
                <Text style={[s.opacityText, glassOpacity === op && { color: colors.accentOrange, fontWeight: 'bold' }]}>
                  {Math.round(op * 100)}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
            <Text style={s.pickerLabel}>Transparent Apple Bar</Text>
            <Switch value={transparentTabBar} onValueChange={setTransparentTabBar} trackColor={{ true: colors.accentOrange, false: colors.cardBorder }} />
          </View>
        </View>

        <View style={s.settingsCard}>
          <Text style={s.sectionTitle}>Wallpaper</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
             <TouchableOpacity style={s.opacityBtn} onPress={pickImage}>
               <Text style={s.opacityText}>Select Image</Text>
             </TouchableOpacity>
             <TouchableOpacity style={s.opacityBtn} onPress={pickVideo}>
               <Text style={s.opacityText}>Select Video</Text>
             </TouchableOpacity>
          </View>
          {hasWallpaper && (
             <TouchableOpacity style={[s.opacityBtn, { marginTop: spacing.sm, borderColor: '#FF4444' }]} onPress={() => setWallpaper(null, null)}>
               <Text style={[s.opacityText, { color: '#FF4444' }]}>Remove Wallpaper</Text>
             </TouchableOpacity>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = ({ colors, spacing, radius }: any) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 60 },
  
  livePreview: {
    height: 200,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.xl,
    justifyContent: 'space-between'
  },
  previewHeader: { height: 40, justifyContent: 'center', alignItems: 'center' },
  previewHeaderText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  previewBody: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  previewCard: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  previewTabBar: { height: 50, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, borderColor: colors.cardBorder },

  settingsCard: { 
    backgroundColor: colors.cardBackground, 
    borderRadius: radius.lg, 
    padding: spacing.md, 
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.md },
  
  pickerContainer: { marginBottom: spacing.md },
  pickerLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs },
  swatchScroll: { gap: spacing.sm, paddingVertical: spacing.xs },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  swatchActive: { borderColor: colors.textPrimary, transform: [{ scale: 1.1 }] },
  swatchDefault: { borderStyle: 'dashed', borderColor: colors.textMuted },
  defaultText: { fontSize: 10, color: colors.textMuted, fontWeight: 'bold' },

  opacityWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  opacityBtn: { 
    flex: 1, 
    minWidth: '28%',
    paddingVertical: spacing.sm, 
    alignItems: 'center', 
    borderRadius: radius.md, 
    borderWidth: 1, 
    borderColor: colors.cardBorder 
  },
  opacityText: { fontSize: 14, color: colors.textSecondary }
});
