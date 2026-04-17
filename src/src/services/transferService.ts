import { supabase } from "./supabaseClient";
import { requireOrgId } from "./guardUtils";

export type Transfer = {
  id: string;
  from_location: string;
  to_location: string;
  items: TransferItem[];
  status: "Pending" | "In Transit" | "Completed";
  notes?: string;
  created_at: string;
};

export type TransferItem = {
  product_id: string;
  name: string;
  qty: number;
  unit: string;
};

export async function fetchTransfers(orgId?: string | null): Promise<Transfer[]> {
  let q = supabase
    .from("inventory_transfers")
    .select("*")
    .order("created_at", { ascending: false });
  q = q.eq("organisation_id", requireOrgId(orgId));
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapTransfer);
}

export async function createTransfer(
  t: Omit<Transfer, "id" | "created_at"> & { organisationId?: string | null }
): Promise<Transfer> {
  const { data, error } = await supabase
    .from("inventory_transfers")
    .insert({
      organisation_id: requireOrgId(t.organisationId),
      from_location: t.from_location,
      to_location: t.to_location,
      items: JSON.stringify(t.items),
      status: t.status ?? "Pending",
      notes: t.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapTransfer(data);
}

export async function updateTransferStatus(
  id: string,
  status: Transfer["status"],
  orgId?: string
): Promise<void> {
  const { error } = await supabase
    .from("inventory_transfers")
    .update({ status })
    .eq("id", id)
    .eq("organisation_id", requireOrgId(orgId));
  if (error) throw error;
}

export async function deleteTransfer(id: string, orgId?: string): Promise<void> {
  const { error } = await supabase.from("inventory_transfers").delete().eq("id", id).eq("organisation_id", requireOrgId(orgId));
  if (error) throw error;
}

function mapTransfer(row: any): Transfer {
  let items: TransferItem[] = [];
  try {
    items = typeof row.items === "string" ? JSON.parse(row.items) : row.items ?? [];
  } catch { items = []; }
  return {
    id: row.id,
    from_location: row.from_location,
    to_location: row.to_location,
    items,
    status: row.status ?? "Pending",
    notes: row.notes,
    created_at: row.created_at,
  };
}
