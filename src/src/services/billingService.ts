import { supabase } from "./supabaseClient";

export type BillingCustomer = {
  id: string;
  name: string;
  phone?: string | null;
};

export type BillingProduct = {
  id: string;
  name: string;
  category?: string | null;
  itemCode?: string | null;
  hsnCode?: string | null;
  unit?: string | null;
  defaultRate: number;
  taxRate: number;
  description?: string | null;
  active: boolean;
};

export type NewBillItem = {
  productId?: string;
  name: string;
  description?: string | null;
  qty: number;
  rate: number;
  taxRate: number;
  amount: number;
};

export type NewBillPayload = {
  id: string;
  customer: string;
  phone?: string | null;
  email?: string | null;
  subtotal: number;
  gstAmt: number;
  total: number;
  gst: boolean;
  paid: boolean;
  organisationId?: string;
  dueDate?: string | null;
  notes?: string | null;
  status?: string | null;
  items: NewBillItem[];
};

export type RecentBill = {
  id: string;
  number?: string | null;
  customer: string;
  phone?: string | null;
  total: number;
  createdAt: string;
  paid: boolean | null;
  gst?: boolean | null;
  status?: string | null;
  docType?: string | null;
  items?: any[] | null;
};

export async function fetchCustomers(organisationId?: string): Promise<BillingCustomer[]> {
  let query = supabase
    .from("customers")
    .select("id, name, phone")
    .order("created_at", { ascending: false });

  if (organisationId) {
    query = query.eq("organisation_id", organisationId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[billing] fetchCustomers:", error.message);
    throw error;
  }

  return (data || []) as BillingCustomer[];
}

export async function fetchProducts(organisationId?: string): Promise<BillingProduct[]> {
  let query = supabase
    .from("products")
    .select(
      "id, name, category, item_code, hsn_code, unit, default_rate, tax_rate, active, description"
    )
    .order("created_at", { ascending: false });

  if (organisationId) {
    query = query.eq("organisation_id", organisationId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[billing] fetchProducts:", error.message);
    throw error;
  }

  const rows = (data || []) as any[];

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category ?? null,
    itemCode: p.item_code ?? null,
    hsnCode: p.hsn_code ?? null,
    unit: p.unit ?? null,
    defaultRate: Number(p.default_rate ?? 0),
    taxRate: Number(p.tax_rate ?? 0),
    description: p.description ?? null,
    active: p.active !== false,
  }));
}

export async function createBill(payload: NewBillPayload) {
  console.log("[billing] createBill → starting", payload);

  const row: any = {
    id: payload.id,
    customer: payload.customer,
    phone: payload.phone ?? null,
    email: payload.email ?? null,
    subtotal: payload.subtotal,
    gst_amt: payload.gstAmt,
    total: payload.total,
    gst: payload.gst,
    paid: payload.paid,
  };

  if (payload.dueDate) row.due_date = payload.dueDate;
  if (payload.notes) row.notes = payload.notes;
  if (payload.status) row.status = payload.status;
  if ((payload as any).docType) row.doc_type = (payload as any).docType;
  if (payload.organisationId) row.organisation_id = payload.organisationId;
  if (payload.items && payload.items.length > 0) {
    row.items = payload.items;
  }

  const { data, error } = await supabase
    .from("bills")
    .insert([row])
    .select()
    .single();

  if (error) {
    console.error("[billing] createBill:", error.message);
    throw error;
  }

  return {
    ...data,
    createdAt: data.created_at as string,
  } as RecentBill;
}

export async function updateBill(id: string, payload: NewBillPayload) {
  console.log("[billing] updateBill → starting", id, payload);

  const row: any = {
    customer: payload.customer,
    phone: payload.phone ?? null,
    email: payload.email ?? null,
    subtotal: payload.subtotal,
    gst_amt: payload.gstAmt,
    total: payload.total,
    gst: payload.gst,
    paid: payload.paid,
  };

  if (payload.dueDate) row.due_date = payload.dueDate;
  if (payload.notes) row.notes = payload.notes;
  if (payload.status) row.status = payload.status;
  if (payload.organisationId) row.organisation_id = payload.organisationId;
  if (payload.items && payload.items.length > 0) {
    row.items = payload.items;
  }

  const { data, error } = await supabase
    .from("bills")
    .update(row)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[billing] updateBill:", error.message);
    throw error;
  }

  return {
    ...data,
    createdAt: data.created_at as string,
  } as RecentBill;
}

export type BillPayment = {
  id: string;
  billId: string;
  amount: number;
  method: string;
  paidAt: string | null;
};

export async function fetchBills(organisationId?: string): Promise<RecentBill[]> {
  let query = supabase
    .from("bills")
    .select("id, customer, phone, total, created_at, paid, gst, status, doc_type, items")
    .order("created_at", { ascending: false });

  if (organisationId) {
    query = query.eq("organisation_id", organisationId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[billing] fetchBills:", error.message);
    throw error;
  }

  const rows = (data || []) as any[];
  return rows.map((b) => ({
    id: b.id,
    customer: b.customer,
    phone: b.phone ?? null,
    total: Number(b.total ?? 0),
    createdAt: b.created_at,
    paid: b.paid ?? null,
    gst: b.gst ?? null,
    status: b.status ?? null,
    docType: b.doc_type ?? "Sales Invoice",
    items: Array.isArray(b.items) ? b.items : (typeof b.items === 'string' ? safeJsonParse(b.items) : []),
  }));
}

function safeJsonParse(str: string) {
  try { return JSON.parse(str); } catch { return []; }
}

export async function fetchRecentBills(
  limit: number = 10,
  organisationId?: string
): Promise<RecentBill[]> {
  const bills = await fetchBills(organisationId);
  return bills.slice(0, limit);
}

export async function fetchBillPayments(organisationId?: string): Promise<BillPayment[]> {
  let query = supabase
    .from("bill_payments")
    .select("id, bill_id, amount, method, paid_at")
    .order("paid_at", { ascending: false });

  if (organisationId) {
    query = query.eq("organisation_id", organisationId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[billing] fetchBillPayments:", error.message);
    return [];
  }

  const rows = (data || []) as any[];
  return rows.map((p) => ({
    id: p.id,
    billId: p.bill_id,
    amount: Number(p.amount ?? 0),
    method: p.method || "cash",
    paidAt: p.paid_at ?? null,
  }));
}

export async function addBillPayment(payment: {
  billId: string;
  amount: number;
  method?: string;
  note?: string | null;
  organisationId?: string;
}) {
  const row: any = {
    bill_id: payment.billId,
    method: payment.method || "cash",
    amount: payment.amount,
    note: payment.note ?? null,
  };
  if (payment.organisationId) row.organisation_id = payment.organisationId;

  const { data, error } = await supabase
    .from("bill_payments")
    .insert([row])
    .select("*")
    .single();

  if (error) {
    console.error("[billing] addBillPayment:", error.message);
    throw error;
  }
  return { ...data, billId: data.bill_id, paidAt: data.paid_at } as BillPayment;
}

export async function deleteBill(id: string) {
  const { error } = await supabase.from("bills").delete().eq("id", id);
  if (error) {
    console.error("[billing] deleteBill:", error.message);
    throw error;
  }
}

export type BillWithItems = RecentBill & {
  items?: Array<{ name?: string; description?: string | null; qty?: number; rate?: number; taxRate?: number; amount?: number }>;
  subtotal?: number;
  gst_amt?: number;
  due_date?: string | null;
  notes?: string | null;
};

export async function fetchBillById(id: string): Promise<BillWithItems | null> {
  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const b = data as any;
  return {
    id: b.id,
    customer: b.customer,
    phone: b.phone ?? null,
    total: Number(b.total ?? 0),
    createdAt: b.created_at,
    paid: b.paid ?? null,
    gst: b.gst ?? null,
    items: Array.isArray(b.items) ? b.items : (typeof b.items === 'string' ? safeJsonParse(b.items) : []),
    subtotal: Number(b.subtotal ?? 0),
    gst_amt: Number(b.gst_amt ?? 0),
    due_date: b.due_date ?? null,
    notes: b.notes ?? null,
  };
}

