import { describe, expect, test } from "bun:test";
import { parseMenuText } from "./ocr";

describe("parseMenuText", () => {
  test("parses category headers, names and prices", () => {
    const items = parseMenuText(`STARTERS
Chicken Momo .... 250
Veg Momos - Rs 200
MAIN COURSE
Chicken Curry  420
Buffalo Wings  380`);
    expect(items).toHaveLength(4);
    expect(items[0]).toEqual(
      expect.objectContaining({ name: "Chicken Momo", price: 250, category: "Starters" }),
    );
    expect(items[1]).toEqual(expect.objectContaining({ name: "Veg Momos", price: 200 }));
    expect(items[2]).toEqual(
      expect.objectContaining({ name: "Chicken Curry", price: 420, category: "Main Course" }),
    );
    expect(items[3]).toEqual(expect.objectContaining({ name: "Buffalo Wings", price: 380 }));
  });

  test("attaches following line as description", () => {
    const items = parseMenuText(`DESSERTS
Gulab Jamun  180
Two pieces served hot`);
    expect(items).toHaveLength(1);
    expect(items[0]?.description).toBe("Two pieces served hot");
  });

  test("tolerates OCR confusions and currency marks", () => {
    const items = parseMenuText(`Drinks
Lassi  NPR 25O
Milk Tea ₹120
Coffee Rs. 150/-`);
    expect(items.map((i) => i.price)).toEqual([250, 120, 150]);
  });

  test("ignores lines without prices", () => {
    const items = parseMenuText(`Welcome to Hotel
Chicken Momo 250`);
    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe("Chicken Momo");
  });

  test("handles custom Title-Case and decorative categories", () => {
    const items = parseMenuText(`From Our Kitchen
Chicken Momo 250
--- MOMO ITEMS ---
Veg Momo 200
Cold Drinks:
Lassi 150
★ Desserts ★
Gulab Jamun 180`);
    expect(items.map((i) => [i.name, i.category])).toEqual([
      ["Chicken Momo", "From Our Kitchen"],
      ["Veg Momo", "Momo Items"],
      ["Lassi", "Cold Drinks"],
      ["Gulab Jamun", "Desserts"],
    ]);
  });

  test("does not turn the hotel banner into a category", () => {
    const items = parseMenuText(`Hotel Muktinath
Welcome to Hotel
Chicken Momo 250
MAIN COURSE
Chicken Curry 420`);
    expect(items[0]?.category).toBe("Uncategorized");
    expect(items[1]?.category).toBe("Main Course");
  });

  test("splits side-by-side items on the same line", () => {
    const items = parseMenuText(`Special Pasta $2 Spicy Burger $2 Special Pizza $2
Small Pasta $3 Small Burger $3 Small Pizza $3`);
    expect(items.map((i) => [i.name, i.price])).toEqual([
      ["Special Pasta", 2],
      ["Spicy Burger", 2],
      ["Special Pizza", 2],
      ["Small Pasta", 3],
      ["Small Burger", 3],
      ["Small Pizza", 3],
    ]);
  });

  test("splits bare multi-prices on the same line", () => {
    const items = parseMenuText(`Chicken Momo 250 Veg Momo 200`);
    expect(items.map((i) => [i.name, i.price])).toEqual([
      ["Chicken Momo", 250],
      ["Veg Momo", 200],
    ]);
  });

  test("ignores OCR gibberish lines as categories (first-element bug)", () => {
    const items = parseMenuText(`Zr Ci छा
FF छ
Special Pasta $2 Spicy Burger $2
Small Pasta $3`);
    expect(items.map((i) => [i.name, i.category])).toEqual([
      ["Special Pasta", "Uncategorized"],
      ["Spicy Burger", "Uncategorized"],
      ["Small Pasta", "Uncategorized"],
    ]);
  });

  test("keeps prose descriptions as descriptions, not categories", () => {
    const items = parseMenuText(`DESSERTS
Gulab Jamun 180
Two pieces served hot
Chicken Momo 250`);
    expect(items[0]?.description).toBe("Two pieces served hot");
    expect(items).toHaveLength(2);
  });
});
