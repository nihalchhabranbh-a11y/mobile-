/**
 * aiOrderService.ts  ·  PrintMaster Smart AI Agent
 *
 * Structured JSON-response agent — no external API, runs 100% offline.
 * Trained on the user's products database (keywords field).
 *
 * Task types: ORDER_CREATE | BILL_CREATE | DATA_FILL | QUERY | UPDATE | ASK | ERROR
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface TrainedProduct {
  id: string;
  name: string;
  defaultRate: number;
  keywords: string;
  unit: string;
}

export interface AgentMemory {
  customerName: string | null;
  customerPhone: string | null; // from DB lookup
  phone: string | null;
  lastProductId: string | null;
  lastProductName: string | null;
  lastRate: number | null;
  lastWidth: number | null;
  lastHeight: number | null;
  lastQty: number | null;
  lastTotal: number | null;
  pendingTask: string | null;
  pendingField: string | null;
  multiItems: MultiOrderItem[]; // for multi-item orders
  productRateHistory: Record<string, number>; // product_id → last used rate
  sessionOrderCount: number;
}

export type AgentResponse =
  | { task: "ORDER_CREATE"; items: OrderItem[] }
  | { task: "BILL_CREATE"; area: number; total: number; customer: string | null; phone: string | null; product: string | null; items: BillItem[]; isMulti: boolean }
  | { task: "DATA_FILL"; fields: Record<string, any> }
  | { task: "QUERY"; answer: string }
  | { task: "UPDATE"; field: string; value: string }
  | { task: "ASK"; question: string; for: string }
  | { task: "ERROR"; message: string }
  | { task: "SUGGEST"; suggestions: string[] };

export interface OrderItem {
  product: string;
  productId: string | null;
  width: number;
  height: number;
  quantity: number;
  sqft: number;
  rate: number;
  amount: number;
  description: string;
}

export interface MultiOrderItem {
  productText: string;
  width: number;
  height: number;
  quantity: number;
  rate: number;
  hasExplicitQty: boolean;
  description?: string;
}

export interface BillItem {
  name: string;
  description: string;
  qty: number;
  rate: number;
  taxRate: number;
  amount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT MAPPING (Built-in + keyword-trained)
// ─────────────────────────────────────────────────────────────────────────────

const BUILTIN_KEYWORDS: Record<string, string[]> = {
  "Normal Flex":   ["normal", "nf", "plain", "simple", "ordinary", "sadharan"],
  "Star Flex":     ["star", "sf", "premium star", "star flex"],
  "Vinyl":         ["vinyl", "self adhesive", "sticker", "self-adhesive"],
  "Banner":        ["banner", "flex banner", "outdoor"],
  "Backlit Flex":  ["backlit", "glow", "night flex", "light", "bl"],
  "ACP Board":     ["acp", "board", "metal", "aluminium", "sign board"],
};

function fuzzyScore(typed: string, target: string): number {
  const q = typed.toLowerCase();
  const t = target.toLowerCase();
  if (q === t) return 1.0;
  
  // Bigram Dice Coefficient for sequence similarity
  const getBigrams = (str: string) => {
    const bg = [];
    for (let i = 0; i < str.length - 1; i++) bg.push(str.slice(i, i + 2));
    return bg;
  };
  const qb = getBigrams(q), tb = getBigrams(t);
  let intersection = 0;
  const tbCopy = [...tb];
  for (const b of qb) {
    const idx = tbCopy.indexOf(b);
    if (idx !== -1) { intersection++; tbCopy.splice(idx, 1); }
  }
  const bigramScore = (qb.length + tb.length) === 0 ? 0 : (2 * intersection) / (qb.length + tb.length);

  // Consonant skeleton: strip vowels and compare
  const stripVowels = (s: string) => s.replace(/[aeiou]/gi, "");
  const qc = stripVowels(q), tc = stripVowels(t);
  let consonantScore = 0;
  if (qc && tc) {
      const overlap = [...qc].filter(ch => tc.includes(ch)).length;
      consonantScore = (overlap / Math.max(qc.length, 1)) >= 0.6 ? 0.7 : 0;
  }

  // Starts-with bonus
  const startBonus = t.startsWith(q.slice(0, 2)) || q.startsWith(t.slice(0, 2)) ? 0.2 : 0;

  return Math.min(1, bigramScore + consonantScore * 0.4 + startBonus);
}

function findProduct(text: string, products: TrainedProduct[]): TrainedProduct | null {
  const ltext = text.toLowerCase();
  let best: TrainedProduct | null = null;
  let bestScore = 0;

  // Split text into words to test each word
  const textWords = ltext.split(/\s+/);

  for (const prod of products) {
    let score = 0;

    // Direct exact match
    if (ltext.includes(prod.name.toLowerCase())) {
      score += 5;
    } else {
      // Fuzzy name words (score 2 each)
      prod.name.toLowerCase().split(/\s+/).forEach(pw => {
        if (pw.length > 2) {
          const matchScore = Math.max(...textWords.map(tw => fuzzyScore(tw, pw)));
          if (matchScore > 0.7) score += (2 * matchScore);
        }
      });
    }

    // User-set keywords (score 3 each)
    if (prod.keywords) {
      prod.keywords.split(/[,\s]+/).map(k => k.trim().toLowerCase()).filter(Boolean).forEach(kw => {
        if (kw.length > 1) {
          const matchScore = Math.max(...textWords.map(tw => fuzzyScore(tw, kw)));
          if (matchScore > 0.75) score += (3 * matchScore);
        }
      });
    }

    // Built-in keyword overrides (score 4 each)
    for (const [builtinName, kws] of Object.entries(BUILTIN_KEYWORDS)) {
      if (prod.name.toLowerCase().includes(builtinName.toLowerCase())) {
        kws.forEach(kw => {
          const matchScore = Math.max(...textWords.map(tw => fuzzyScore(tw, kw)));
          if (matchScore > 0.75) score += (4 * matchScore);
        });
      }
    }

    if (score > bestScore) { bestScore = score; best = prod; }
  }

  // Fallback: match any builtin-mapped product even if not in DB
  if (!best || bestScore < 1.5) {
    for (const [builtinName, kws] of Object.entries(BUILTIN_KEYWORDS)) {
      for (const kw of kws) {
        const matchScore = Math.max(...textWords.map(tw => Math.abs(tw.length - kw.length) <= 2 ? fuzzyScore(tw, kw) : 0));
        if (matchScore > 0.8) {
          return {
            id: "",
            name: builtinName,
            defaultRate: 0,
            keywords: kws.join(", "),
            unit: "SQFT",
          };
        }
      }
    }
  }

  return bestScore >= 1.5 ? best : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTORS
// ─────────────────────────────────────────────────────────────────────────────

function extractDimension(text: string): { width: number; height: number } | null {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*[xX×\*]\s*(\d+(?:\.\d+)?)/,
    /(\d+(?:\.\d+)?)\s+by\s+(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*ft\s*[xX×\*]\s*(\d+(?:\.\d+)?)\s*ft/i,
    /width\s*:?\s*(\d+(?:\.\d+)?)\s*.*?height\s*:?\s*(\d+(?:\.\d+)?)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const w = parseFloat(m[1]); const h = parseFloat(m[2]);
      if (w > 0 && h > 0) return { width: w, height: h };
    }
  }
  return null;
}

function extractPhone(text: string): string | null {
  const m = text.match(/(?:\+91|0|91)?[6-9]\d{9}/);
  if (!m) return null;
  const num = m[0].replace(/^\+91|^91|^0/, "");
  return num.length === 10 ? num : null;
}

function extractQty(text: string): number {
  const patterns = [
    /qty\s*:?\s*(\d+(?:\.\d+)?)/i, /quantity\s*:?\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s+pcs/i, /(\d+(?:\.\d+)?)\s+pieces/i,
    /(\d+(?:\.\d+)?)\s+nos/i, /(\d+(?:\.\d+)?)\s+units/i,
    /x\s*(\d+(?:\.\d+)?)\s*$/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseFloat(m[1]);
  }
  return 1; // Default per spec
}

function extractCustomerName(text: string, productName: string | null): string | null {
  let clean = text
    .replace(/(?:\+91|0|91)?[6-9]\d{9}/g, "")
    .replace(/\d+(?:\.\d+)?\s*[xX×\*]\s*\d+(?:\.\d+)?/g, "")
    .replace(/\d+/g, "")
    .replace(/rs\.?|₹|sqft|sq\.?\s?ft|print|banner|flex|vinyl|normal|star|backlit|for|from|to|order|please|hi|hello|dear|thanks|sir|make|bill|create|invoice|pcs|qty|quantity|acp|board/gi, "");

  if (productName) productName.split(" ").forEach(w => { clean = clean.replace(new RegExp(w, "gi"), ""); });

  const words = clean.match(/\b[a-z]{3,}\b/gi);
  if (words && words.length > 0) return words.slice(0, 2).join(" ");
  return null;
}

function extractRate(text: string): number | null {
  const m = text.match(/(?:@|at|rate|rs\.?|₹)\s*:?\s*(\d+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1]) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-ITEM PARSER
// Parses messages like:
// "6x3 normal, 4x2 star flex for Rahul 98765"
// "3 items: 6x3 normal x2, 4x2 star, 2x1 vinyl"
// ─────────────────────────────────────────────────────────────────────────────

function extractMultiItems(
  text: string,
  products: TrainedProduct[]
): { items: MultiOrderItem[]; isMulti: boolean } {
  let segments: string[] = [];
  if (text.includes('\n')) {
    segments = text.split('\n').map(s => s.trim()).filter(s => s.length > 2);
  } else {
    segments = text.split(/,|;|\band\b|\bthen\b|\+/i).map(s => s.trim()).filter(s => s.length > 2);
  }
  
  if (segments.length < 2 && !text.includes('\n')) return { items: [], isMulti: false };

  const items: MultiOrderItem[] = [];
  for (const seg of segments) {
    const dim = extractDimension(seg);
    const explicitQtyMatch = seg.match(/(?:qty|quantity)\s*:?\s*(\d+(?:\.\d+)?)/i);
    const hasExplicitQty = !!explicitQtyMatch;

    const qty = extractQty(seg);
    const rate = extractRate(seg) || 0;
    const prod = findProduct(seg, products);
    
    let desc = seg;
    desc = desc.replace(/,?\s*(?:qty|quantity)\s*:?\s*\d+(?:\.\d+)?/gi, "");
    desc = desc.replace(/,?\s*(?:@|at|rate|rs\.?|₹)\s*:?\s*\d+(?:\.\d+)?/gi, "");
    desc = desc.replace(/^\d+\.\s*/, "").trim();
    
    items.push({
      productText: prod?.name || "Unknown",
      width: dim ? dim.width : 0,
      height: dim ? dim.height : 0,
      quantity: qty,
      hasExplicitQty: hasExplicitQty,
      rate: rate,
      description: desc || "Item"
    });
  }
  const validItems = items.filter(it => it.width > 0 || it.hasExplicitQty || it.rate > 0);
  return { items: validItems, isMulti: validItems.length >= 2 || text.includes('\n') };
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER FUZZY LOOKUP FROM DB
// ─────────────────────────────────────────────────────────────────────────────

function lookupCustomer(
  name: string | null,
  phone: string | null,
  customers: any[]
): { name: string; phone: string } | null {
  if (!customers.length) return null;

  // Exact phone match
  if (phone) {
    const byPhone = customers.find(c => (c.phone || "").replace(/\D/g, "").slice(-10) === phone);
    if (byPhone) return { name: byPhone.name, phone: byPhone.phone || phone };
  }

  // Fuzzy name match
  if (name && name.trim().length >= 3) {
    const lname = name.toLowerCase().trim();
    let bestMatch: any = null, bestScore = 0;
    
    for (const c of customers) {
      const cn = (c.name || "").toLowerCase();
      // Exact substring - only for meaningful lengths
      if (cn === lname || (cn.length > 3 && (cn.includes(lname) || lname.includes(cn)))) {
        return { name: c.name, phone: c.phone || "" };
      }
      
      const nameWords = lname.split(/\s+/);
      const dbWords = cn.split(/\s+/);
      let wordScore = 0;
      
      nameWords.forEach(nw => {
        let best = 0;
        dbWords.forEach((dw: string) => { const s = fuzzyScore(nw, dw); if (s > best) best = s; });
        wordScore += best;
      });
      
      const normScore = wordScore / Math.max(nameWords.length, 1);
      if (normScore > bestScore) { bestScore = normScore; bestMatch = c; }
    }
    
    // Accept if average word-match confidence ≥ 0.38
    if (bestMatch && bestScore >= 0.38) {
      return { name: bestMatch.name, phone: bestMatch.phone || "" };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART RATE RECALL — reuse last known rate for a product
// ─────────────────────────────────────────────────────────────────────────────

function recallRate(productId: string | null, productName: string, memory: AgentMemory, bills: any[]): number | null {
  // 1. From this session's history
  if (productId && memory.productRateHistory[productId]) {
    return memory.productRateHistory[productId];
  }

  // 2. From bills history — last rate used for same product name
  for (const bill of bills) {
    const items: any[] = bill.items || [];
    const match = items.find(it => (it.name || "").toLowerCase().includes(productName.toLowerCase()));
    if (match && match.rate) return Number(match.rate);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTENT DETECTION
// ─────────────────────────────────────────────────────────────────────────────

function detectIntent(msg: string, memory: AgentMemory): string {
  const m = msg.toLowerCase();

  // If agent was waiting for an answer
  if (memory.pendingTask && memory.pendingField) return "ANSWER";

  // Greetings first
  if (m.match(/^(hi|hello|hey|helo|hii|helo|namaste|namaskar|ok|okay|thanks|thank you|ty|good morning|good evening|good afternoon|sup|yo|howdy|hy|hye|hai)[\.!\s]*$/)) return "GREETING";

  // Explicit Bill / order intents
  if (m.match(/make.*bill|create.*bill|bill.*for|new.*bill|generate.*bill|invoice/)) return "BILL_CREATE";
  if (m.match(/make.*order|create.*order|new.*order/)) return "ORDER_CREATE";

  // Query intents
  if (m.match(/sales|revenue|earning|income|how much.*today|today.*total/)) return "QUERY_SALES";
  if (m.match(/this week|weekly|week/)) return "QUERY_WEEKLY";
  if (m.match(/this month|monthly|month/)) return "QUERY_MONTHLY";
  if (m.match(/top customer|best customer|biggest/)) return "QUERY_TOP_CUSTOMER";
  if (m.match(/unpaid|due|pending|owed|outstanding/)) return "QUERY_UNPAID";
  if (m.match(/products?|items?|catalog|what.*sell/)) return "QUERY_PRODUCTS";
  if (m.match(/last.*bill|recent.*bill|latest.*invoice/)) return "QUERY_LAST_BILL";
  if (m.match(/help|commands?|what.*can|features?/)) return "QUERY_HELP";

  if (m.match(/discount|tax|gst/)) return "MODIFY_BILL";

  // Multi-item?
  if (m.match(/,|;|\band\b/) && extractDimension(msg)) return "BILL_CREATE";

  // Has dimension? → likely an order/bill
  if (extractDimension(msg)) return "ORDER_CREATE";

  if (m.match(/bill|paid|unpaid|due|total|how many|owe|balance|history|invoice/)) return "QUERY_CUSTOMER";
  if (m.match(/customers?|clients?|parties?|how many/)) return "QUERY_CUSTOMERS";
  
  // Update intents
  if (m.match(/update|change|edit|modify/)) return "UPDATE";

  // General intelligence
  if (m.match(/what|who|when|where|why|how|which|define|explain|tell me|is the|are the|color|colour|capital|flag|meaning|difference|formula|calculate|convert|translate|weather|news|latest|current|price of|cost of|rate of/i)) return "QUERY_GENERAL";
  // Any other input that looks like a question or unknown → try web search
  if (m.length > 3) return "QUERY_GENERAL";

  return "UNKNOWN";
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN AGENT PROCESS FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

export async function processAgentMessage(
  rawMessage: string,
  memory: AgentMemory,
  products: TrainedProduct[],
  context: { bills?: any[]; customers?: any[] }
): Promise<{ response: AgentResponse; updatedMemory: AgentMemory }> {
  const text = rawMessage.trim();
  const intent = detectIntent(text, memory);
  const mem = { ...memory, productRateHistory: { ...memory.productRateHistory } };

  // ── ANSWER to a pending question ──────────────────────────────────────────
  if (intent === "ANSWER" && mem.pendingTask && mem.pendingField) {
    const field = mem.pendingField;
    const task = mem.pendingTask;
    const val = text.trim();
    mem.pendingField = null;
    mem.pendingTask = null;

    if (field === "customer") {
      const matchedUser = lookupCustomer(val, null, context.customers || []);
      mem.customerName = matchedUser ? matchedUser.name : val;
      mem.phone = matchedUser && matchedUser.phone ? matchedUser.phone : mem.phone;
      
      // Check if we now have enough to complete the task
      if (task === "BILL_CREATE" && mem.lastWidth && mem.lastHeight && mem.lastProductName) {
        return buildBillResponse(mem, products);
      }
    }
    if (field === "phone") {
      mem.phone = val.replace(/\D/g, "").slice(-10);
    }
    if (field === "product") {
      const prod = products.find(p => p.name.toLowerCase().includes(val.toLowerCase()));
      if (prod) {
        mem.lastProductId = prod.id;
        mem.lastProductName = prod.name;
        mem.lastRate = prod.defaultRate;
      }
      if (task === "BILL_CREATE" && mem.lastWidth && mem.lastHeight) {
        return buildBillResponse(mem, products);
      }
    }
    if (field === "dimensions") {
      const dim = extractDimension(val);
      if (dim) {
        mem.lastWidth = dim.width;
        mem.lastHeight = dim.height;
        if (task === "BILL_CREATE" && mem.lastProductName) {
          return buildBillResponse(mem, products);
        }
      }
    }
    if (field === "rate") {
      mem.lastRate = parseFloat(val) || null;
      if (task === "BILL_CREATE" && mem.lastWidth && mem.lastHeight && mem.lastProductName) {
        return buildBillResponse(mem, products);
      }
    }

    return { response: { task: "DATA_FILL", fields: { [field]: val } }, updatedMemory: mem };
  }

  // ── QUERY ─────────────────────────────────────────────────────────────────
  if (intent === "GREETING") {
    return { response: { task: "QUERY", answer: "Hello! 👋 I'm ready to help you create invoices or check your business stats. What do you need?" }, updatedMemory: mem };
  }

  if (intent === "QUERY_GENERAL") {
    const webResult = await fetchWebAnswer(text);
    if (webResult) {
       return { response: { task: "QUERY", answer: webResult.answer }, updatedMemory: mem };
    }
    // Fallthrough to SUGGEST if general query fails
  }

  if (intent.startsWith("QUERY_") && intent !== "QUERY_GENERAL") {
    const ans = handleQuery(intent, context, products);
    return { response: { task: "QUERY", answer: ans }, updatedMemory: mem };
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  if (intent === "UPDATE") {
    const nameM = text.match(/(?:name|customer)\s+(?:to|is|=)\s+(.+)/i);
    if (nameM) {
      mem.customerName = nameM[1].trim();
      return { response: { task: "UPDATE", field: "customerName", value: mem.customerName }, updatedMemory: mem };
    }
    const rateM = text.match(/(?:rate|price)\s+(?:to|is|=)\s+(\d+(?:\.\d+)?)/i);
    if (rateM) {
      mem.lastRate = parseFloat(rateM[1]);
      return { response: { task: "UPDATE", field: "rate", value: String(mem.lastRate) }, updatedMemory: mem };
    }
    return { response: { task: "ERROR", message: "Could not understand what to update. Try: 'update rate to 45'" }, updatedMemory: mem };
  }

  // ── ORDER_CREATE and BILL_CREATE ──────────────────────────────────────────
  if (intent === "ORDER_CREATE" || intent === "BILL_CREATE") {
    // ── MULTI-ITEM detection ───────────────────────────────────────────────
    const { items: multiItems, isMulti } = extractMultiItems(text, products);
    if (isMulti) {
      // Build multi-item bill
      const phone = extractPhone(text);
      const customerName = extractCustomerName(text, null);
      if (phone) mem.phone = phone;
      if (customerName) mem.customerName = customerName;

      // Lookup customer in DB for phone/history
      const dbCustomer = lookupCustomer(customerName, phone || null, context.customers || []);
      if (dbCustomer) {
        mem.customerName = dbCustomer.name;
        if (!mem.phone && dbCustomer.phone) mem.phone = dbCustomer.phone;
      }

      const billItems: BillItem[] = multiItems.map(it => {
        const prod = findProduct(it.productText, products);
        const recalledRate = prod ? recallRate(prod.id || null, prod.name, mem, context.bills || []) : null;
        const rate = it.rate || recalledRate || prod?.defaultRate || 0;
        
        let sqft = 0;
        if (it.hasExplicitQty || (!it.width && !it.height)) {
           sqft = parseFloat(it.quantity.toFixed(2));
        } else {
           sqft = parseFloat((it.width * it.height * it.quantity).toFixed(2));
        }
        
        const amount = parseFloat((sqft * rate).toFixed(2));
        return { 
          name: it.description || prod?.name || it.productText,
          description: "",
          qty: sqft, 
          rate, 
          taxRate: 0, 
          amount 
        };
      });

      const grandTotal = parseFloat(billItems.reduce((s, it) => s + it.amount, 0).toFixed(2));
      const totalArea = parseFloat(billItems.reduce((s, it) => s + it.qty, 0).toFixed(2));

      mem.sessionOrderCount = (mem.sessionOrderCount || 0) + 1;
      return {
        response: {
          task: "BILL_CREATE",
          area: totalArea,
          total: grandTotal,
          customer: mem.customerName,
          phone: mem.phone,
          product: billItems.map(it => it.name).join(" + "),
          items: billItems,
          isMulti: true,
        },
        updatedMemory: mem,
      };
    }

    // ── SINGLE ITEM ────────────────────────────────────────────────────────
    const dim = extractDimension(text);
    const phone = extractPhone(text);
    const customerName = extractCustomerName(text, null);
    const qty = extractQty(text);
    const explicitRate = extractRate(text);
    const matchedProduct = findProduct(text, products);

    // DB customer lookup
    const dbCustomer = lookupCustomer(customerName, phone || null, context.customers || []);
    if (dbCustomer) {
      mem.customerName = dbCustomer.name;
      if (!mem.phone && dbCustomer.phone) mem.phone = dbCustomer.phone;
    } else {
      if (phone) mem.phone = phone;
      if (customerName) mem.customerName = customerName;
    }

    if (dim) { mem.lastWidth = dim.width; mem.lastHeight = dim.height; }
    if (qty > 1) mem.lastQty = qty;
    if (matchedProduct) {
      mem.lastProductId = matchedProduct.id || null;
      mem.lastProductName = matchedProduct.name;
      // Smart rate: explicit > session history > bill history > product default
      const recalledRate = recallRate(matchedProduct.id || null, matchedProduct.name, mem, context.bills || []);
      mem.lastRate = explicitRate ?? recalledRate ?? matchedProduct.defaultRate;
    } else if (explicitRate) {
      mem.lastRate = explicitRate;
    }

    // Check what's missing
    if (!mem.lastProductName && !matchedProduct) {
      mem.pendingTask = intent;
      mem.pendingField = "product";
      const productList = products.slice(0, 5).map(p => p.name).join(", ");
      return { response: { task: "ASK", question: `Which product? Your products: ${productList || "Normal Flex, Star Flex, Vinyl"}`, for: "product" }, updatedMemory: mem };
    }
    if (!mem.lastWidth || !mem.lastHeight) {
      mem.pendingTask = intent;
      mem.pendingField = "dimensions";
      return { response: { task: "ASK", question: "What size? (e.g. 6x3, 4x2 ft)", for: "dimensions" }, updatedMemory: mem };
    }
    if (intent === "BILL_CREATE" && !mem.customerName) {
      mem.pendingTask = intent;
      mem.pendingField = "customer";
      return { response: { task: "ASK", question: "Customer name?", for: "customer" }, updatedMemory: mem };
    }
    if (!mem.lastRate || mem.lastRate === 0) {
      mem.pendingTask = intent;
      mem.pendingField = "rate";
      return { response: { task: "ASK", question: `Rate per sqft for ${mem.lastProductName}? (₹)`, for: "rate" }, updatedMemory: mem };
    }

    return buildBillResponse(mem, products);
  }

  // ── UNKNOWN / SUGGEST ─────────────────────────────────────────────────────
  return {
    response: {
      task: "SUGGEST",
      suggestions: [
        "6x3 normal flex for Rahul 9876543210",
        "4x2 vinyl and 6x3 star for Ahmed",
        "sales today?",
        "unpaid invoices?",
        "this week revenue?",
        "top customer?",
      ],
    },
    updatedMemory: mem,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD BILL RESPONSE
// ─────────────────────────────────────────────────────────────────────────────

function buildBillResponse(
  mem: AgentMemory,
  products: TrainedProduct[]
): { response: AgentResponse; updatedMemory: AgentMemory } {
  const w = mem.lastWidth!;
  const h = mem.lastHeight!;
  const qty = mem.lastQty || 1;
  const area = parseFloat((w * h * qty).toFixed(2));
  const rate = mem.lastRate || 0;
  const total = parseFloat((area * rate).toFixed(2));
  const product = mem.lastProductName || "";
  const productId = mem.lastProductId || null;

  mem.lastTotal = total;
  mem.sessionOrderCount = (mem.sessionOrderCount || 0) + 1;
  // Save rate to session history
  if (productId) mem.productRateHistory[productId] = rate;

  const billItem: BillItem = {
    name: product,
    description: `${w}x${h}`,
    qty: area,
    rate,
    taxRate: 0,
    amount: total,
  };

  return {
    response: {
      task: "BILL_CREATE",
      area,
      total,
      customer: mem.customerName,
      phone: mem.phone,
      product,
      items: [billItem],
      isMulti: false,
    },
    updatedMemory: mem,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

function handleQuery(intent: string, context: { bills?: any[]; customers?: any[] }, products: TrainedProduct[]): string {
  const bills = context.bills || [];
  const customers = context.customers || [];

  if (intent === "QUERY_SALES") {
    const today = new Date().toDateString();
    const todayBills = bills.filter(b => new Date(b.createdAt || b.created_at || "").toDateString() === today);
    const total = todayBills.reduce((s, b) => s + (Number(b.total) || 0), 0);
    const paid = todayBills.filter(b => b.paid).reduce((s, b) => s + (Number(b.total) || 0), 0);
    return `📊 Today's Sales\n━━━━━━━━━━━━━\n🧾 ${todayBills.length} bills\n💰 Total: ₹${total.toFixed(2)}\n✅ Received: ₹${paid.toFixed(2)}\n🔴 Pending: ₹${(total - paid).toFixed(2)}`;
  }
  if (intent === "QUERY_WEEKLY") {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const weekBills = bills.filter(b => new Date(b.createdAt || b.created_at || "") >= weekAgo);
    const total = weekBills.reduce((s, b) => s + (Number(b.total) || 0), 0);
    return `📅 This Week\n━━━━━━━━━━━━━\n🧾 ${weekBills.length} bills · ₹${total.toFixed(2)} total`;
  }
  if (intent === "QUERY_MONTHLY") {
    const now = new Date();
    const monthBills = bills.filter(b => {
      const d = new Date(b.createdAt || b.created_at || "");
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const total = monthBills.reduce((s, b) => s + (Number(b.total) || 0), 0);
    return `📆 This Month\n━━━━━━━━━━━━━\n🧾 ${monthBills.length} bills · ₹${total.toFixed(2)} total`;
  }
  if (intent === "QUERY_TOP_CUSTOMER") {
    const tally: Record<string, number> = {};
    bills.forEach(b => { const n = b.customer || "Unknown"; tally[n] = (tally[n] || 0) + Number(b.total || 0); });
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (!sorted.length) return "No bills found yet.";
    return `🏆 Top Customers\n━━━━━━━━━━━━━\n${sorted.map(([n, t], i) => `${["🥇","🥈","🥉"][i]} ${n} — ₹${t.toFixed(2)}`).join("\n")}`;
  }
  if (intent === "QUERY_LAST_BILL") {
    const last = bills[0];
    if (!last) return "No bills found yet.";
    return `🧾 Last Bill\n━━━━━━━━━━━━━\n👤 ${last.customer}\n💰 ₹${last.total}\n${last.paid ? "✅ Paid" : "🔴 Unpaid"}`;
  }
  if (intent === "QUERY_UNPAID") {
    const unpaid = bills.filter(b => !b.paid);
    const total = unpaid.reduce((s, b) => s + (Number(b.total) || 0), 0);
    const top3 = unpaid.slice(0, 3).map(b => `• ${b.customer}: ₹${b.total}`).join("\n");
    return `🔴 Unpaid Invoices\n━━━━━━━━━━━━━\n${unpaid.length} bills · ₹${total.toFixed(2)} owed${top3 ? "\n" + top3 : ""}`;
  }
  if (intent === "QUERY_PRODUCTS") {
    const active = products.filter(p => (p as any).active !== false);
    if (!active.length) return "No products found. Add them in Products.";
    return `🖨️ Products (${active.length})\n━━━━━━━━━━━━━\n${active.slice(0, 12).map(p => `• ${p.name} — ₹${p.defaultRate}/${p.unit || "sqft"}`).join("\n")}`;
  }
  if (intent === "QUERY_CUSTOMERS") {
    const top5 = customers.slice(0, 5).map(c => `• ${c.name}${c.phone ? " " + c.phone : ""}`).join("\n");
    return `👥 ${customers.length} customers\n━━━━━━━━━━━━━\n${top5}`;
  }
  if (intent === "QUERY_HELP") {
    return `🤖 AI Agent Commands\n━━━━━━━━━━━━━\n📦 Order: "6x3 normal Rahul 98765"\n📦 Multi: "6x3 normal, 4x2 star for Ahmed"\n📊 Sales: "sales today", "this week", "this month"\n🔴 Due: "unpaid invoices"\n🏆 Best: "top customer"\n🧾 Last: "last bill"\n📋 List: "list products", "customers"\n✏️ Edit: "update rate to 50"`;
  }
  return "Didn't get that. Type 'help' for commands.";
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNET & SPELL CHECKER ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const KNOWLEDGE_BASE = [
  { keys: ["indian flag","india flag","flag india","color indian flag","colour indian flag","indian national flag"],
    answer: "🇮🇳 The Indian national flag has three horizontal stripes:\n• 🟠 Top: Saffron (Kesaria) — courage & sacrifice\n• ⚪ Middle: White — peace & truth (with Ashoka Chakra, a 24-spoke blue wheel)\n• 🟢 Bottom: India Green — faith & chivalry", source: "Built-in Knowledge" },
  { keys: ["usa flag","american flag","us flag","color usa flag","colour american flag"],
    answer: "🇺🇸 The US flag has 3 colors:\n• 🔴 Red\n• ⚪ White\n• 🔵 Blue\n13 stripes (original colonies) + 50 stars (states).", source: "Built-in Knowledge" },
  { keys: ["capital india","india capital"],
    answer: "🏛️ Capital of India: **New Delhi**.", source: "Built-in Knowledge" },
  { keys: ["capital usa","usa capital","capital america","capital united states"],
    answer: "🏛️ Capital of USA: **Washington, D.C.**", source: "Built-in Knowledge" },
  { keys: ["pm india","prime minister india","india prime minister","who is pm india"],
    answer: "🏛️ Prime Minister of India: **Narendra Modi** (as of 2024).", source: "Built-in Knowledge" },
  { keys: ["president usa","usa president","who is president usa","american president"],
    answer: "🏛️ President of USA: **Joe Biden** (46th) — succeeded by **Donald Trump** (47th, from Jan 2025).", source: "Built-in Knowledge" },
  { keys: ["gst","goods and services tax","what is gst"],
    answer: "📊 GST (Goods and Services Tax) — India's indirect tax:\n• 0% – essentials\n• 5% – basic goods\n• 12% – standard goods\n• 18% – most services\n• 28% – luxury items\nGST = CGST + SGST (intra-state) or IGST (inter-state).", source: "Built-in Knowledge" },
  { keys: ["sqft formula","square feet formula","area formula","calculate sqft"],
    answer: "📐 Area = Width × Height (in feet)\nExample: 6ft × 4ft = 24 sqft\nTotal cost = Area × Rate per sqft.", source: "Built-in Knowledge" },
  { keys: ["rupee","indian currency","india currency","inr"],
    answer: "💰 India's currency: **Indian Rupee (₹ / INR)**. 1 Rupee = 100 Paise.", source: "Built-in Knowledge" },
];

const SPELL_MAP: Record<string, string> = {
  wos:"who", wot:"what", wht:"what", waht:"what", hwo:"how", hw:"how", whe:"where", wen:"when", y:"why",
  iz:"is", ar:"are", teh:"the", fo:"of", ov:"of", fom:"from", forme:"from", frome:"from",
  indnan:"india", indain:"india", idia:"india", inda:"india", indie:"india",
  pakisan:"pakistan", pakstan:"pakistan", pakis:"pakistan", paksitan:"pakistan",
  amrica:"america", amercia:"america", amerca:"america",
  moodi:"modi", mody:"modi", narendtra:"narendra",
  flg:"flag", falg:"flag", fleg:"flag",
  captial:"capital", captal:"capital", capitla:"capital",
  prezident:"president", presiden:"president", prsident:"president",
  minstr:"minister", mnister:"minister", ministor:"minister",
  colr:"color", colur:"color", coulor:"color", clour:"colour",
  aboout:"about", abut:"about", aboud:"about",
  medel:"model", medle:"model",
  ested:"is", aste:"is",
};

function correctWord(word: string): string {
  const w = word.toLowerCase();
  if (SPELL_MAP[w]) return SPELL_MAP[w];
  if (w.length >= 4) {
    let best = w, bestScore = 0;
    for (const [wrong, right] of Object.entries(SPELL_MAP)) {
      const s = fuzzyScore(w, wrong);
      if (s > 0.8 && s > bestScore) { bestScore = s; best = right; }
    }
    if (bestScore > 0.8) return best;
  }
  return w;
}

function buildSearchQuery(raw: string): string {
  const corrected = raw.trim().split(/\s+/).map(correctWord).join(" ");
  const cleaned = corrected
    .replace(/\b(is|are|the|a|an|me|please|i|my|our|your)\b/gi, " ")
    .replace(/\s+/g, " ").trim();
  return cleaned.length > 2 ? cleaned : corrected;
}

function tryMath(text: string): { answer: string; source: string } | null {
  let expr = text
    .replace(/how much|what is|what's|calculate|=|\?/gi, " ")
    .replace(/\bplus\b/gi, "+").replace(/\bminus\b/gi, "-")
    .replace(/\btimes\b|\bmultiplied by\b/gi, "*")
    .replace(/\bdivided by\b|\bdivide\b/gi, "/")
    .replace(/[^0-9\+\-\*\/\.\(\)\s]/g, " ")
    .replace(/\s+/g, "").trim();
  if (!expr || !/\d/.test(expr)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + expr + ')')();
    if (typeof result === "number" && isFinite(result)) {
      return { answer: `🧮 **${text.replace(/\?/g,"").trim()}** = **${result}**`, source: "Math Engine" };
    }
  } catch (_) {}
  return null;
}

function checkBuiltinKnowledge(query: string) {
  const q = query.toLowerCase().trim();
  let bestMatch = null, bestScore = 0;
  for (const entry of KNOWLEDGE_BASE) {
    for (const key of entry.keys) {
      const keyWords = key.split(" ");
      const queryWords = q.split(/\s+/);
      let matched = 0;
      keyWords.forEach(kw => {
        const best = Math.max(...queryWords.map(qw => fuzzyScore(qw, kw)));
        if (best > 0.55) matched++;
      });
      const score = matched / Math.max(keyWords.length, 1);
      if (score > bestScore) { bestScore = score; bestMatch = entry; }
    }
  }
  return bestScore >= 0.7 ? bestMatch : null;
}

async function fetchWebAnswer(query: string): Promise<{ answer: string; source: string } | null> {
  const mathResult = tryMath(query);
  if (mathResult) return mathResult;

  const correctedQuery = query.trim().split(/\s+/).map(correctWord).join(" ");
  const builtin = checkBuiltinKnowledge(correctedQuery);
  if (builtin) return { answer: builtin.answer, source: builtin.source };

  const searchTerm = buildSearchQuery(query);
  const correctedFull = query.trim().split(/\s+/).map(correctWord).join(" ");

  async function wikiSearch(term: string) {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&format=json&origin=*&srlimit=3`;
    try {
      const resp = await fetch(searchUrl);
      const data = await resp.json();
      if (data?.query?.search?.length > 0) {
        const topResult = data.query.search[0];
        
        let relevanceScore = 0;
        const qWords = correctedFull.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const titleLower = topResult.title.toLowerCase();
        qWords.forEach(w => { if (titleLower.includes(w)) relevanceScore++; });
        if (qWords.length > 0 && (relevanceScore / qWords.length) < 0.3) {
           return "REJECT_IRRELEVANT";
        }

        const snip = topResult.snippet.replace(/<[^>]+>/g, "");
        const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&titles=${encodeURIComponent(topResult.title)}&format=json&origin=*`;
        const exResp = await fetch(extractUrl);
        const exData = await exResp.json();
        const pages = exData?.query?.pages;
        let finalSnippet = snip;
        if (pages) {
          const pageId = Object.keys(pages)[0];
          if (pages[pageId]?.extract) finalSnippet = pages[pageId].extract.replace(/<[^>]+>/g, "").split("\n")[0];
        }
        return `🌐 **${topResult.title}**\n${finalSnippet.substring(0, 300)}...${finalSnippet.length > 300 ? " (Read more on Wikipedia)" : ""}`;
      }
    } catch (e) {}
    return null;
  }

  let ans = await wikiSearch(searchTerm);
  if (ans === "REJECT_IRRELEVANT" || !ans) {
    ans = await wikiSearch(correctedFull);
  }
  if (ans && ans !== "REJECT_IRRELEVANT") return { answer: ans, source: "Wikipedia API" };

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MEMORY FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export function createEmptyMemory(): AgentMemory {
  return {
    customerName: null,
    customerPhone: null,
    phone: null,
    lastProductId: null,
    lastProductName: null,
    lastRate: null,
    lastWidth: null,
    lastHeight: null,
    lastQty: null,
    lastTotal: null,
    pendingTask: null,
    pendingField: null,
    multiItems: [],
    productRateHistory: {},
    sessionOrderCount: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE → HUMAN STRING (for chat display)
// ─────────────────────────────────────────────────────────────────────────────

export function agentResponseToDisplay(r: AgentResponse, memory: AgentMemory): string {
  switch (r.task) {
    case "BILL_CREATE": {
      const lines = [r.isMulti ? `✅ Multi-Item Bill (${r.items.length} items)!` : "✅ Bill calculated!"];
      if (r.customer) lines.push(`👤 Customer: ${r.customer}`);
      if (r.phone)    lines.push(`📞 Phone: ${r.phone}`);
      if (r.isMulti) {
        r.items.forEach(it => lines.push(`  • ${it.name} ${it.description} (Qty: ${it.qty.toFixed(2)}, Rate: ₹${it.rate}) = ₹${it.amount.toFixed(2)}`));
        lines.push(`━━━━━━━━━━━━━`);
      } else if (r.items[0]) {
        const it = r.items[0];
        lines.push(`  • ${it.name} ${it.description} (Qty: ${it.qty.toFixed(2)}, Rate: ₹${it.rate}) = ₹${it.amount.toFixed(2)}`);
      }
      lines.push(`🧾 Total: ₹${r.total.toFixed(2)}`);
      if (memory.sessionOrderCount > 1) lines.push(`\n📌 Order #${memory.sessionOrderCount} this session`);
      return lines.join("\n");
    }
    case "ORDER_CREATE":
      return `📦 ${r.items.length} item(s):\n` +
        r.items.map(it => `• ${it.product}: ${it.width}×${it.height} × ${it.quantity} = ${it.sqft} sqft (₹${it.amount})`).join("\n");
    case "ASK":
      return `❓ ${r.question}`;
    case "QUERY":
      return r.answer;
    case "UPDATE":
      return `✏️ Updated ${r.field} → ${r.value}`;
    case "DATA_FILL":
      return `✅ Saved: ${Object.entries(r.fields).map(([k, v]) => `${k} = ${v}`).join(", ")}`;
    case "ERROR":
      return `❌ ${r.message}`;
    case "SUGGEST":
      return `💡 Try one of these:\n${r.suggestions.map(s => `  → "${s}"`).join("\n")}`;
    default:
      return "Done.";
  }
}
