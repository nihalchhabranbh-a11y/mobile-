/**
 * sandboxService.ts
 * Sandbox.co.in API integration for GST & E-Invoice functionality.
 *
 * API Docs: https://docs.sandbox.co.in/
 * Base URL: https://api.sandbox.co.in (production)
 *           https://api.sandbox.co.in (sandbox uses its own prefix)
 *
 * How to set your API key:
 *   1. Open app.json → expo.extra → sandboxApiKey
 *   2. Paste your key from https://sandbox.co.in/dashboard
 */

import Constants from "expo-constants";

// ── API Key ────────────────────────────────────────────────────────
// Reads from app.json → expo.extra.sandboxApiKey (safe for Expo)
const API_KEY: string = (Constants.expoConfig?.extra?.sandboxApiKey as string) ?? "";

const BASE_URL = "https://api.sandbox.co.in";

// ── Shared fetch helper ────────────────────────────────────────────
async function sandboxFetch<T>(
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>
): Promise<T> {
  if (!API_KEY) {
    throw new Error(
      "Sandbox API key not configured. Add sandboxApiKey to app.json → expo.extra"
    );
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();

  if (!res.ok) {
    // Sandbox returns errors in json.message or json.error
    throw new Error(
      json?.message || json?.error || `HTTP ${res.status}: ${res.statusText}`
    );
  }

  return json as T;
}

// ── Types ──────────────────────────────────────────────────────────

export type GstTaxpayerData = {
  gstin: string;
  trade_name?: string;
  legal_name?: string;
  registration_date?: string;
  status?: string;
  constitution_of_business?: string;
  address?: string;
  state?: string;
  filing_status?: string;
};

export type EInvoicePayload = {
  seller_gstin: string;
  buyer_gstin?: string;
  buyer_name: string;
  buyer_address?: string;
  invoice_number: string;
  invoice_date: string; // DD/MM/YYYY
  invoice_value: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    hsn_code?: string;
    tax_rate?: number;
    amount: number;
  }>;
};

export type EInvoiceResult = {
  irn: string;
  ack_no?: string;
  ack_dt?: string;
  signed_invoice?: string;
  signed_qr_code?: string;
  status?: string;
};

// ── 1. GSTIN Verification / Taxpayer Lookup ───────────────────────
/**
 * Look up a GST number (GSTIN) to verify it and get business details.
 * Endpoint: GET /gst/compliance/taxpayer/{gstin}
 */
export async function lookupGstin(gstin: string): Promise<GstTaxpayerData> {
  const clean = gstin.trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean)) {
    throw new Error("Invalid GSTIN format. Must be 15 characters (e.g. 29ABCDE1234F1Z5)");
  }

  const data = await sandboxFetch<any>(`/gst/compliance/taxpayer/${clean}`);

  // Normalize the Sandbox response shape
  return {
    gstin: data.data?.gstin || clean,
    trade_name: data.data?.trade_name || data.data?.tradeName,
    legal_name: data.data?.legal_name || data.data?.legalName,
    registration_date: data.data?.registration_date || data.data?.rgdt,
    status: data.data?.status || data.data?.sts,
    constitution_of_business: data.data?.constitution_of_business || data.data?.ctb,
    address: data.data?.address,
    state: data.data?.state,
    filing_status: data.data?.filing_status,
  };
}

// ── 2. E-Invoice Generation ────────────────────────────────────────
/**
 * Generate an E-Invoice IRN + QR code via Sandbox.co.in.
 * Endpoint: POST /gst/einvoice/generate
 */
export async function generateRealEInvoice(
  payload: EInvoicePayload
): Promise<EInvoiceResult> {
  const data = await sandboxFetch<any>(
    "/gst/einvoice/generate",
    "POST",
    {
      seller_gstin: payload.seller_gstin,
      buyer_gstin: payload.buyer_gstin || null,
      buyer_name: payload.buyer_name,
      buyer_address: payload.buyer_address || "",
      invoice_number: payload.invoice_number,
      invoice_date: payload.invoice_date,
      invoice_value: payload.invoice_value,
      cgst: payload.cgst ?? 0,
      sgst: payload.sgst ?? 0,
      igst: payload.igst ?? 0,
      items: payload.items ?? [],
    }
  );

  if (!data?.data?.irn && !data?.irn) {
    throw new Error("E-Invoice generated but IRN not returned. Check your GST credentials.");
  }

  return {
    irn: data.data?.irn || data.irn,
    ack_no: data.data?.ack_no || data.ack_no,
    ack_dt: data.data?.ack_dt || data.ack_dt,
    signed_invoice: data.data?.signed_invoice,
    signed_qr_code: data.data?.signed_qr_code,
    status: data.data?.status || "GENERATED",
  };
}

// ── 3. Cancel E-Invoice ────────────────────────────────────────────
/**
 * Cancel an already-generated IRN.
 * Endpoint: POST /gst/einvoice/cancel
 */
export async function cancelRealEInvoice(
  irn: string,
  cancelReason: string = "Order cancelled",
  cancelRemarks: string = ""
): Promise<{ success: boolean; message: string }> {
  const data = await sandboxFetch<any>("/gst/einvoice/cancel", "POST", {
    irn,
    cancel_reason: cancelReason,
    cancel_remarks: cancelRemarks,
  });

  return {
    success: data?.data?.status === "CNL" || !!data?.success,
    message: data?.data?.message || data?.message || "IRN cancelled successfully",
  };
}

// ── 4. Test connection ─────────────────────────────────────────────
/**
 * Quick connectivity test — fetches a known GSTIN.
 * Returns true if API key is working.
 */
export async function testSandboxConnection(): Promise<boolean> {
  try {
    await lookupGstin("29ABCDE1234F1Z5");
    return true;
  } catch {
    return false;
  }
}

// ── 5. E-Way Bill Types ────────────────────────────────────────────

export type EWayBillPayload = {
  seller_gstin: string;
  buyer_gstin?: string;
  buyer_name: string;
  supply_type: "O" | "I";           // O = Outward, I = Inward
  sub_supply_type: string;          // "1" = Supply
  document_type: "INV" | "BIL" | "BOE" | "CHL" | "OTH";
  document_number: string;
  document_date: string;            // DD/MM/YYYY
  from_gstin: string;
  from_pincode: string;
  to_gstin?: string;
  to_pincode: string;
  total_value: number;
  taxable_value: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  cess?: number;
  transport_mode: "1" | "2" | "3" | "4"; // 1=Road,2=Rail,3=Air,4=Ship
  vehicle_number?: string;
  transporter_id?: string;
  transporter_name?: string;
  distance?: number;
  hsn_code?: string;
  items?: Array<{
    name: string;
    description: string;
    hsn_code: string;
    quantity: number;
    unit: string;
    value: number;
    tax_rate: number;
  }>;
};

export type EWayBillResult = {
  ewb_no: string;
  ewb_date?: string;
  valid_upto?: string;
  alert?: string;
  status?: string;
};

// ── 6. Generate E-Way Bill ─────────────────────────────────────────
/**
 * Generate an E-Way Bill via Sandbox.co.in.
 * Endpoint: POST /gst/ewayBill/generate
 */
export async function generateEWayBill(
  payload: EWayBillPayload
): Promise<EWayBillResult> {
  const data = await sandboxFetch<any>("/gst/ewayBill/generate", "POST", {
    supplyType: payload.supply_type,
    subSupplyType: payload.sub_supply_type,
    docType: payload.document_type,
    docNo: payload.document_number,
    docDate: payload.document_date,
    fromGstin: payload.from_gstin,
    fromPincode: parseInt(payload.from_pincode) || 0,
    toGstin: payload.to_gstin || "URP",
    toPincode: parseInt(payload.to_pincode) || 0,
    transactionType: "1",
    totInvValue: payload.total_value,
    taxableAmount: payload.taxable_value,
    cgstValue: payload.cgst ?? 0,
    sgstValue: payload.sgst ?? 0,
    igstValue: payload.igst ?? 0,
    cessValue: payload.cess ?? 0,
    transporterId: payload.transporter_id || "",
    transporterName: payload.transporter_name || "",
    transMode: payload.transport_mode,
    vehicleNo: payload.vehicle_number || "",
    vehicleType: "R",
    distance: payload.distance || 0,
    itemList: (payload.items ?? []).map((it) => ({
      productName: it.name,
      productDesc: it.description,
      hsnCode: it.hsn_code,
      quantity: it.quantity,
      qtyUnit: it.unit || "NOS",
      taxableAmount: it.value,
      cgstRate: it.tax_rate / 2,
      sgstRate: it.tax_rate / 2,
      igstRate: 0,
      cessRate: 0,
    })),
  });

  const ewbNo = data?.data?.ewbNo || data?.ewbNo;
  if (!ewbNo) {
    throw new Error(
      data?.data?.message || data?.message || "E-Way Bill generated but EWB No not returned."
    );
  }

  return {
    ewb_no: String(ewbNo),
    ewb_date: data?.data?.ewbDt || data?.ewbDt,
    valid_upto: data?.data?.validUpto || data?.validUpto,
    alert: data?.data?.alert,
    status: "ACTIVE",
  };
}

// ── 7. Cancel E-Way Bill ───────────────────────────────────────────
/**
 * Cancel an E-Way Bill.
 * Endpoint: POST /gst/ewayBill/cancel
 */
export async function cancelEWayBill(
  ewbNo: string,
  cancelReason: string = "Others",
  cancelRemarks: string = "Cancelled"
): Promise<{ success: boolean; message: string }> {
  const data = await sandboxFetch<any>("/gst/ewayBill/cancel", "POST", {
    ewbNo: parseInt(ewbNo),
    cancelRsnCode: 4,      // 4 = Others
    cancelRmrk: cancelRemarks,
  });

  return {
    success: data?.data?.cancelDate != null || !!data?.success,
    message: data?.data?.message || data?.message || "E-Way Bill cancelled",
  };
}
