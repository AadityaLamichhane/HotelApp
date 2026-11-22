import env from "@/config/env";
import type { OcrItem } from "./ocr";

const DEFAULT_CATEGORY = "Uncategorized";

// Canonical taxonomy so headings like "From Our Kitchen" / "MOMO ITEMS"
// collapse into one clean group in the UI.
export const CANONICAL_CATEGORIES: Record<string, string> = {
  Starters: "Small appetizers and snacks to start a meal (momo as snack, wings, fries)",
  "Momo & Dumplings": "Momo, dumplings, dim sum, wontons",
  "Soup & Salad": "Soups, salads, pickles",
  "Main Course": "Curries, thali, paneer, chicken/buff/mutton dishes, main dishes",
  "Rice & Breads": "Rice, fried rice, roti, naan, breads, sel roti",
  "Chinese & Noodles": "Chowmein, noodles, Chinese dishes",
  "Pizza & Pasta": "Pizza, pasta, spaghetti",
  "Burgers & Sandwiches": "Burgers, sandwiches, rolls",
  "BBQ & Grill": "BBQ, grill, kebab, tandoor",
  Drinks: "Tea, coffee, juices, lassi, shakes, soft drinks, beer",
  Desserts: "Sweets, desserts, gulab jamun, ice cream",
  Uncategorized: "Does not fit any of the other categories",
};

type JevChoiceAnswer = {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities?: Record<string, number>;
};
type JevNoulAnswer = { type: "noul"; noul: number };
type JevResponse = {
  model: string;
  answers: {
    category?: JevChoiceAnswer;
    isVeg?: JevNoulAnswer;
  };
  usage?: { input_tokens: number; output_tokens: number };
};

const getApiKey = (): string =>
  (env as Record<string, string>).TYPESAFE_API_KEY ??
  process.env.TYPESAFE_API_KEY ??
  "";

export const classifyItemWithJev = async (item: OcrItem): Promise<OcrItem> => {
  const apiKey = getApiKey();
  if (!apiKey) return item;

  const model =
    (env as Record<string, string>).JEV_MODEL ?? process.env.JEV_MODEL ?? "jev-latest";

  const res = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      state: {
        name: item.name,
        description: item.description ?? "",
        parsedCategory: item.category,
      },
      questions: {
        category: {
          type: "choice",
          instructions:
            "Which menu category does this dish belong to? Choose the best fit from the criteria. If unsure, choose Uncategorized.",
          criteria: Object.fromEntries(
            Object.entries(CANONICAL_CATEGORIES).map(([k, v]) => [
              k.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
              v,
            ]),
          ),
        },
        isVeg: {
          type: "noul",
          instructions: "Is this dish vegetarian (contains no meat, fish, egg, or chicken)?",
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jev failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as JevResponse;
  const cat = json.answers?.category;
  const veg = json.answers?.isVeg;

  let category = item.category;
  if (cat?.choice && cat.confidence >= 0.5) {
    const key = cat.choice;
    const display =
      Object.keys(CANONICAL_CATEGORIES).find(
        (k) => k.toLowerCase().replace(/[^a-z0-9]+/g, "_") === key,
      ) ?? null;
    // Only override Uncategorized / low-quality headings; keep the
    // restaurant's own headings when Jev agrees or is unsure.
    if (display && display !== "Uncategorized") category = display;
    else if (item.category === DEFAULT_CATEGORY && display) category = display;
  }

  const isVeg = veg ? veg.noul >= 0.5 : null;

  return {
    ...item,
    category,
    isVeg,
    confidence: cat?.confidence ?? item.confidence,
  };
};

export const classifyItemsWithJev = async (items: OcrItem[]): Promise<OcrItem[]> => {
  if (!getApiKey() || items.length === 0) return items;
  const out: OcrItem[] = new Array(items.length);
  const limit = 5;
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      try {
        out[i] = await classifyItemWithJev(items[i]!);
      } catch (e) {
        // Fail open: keep the parser result. Jev is an enhancement,
        // not a hard dependency of the OCR route.
        console.warn("[jev] classify failed for", items[i]?.name, e);
        out[i] = items[i]!;
      }
    }
  });
  await Promise.all(workers);
  return out;
};

export interface MenuGate {
  isMenu: boolean;
  hasPrices: boolean;
  box: { top: number; bottom: number; left: number; right: number } | null;
  menuScore: number | null;
  skipped: boolean;
}

// Gate check: given the photo, does it look like a menu with prices?
// Uses an image asset + a Noul question and a Box question (Jev Box is
// experimental; we never hard-block the scan — we return the gate for
// the UI and fail open to full-image OCR).
export const checkMenuImage = async (imageBase64: string): Promise<MenuGate> => {
  const apiKey = getApiKey();
  if (!apiKey) return { isMenu: true, hasPrices: true, box: null, menuScore: null, skipped: true };

  const clean = imageBase64.includes(",") ? imageBase64.split(",").pop()! : imageBase64;
  const model =
    (env as Record<string, string>).JEV_MODEL ?? process.env.JEV_MODEL ?? "jev-latest";

  try {
    const res = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "TypeSafe-Danger-Zone-Images": "true",
      },
      body: JSON.stringify({
        model,
        state: "Check if this is a menu photograph.",
        assets: {
          photo: { type: "image", format: "jpg", data_base64: clean },
        },
        questions: {
          isMenu: {
            type: "noul",
            instructions: "Is <photo> a menu photo?",
          },
          hasPrices: {
            type: "noul",
            instructions: "Does <photo> show prices next to dish names?",
          },
          menuBox: {
            type: "box",
            instructions: "Locate the large region covering the menu price list in <photo>",
          },
        },
      }),
    });
    if (!res.ok) throw new Error(`Jev gate failed (${res.status})`);

    const json = (await res.json()) as {
      answers?: {
        isMenu?: JevNoulAnswer;
        hasPrices?: JevNoulAnswer;
        menuBox?: { type: "box"; box?: { top: number; bottom: number; left: number; right: number } };
      };
    };
    const menuScore = json.answers?.isMenu?.noul ?? null;
    const hasPrices = (json.answers?.hasPrices?.noul ?? 0) >= 0.5;
    const box = json.answers?.menuBox?.box ?? null;
    return {
      isMenu: menuScore !== null && menuScore >= 0.5,
      hasPrices,
      box,
      menuScore,
      skipped: false,
    };
  } catch (e) {
    console.warn("[jev] gate check failed (fail open)", e);
    return { isMenu: true, hasPrices: true, box: null, menuScore: null, skipped: true };
  }
};

export default { classifyItemsWithJev, classifyItemWithJev, checkMenuImage };
