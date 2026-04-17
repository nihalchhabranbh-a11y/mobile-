import { Linking } from "react-native";
import type { RecentBill, BillPayment } from "../services/billingService";
import { getBillPaymentInfo } from "./billingUtils";

/** Web app base URL for invoice and payment links (e.g. https://your-app.vercel.app) */
export const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://your-web-app.vercel.app";

const DEFAULT_BRAND_NAME = "My Business";

export type ShareableBill = RecentBill & {
  customerPhone?: string | null;
};

export type BrandLike = {
  shopName?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
};

function applyTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_m, key) => vars[key] ?? `{${key}}`);
}

function fmtCur(n: number): string {
  return `₹${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtBillDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Build WhatsApp message with invoice link (?inv=id) and payment link (?pay=id).
 * Ported from printmaster App.jsx buildInvoiceWhatsAppMessage.
 */
export function buildInvoiceWhatsAppMessage(params: {
  bill: ShareableBill;
  billPayments?: BillPayment[];
  brand?: BrandLike | null;
  webBaseUrl?: string;
  template?: string | null;
}): string {
  const {
    bill,
    billPayments = [],
    brand,
    webBaseUrl = WEB_BASE_URL,
    template,
  } = params;
  const invLink = `${webBaseUrl.replace(/\/$/, "")}?inv=${bill.id}`;
  const payLink = `${webBaseUrl.replace(/\/$/, "")}?pay=${bill.id}`;
  const info = getBillPaymentInfo(bill, billPayments);
  const shopName = brand?.shopName || DEFAULT_BRAND_NAME;

  if (template && template.trim()) {
    const createdAt = (bill as { createdAt?: string }).createdAt || "";
    const vars: Record<string, string> = {
      shopName,
      customerName: bill.customer || "Customer",
      invoiceId: bill.id,
      total: fmtCur(Number(bill.total || 0)),
      paid: fmtCur(info.paidAmount),
      remaining: fmtCur(info.remaining),
      date: createdAt ? fmtBillDate(createdAt) : "",
      invLink,
      payLink,
      status: info.isPaid
        ? "PAID"
        : info.paidAmount > 0
          ? "PARTIALLY_PAID"
          : "PAYMENT_PENDING",
    };
    return applyTemplate(template.trim(), vars);
  }

  const lines: (string | null)[] = [
    `*Invoice from ${shopName}*`,
    ``,
    `Hi ${bill.customer || "Customer"},`,
    ``,
    `Your invoice is ready.`,
    ``,
    `*Invoice No:* ${bill.id}`,
    (bill as { createdAt?: string }).createdAt
      ? `*Date:* ${fmtBillDate((bill as { createdAt?: string }).createdAt)}`
      : null,
    `*Total:* ${fmtCur(Number(bill.total || 0))}`,
    info.paidAmount > 0 ? `*Advance Received:* ${fmtCur(info.paidAmount)}` : null,
    info.paidAmount > 0 ? `*Balance Due:* ${fmtCur(info.remaining)}` : null,
    ``,
    info.isPaid
      ? "✅ *Status:* PAID"
      : info.paidAmount > 0
        ? "⏳ *Status:* PARTIALLY PAID"
        : "⏳ *Status:* PAYMENT PENDING",
    ``,
    `📄 *View Invoice:* ${invLink}`,
    !info.isPaid ? `💳 *Pay Now:* ${payLink}` : null,
    ``,
    `Thank you,`,
    shopName,
    brand?.phone ? `Phone: ${brand.phone}` : null,
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

export function getInvoiceWhatsAppUrl(params: {
  bill: ShareableBill;
  billPayments?: BillPayment[];
  brand?: BrandLike | null;
  webBaseUrl?: string;
  template?: string | null;
}): string | null {
  const msg = buildInvoiceWhatsAppMessage(params);
  const raw = (params.bill.customerPhone ?? params.bill.phone ?? params.brand?.whatsapp ?? "")
    .replace(/\D/g, "");
  if (!raw) return null;
  const target = raw.startsWith("91") || raw.length >= 12 ? raw : `91${raw}`;
  return `https://wa.me/${target}?text=${encodeURIComponent(msg)}`;
}

export async function shareBillViaWhatsApp(params: {
  bill: ShareableBill;
  billPayments?: BillPayment[];
  brand?: BrandLike | null;
  webBaseUrl?: string;
  template?: string | null;
}): Promise<void> {
  const url = getInvoiceWhatsAppUrl(params);
  if (!url) return;
  await Linking.openURL(url);
}
