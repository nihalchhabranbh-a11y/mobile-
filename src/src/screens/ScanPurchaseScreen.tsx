import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert,
  ActivityIndicator, Platform, StatusBar, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useUser } from "../userContext";
import { scanPurchaseBill, OcrPurchaseResult } from "../services/ocrPurchaseService";

type Nav = { navigate: (n: string, p?: any) => void; goBack: () => void };

export const ScanPurchaseScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { user } = useUser();
  const [image, setImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [warnBanner, setWarnBanner] = useState(false);

  const TIPS = [
    "📸 Lay the bill flat on a dark surface",
    "💡 Ensure bright, even lighting",
    "🔍 Capture the full bill — all edges visible",
    "🚫 Avoid shadows or glare on the bill",
  ];

  const pickImage = useCallback(async (source: "camera" | "gallery") => {
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      base64: false,
    };

    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);

    if (result.canceled || !result.assets?.[0]?.uri) return;

    // Enhance image for better OCR
    const manipulated = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 2400 } }],
      { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    setImage(manipulated.uri);
    setWarnBanner(false);

    // Auto-scan
    if (manipulated.base64) {
      try {
        setScanning(true);
        const ocrResult = await scanPurchaseBill({
          imageBase64: manipulated.base64,
          mimeType: "image/jpeg",
        });

        const hasItems = Array.isArray(ocrResult.items) && ocrResult.items.length > 0;
        const hasVendor = !!ocrResult.vendorName;

        if (!hasItems && !hasVendor) {
          setWarnBanner(true);
          Alert.alert(
            "Low accuracy scan",
            "Couldn't detect items or vendor. Tips:\n• Lay bill flat\n• Bright lighting\n• Capture full bill\n• No shadows",
            [
              { text: "Manual Entry", onPress: () => navigation.navigate("ScanPurchasePreview", { ocrResult: { ...ocrResult, items: [] }, rawImage: manipulated.uri }) },
              { text: "Retry", style: "cancel" },
            ]
          );
          return;
        }

        navigation.navigate("ScanPurchasePreview", {
          ocrResult,
          rawImage: manipulated.uri,
        });
      } catch (e: any) {
        Alert.alert("Scan failed", e.message || "Try again with better lighting.");
      } finally {
        setScanning(false);
      }
    }
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#0F172A", "#1E293B"]} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingTop: Platform.OS === "ios" ? 50 : 36, paddingHorizontal: 20, paddingBottom: 16 }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold", marginLeft: 12 }}>Scan Purchase Bill</Text>
        </View>

        {warnBanner && (
          <View style={{ backgroundColor: "#FBBF2420", borderRadius: 12, marginHorizontal: 20, padding: 12, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Ionicons name="warning" size={18} color="#FBBF24" />
            <Text style={{ color: "#FBBF24", fontSize: 12, flex: 1 }}>Previous scan had low accuracy. Try again with better lighting.</Text>
          </View>
        )}

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          {image ? (
            <View style={{ borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#334155" }}>
              <Image source={{ uri: image }} style={{ width: "100%", height: 300 }} resizeMode="contain" />
            </View>
          ) : (
            <View style={{ height: 200, borderRadius: 16, borderWidth: 2, borderColor: "#334155", borderStyle: "dashed", justifyContent: "center", alignItems: "center", gap: 8 }}>
              <Ionicons name="document-text-outline" size={48} color="#475569" />
              <Text style={{ color: "#94A3B8", fontSize: 14 }}>Take a photo or pick from gallery</Text>
            </View>
          )}

          {scanning ? (
            <View style={{ alignItems: "center", gap: 8, paddingVertical: 20 }}>
              <ActivityIndicator color="#3B82F6" size="large" />
              <Text style={{ color: "#94A3B8", fontSize: 13 }}>Analyzing bill with AI…</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
               <View style={{ flexDirection: "row", gap: 10 }}>
                 <TouchableOpacity
                   style={{ flex: 1, backgroundColor: "#3B82F6", borderRadius: 14, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                   onPress={() => pickImage("camera")}
                 >
                   <Ionicons name="camera" size={20} color="#fff" />
                   <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" }}>Camera</Text>
                 </TouchableOpacity>
                 <TouchableOpacity
                   style={{ flex: 1, backgroundColor: "#1E293B", borderRadius: 14, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#334155" }}
                   onPress={() => pickImage("gallery")}
                 >
                   <Ionicons name="images" size={20} color="#94A3B8" />
                   <Text style={{ color: "#94A3B8", fontSize: 15, fontFamily: "Inter_700Bold" }}>Gallery</Text>
                 </TouchableOpacity>
               </View>
               <TouchableOpacity 
                 style={{ backgroundColor: "transparent", borderWidth: 1, borderColor: "#3B82F6", borderRadius: 14, paddingVertical: 16, alignItems: "center", justifyContent: "center", marginTop: 4 }}
                 onPress={() => navigation.navigate("ScanPurchasePreview", { ocrResult: { items: [], vendorName: "", billDate: "", total: 0 }, rawImage: "" })}
               >
                 <Text style={{ color: "#3B82F6", fontSize: 15, fontFamily: "Inter_700Bold" }}>Enter Manually Without Scan</Text>
               </TouchableOpacity>
            </View>
          )}

          <View style={{ backgroundColor: "#1E293B", borderRadius: 16, padding: 16, gap: 10 }}>
            <Text style={{ color: "#F8FAFC", fontSize: 14, fontFamily: "Inter_700Bold" }}>Tips for best results</Text>
            {TIPS.map((tip, i) => (
              <Text key={i} style={{ color: "#94A3B8", fontSize: 13, lineHeight: 20 }}>{tip}</Text>
            ))}
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};
