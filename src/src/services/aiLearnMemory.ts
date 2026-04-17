/**
 * aiLearnMemory.ts  —  PrintMaster Mobile AI — 10-Level Intelligence Brain
 * ─────────────────────────────────────────────────────────────────────────
 * L1  — Persistent Memory     (patterns saved to AsyncStorage)
 * L2  — Predictive Billing    (suggest repeat bill instantly)
 * L3  — Reasoning Chain       (explain decision step by step)
 * L4  — Self-Correction       (learn from user edits)
 * L5  — Rate Change Alerts    (warn when rate differs from last time)
 * L6  — Due/Credit Tracking   (per-customer balance awareness)
 * L7  — Recurring Radar       (flag customers not billed in 7+ days)
 * L8  — Smart Rate Suggestion (avg rate across similar customers)
 * L9  — Digest Summary        (weekly/daily business snapshot)
 * L10 — Conversation Memory   (persist full chat for context)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "printmaster_ai_learn_v2";
const CHAT_KEY    = "printmaster_ai_chat_v1";

interface Pattern {
  key: string;
  customerName: string;
  customerId: string | null;
  productName: string;
  productId: string | null;
  rate: number;
  qty: number;
  description: string | null;
  count: number;
  lastUsed: number;
  previousRate: number | null;
}

interface DB {
  patterns: Pattern[];
  rateMap: Record<string, { rate: number; previousRate: number | null; updatedAt: number }>;
  corrections: any[];
}

// ── Internal helpers ─────────────────────────────────────────────

async function loadDB(): Promise<DB> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { patterns: [], rateMap: {}, corrections: [] };
}

async function saveDB(db: DB): Promise<void> {
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch {}
}

// ── L1/L2: Learn from Bill & Predict ─────────────────────────────

export async function learnFromBill({
  customerName, customerId, items = [],
}: {
  customerName: string;
  customerId?: string;
  items: { name?: string; productId?: string; rate?: number; qty?: number; description?: string }[];
}): Promise<void> {
  if (!customerName || items.length === 0) return;
  const db = await loadDB();
  const ts = Date.now();

  for (const item of items) {
    const { name: productName, productId, rate = 0, qty = 1, description } = item;
    if (!productName) continue;
    const key = `${(customerId || customerName).toLowerCase()}::${(productId || productName).toLowerCase()}`;
    const prevEntry = db.patterns.find(p => p.key === key);
    const previousRate = prevEntry?.rate ?? null;

    db.rateMap[key] = { rate, previousRate, updatedAt: ts };

    if (prevEntry) {
      Object.assign(prevEntry, {
        rate, qty, description: description || prevEntry.description,
        count: (prevEntry.count || 1) + 1,
        lastUsed: ts, previousRate,
      });
    } else {
      db.patterns.push({
        key, customerName, customerId: customerId || null,
        productName, productId: productId || null,
        rate, qty, description: description || null,
        count: 1, lastUsed: ts, previousRate,
      });
    }
  }
  await saveDB(db);
}

// ── L2: Predictive Billing ────────────────────────────────────────

export async function getAllSuggestionsForCustomer(query: string): Promise<Pattern[]> {
  if (!query || query.trim().length < 2) return [];
  const db = await loadDB();
  const q = query.toLowerCase().trim();
  return db.patterns
    .filter(p => {
      const c = (p.customerName || "").toLowerCase();
      return c.includes(q) || q.split(" ").some(w => w.length > 2 && c.includes(w));
    })
    .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
    .slice(0, 5);
}

export async function getSuggestionForCustomer(query: string): Promise<Pattern | null> {
  const all = await getAllSuggestionsForCustomer(query);
  return all.length > 0 ? all[0] : null;
}

// ── L4: Self-Correction ───────────────────────────────────────────

export async function recordCorrection(params: {
  customerName: string; productName?: string; field: string; oldValue: any; newValue: any;
}): Promise<void> {
  const db = await loadDB();
  db.corrections = db.corrections || [];
  db.corrections.unshift({ ...params, ts: Date.now() });
  if (db.corrections.length > 50) db.corrections.length = 50;
  await saveDB(db);
}

// ── L5: Rate Change Alert ─────────────────────────────────────────

export async function checkRateChange(
  customerName: string, productName: string, newRate: number
): Promise<{ changed: boolean; oldRate: number; newRate: number } | null> {
  const db = await loadDB();
  const q = customerName.toLowerCase();
  const p = db.patterns.find(pat =>
    (pat.customerName || "").toLowerCase().includes(q) &&
    (pat.productName || "").toLowerCase().includes(productName.toLowerCase())
  );
  if (!p || p.rate === newRate || !p.rate) return null;
  return { changed: true, oldRate: p.rate, newRate };
}

// ── L6: Due/Credit Tracking ───────────────────────────────────────

export function getCustomerDue(customerName: string, bills: any[]): number {
  if (!customerName || !bills.length) return 0;
  const q = customerName.toLowerCase();
  return bills
    .filter(b => !b.paid && b.status !== "draft" && (b.customer || "").toLowerCase().includes(q))
    .reduce((sum, b) => sum + (b.total || 0), 0);
}

// ── L7: Recurring Radar ───────────────────────────────────────────

export function getRecurringRadar(
  bills: any[], days = 7
): { customerName: string; daysSince: number }[] {
  if (!bills.length) return [];
  const cutoff = Date.now() - days * 86400000;
  const lastBillDate: Record<string, number> = {};
  for (const b of bills) {
    const name = (b.customer || "").trim();
    if (!name) continue;
    const ts = new Date(b.createdAt || b.created_at || 0).getTime();
    if (!lastBillDate[name] || ts > lastBillDate[name]) lastBillDate[name] = ts;
  }
  return Object.entries(lastBillDate)
    .filter(([, ts]) => ts < cutoff)
    .map(([name, ts]) => ({ customerName: name, daysSince: Math.floor((Date.now() - ts) / 86400000) }))
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 5);
}

// ── L8: Smart Rate Recommendation ────────────────────────────────

export async function getSmartRateRecommendation(
  productName: string
): Promise<{ avg: number; min: number; max: number; samples: number } | null> {
  if (!productName) return null;
  const db = await loadDB();
  const p = productName.toLowerCase();
  const matching = db.patterns.filter(pat => (pat.productName || "").toLowerCase().includes(p));
  if (!matching.length) return null;
  const avg = matching.reduce((sum, pat) => sum + (pat.rate || 0), 0) / matching.length;
  return {
    avg: Math.round(avg * 100) / 100,
    min: Math.min(...matching.map(x => x.rate || 0)),
    max: Math.max(...matching.map(x => x.rate || 0)),
    samples: matching.length,
  };
}

// ── L9: Digest Summary ────────────────────────────────────────────

export function getWeeklyDigest(bills: any[]): {
  billCount: number; total: number; paid: number; unpaidCount: number;
  topCustomer: { name: string; revenue: number } | null;
} | null {
  if (!bills.length) return null;
  const cutoff = Date.now() - 7 * 86400000;
  const recent = bills.filter(b => new Date(b.createdAt || b.created_at || 0).getTime() >= cutoff);
  if (!recent.length) return null;
  const total = recent.reduce((s, b) => s + (b.total || 0), 0);
  const paid  = recent.filter(b => b.paid).reduce((s, b) => s + (b.total || 0), 0);
  const unpaidCount = recent.filter(b => !b.paid && b.status !== "draft").length;
  const byCustomer: Record<string, number> = {};
  for (const b of recent) {
    const c = b.customer || "Unknown";
    byCustomer[c] = (byCustomer[c] || 0) + (b.total || 0);
  }
  const topEntry = Object.entries(byCustomer).sort((a, b) => b[1] - a[1])[0];
  return {
    billCount: recent.length, total: Math.round(total), paid: Math.round(paid),
    unpaidCount, topCustomer: topEntry ? { name: topEntry[0], revenue: Math.round(topEntry[1]) } : null,
  };
}

// ── L10: Conversation Memory ─────────────────────────────────────

export async function saveConversation(messages: any[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-40)));
  } catch {}
}

export async function loadConversation(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(CHAT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export async function clearConversation(): Promise<void> {
  try { await AsyncStorage.removeItem(CHAT_KEY); } catch {}
}

export async function clearLearnedData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(CHAT_KEY);
  } catch {}
}
