import { supabase } from "./supabaseClient";

export type EInvoice = {
  id: string;
  bill_id: string;
  irn: string;
  ack_number: string;
  ack_date: string;
  qr_code: string;
  status: "Generated" | "Cancelled";
  created_at: string;
};

export async function fetchEInvoices(orgId?: string | null): Promise<EInvoice[]> {
  let q = supabase
    .from("e_invoice_logs")
    .select("*")
    .order("created_at", { ascending: false });
  if (orgId) q = q.eq("organisation_id", orgId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapEInvoice);
}

export async function generateEInvoice(
  billId: string,
  orgId?: string | null
): Promise<EInvoice> {
  const now = new Date();
  const irn = `IRN${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  const ackNumber = `ACK${Math.floor(1000000 + Math.random() * 9000000)}`;
  const ackDate = now.toISOString();
  const qrCode = `https://einvoice1.gst.gov.in/Others/VSignedInvoice?irn=${irn}`;

  const { data, error } = await supabase
    .from("e_invoice_logs")
    .insert({
      organisation_id: orgId ?? null,
      bill_id: billId,
      irn,
      ack_number: ackNumber,
      ack_date: ackDate,
      qr_code: qrCode,
      status: "Generated",
    })
    .select()
    .single();
  if (error) throw error;
  return mapEInvoice(data);
}

export async function cancelEInvoice(id: string): Promise<void> {
  const { error } = await supabase
    .from("e_invoice_logs")
    .update({ status: "Cancelled" })
    .eq("id", id);
  if (error) throw error;
}

function mapEInvoice(row: any): EInvoice {
  return {
    id: row.id,
    bill_id: row.bill_id,
    irn: row.irn,
    ack_number: row.ack_number,
    ack_date: row.ack_date,
    qr_code: row.qr_code,
    status: row.status ?? "Generated",
    created_at: row.created_at,
  };
}
