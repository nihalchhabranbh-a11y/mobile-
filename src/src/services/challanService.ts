import { supabase } from "./supabaseClient";
import { requireOrgId } from "./guardUtils";

export type Challan = {
  id: string;
  customer: string;
  phone?: string;
  items: ChallanItem[];
  status: "Draft" | "Sent" | "Delivered" | "Converted";
  vehicle_number?: string;
  transport?: string;
  notes?: string;
  created_at: string;
};

export type ChallanItem = {
  name: string;
  qty: number;
  unit: string;
  description?: string;
};

export async function fetchChallans(orgId?: string | null): Promise<Challan[]> {
  let q = supabase
    .from("challans")
    .select("*")
    .order("created_at", { ascending: false });
  q = q.eq("organisation_id", requireOrgId(orgId));
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapChallan);
}

export async function createChallan(
  c: Omit<Challan, "id" | "created_at"> & { organisationId?: string | null }
): Promise<Challan> {
  const { data, error } = await supabase
    .from("challans")
    .insert({
      organisation_id: requireOrgId(c.organisationId),
      customer: c.customer,
      phone: c.phone ?? null,
      items: JSON.stringify(c.items),
      status: c.status ?? "Draft",
      vehicle_number: c.vehicle_number ?? null,
      transport: c.transport ?? null,
      notes: c.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapChallan(data);
}

export async function updateChallanStatus(
  id: string,
  status: Challan["status"],
  orgId?: string
): Promise<void> {
  const { error } = await supabase
    .from("challans")
    .update({ status })
    .eq("id", id)
    .eq("organisation_id", requireOrgId(orgId));
  if (error) throw error;
}

export async function deleteChallan(id: string, orgId?: string): Promise<void> {
  const { error } = await supabase.from("challans").delete().eq("id", id).eq("organisation_id", requireOrgId(orgId));
  if (error) throw error;
}

function mapChallan(row: any): Challan {
  let items: ChallanItem[] = [];
  try {
    items = typeof row.items === "string" ? JSON.parse(row.items) : row.items ?? [];
  } catch { items = []; }
  return {
    id: row.id,
    customer: row.customer,
    phone: row.phone,
    items,
    status: row.status ?? "Draft",
    vehicle_number: row.vehicle_number,
    transport: row.transport,
    notes: row.notes,
    created_at: row.created_at,
  };
}
