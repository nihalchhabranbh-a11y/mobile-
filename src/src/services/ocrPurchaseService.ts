import { supabase } from "./supabaseClient";

export type OcrPurchaseItem = {
  name: string;
  qty?: number | null;
  rate?: number | null;
  amount: number;
  taxRate?: number | null;
};

export type OcrPurchaseResult = {
  vendorName?: string | null;
  billNumber?: string | null;
  billDate?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  gstTotal?: number | null;
  total?: number | null;
  items: OcrPurchaseItem[];
  rawText?: string | null;
};

export async function scanPurchaseBill(params: {
  imageBase64: string;
  mimeType: string;
}): Promise<OcrPurchaseResult> {
  const { data, error } = await supabase.functions.invoke("scan_purchase", {
    body: params,
  });

  if (error) {
    console.error("[ocr] scanPurchaseBill:", error.message);
    throw error;
  }

  return (data || {}) as OcrPurchaseResult;
}
