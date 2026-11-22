import env from "@/config/env";
import { throwErrorOnValidation, throwServiceUnavailableError } from "@/utils/error";
import { checkMenuImage, classifyItemsWithJev, type MenuGate } from "./jev";

export interface OcrItem {
  name: string;
  price: number;
  category: string;
  description: string | null;
  confidence: number | null;
  isVeg: boolean | null;
}

export interface OcrResult {
  text: string;
  confidence: number | null;
  items: OcrItem[];
  engine: "google-vision" | "tesseract";
  gate: MenuGate;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const DEFAULT_CATEGORY = "Uncategorized";

const KNOWN_CATEGORIES = new Set([
  "starters", "starter", "appetizers", "appetizer", "breakfast",
  "lunch", "dinner", "mains", "main course", "main courses", "thali",
  "soup", "soups", "salad", "salads", "pizza", "pasta", "burger",
  "burgers", "sandwich", "sandwiches", "chinese", "indian", "nepali",
  "veg", "vegetarian", "non veg", "non-veg", "bbq", "grill",
  "desserts", "dessert", "sweets", "drinks", "beverages", "juices",
  "juice", "tea", "coffee", "momo", "chowmein", "fried rice",
  "curry", "curries", "roti", "breads", "rice", "noodles", "snacks",
  "snack", "specials", "special", "chef special", "chef's special",
  "recommended", "popular", "combo", "combos", "set menu", "set",
]);

const BANNER_WORDS = new Set([
  "welcome", "namaste", "hotel", "resort", "restaurant", "cafe", "menu",
  "our", "the", "phone", "call", "order", "delivery", "home", "free",
  "taste", "visit", "www", "address", "est", "since",
]);

// Decorative borders / emojis / numbering around a heading:
// "--- MOMO ITEMS ---", "★ Starters ★", "1. BREAKFAST"
const cleanHeading = (raw: string): string => {
  return raw
    .replace(/^[\s\-–—=*#•·~★☆❖►>»【〔\[]+/, "")
    .replace(/[\s\-–—=*#•·~★☆❖►»】〕\]]+$/, "")
    .replace(/^[\d]+[.)]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
};

const looksLikeBanner = (clean: string): boolean => {
  const words = clean.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  // "Welcome to Hotel Muktinath", "Hotel Menu", "Our Menu" — not categories.
  if (words.includes("welcome") || words.includes("namaste")) return true;
  if (words.length >= 2 && words.every((w) => BANNER_WORDS.has(w.replace(/[^a-z]/g, "")))) return true;
  if (words.includes("hotel") || words.includes("restaurant") || words.includes("resort")) return true;
  if (words.length === 1 && words[0] === "menu") return true;
  if (/(www\.|@gmail|\+?\d[\d\s-]{7,})/.test(clean)) return true;
  return false;
};

const isCategoryHeader = (
  line: string,
  opts: { nextIsPriced: boolean; seenAnyItem: boolean },
): boolean => {
  const clean = cleanHeading(line);
  if (!clean || clean.length > 60) return false;
  if (/^\d{1,3}$/.test(clean)) return false;
  if (looksLikeBanner(clean)) return false;
  if (clean.endsWith(".") && clean.split(/\s+/).length > 3) return false;

  // OCR gibberish guard: "FF छ", "Zr Ci छो" are scanner noise, not
  // headings. A real heading needs a legitimate word (Latin >= 3 letters
  // or a Devanagari word >= 2 chars). Gibberish lines fail this and get
  // ignored instead of becoming the category for everything after.
  const latinWords = clean.split(/\s+/).filter((w) => /[A-Za-z]{3,}/.test(w));
  const devaWords = clean.split(/\s+/).filter((w) => /[\u0900-\u097F]{2,}/.test(w));
  if (latinWords.length === 0 && devaWords.length === 0) return false;
  // All-Latin noise: every word is <= 2 chars ("FF", "Ci", "Zr") -> reject.
  if (latinWords.length === 0 && clean.split(/\s+/).length >= 2) return false;
  const alphaRatio = clean.replace(/[^A-Za-z\u0900-\u097F]/g, "").length /
    (clean.replace(/\s/g, "").length || 1);
  if (alphaRatio < 0.5) return false;

  const lower = clean.toLowerCase();
  if (KNOWN_CATEGORIES.has(lower)) return true;
  if (KNOWN_CATEGORIES.has(lower.replace(/s$/, ""))) return true;

  // ALL-CAPS short heading (e.g. "MAIN COURSE", "DESSERTS & SWEETS")
  if (clean === clean.toUpperCase() && /[A-Z]/.test(clean) && clean.length <= 45 && !/\d/.test(clean)) {
    return true;
  }
  // Title Case heading ("From Our Kitchen", "Cold Drinks") — but a prose
  // description is usually lower-case after the first word.
  const words = clean.split(/\s+/).filter(Boolean);
  const titleCase =
    words.length >= 1 &&
    words.length <= 6 &&
    words.every((w) => {
      const alpha = w.replace(/[^A-Za-z]/g, "");
      return !alpha || alpha[0] === alpha[0]?.toUpperCase();
    });
  // "Breakfast:" / "Category -" style headings
  const endsWithColon = /[:：]$/.test(clean);
  if ((titleCase || endsWithColon) && !/\d/.test(clean)) {
    // Before any item, only accept stylized headings (banner guard above
    // already handles the hotel name). After items, a short Title-Case
    // line followed by a priced line is the next section.
    if (opts.seenAnyItem) return true;
    // First section: require title-case + (next is priced or known-ish).
    if (opts.nextIsPriced && words.length <= 6) return true;
    if (endsWithColon) return true;
    // Single-word title-case headings ("Momo", "Thali", "Drinks") are
    // categories whenever they appear — a lone dish name has no price
    // on its own line in this layout and would be an orphan otherwise.
    if (words.length === 1) return true;
  }
  if (endsWithColon && clean.length <= 40) return true;
  return false;
};

const normalizeCategory = (raw: string): string => {
  const clean = cleanHeading(raw).replace(/[:：]+$/, "").trim();
  if (!clean) return DEFAULT_CATEGORY;
  return clean.toLowerCase().replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

// Trailing price token: "250", "Rs 250", "NPR 250", "₹250", "300/-"
// Tolerates OCR confusions: "25O" -> 250, "l50" -> 150.
const PRICE_TOKEN_RE = /([0-9OQlI|][0-9OQlI|,\.]*)$/;
const CURRENCY_RE = /(?:rs\.?|npr|nrp|inr|nrs|₹|\$|€|£|\/-)/i;

const cleanNameFragment = (raw: string): string => {
  return raw
    .replace(/[.\-–—_]{2,}/g, " ")
    .replace(/\b(?:rs\.?|npr|nrp|inr|nrs)\b/gi, " ")
    .replace(/₹|\$|€|£/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[:\-–—\s]+|[:\-–—\s]+$/g, "")
    .trim();
};

// One line often contains several items side-by-side:
// "Special Pasta $2 Spicy Burger $2 Special Pizza $2"
// Return >1 priced items, or null if the line isn't a multi-item line.
const extractMultiplePriced = (line: string): { price: number; name: string }[] | null => {
  // 1) Currency-prefixed prices: "$2", "Rs 250", "₹120", "£3"
  const currencyRe = /(?:rs\.?|npr|nrp|inr|nrs|₹|\$|€|£)\s*([0-9OQlI|][0-9OQlI|,\.]*)/gi;
  const matches = Array.from(line.matchAll(currencyRe));
  if (matches.length >= 2) {
    const out: { price: number; name: string }[] = [];
    let prevEnd = 0;
    for (const m of matches) {
      const price = cleanPrice(m[1] ?? "");
      if (price === null) continue;
      const name = cleanNameFragment(line.slice(prevEnd, m.index));
      if (name.length >= 2) out.push({ name, price });
      prevEnd = (m.index ?? 0) + m[0].length;
    }
    if (out.length >= 2) return out;
  }

  // 2) Bare multi-prices: "Chicken Momo 250 Veg Momo 200"
  // Only if every number is >= 10 and there are >= 2 of them.
  const bareRe = /([0-9]{2,5})/g;
  const bare = Array.from(line.matchAll(bareRe));
  if (bare.length >= 2) {
    const out: { price: number; name: string }[] = [];
    let prevEnd = 0;
    for (const m of bare) {
      const price = cleanPrice(m[1] ?? "");
      if (price === null || price < 10) {
        // Bail out — this looks like random numbers, not a price list.
        return null;
      }
      const name = cleanNameFragment(line.slice(prevEnd, m.index));
      if (name.length >= 2) out.push({ name, price });
      prevEnd = (m.index ?? 0) + m[0].length;
    }
    if (out.length >= 2) return out;
  }
  return null;
};

const cleanPrice = (raw: string): number | null => {
  const normalized = raw
    .replace(/[OQ]/gi, "0")
    .replace(/[lI|]/g, "1")
    .replace(/,/g, "")
    .replace(/\./g, "")
    .trim();
  if (!/^\d+$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isInteger(value) || value < 0 || value > 100000) return null;
  return value;
};

const extractPrice = (line: string): { price: number; name: string } | null => {
  let body = line.trim();
  // Strip trailing "/-", "-" or "/" after the price.
  body = body.replace(/(?:\/-|-\s*|\/\s*)$/, "").trim();
  const match = body.match(PRICE_TOKEN_RE);
  if (!match?.[1]) return null;
  const tokenStart = body.length - match[1].length;
  // The token must start at a word boundary (space / dot / dash / currency
  // symbol / start) so we don't grab the last letter of a word like "Hotel".
  const before = tokenStart > 0 ? body[tokenStart - 1]! : "";
  if (tokenStart > 0 && !/\s|₹|\$|€|[.\-–—:]/.test(before)) return null;
  // Require at least one real digit so a word ending in "o"/"l" isn't a price.
  if (!/\d/.test(match[1])) return null;
  const price = cleanPrice(match[1]);
  if (price === null) return null;
  const hasCurrency = CURRENCY_RE.test(body.slice(Math.max(0, tokenStart - 8)));
  if (!hasCurrency && price < 10) return null;
  const namePart = body
    .slice(0, tokenStart)
    .replace(/[.\-–—_]{2,}/g, " ")
    .replace(/\b(?:rs\.?|npr|nrp|inr|nrs)\b/gi, " ")
    .replace(/₹|\$|€/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[:\-–—\s]+|[:\-–—\s]+$/g, "")
    .trim();
  if (!namePart || namePart.length < 2) return null;
  return { price, name: namePart };
};

// Parse OCR'd plain text into structured menu items.
// Pure function — unit-tested without any OCR engine.
export const parseMenuText = (text: string): OcrItem[] => {
  const lines = text
    .replace(/\f/g, " ")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[\d]+[.)]\s+/, "").replace(/^[•\-–—\*•]\s+/, ""))
    .filter(Boolean);

  const items: OcrItem[] = [];
  let currentCategory = DEFAULT_CATEGORY;
  let lastItem: OcrItem | null = null;

  for (let i = 0; i < lines.length; i++) {
    const deBulleted = lines[i]!;
    const nextIsPriced = lines
      .slice(i + 1, i + 3)
      .some((l) => Boolean(extractPrice(l) || extractMultiplePriced(l)));

    if (
      isCategoryHeader(deBulleted, { nextIsPriced, seenAnyItem: items.length > 0 })
    ) {
      currentCategory = normalizeCategory(deBulleted);
      lastItem = null;
      continue;
    }

    // Multi-item line (side-by-side columns): split into several items.
    const multi = extractMultiplePriced(deBulleted);
    if (multi) {
      for (const priced of multi) {
        const item: OcrItem = {
          name: priced.name,
          price: priced.price,
          category: currentCategory,
          description: null,
          confidence: null,
          isVeg: null,
        };
        items.push(item);
        lastItem = item;
      }
      continue;
    }

    const priced = extractPrice(deBulleted);
    if (priced) {
      const item: OcrItem = {
        name: priced.name,
        price: priced.price,
        category: currentCategory,
        description: null,
        confidence: null,
        isVeg: null,
      };
      items.push(item);
      lastItem = item;
      continue;
    }

    // Non-priced line: treat as description of the previous item if one exists
    // and the line looks like prose (not a bare heading). Otherwise ignore —
    // the frontend can show unparsed lines for manual entry.
    if (lastItem && deBulleted.length >= 4 && !/^\d+$/.test(deBulleted)) {
      lastItem.description = lastItem.description
        ? `${lastItem.description} ${deBulleted}`
        : deBulleted;
    }
  }
  return items;
};

// ---------- OCR engines ----------

const decodeImage = (imageBase64: string): Buffer => {
  const clean = imageBase64.includes(",") ? imageBase64.split(",").pop()! : imageBase64;
  const buffer = Buffer.from(clean, "base64");
  if (buffer.length === 0) throw throwErrorOnValidation("Invalid image data");
  if (buffer.length > MAX_IMAGE_BYTES) throw throwErrorOnValidation("Image is too large (max 8MB)");
  return buffer;
};

const runGoogleVision = async (buffer: Buffer): Promise<{ text: string; confidence: number | null }> => {
  const apiKey = (env as Record<string, string>).GOOGLE_VISION_API_KEY as string | undefined;
  if (!apiKey) throw throwServiceUnavailableError("Google Vision is not configured");
  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: buffer.toString("base64") },
            // "ne" = Nepali (Devanagari) + "en" for mixed menus.
            // DOCUMENT_TEXT_DETECTION auto-detects all languages.
            features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
            imageContext: { languageHints: ["ne", "en", "hi"] },
          },
        ],
      }),
    },
  );
  const json = (await res.json()) as {
    responses?: Array<{ textAnnotations?: Array<{ description: string }> ; error?: unknown }>;
    error?: { message?: string };
  };
  if (!res.ok || json.error) {
    throw throwServiceUnavailableError(`Google Vision failed: ${json.error?.message ?? res.statusText}`);
  }
  const text = json.responses?.[0]?.textAnnotations?.[0]?.description ?? "";
  return { text, confidence: null };
};

const runTesseract = async (buffer: Buffer, language: string): Promise<{ text: string; confidence: number | null }> => {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(language);
  try {
    const { data } = await worker.recognize(buffer);
    return { text: data.text ?? "", confidence: data.confidence ?? null };
  } finally {
    await worker.terminate();
  }
};

export const runOcr = async (imageBase64: string, language = "eng+nep"): Promise<OcrResult> => {
  const buffer = decodeImage(imageBase64);
  const apiKey = (env as Record<string, string>).GOOGLE_VISION_API_KEY as string | undefined;
  let engine: OcrResult["engine"];
  let raw: { text: string; confidence: number | null };
  if (apiKey) {
    engine = "google-vision";
    raw = await runGoogleVision(buffer);
  } else {
    engine = "tesseract";
    raw = await runTesseract(buffer, language);
  }
  // Entry gate: Jev Noul gate + box. Never blocks on failure (fail open).
  const gate = await checkMenuImage(imageBase64);
  if (gate.isMenu === false) {
    throw throwErrorOnValidation("This doesn't look like a menu photo");
  }
  const parsed = parseMenuText(raw.text);
  const items = await classifyItemsWithJev(parsed);
  return { text: raw.text, confidence: raw.confidence, engine, items, gate };
};

export default { runOcr, parseMenuText };
