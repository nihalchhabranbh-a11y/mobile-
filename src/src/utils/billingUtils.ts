/**
 * Port of printmaster/src/billingUtils.js getBillPaymentInfo.
 * Used for Paid / Remaining / Partially Paid everywhere.
 */
export type BillLike = { id: string; total?: number | null; paid?: boolean | null; status?: string | null; docType?: string | null; customer?: string | null; };
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
  const isCredit = ["Payment In", "Sales Return"].includes(bill.docType || "");
  const payments = (billPayments || []).filter(
    (p) => (p.billId || p.bill_id) === bill.id
  );
  const paidAmount = payments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  );
  const total = Number(bill.total) || 0;
  const hasPayments = payments.length > 0;

  // Credit documents directly resolve against current outstanding
  // So a generic invoice of ₹1000 adds to debt (+1000)
  // A credit of ₹1000 subtracts from debt (-1000)
  if (isCredit) {
    return {
      paidAmount: total,    // Visual purposes
      remaining: -total,    // Ensures it subtracts from outstanding sums
      status: "Paid",       // Stops it from appearing as overdue/unpaid
      isPaid: true
    };
  }

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

export function calculatePartyBalance(
  partyName: string,
  bills: BillLike[],
  billPayments: BillPaymentLike[],
  customers: { name: string; opening_balance?: string | number | null }[],
  /** Pass true when bills/billPayments are already filtered for this party (avoids double scan) */
  preFiltered = false
): number {
  let balance = 0;
  const normName = (partyName || "").trim().toLowerCase();
  const party = customers?.find((c) => (c.name || "").trim().toLowerCase() === normName);
  if (party) {
    balance = Number(party.opening_balance || 0);
  }

  // If pre-filtered, skip the inner .filter to avoid O(n²) re-scan
  const partyBills = preFiltered ? bills : (bills?.filter((b) => (b.customer || "").trim().toLowerCase() === normName) || []);
  partyBills.forEach((b) => {
    const docType = b.docType || "Sales Invoice";
    if (
      docType === "Payment In" ||
      docType === "Sales Return" ||
      docType === "Credit Note"
    ) {
      balance = Math.round((balance - (Number(b.total) || 0)) * 100) / 100;
    } else {
      balance = Math.round((balance + (Number(b.total) || 0)) * 100) / 100;
    }
  });

  // If pre-filtered, billPayments are already for this party — just sum them up
  const pPayments = preFiltered
    ? (billPayments || [])
    : (billPayments?.filter((p) => {
        const bill = bills?.find((b) => b.id === p.bill_id || b.id === p.billId);
        return bill && (bill.customer || "").trim().toLowerCase() === normName;
      }) || []);

  pPayments.forEach((p) => {
    balance = Math.round((balance - (Number(p.amount) || 0)) * 100) / 100;
  });

  return balance;
}
