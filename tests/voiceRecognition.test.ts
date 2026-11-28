import { describe, expect, it } from "vitest";
import { parseUtterance } from "@/lib/parser";
import { createDraftItemFromParsed } from "@/lib/resolve";
import { matchProduct } from "@/lib/matching";
import { createSampleProducts } from "@/lib/sampleData";
import { validateDraft } from "@/lib/billing";
import { emptyDraft, type Product } from "@/lib/types";
import { isFillerWord, isNonWordNoise } from "@/lib/noise";

const now = new Date("2026-01-01T00:00:00Z");
const products = createSampleProducts(now);
const byName = (name: string) => {
  const product = products.find((candidate) => candidate.name === name);
  if (!product) throw new Error(`Missing sample product ${name}`);
  return product.id;
};

/** Run the whole voice pipeline for one utterance. */
function recognise(text: string, catalogue: Product[] = products) {
  const parsed = parseUtterance(text, catalogue);
  const items = parsed.items.map((item) => createDraftItemFromParsed(item, catalogue));
  return { parsed, items };
}

describe("strict product recognition — acceptance matrix", () => {
  const cases: Array<{
    input: string;
    expected: "product" | "none" | "unmatched";
    productId?: string;
    productName?: RegExp;
    quantity?: number;
    unit?: string;
  }> = [
    { input: "3 kg sugar", expected: "product", productId: byName("Sugar"), quantity: 3, unit: "kg" },
    // Two oils exist in the sample catalogue, so "oil" must resolve to an oil
    // (possibly with confirmation) — never to an invented product.
    { input: "2 litre oil", expected: "product", productName: /oil/i, quantity: 2, unit: "litre" },
    { input: "3 kilo chini", expected: "product", productId: byName("Sugar"), quantity: 3, unit: "kg" },
    { input: "hmm", expected: "none" },
    { input: "huu", expected: "none" },
    { input: "umm", expected: "none" },
    { input: "achha", expected: "none" },
    { input: "3 kg huu", expected: "none" },
    { input: "2 litre umm", expected: "none" },
    { input: "umm 3 kg sugar", expected: "product", productId: byName("Sugar"), quantity: 3, unit: "kg" },
    { input: "3 kg sugar aur 2 kg atta", expected: "product", productId: byName("Sugar"), quantity: 3, unit: "kg" },
    // Not in the sample catalogue: offered for review, never auto-created.
    { input: "250 gram haldi", expected: "unmatched" },
  ];

  for (const testCase of cases) {
    it(`"${testCase.input}" → ${testCase.expected === "product" ? "product" : "no product"}`, () => {
      const { items } = recognise(testCase.input);
      if (testCase.expected === "none") {
        expect(items).toHaveLength(0);
        return;
      }
      expect(items.length).toBeGreaterThan(0);
      const first = items[0]!;
      if (testCase.expected === "unmatched") {
        expect(first).toMatchObject({ productId: null, unitPrice: 0, matchStatus: "unmatched" });
        return;
      }
      // Recognised: resolved to a real catalogue product. Ambiguity still needs
      // the shopkeeper's confirmation, but the line is never invented.
      expect(first.productId).not.toBeNull();
      expect(first.matchStatus).not.toBe("unmatched");
      if (testCase.productId) expect(first.productId).toBe(testCase.productId);
      if (testCase.productName) expect(first.name).toMatch(testCase.productName);
      if (testCase.quantity !== undefined) expect(first.quantity).toBe(testCase.quantity);
      if (testCase.unit) expect(first.unit).toBe(testCase.unit);
    });
  }

  it('"3 kg sugar aur 2 kg atta" recognises both products', () => {
    const { items } = recognise("3 kg sugar aur 2 kg atta");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ productId: byName("Sugar"), quantity: 3, unit: "kg" });
    expect(items[1]).toMatchObject({ productId: byName("Wheat Flour (Aata)"), quantity: 2, unit: "kg" });
  });

  it('"250 gram haldi" stays unmatched because haldi is not in the catalogue', () => {
    const { items } = recognise("250 gram haldi");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      productId: null,
      unitPrice: 0,
      matchStatus: "unmatched",
      needsReview: true,
      quantity: 250,
      unit: "gram",
    });
  });

  it('"250 gram haldi" matches once the shop adds haldi to the catalogue', () => {
    const withHaldi: Product[] = [
      ...products,
      {
        id: "shop-haldi",
        name: "Haldi Powder",
        aliases: ["haldi", "turmeric"],
        price: 300,
        unit: "kg",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ];
    const { items } = recognise("250 gram haldi", withHaldi);
    expect(items[0]).toMatchObject({
      productId: "shop-haldi",
      name: "Haldi Powder",
      matchStatus: "matched",
      unitPrice: 300,
      quantity: 0.25,
      unit: "kg",
    });
  });
});

describe("filler and noise never become products", () => {
  const fillerInputs = [
    "hmm", "hmmm", "hmmmm", "hm", "umm", "ummm", "uh", "uhh", "huu", "huuu",
    "hu", "haan", "han", "haanji", "achha", "acha", "accha", "achcha", "arey",
    "arre", "matlab", "mtlb", "okay", "ok", "yes", "yeah", "no", "nah", "ji",
    "jee", "hmm hmm", "acha ji", "haan ji", "arey matlab", "uh hmm", "mmm",
    "हूँ", "हूं", "हाँ", "अच्छा", "जी", "मतलब", "अरे", "उम्म", "हम्म",
  ];

  for (const filler of fillerInputs) {
    it(`"${filler}" produces no bill item`, () => {
      const { parsed, items } = recognise(filler);
      expect(items).toHaveLength(0);
      expect(parsed.items).toHaveLength(0);
    });
  }

  const fillerWithQuantity = [
    "3 kg huu", "2 litre umm", "3 kg hmm", "1 kg haan", "500 gram achha",
    "2 packet ji", "5 kilo acha", "3 kg arey",
  ];

  for (const utterance of fillerWithQuantity) {
    it(`"${utterance}" produces no bill item`, () => {
      const { parsed, items } = recognise(utterance);
      expect(items).toHaveLength(0);
      // The words are not thrown away silently: they are reported as ignored.
      expect(parsed.ignored.length + parsed.noise.length).toBeGreaterThan(0);
    });
  }

  it("keeps the product when a filler sits next to it", () => {
    expect(recognise("umm 3 kg sugar").items[0]).toMatchObject({
      productId: byName("Sugar"),
      quantity: 3,
      unit: "kg",
    });
    expect(recognise("haan 2 kilo chini").items[0]).toMatchObject({
      productId: byName("Sugar"),
      quantity: 2,
    });
    expect(recognise("3 kg sugar ji").items[0]).toMatchObject({
      productId: byName("Sugar"),
      quantity: 3,
    });
    expect(recognise("acha 2 kg atta matlab").items[0]).toMatchObject({
      productId: byName("Wheat Flour (Aata)"),
      quantity: 2,
    });
    expect(recognise("ok 2 kg sugar").items[0]).toMatchObject({ productId: byName("Sugar") });
  });

  it("never leaves filler words inside the matched query", () => {
    const { parsed } = recognise("hmm 3 kilo chini haan");
    expect(parsed.items[0]?.query).toBe("cini");
  });

  it("classifies filler and humming consistently", () => {
    for (const word of ["hmm", "huu", "achha", "haan", "ji", "matlab", "okay", "no"]) {
      expect(isFillerWord(word)).toBe(true);
    }
    expect(isNonWordNoise("huu")).toBe(true);
    expect(isNonWordNoise("hmmm")).toBe(true);
    // Real words are never classified as noise.
    for (const word of ["sugar", "chini", "aata", "dal", "msg", "bun", "bread"]) {
      expect(isNonWordNoise(word)).toBe(false);
    }
  });
});

describe("quantity and unit validation", () => {
  it("never creates a product from a quantity or unit alone", () => {
    for (const utterance of ["3 kg", "2 litre", "250 gram", "5 packet", "1 dozen", "500 ml"]) {
      const { items, parsed } = recognise(utterance);
      expect(items).toHaveLength(0);
      expect(parsed.ignored).toHaveLength(1);
    }
  });

  it("keeps the required quantity and unit forms working", () => {
    const expectations: Array<[string, number, string]> = [
      ["half kilogram sugar", 0.5, "kg"],
      ["aadha kilo chini", 0.5, "kg"],
      ["one and a half kilograms sugar", 1.5, "kg"],
      ["dedh kilo chini", 1.5, "kg"],
      ["1.5 kg sugar", 1.5, "kg"],
      ["250 grams sugar", 0.25, "kg"],
      ["500 grams chini", 0.5, "kg"],
      ["2 litre oil", 2, "litre"],
      ["500 ml oil", 0.5, "litre"],
      ["5 packet maggi", 5, "packet"],
      ["3 piece sabun", 3, "piece"],
      ["do kilo chawal", 2, "kg"],
      ["teen kilo aata", 3, "kg"],
      ["paanch packet maggi", 5, "packet"],
      ["पाँच किलो चीनी", 5, "kg"],
    ];
    for (const [utterance, quantity, unit] of expectations) {
      const { items } = recognise(utterance);
      expect(items, utterance).toHaveLength(1);
      expect(items[0]!.quantity, utterance).toBe(quantity);
      expect(items[0]!.unit, utterance).toBe(unit);
      // "oil" may need a confirmation between two oils; it is still a real
      // catalogue product with its real price, never an invented one.
      expect(items[0]!.matchStatus, utterance).not.toBe("unmatched");
      expect(items[0]!.productId, utterance).not.toBeNull();
      expect(items[0]!.unitPrice, utterance).toBeGreaterThan(0);
    }
  });

  it('reads "no"/"na" as the piece unit when a number precedes it', () => {
    const { items, parsed } = recognise("2 no sabun");
    expect(parsed.items[0]?.query).toBe("sabun");
    expect(items[0]).toMatchObject({ productId: byName("Lifebuoy Soap"), quantity: 2, unit: "piece" });
  });
});

describe("unknown and ambiguous speech", () => {
  it("marks an unknown product unmatched without inventing a name or price", () => {
    const { items } = recognise("3 kg unicorn powder");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      productId: null,
      unitPrice: 0,
      matchStatus: "unmatched",
      needsReview: true,
      quantity: 3,
      unit: "kg",
    });
    // No catalogue product is created, and nothing is auto-confirmed.
    expect(products.some((product) => /unicorn/i.test(product.name))).toBe(false);
  });

  it("does not attach weak candidates to an unknown word", () => {
    const match = matchProduct("unicorn powder", products);
    expect(match.status).toBe("unmatched");
    expect(match.alternatives).toHaveLength(0);
  });

  it("requires confirmation for an ambiguous product", () => {
    const { items } = recognise("2 litre tel");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ matchStatus: "ambiguous", needsReview: true });
    expect(items[0]!.alternatives.length).toBeGreaterThan(1);
    expect(items[0]!.reviewReason).toMatch(/confirm/i);
  });

  it("blocks saving a bill that still contains an unresolved line", () => {
    const { items } = recognise("3 kg unicorn powder");
    const draft = { ...emptyDraft(), items };
    const validation = validateDraft(draft, products);
    expect(validation.canFinalize).toBe(false);
    expect(validation.issues.length).toBeGreaterThan(0);
  });

  it("only shows real candidates, never weak guesses", () => {
    const unsure = createDraftItemFromParsed(
      { raw: "xyz", query: "xyz", quantity: 1, unit: null, explicitQuantity: false, explicitUnit: false, notes: [] },
      products,
    );
    expect(unsure.alternatives).toHaveLength(0);
    expect(unsure.unitPrice).toBe(0);
  });
});

describe("catalogue products that overlap filler words", () => {
  const overlapCatalogue: Product[] = [
    ...products,
    {
      id: "shop-no-sugar",
      name: "No Sugar Sweetener",
      aliases: ["sugar free", "zero sugar", "no sugar"],
      price: 260,
      unit: "kg",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "shop-achaar",
      name: "Mixed Achaar",
      aliases: ["achaar", "pickle"],
      price: 220,
      unit: "kg",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "shop-basmati",
      name: "Basmati Rice",
      aliases: ["basmati"],
      price: 95,
      unit: "kg",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "shop-jio",
      name: "Jio Tasty Chips",
      aliases: [],
      price: 20,
      unit: "packet",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];

  it('keeps "no" in a product name: "no sugar 2 kg"', () => {
    const { items } = recognise("no sugar 2 kg", overlapCatalogue);
    expect(items[0]).toMatchObject({
      productId: "shop-no-sugar",
      name: "No Sugar Sweetener",
      quantity: 2,
      unit: "kg",
    });
  });

  it('still treats a bare "no" as filler', () => {
    expect(recognise("no", overlapCatalogue).items).toHaveLength(0);
    expect(recognise("2 kg no", overlapCatalogue).items).toHaveLength(0);
  });

  it("matches a product whose name starts with a filler syllable", () => {
    expect(recognise("500 gram achaar", overlapCatalogue).items[0]).toMatchObject({
      productId: "shop-achaar",
      quantity: 0.5,
      unit: "kg",
    });
    expect(recognise("5 kg basmati", overlapCatalogue).items[0]).toMatchObject({
      productId: "shop-basmati",
      quantity: 5,
    });
    expect(recognise("2 packet jio tasty chips", overlapCatalogue).items[0]).toMatchObject({
      productId: "shop-jio",
      quantity: 2,
      unit: "packet",
    });
  });

  it("never loses a catalogue product because its name contains a filler word", () => {
    for (const product of overlapCatalogue) {
      const { items } = recognise(`${product.name} 1 kg`, overlapCatalogue);
      expect(items.length, product.name).toBeGreaterThan(0);
      expect(items[0]!.matchStatus, product.name).not.toBe("unmatched");
    }
  });
});
