/**
 * aiWebSearch.ts  —  PrintMaster Mobile AI — Internet Search Engine
 * -----------------------------------------------------------------
 * Full search chain:
 *   1. Math Engine       — instant local calculation
 *   2. Built-in KB       — instant offline facts
 *   3. DuckDuckGo API    — free, no key, real internet search
 *   4. Wikipedia API     — fallback for long-form answers
 *
 * No API key. No cost. Works 24/7 as long as device has internet.
 */

// -- Built-in Knowledge Base --

const KNOWLEDGE_BASE = [
  { keys: ["flag india", "india flag", "colour india flag", "color india flag"],
    answer: "The Indian flag (Tiranga) has three horizontal bands: saffron (top), white (middle, with blue Ashoka Chakra), and green (bottom).", source: "Built-in Knowledge" },
  { keys: ["flag pakistan", "pakistan flag"],
    answer: "Pakistan's flag is dark green with a white vertical stripe, a white crescent moon, and a white star.", source: "Built-in Knowledge" },
  { keys: ["capital india", "india capital"],
    answer: "Capital of India: New Delhi.", source: "Built-in Knowledge" },
  { keys: ["capital usa", "usa capital", "capital america"],
    answer: "Capital of USA: Washington, D.C.", source: "Built-in Knowledge" },
  { keys: ["capital pakistan", "pakistan capital"],
    answer: "Capital of Pakistan: Islamabad.", source: "Built-in Knowledge" },
  { keys: ["pm india", "prime minister india"],
    answer: "Prime Minister of India: Narendra Modi (as of 2024).", source: "Built-in Knowledge" },
  { keys: ["president usa", "usa president", "pm usa", "pm america", "prime minister usa"],
    answer: "The USA does NOT have a Prime Minister. It has a President.\n\nCurrent: Donald Trump (47th President, from Jan 2025). Previous: Joe Biden (46th).", source: "Built-in Knowledge" },
  { keys: ["gst", "goods and services tax"],
    answer: "GST — India's indirect tax:\n• 0% – essentials\n• 5% – basic goods\n• 12% – standard goods\n• 18% – most services\n• 28% – luxury items", source: "Built-in Knowledge" },
  { keys: ["sqft formula", "calculate sqft", "area formula"],
    answer: "Area = Width x Height (in feet)\nExample: 6ft x 4ft = 24 sqft\nTotal = Area x Rate per sqft.", source: "Built-in Knowledge" },
  { keys: ["national animal india"],
    answer: "National animal of India: Bengal Tiger.", source: "Built-in Knowledge" },
  { keys: ["national bird india"],
    answer: "National bird of India: Indian Peacock.", source: "Built-in Knowledge" },
  { keys: ["rupee", "inr", "indian currency"],
    answer: "India's currency: Indian Rupee (INR). 1 Rupee = 100 Paise.", source: "Built-in Knowledge" },
];

// -- Spell Correction --

const SPELL_MAP: Record<string, string> = {
  wot: "what", wht: "what", hwo: "how", whe: "where", wen: "when",
  indain: "india", idia: "india", inda: "india",
  pakisan: "pakistan", pakstan: "pakistan",
  flg: "flag", falg: "flag", captial: "capital", captal: "capital",
  prezident: "president", minstr: "minister",
};

function fuzzyScore(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  return matches / longer.length;
}

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
  return corrected.replace(/\b(is|are|the|a|an|me|please|i|my|our|your)\b/gi, " ")
    .replace(/\s+/g, " ").trim() || corrected;
}

// -- Math Engine (only fires for actual calculations) --

function tryMath(text: string): { answer: string; source: string } | null {
  // Skip if text contains natural language / sports / question context words
  const hasNaturalLanguage = /\b(who|win|won|when|where|which|champion|cup|final|match|ipl|t20|world|cricket|football|team|player|country|tournament|league)\b/i.test(text);
  if (hasNaturalLanguage) return null;

  let expr = text
    .replace(/how much|what is|what's|calculate|=|\?/gi, " ")
    .replace(/\bplus\b/gi, "+").replace(/\bminus\b/gi, "-")
    .replace(/\btimes\b|\bmultiplied by\b/gi, "*")
    .replace(/\bdivided by\b|\bdivide\b/gi, "/")
    .replace(/[^0-9\+\-\*\/\.\(\)\s]/g, " ")
    .replace(/\s+/g, "").trim();
  if (!expr || !/\d/.test(expr)) return null;

  // Require an operator for multi-digit expressions — prevents '2025' evaluating to 2025
  if (!/[\+\-\*\/]/.test(expr) && expr.length > 6) return null;

  try {
    const result = new Function('"use strict"; return (' + expr + ')')() as number;
    if (typeof result === "number" && isFinite(result)) {
      return { answer: `${text.replace(/\?/g, "").trim()} = ${result}`, source: "Math Engine" };
    }
  } catch {}
  return null;
}

// -- Built-in Knowledge Check --

function checkBuiltinKnowledge(query: string): { answer: string; source: string } | null {
  const q = query.toLowerCase().trim();
  let bestMatch: typeof KNOWLEDGE_BASE[0] | null = null;
  let bestScore = 0;
  const stopWords = ['what','who','when','where','how','is','the','of','are','a','an'];
  for (const entry of KNOWLEDGE_BASE) {
    for (const key of entry.keys) {
      const keyWords = key.split(" ");
      const queryWords = q.split(/\s+/);
      let matched = 0;
      keyWords.forEach(kw => {
        // Short keywords (<=3 chars like 'inr','gst') require EXACT match
        let best: number;
        if (kw.length <= 3) {
          best = queryWords.includes(kw) ? 1 : 0;
        } else {
          best = Math.max(...queryWords.map((qw: string) => fuzzyScore(qw, kw)));
        }
        if (best > 0.55) matched++;
      });
      let score = matched / Math.max(keyWords.length, 1);
      // Bonus: all topic words (non-stop-words) must match for a score boost
      const topicWords = keyWords.filter(w => w.length > 3 && !stopWords.includes(w));
      const topicMatched = topicWords.every(tw => queryWords.some(qw => fuzzyScore(qw, tw) > 0.7));
      if (topicWords.length > 0 && topicMatched) score = Math.min(score * 1.2, 1);
      if (score > bestScore) { bestScore = score; bestMatch = entry; }
    }
  }
  // Threshold 0.88 prevents cross-country matches (pm pakistan vs pm usa)
  return bestScore >= 0.88 ? bestMatch : null;
}

// -- DuckDuckGo Instant Answers API (free, no API key) --

async function duckDuckGoSearch(query: string): Promise<{ answer: string; source: string; url?: string } | null> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.Answer && data.Answer.length > 3)
      return { answer: data.Answer, source: 'DuckDuckGo', url: data.AnswerURL || undefined };
    if (data.AbstractText && data.AbstractText.length > 30) {
      const sentences = data.AbstractText.split(/\.\s+/).slice(0, 3).join('. ') + '.';
      return { answer: sentences, source: `DuckDuckGo — ${data.AbstractSource || 'Web'}`, url: data.AbstractURL || undefined };
    }
    if (data.Definition && data.Definition.length > 10)
      return { answer: data.Definition, source: `DuckDuckGo — ${data.DefinitionSource || 'Web'}`, url: data.DefinitionURL || undefined };
    if (data.RelatedTopics?.length > 0) {
      const first = data.RelatedTopics[0];
      const text = first?.Text || '';
      if (text.length > 20) return { answer: text, source: 'DuckDuckGo', url: first?.FirstURL || undefined };
    }
  } catch {}
  return null;
}

// -- Wikipedia Search (fallback) --

async function wikiSearch(term: string): Promise<{ answer: string; source: string; url?: string } | null> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&format=json&origin=*&srlimit=3`;
    const res = await fetch(searchUrl);
    const data = await res.json();
    const hits = data.query?.search || [];
    if (!hits.length) return null;
    const title = hits[0].title;
    const titleWords = title.toLowerCase().split(/\s+/);
    const queryWords = term.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
    const relevant = queryWords.some((qw: string) => titleWords.some((tw: string) => fuzzyScore(qw, tw) > 0.7));
    if (!relevant) return null;
    const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&format=json&utf8=1&titles=${encodeURIComponent(title)}&origin=*`;
    const extractRes = await fetch(extractUrl);
    const extractData = await extractRes.json();
    const page = Object.values(extractData.query?.pages || {})[0] as any;
    const extract = page?.extract || "";
    if (extract.length > 30) {
      const sentences = extract.split(/\.\s+/).slice(0, 3).join(". ") + ".";
      return {
        answer: sentences,
        source: `Wikipedia: ${title}`,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      };
    }
  } catch {}
  return null;
}

// -- Main Export --

export interface WebSearchResult {
  answer: string;
  source: string;
  url?: string;
}

/**
 * Full search chain: Math -> Built-in KB -> DuckDuckGo -> Wikipedia
 */
export async function fetchWebAnswer(query: string): Promise<WebSearchResult | null> {
  // 1. Math
  const math = tryMath(query);
  if (math) return math;

  // 2. Spell-correct + smart knowledge base lookup
  const corrected = query.trim().split(/\s+/).map(correctWord).join(" ");

  // PREFILTER: Built-in KB only fires for short specific lookups.
  // Complex queries (sports, events, 4+ words) go straight to internet search.
  const wordCount = corrected.trim().split(/\s+/).length;
  const hasContextWords = /\b(who|win|won|which|champion|cup|ipl|t20|cricket|football|league|tournament|score|season|news|latest|2024|2025|2026)\b/i.test(corrected);
  const isComplexQuery = wordCount >= 4 || (wordCount >= 2 && hasContextWords);

  if (!isComplexQuery) {
    const builtin = checkBuiltinKnowledge(corrected);
    if (builtin) return builtin;
  }

  // PRE-SEARCH INTELLIGENCE: Time-awareness for future events
  const yearMatch = query.match(/\b(2025|2026|2027|2028|2029|2030)\b/);
  if (yearMatch) {
    const futureYear = parseInt(yearMatch[1], 10);
    const currentYear = new Date().getFullYear() || 2024;
    // If asking about "win" or "won" for a future year event
    if (futureYear > currentYear && /\b(win|won|winner)\b/i.test(query)) {
      return { answer: `Hmm... ${futureYear} hasn't happened yet, so there's no winner yet! 😉 Check back later.`, source: "Time-Aware AI" };
    }
  }

  // 3. DuckDuckGo Instant Answers API (primary internet search)
  const searchTerm = buildSearchQuery(query);
  try {
    const ddg = await duckDuckGoSearch(searchTerm) || await duckDuckGoSearch(corrected);
    if (ddg) return ddg;
  } catch {}

  // 4. Wikipedia (fallback)
  const result = await wikiSearch(searchTerm) || await wikiSearch(corrected);
  return result;
}

/**
 * Detect if a message is a general knowledge question (not a billing command).
 */
export function isGeneralQuestion(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (t.length < 4) return false;

  // Clear billing signals
  const clearBilling = /\d+\s*x\s*\d+|sqft|for\s+\w+\s+\d{7,}|new.*invoice|create.*bill|unpaid|paid.*bill|sales\s+(today|this|week|month)/i;
  if (clearBilling.test(t)) return false;

  // Explicit question words
  const questionWords = /\b(what|who|when|where|why|which|define|explain|meaning|capital|flag|president|prime.?minister|national|currency|formula|calculate|convert|weather|news|latest|current|win|won|champion|cup|ipl|t20)\b/i;
  if (questionWords.test(t)) return true;

  if (/^(how|tell me|is the|are the)/i.test(t)) return true;
  if (t.endsWith("?")) return true;

  return false;
}
