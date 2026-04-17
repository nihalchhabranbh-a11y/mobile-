import { supabase } from "./supabaseClient";
import { requireOrgId } from "./guardUtils";
import { createProductQuick, getProducts, Product } from "./productsService";

export type Vendor = {
  id: string;
  name: string;
  phone?: string | null;
  organisation_id?: string | null;
  created_at?: string;
};

export type PurchaseItem = {
  productId?: string | null;
  name: string;
  qty: number;
  rate: number;
  amount: number;
  taxRate?: number | null;
};

export type Purchase = {
  id: string;
  vendor_id: string | null;
  vendor_name: string;
  bill_number: string | null;
  bill_date: string | null;
  subtotal: number;
  gst_total: number;
  total: number;
  items: PurchaseItem[];
  organisation_id?: string | null;
  created_at?: string;
};

function normName(s: string) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreName(a: string, b: string) {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.92;
  const ta = new Set(na.split(" ").filter(Boolean));
  const tb = new Set(nb.split(" ").filter(Boolean));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size || 1;
  return inter / union;
}

export async function upsertVendorByName(params: {
  name: string;
  organisationId?: string;
}): Promise<Vendor> {
  const name = params.name.trim();
  if (!name) throw new Error("Vendor name required");

  let query = supabase.from("vendors").select("*").ilike("name", name).limit(1);
  query = query.eq("organisation_id", requireOrgId(params.organisationId));
  const { data: existing, error: selErr } = await query;

  if (selErr) console.warn("[vendors] select failed", selErr.message);

  const row = Array.isArray(existing) && existing.length ? (existing[0] as any) : null;
  if (row) return row as Vendor;

  const ins: any = { name, organisation_id: requireOrgId(params.organisationId) };
  const { data, error } = await supabase.from("vendors").insert([ins]).select("*").single();
  if (error) throw error;
  return data as Vendor;
}

export async function matchOrCreateProductsFromItems(params: {
  items: Array<{ name: string; rate?: number | null; taxRate?: number | null }>;
  organisationId?: string;
}): Promise<Record<string, Product>> {
  const existing = await getProducts(params.organisationId);
  const map: Record<string, Product> = {};

  for (const it of params.items) {
    const name = (it.name || "").trim();
    if (!name) continue;
    let best: Product | null = null;
    let bestScore = 0;
    for (const p of existing) {
      const s = scoreName(name, p.name);
      if (s > bestScore) { bestScore = s; best = p; }
    }
    if (best && bestScore >= 0.82) { map[name] = best; continue; }

    const created = await createProductQuick({
      name,
      defaultRate: Number(it.rate ?? 0) || 0,
      taxRate: Number(it.taxRate ?? 0) || 0,
      organisationId: params.organisationId,
    });

    const prod: Product = {
      id: created.id, name: created.name, category: created.category || "product",
      item_code: created.item_code ?? null, hsn_code: created.hsn_code ?? null,
      unit: created.unit ?? null, default_rate: Number(created.default_rate ?? 0),
      tax_rate: Number(created.tax_rate ?? 0), purchase_price: Number(created.purchase_price ?? 0),
      opening_stock: Number(created.opening_stock ?? 0), stock_as_of: created.stock_as_of ?? null,
      size: created.size ?? null, description: created.description ?? null,
      active: created.active !== false, created_at: created.created_at,
    };
    existing.unshift(prod);
    map[name] = prod;
  }
  return map;
}

export async function createPurchase(params: {
  vendorName: string;
  billNumber?: string | null;
  billDate?: string | null;
  items: PurchaseItem[];
  subtotal: number;
  gstTotal: number;
  total: number;
  organisationId?: string;
}): Promise<Purchase> {
  const vendor = await upsertVendorByName({ name: params.vendorName, organisationId: params.organisationId });

  const row: any = {
    vendor_id: vendor.id, vendor_name: params.vendorName,
    bill_number: params.billNumber ?? null, bill_date: params.billDate ?? null,
    subtotal: params.subtotal, gst_total: params.gstTotal, total: params.total,
    items: params.items,
  };
  row.organisation_id = requireOrgId(params.organisationId);

  const { data, error } = await supabase.from("purchases").insert([row]).select("*").single();
  if (error) throw error;
  return data as Purchase;
}

export async function fetchPurchases(organisationId?: string): Promise<Purchase[]> {
  let query = supabase.from("purchases").select("*").order("created_at", { ascending: false });
  query = query.eq("organisation_id", requireOrgId(organisationId));
  const { data, error } = await query;
  if (error) { console.error("[purchases] fetchPurchases:", error.message); return []; }
  return (data || []) as Purchase[];
}
