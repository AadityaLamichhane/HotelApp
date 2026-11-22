import { describe, expect, test } from "bun:test";
import { classifyItemsWithJev, CANONICAL_CATEGORIES } from "./jev";
import type { OcrItem } from "./ocr";

const item = (name: string, category = "Uncategorized"): OcrItem => ({
  name,
  price: 250,
  category,
  description: null,
  confidence: null,
  isVeg: null,
});

describe("classifyItemsWithJev", () => {
  test("fails open or classifies via Jev (never throws)", async () => {
    const items = [item("Chicken Momo"), item("Lassi", "Cold Drinks")];
    const out = await classifyItemsWithJev(items);
    expect(out).toHaveLength(2);
    expect(out[0]?.name).toBe("Chicken Momo");
    // With a key the category may be canonicalized; without it stays as-is.
    expect(typeof out[0]?.category).toBe("string");
  });

  test("canonical taxonomy exists", () => {
    expect(Object.keys(CANONICAL_CATEGORIES).length).toBeGreaterThan(5);
    expect(CANONICAL_CATEGORIES.Drinks).toBeDefined();
  });
});
