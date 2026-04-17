import { supabase } from "./supabaseClient";
import { requireOrgId } from "./guardUtils";

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  opening_balance: number;
  balance_type?: string;
  created_at?: string;
  billing_address?: string | null;
  state?: string | null;
  notes?: string | null;
};

export type NewCustomerPayload = {
  name: string;
  phone?: string;
  email?: string;
  organisationId?: string;
};

export async function getCustomers(organisationId?: string): Promise<Customer[]> {
  const orgId = requireOrgId(organisationId);
  let query = supabase
    .from("customers")
    .select("*")
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) {
    console.error("[customers] getCustomers:", error.message);
    return [];
  }
  const rows = (data || []) as any[];
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? null,
    email: c.email ?? null,
    gstin: c.gstin ?? null,
    opening_balance: Number(c.opening_balance ?? 0),
    balance_type: c.balance_type ?? null,
    created_at: c.created_at,
    billing_address: c.billing_address ?? null,
    state: c.state ?? null,
  }));
}

export async function createCustomerQuick(payload: NewCustomerPayload) {
  const orgId = requireOrgId(payload.organisationId);
  const row: any = {
    name: payload.name,
    phone: payload.phone ?? null,
    email: payload.email ?? null,
    party_type: "customer",
    organisation_id: orgId,
  };

  const { data, error } = await supabase
    .from("customers")
    .upsert([row], { onConflict: "phone" })
    .select("*")
    .single();

  if (error) {
    console.error("[customers] createCustomerQuick:", error.message);
    throw error;
  }

  return data;
}

export async function addCustomer(customer: {
  name: string;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  openingBalance?: number;
  organisationId?: string;
  billingAddress?: string | null;
  state?: string | null;
  notes?: string | null;
}): Promise<Customer | null> {
  const orgId = requireOrgId(customer.organisationId);
  const row: any = {
    name: customer.name,
    phone: customer.phone ?? null,
    email: customer.email ?? null,
    gstin: customer.gstin ?? null,
    opening_balance: customer.openingBalance ?? 0,
    party_type: "customer",
    billing_address: customer.billingAddress ?? null,
    state: customer.state ?? null,
    notes: customer.notes ?? null,
    organisation_id: orgId,
  };

  const { data, error } = await supabase
    .from("customers")
    .upsert([row], { onConflict: "phone" })
    .select("*")
    .single();

  if (error) {
    console.error("[customers] addCustomer:", error.message);
    return null;
  }
  return {
    id: data.id,
    name: data.name,
    phone: data.phone ?? null,
    email: data.email ?? null,
    gstin: data.gstin ?? null,
    opening_balance: Number(data.opening_balance ?? 0),
    balance_type: data.balance_type ?? null,
    created_at: data.created_at,
    billing_address: data.billing_address ?? null,
    state: data.state ?? null,
    notes: data.notes ?? null,
  };
}

export async function updateCustomer(
  id: string,
  updates: {
    name?: string;
    phone?: string | null;
    email?: string | null;
    gstin?: string | null;
    openingBalance?: number;
    billingAddress?: string | null;
    state?: string | null;
    notes?: string | null;
  },
  orgId?: string | null
): Promise<void> {
  const validOrgId = requireOrgId(orgId);
  const payload: any = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.phone !== undefined) payload.phone = updates.phone ?? null;
  if (updates.email !== undefined) payload.email = updates.email ?? null;
  if (updates.gstin !== undefined) payload.gstin = updates.gstin ?? null;
  if (updates.openingBalance !== undefined) payload.opening_balance = updates.openingBalance;
  if (updates.billingAddress !== undefined) payload.billing_address = updates.billingAddress ?? null;
  if (updates.state !== undefined) payload.state = updates.state ?? null;
  if (updates.notes !== undefined) payload.notes = updates.notes ?? null;
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase
    .from("customers")
    .update(payload)
    .eq("id", id)
    .eq("organisation_id", validOrgId);
  if (error) console.error("[customers] updateCustomer:", error.message);
}

export async function deleteCustomer(id: string, orgId?: string | null): Promise<void> {
  const validOrgId = requireOrgId(orgId);
  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", id)
    .eq("organisation_id", validOrgId);
  if (error) {
    console.error("[customers] deleteCustomer:", error.message);
    throw error;
  }
}
