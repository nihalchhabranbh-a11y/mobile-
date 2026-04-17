import { supabase } from "./supabaseClient";
import { requireOrgId } from "./guardUtils";

export type Product = {
  id: string;
  name: string;
  category: string;
  item_code: string | null;
  hsn_code: string | null;
  unit: string | null;
  default_rate: number;
  tax_rate: number;
  purchase_price: number;
  opening_stock: number;
  stock_as_of: string | null;
  size: string | null;
  description: string | null;
  keywords: string | null;
  active: boolean;
  created_at?: string;
};

export type NewProductPayload = {
  name: string;
  defaultRate: number;
  taxRate: number;
  unit?: string | null;
  hsnCode?: string | null;
  organisationId?: string;
};

export async function getProducts(organisationId?: string): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  query = query.eq("organisation_id", requireOrgId(organisationId));
  const { data, error } = await query;
  if (error) {
    console.error("[products] getProducts:", error.message);
    return [];
  }
  const rows = (data || []) as any[];
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category || "product",
    item_code: p.item_code ?? null,
    hsn_code: p.hsn_code ?? null,
    unit: p.unit ?? null,
    default_rate: Number(p.default_rate ?? 0),
    tax_rate: Number(p.tax_rate ?? 0),
    purchase_price: Number(p.purchase_price ?? 0),
    opening_stock: Number(p.opening_stock ?? 0),
    stock_as_of: p.stock_as_of ?? null,
    size: p.size ?? null,
    description: p.description ?? null,
    keywords: p.keywords ?? null,
    active: p.active !== false,
    created_at: p.created_at,
  }));
}

export async function createProductQuick(payload: NewProductPayload) {
  const row: any = {
    name: payload.name,
    category: "product",
    default_rate: payload.defaultRate ?? 0,
    tax_rate: payload.taxRate ?? 0,
    unit: payload.unit ?? null,
    hsn_code: payload.hsnCode ?? null,
    active: true,
    organisation_id: requireOrgId(payload.organisationId),
  };

  const { data, error } = await supabase
    .from("products")
    .insert([row])
    .select("*")
    .single();

  if (error) {
    console.error("[products] createProductQuick:", error.message);
    throw error;
  }

  return data;
}

export async function addProduct(product: {
  name: string;
  category?: string;
  itemCode?: string | null;
  hsnCode?: string | null;
  unit?: string | null;
  defaultRate?: number;
  taxRate?: number;
  purchasePrice?: number;
  openingStock?: number;
  stockAsOf?: string | null;
  size?: string | null;
  description?: string | null;
  keywords?: string | null;
  active?: boolean;
  organisationId?: string;
}): Promise<Product | null> {
  const row: any = {
    name: product.name,
    category: product.category || "product",
    item_code: product.itemCode ?? null,
    hsn_code: product.hsnCode ?? null,
    unit: product.unit ?? null,
    default_rate: product.defaultRate ?? 0,
    tax_rate: product.taxRate ?? 0,
    purchase_price: product.purchasePrice ?? 0,
    opening_stock: product.openingStock ?? 0,
    stock_as_of: product.stockAsOf ?? null,
    size: product.size ?? null,
    description: product.description ?? null,
    keywords: product.keywords ?? null,
    active: product.active !== false,
    organisation_id: requireOrgId(product.organisationId),
  };

  const { data, error } = await supabase
    .from("products")
    .insert([row])
    .select("*")
    .single();

  if (error) {
    console.error("[products] addProduct:", error.message);
    return null;
  }
  return {
    id: data.id,
    name: data.name,
    category: data.category || "product",
    item_code: data.item_code ?? null,
    hsn_code: data.hsn_code ?? null,
    unit: data.unit ?? null,
    default_rate: Number(data.default_rate ?? 0),
    tax_rate: Number(data.tax_rate ?? 0),
    purchase_price: Number(data.purchase_price ?? 0),
    opening_stock: Number(data.opening_stock ?? 0),
    stock_as_of: data.stock_as_of ?? null,
    size: data.size ?? null,
    description: data.description ?? null,
    keywords: data.keywords ?? null,
    active: data.active !== false,
    created_at: data.created_at,
  };
}

export async function updateProduct(
  id: string,
  updates: {
    name?: string;
    category?: string;
    itemCode?: string | null;
    hsnCode?: string | null;
    unit?: string | null;
    defaultRate?: number;
    taxRate?: number;
    purchasePrice?: number;
    openingStock?: number;
    stockAsOf?: string | null;
    size?: string | null;
    description?: string | null;
    keywords?: string | null;
    active?: boolean;
    organisationId?: string;
  }
): Promise<void> {
  const payload: any = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.itemCode !== undefined) payload.item_code = updates.itemCode ?? null;
  if (updates.hsnCode !== undefined) payload.hsn_code = updates.hsnCode ?? null;
  if (updates.unit !== undefined) payload.unit = updates.unit ?? null;
  if (updates.defaultRate !== undefined) payload.default_rate = updates.defaultRate;
  if (updates.taxRate !== undefined) payload.tax_rate = updates.taxRate;
  if (updates.purchasePrice !== undefined) payload.purchase_price = updates.purchasePrice;
  if (updates.openingStock !== undefined) payload.opening_stock = updates.openingStock;
  if (updates.stockAsOf !== undefined) payload.stock_as_of = updates.stockAsOf ?? null;
  if (updates.size !== undefined) payload.size = updates.size ?? null;
  if (updates.description !== undefined) payload.description = updates.description ?? null;
  if (updates.keywords !== undefined) payload.keywords = updates.keywords ?? null;
  if (updates.active !== undefined) payload.active = updates.active;
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from("products").update(payload).eq("id", id).eq("organisation_id", requireOrgId(updates.organisationId));
  if (error) console.error("[products] updateProduct:", error.message);
}

export async function deleteProduct(id: string, orgId?: string | null): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", id).eq("organisation_id", requireOrgId(orgId));
  if (error) console.error("[products] deleteProduct:", error.message);
}

