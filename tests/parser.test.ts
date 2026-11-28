import { describe, expect, it } from "vitest";
import { parseUtterance } from "@/lib/parser";

describe("speech parser", () => {
  it("parses a simple Hinglish quantity and product", () => {
    const { items } = parseUtterance("3 kilo chini");
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
    expect(items[0].unit).toBe("kg");
    expect(items[0].query).toBe("cini");
    expect(items[0].explicitQuantity).toBe(true);
  });

  it("parses multiple products in one utterance", () => {
    const { items } = parseUtterance("Teen litre tel aur paanch packet Maggi");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ quantity: 3, unit: "litre" });
    expect(items[1]).toMatchObject({ quantity: 5, unit: "packet" });
    expect(items[1].query).toContain("mag");
  });

  it("parses comma separated items", () => {
    const { items } = parseUtterance("2 kilo aata, 1 kilo chawal");
    expect(items).toHaveLength(2);
    expect(items[0].unit).toBe("kg");
    expect(items[1].quantity).toBe(1);
  });

  it("parses spoken English with plural units and 'of'", () => {
    const { items } = parseUtterance("Add 2 packets of biscuits");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ quantity: 2, unit: "packet" });
    expect(items[0].query).toContain("biscuit");
  });

  it("parses English numbers and units", () => {
    const { items } = parseUtterance("Three kilograms of sugar and two litres of oil");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ quantity: 3, unit: "kg" });
    expect(items[1]).toMatchObject({ quantity: 2, unit: "litre" });
  });

  it("parses decimal quantities", () => {
    const { items } = parseUtterance("1.5 kilo sugar");
    expect(items[0].quantity).toBe(1.5);
    expect(items[0].unit).toBe("kg");
  });

  it("parses fraction words", () => {
    expect(parseUtterance("dedh kilo chini").items[0].quantity).toBe(1.5);
    expect(parseUtterance("dhai kilo chawal").items[0].quantity).toBe(2.5);
    expect(parseUtterance("aadha kilo namak").items[0].quantity).toBe(0.5);
    expect(parseUtterance("sava kilo sugar").items[0].quantity).toBe(1.25);
    expect(parseUtterance("paune do kilo sugar").items[0].quantity).toBe(1.75);
    expect(parseUtterance("sade teen kilo aata").items[0].quantity).toBe(3.5);
  });

  it("parses Devanagari input with Devanagari digits", () => {
    const { items } = parseUtterance("३ किलो चीनी और २ पैकेट मैगी");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ quantity: 3, unit: "kg" });
    expect(items[1]).toMatchObject({ quantity: 2, unit: "packet" });
  });

  it("combines mixed-unit quantities of the same item", () => {
    const { items } = parseUtterance("1 kilo 500 gram chawal");
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(1.5);
    expect(items[0].unit).toBe("kg");
  });

  it("defaults to quantity 1 when quantity is not spoken", () => {
    const { items } = parseUtterance("namak");
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(1);
    expect(items[0].explicitQuantity).toBe(false);
    expect(items[0].notes.join(" ")).toMatch(/quantity/i);
  });

  it("parses dozen", () => {
    const { items } = parseUtterance("2 dozen eggs");
    expect(items[0]).toMatchObject({ quantity: 2, unit: "dozen" });
  });

  it("merges repeated mentions within one utterance", () => {
    const { items } = parseUtterance("2 kilo sugar aur 1 kilo sugar");
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
  });

  it("ignores fragments without a product", () => {
    const result = parseUtterance("3 kilo");
    expect(result.items).toHaveLength(0);
    expect(result.ignored.length).toBe(1);
  });

  it("returns nothing for empty speech", () => {
    expect(parseUtterance("").items).toHaveLength(0);
    expect(parseUtterance("   ").items).toHaveLength(0);
  });

  it("keeps unknown product words instead of inventing one", () => {
    const { items } = parseUtterance("3 kilo unicorn powder");
    expect(items).toHaveLength(1);
    expect(items[0].query).toContain("unicorn");
    expect(items[0].quantity).toBe(3);
  });

  it("handles quantities after the product name", () => {
    const { items } = parseUtterance("chini 3 kilo");
    expect(items[0]).toMatchObject({ quantity: 3, unit: "kg" });
    expect(items[0].query).toBe("cini");
  });

  it("handles attached unit spellings", () => {
    const { items } = parseUtterance("2kg sugar");
    expect(items[0]).toMatchObject({ quantity: 2, unit: "kg" });
  });

  it("ignores an utterance that is only an interjection", () => {
    const result = parseUtterance("uh hmm");
    expect(result.items).toHaveLength(0);
    // Pure filler is reported as noise (not as an unknown product).
    expect(result.ignored).toHaveLength(0);
    expect(result.noise).toEqual(["uh hmm"]);
  });

  it("drops greeting words without losing the product", () => {
    const result = parseUtterance("hello 2 kilo chini");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.query).toBe("cini");
    expect(result.items[0]?.quantity).toBe(2);
  });

  it("ignores a single stray character", () => {
    const result = parseUtterance("x");
    expect(result.items).toHaveLength(0);
    expect(result.noise).toEqual(["x"]);
  });
});
