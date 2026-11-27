import { describe, expect, it } from "vitest";
import { createSampleProducts } from "@/lib/sampleData";
import { matchProduct, scoreProduct } from "@/lib/matching";
import { createDraftItemFromParsed } from "@/lib/resolve";
import type { ParsedItem } from "@/lib/parser";

const products = createSampleProducts(new Date("2026-01-01T00:00:00Z"));
const byName = (name: string) => {
  const product = products.find((candidate) => candidate.name === name);
  if (!product) throw new Error(`Missing sample product ${name}`);
  return product.id;
};

describe("product matching", () => {
  it("matches Hindi aliases to catalogue products", () => {
    expect(matchProduct("chini", products)).toMatchObject({ status: "matched", productId: byName("Sugar") });
    expect(matchProduct("sakkar", products)).toMatchObject({ status: "matched", productId: byName("Sugar") });
    expect(matchProduct("chawal", products)).toMatchObject({ status: "matched", productId: byName("Rice") });
    expect(matchProduct("aata", products)).toMatchObject({ status: "matched", productId: byName("Wheat Flour (Aata)") });
    expect(matchProduct("gehu ka aata", products)).toMatchObject({ status: "matched", productId: byName("Wheat Flour (Aata)") });
    expect(matchProduct("doodh", products)).toMatchObject({ status: "matched", productId: byName("Amul Milk") });
    expect(matchProduct("pyaz", products)).toMatchObject({ status: "matched", productId: byName("Onion") });
  });

  it("matches Devanagari aliases", () => {
    expect(matchProduct("चीनी", products)).toMatchObject({ status: "matched", productId: byName("Sugar") });
  });

  it("matches specific oil when the shopkeeper is specific", () => {
    expect(matchProduct("sarson ka tel", products)).toMatchObject({
      status: "matched",
      productId: byName("Mustard Oil"),
    });
  });

  it("does not blindly pick between two oils", () => {
    const match = matchProduct("tel", products);
    expect(match.status).toBe("ambiguous");
    expect(match.alternatives.length).toBeGreaterThan(1);
  });

  it("matches English product names", () => {
    expect(matchProduct("sugar", products)).toMatchObject({ status: "matched", productId: byName("Sugar") });
    expect(matchProduct("maggi", products)).toMatchObject({ status: "matched", productId: byName("Maggi Noodles") });
    expect(matchProduct("parle g", products)).toMatchObject({ status: "matched", productId: byName("Parle-G Biscuits") });
  });

  it("returns unmatched for an unknown product", () => {
    const match = matchProduct("cement bag", products);
    expect(match.status).toBe("unmatched");
    expect(match.productId).toBeNull();
  });

  it("never matches unrelated products by loose characters", () => {
    expect(matchProduct("soap", products).productId).toBe(byName("Lifebuoy Soap"));
    expect(matchProduct("oil filter", products).status).not.toBe("matched");
    expect(scoreProduct("cement", products.find((p) => p.id === byName("Sugar"))!)).toBeLessThan(0.5);
  });

  it("handles misspellings of Hinglish words", () => {
    expect(matchProduct("cheeni", products)).toMatchObject({ status: "matched", productId: byName("Sugar") });
    expect(matchProduct("biskut", products)).toMatchObject({ status: "matched", productId: byName("Parle-G Biscuits") });
  });
});

describe("draft resolution", () => {
  const parsed = (overrides: Partial<ParsedItem>): ParsedItem => ({
    raw: "test",
    query: "chini",
    quantity: 1,
    unit: null,
    explicitQuantity: true,
    explicitUnit: false,
    notes: [],
    ...overrides,
  });

  it("uses the catalogue price and unit", () => {
    const item = createDraftItemFromParsed(parsed({ query: "chini", quantity: 3, unit: "kg" }), products);
    expect(item).toMatchObject({
      name: "Sugar",
      unit: "kg",
      unitPrice: 45,
      quantity: 3,
      matchStatus: "matched",
      needsReview: false,
    });
  });

  it("converts compatible units (gram to kg)", () => {
    const item = createDraftItemFromParsed(
      parsed({ query: "chini", quantity: 500, unit: "gram" }),
      products,
    );
    expect(item.unit).toBe("kg");
    expect(item.quantity).toBe(0.5);
    expect(item.unitPrice).toBe(45);
    expect(item.notice).toContain("0.5 kg");
    expect(item.needsReview).toBe(false);
  });

  it("flags incompatible units for review instead of guessing", () => {
    const item = createDraftItemFromParsed(
      parsed({ query: "chini", quantity: 2, unit: "litre" }),
      products,
    );
    expect(item.unit).toBe("kg");
    expect(item.needsReview).toBe(true);
    expect(item.reviewReason).toMatch(/sold per kg/i);
  });

  it("never attaches a price to an unmatched product", () => {
    const item = createDraftItemFromParsed(
      parsed({ query: "cement bag", quantity: 2, unit: "packet" }),
      products,
    );
    expect(item.productId).toBeNull();
    expect(item.unitPrice).toBe(0);
    expect(item.needsReview).toBe(true);
    expect(item.matchStatus).toBe("unmatched");
  });

  it("keeps ambiguous matches unresolved until confirmed", () => {
    const item = createDraftItemFromParsed(parsed({ query: "tel", quantity: 3, unit: "litre" }), products);
    expect(item.matchStatus).toBe("ambiguous");
    expect(item.needsReview).toBe(true);
    expect(item.alternatives.length).toBeGreaterThan(1);
  });
});
