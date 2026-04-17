import { supabase } from "./supabaseClient";

export type Brand = {
  shopName: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  businessEmail: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  branchName: string | null;
  authorisedSignatory: string | null;
  upiId: string | null;
  invoicePrintType: string | null;
  thermalPaperMm: number | null;
};

const DEFAULT_BRAND: Brand = {
  shopName: null,
  address: null,
  phone: null,
  whatsapp: null,
  businessEmail: null,
  gstNumber: null,
  panNumber: null,
  bankName: null,
  accountName: null,
  accountNumber: null,
  ifscCode: null,
  branchName: null,
  authorisedSignatory: null,
  upiId: null,
  invoicePrintType: null,
  thermalPaperMm: null,
};

export async function loadBrand(
  organisationId?: string | null
): Promise<Brand> {
  let query = supabase.from("settings").select("*");
  if (organisationId) query = query.eq("organisation_id", organisationId);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    console.error("[settings] loadBrand:", error.message);
    return DEFAULT_BRAND;
  }
  if (!data) return DEFAULT_BRAND;
  return {
    shopName: data.shop_name ?? DEFAULT_BRAND.shopName,
    address: data.address ?? DEFAULT_BRAND.address,
    phone: data.phone ?? DEFAULT_BRAND.phone,
    whatsapp: data.whatsapp ?? DEFAULT_BRAND.whatsapp,
    businessEmail: data.business_email ?? DEFAULT_BRAND.businessEmail,
    gstNumber: data.gst_number ?? DEFAULT_BRAND.gstNumber,
    panNumber: data.pan_number ?? DEFAULT_BRAND.panNumber,
    bankName: data.bank_name ?? DEFAULT_BRAND.bankName,
    accountName: data.account_name ?? DEFAULT_BRAND.accountName,
    accountNumber: data.account_number ?? DEFAULT_BRAND.accountNumber,
    ifscCode: data.ifsc_code ?? DEFAULT_BRAND.ifscCode,
    branchName: data.branch_name ?? DEFAULT_BRAND.branchName,
    authorisedSignatory:
      data.authorised_signatory ?? DEFAULT_BRAND.authorisedSignatory,
    upiId: data.upi_id ?? DEFAULT_BRAND.upiId,
    invoicePrintType:
      data.invoice_print_type ?? DEFAULT_BRAND.invoicePrintType,
    thermalPaperMm: data.thermal_paper_mm ?? DEFAULT_BRAND.thermalPaperMm,
  };
}

export async function saveBrand(
  brand: Partial<Brand>,
  organisationId?: string | null
): Promise<void> {
  const payload: Record<string, unknown> = {};
  
  if ("shopName" in brand) payload.shop_name = brand.shopName;
  if ("address" in brand) payload.address = brand.address;
  if ("phone" in brand) payload.phone = brand.phone;
  if ("whatsapp" in brand) payload.whatsapp = brand.whatsapp;
  if ("businessEmail" in brand) payload.business_email = brand.businessEmail;
  if ("gstNumber" in brand) payload.gst_number = brand.gstNumber;
  if ("panNumber" in brand) payload.pan_number = brand.panNumber;
  if ("bankName" in brand) payload.bank_name = brand.bankName;
  if ("accountName" in brand) payload.account_name = brand.accountName;
  if ("accountNumber" in brand) payload.account_number = brand.accountNumber;
  if ("ifscCode" in brand) payload.ifsc_code = brand.ifscCode;
  if ("branchName" in brand) payload.branch_name = brand.branchName;
  if ("authorisedSignatory" in brand) payload.authorised_signatory = brand.authorisedSignatory;
  if ("upiId" in brand) payload.upi_id = brand.upiId;
  if ("invoicePrintType" in brand) payload.invoice_print_type = brand.invoicePrintType;
  if ("thermalPaperMm" in brand) payload.thermal_paper_mm = brand.thermalPaperMm;

  if (Object.keys(payload).length === 0) return; // Nothing to update
  
  if (organisationId) payload.organisation_id = organisationId;

  let existingId: string | null = null;
  if (organisationId) {
    const { data: existing } = await supabase
      .from("settings")
      .select("id")
      .eq("organisation_id", organisationId)
      .limit(1)
      .maybeSingle();
    existingId = existing?.id ?? null;
  } else {
    const { data: first } = await supabase
      .from("settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    existingId = first?.id ?? null;
  }

  if (existingId) {
    const { error } = await supabase
      .from("settings")
      .update(payload)
      .eq("id", existingId);
    if (error) console.error("[settings] saveBrand update:", error.message);
  } else {
    const { error } = await supabase.from("settings").insert([payload]);
    if (error) console.error("[settings] saveBrand insert:", error.message);
  }
}
