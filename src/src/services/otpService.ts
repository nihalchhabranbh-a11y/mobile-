/**
 * otpService.ts
 * Fast2SMS Native OTP Integration
 * Sends real SMS OTPs via Fast2SMS (free tier).
 * Works on Android, iOS, and Web (with CORS proxy for web).
 */

import { Platform } from "react-native";

// Fast2SMS API Key
const FAST2SMS_API_KEY = "IozF5x1k9MtjvcQXLKemOrAZwWi7PN3qJGyglC8SBafVYn40RdAL3TrQyjwhKGXs1YavgcZbI5CPxkNS";

export type OtpPurpose = "register" | "login" | "verify_phone" | "forgot_password";

// Store OTPs temporarily in memory. (Valid for 5 minutes)
const localOtpStore = new Map<string, { code: string; expiresAt: number }>();

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return `+91${digits}`;
}

export async function requestOtp(phone: string, _purpose: OtpPurpose): Promise<void> {
  const e164 = normalizePhone(phone);
  const digits10 = e164.replace("+91", "");
  
  if (!FAST2SMS_API_KEY || FAST2SMS_API_KEY.trim() === "") {
    console.warn("[OTP] No Fast2SMS API Key found. MOCK MODE ACTIVE.");
    console.log(`[OTP] (MOCK) Use code 123456 to login for ${e164}`);
    return; // Fast success for development
  }

  // Generate a random 6-digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    const isWeb = Platform.OS === "web";
    const messageText = `Your Verification Code is: ${otpCode}. It is valid for 5 minutes.`;
    const fast2smsUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${FAST2SMS_API_KEY}&route=q&message=${encodeURIComponent(messageText)}&language=english&flash=0&numbers=${digits10}`;
    
    // Bypass CORS restrictions transparently if the user is running this on the Web Dashboard
    const finalUrl = isWeb 
      ? `https://api.allorigins.win/raw?url=${encodeURIComponent(fast2smsUrl)}` 
      : fast2smsUrl;

    const response = await fetch(finalUrl, { method: "GET" });
    const result = await response.json();

    if (result.return === false) {
      console.error("[OTP] Fast2SMS Rejection:", result);
      throw new Error(result.message);
    }

    // Save strictly to memory map
    localOtpStore.set(e164, { code: otpCode, expiresAt: Date.now() + 5 * 60 * 1000 });
    console.log(`[OTP] SMS successfully sent via Fast2SMS to ${digits10}`);
  } catch (err: any) {
    console.error("[OTP] Fast2SMS Request Failed:", err);
    throw new Error(err.message || "Failed to send OTP via Fast2SMS");
  }
}

export async function verifyOtp(
  phone: string,
  code: string,
  _purpose: OtpPurpose
): Promise<boolean> {
  const e164 = normalizePhone(phone);

  // Always allow mock login code for dev
  if (code.trim() === "123456" && (!FAST2SMS_API_KEY || FAST2SMS_API_KEY.trim() === "")) {
    console.log("[OTP] Mock 123456 verified automatically.");
    return true;
  }

  const storedData = localOtpStore.get(e164);
  if (!storedData) {
    throw new Error("No active OTP request found. Please resend the code.");
  }

  if (Date.now() > storedData.expiresAt) {
    localOtpStore.delete(e164);
    throw new Error("OTP has expired.");
  }

  if (storedData.code !== code.trim()) {
    throw new Error("Invalid OTP code.");
  }

  // OTP matched perfectly
  localOtpStore.delete(e164);
  console.log("[OTP] Successfully verified via Fast2SMS memory store.");
  return true;
}
