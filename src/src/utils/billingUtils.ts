/**
 * Port of printmaster/src/billingUtils.js getBillPaymentInfo.
 * Used for Paid / Remaining / Partially Paid everywhere.
 */
export type BillLike = { id: string; total?: number | null; paid?: boolean | null; status?: string | null };
export type BillPaymentLike = { billId?: string; bill_id?: string; amount?: number | null };

export type BillPaymentInfo = {
  paidAmount: number;
  remaining: number;
  status: "Paid" | "Unpaid" | "Partially Paid" | "Draft";
  isPaid: boolean;
};

export function getBillPaymentInfo(
  bill: BillLike,
  billPayments: BillPaymentLike[] = []
): BillPaymentInfo {
  const payments = (billPayments || []).filter(
    (p) => (p.billId || p.bill_id) === bill.id
  );
  const paidAmount = payments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  );
  const total = Number(bill.total) || 0;
  const hasPayments = payments.length > 0;

  const remaining = hasPayments
    ? Math.max(0, total - paidAmount)
    : bill.paid
      ? 0
      : total;

  let status: "Paid" | "Unpaid" | "Partially Paid" | "Draft";
  if (bill.status === "draft") {
    status = "Draft";
  } else if (hasPayments) {
    status = paidAmount <= 0
      ? "Unpaid"
      : paidAmount >= total
        ? "Paid"
        : "Partially Paid";
  } else {
    status = bill.paid ? "Paid" : "Unpaid";
  }

  const isPaid = hasPayments ? paidAmount >= total : !!bill.paid;
  const displayPaidAmount = hasPayments ? paidAmount : bill.paid ? total : 0;

  return {
    paidAmount: displayPaidAmount,
    remaining,
    status,
    isPaid,
  };
}

export function fmtCurrency(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
