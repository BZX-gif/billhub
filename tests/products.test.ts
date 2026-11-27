import { describe, expect, it } from "vitest";
import {
  normalizeAliases,
  productFromInput,
  validateProductInput,
  type ProductFormValues,
} from "@/lib/products";
import { convertQuantity, formatMoney, formatQuantity, roundMoney } from "@/lib/units";
import { normalizeText } from "@/lib/text";
import { createSampleProducts } from "@/lib/sampleData";

const values = (overrides: Partial<ProductFormValues> = {}): ProductFormValues => ({
  name: "Sugar",
  price: "45",
  unit: "kg",
  aliases: "chini, cheeni, चीनी",
  ...overrides,
});

describe("product management", () => {
  it("validates a new product", () => {
    expect(validateProductInput(values(), [])).toEqual({});
  });

  it("rejects an empty name and duplicate name", () => {
    expect(validateProductInput(values({ name: "  " }), [])).toHaveProperty("name");
    const existing = [productFromInput(values())];
    expect(validateProductInput(values(), existing)).toHaveProperty("name");
    expect(
      validateProductInput(values({ name: "Sugar" }), existing, existing[0].id),
    ).toEqual({});
  });

  it("rejects invalid prices", () => {
    expect(validateProductInput(values({ price: "" }), [])).toHaveProperty("price");
    expect(validateProductInput(values({ price: "abc" }), [])).toHaveProperty("price");
    expect(validateProductInput(values({ price: "0" }), [])).toHaveProperty("price");
    expect(validateProductInput(values({ price: "-5" }), [])).toHaveProperty("price");
    expect(validateProductInput(values({ price: "99999999" }), [])).toHaveProperty("price");
  });

  it("normalises aliases", () => {
    expect(normalizeAliases(" Chini , cheeni ,CHINI, , ")).toEqual(["Chini", "cheeni"]);
    expect(normalizeAliases(["chini", "chini", "sakkar"])).toEqual(["chini", "sakkar"]);
  });

  it("creates a product with trimmed values and preserves edited ids", () => {
    const product = productFromInput(values({ name: "  Sugar  ", price: "45.555" }));
    expect(product.name).toBe("Sugar");
    expect(product.price).toBe(45.56);
    expect(product.unit).toBe("kg");
    const edited = productFromInput(values({ name: "Sugar Fine", price: "50" }), product);
    expect(edited.id).toBe(product.id);
    expect(edited.createdAt).toBe(product.createdAt);
    expect(edited.name).toBe("Sugar Fine");
  });

  it("ships clearly-marked sample products", () => {
    const samples = createSampleProducts();
    expect(samples.length).toBeGreaterThan(5);
    expect(samples.every((sample) => sample.isSample === true)).toBe(true);
    expect(new Set(samples.map((sample) => sample.id)).size).toBe(samples.length);
  });
});

describe("units and money formatting", () => {
  it("converts within a family and refuses cross-family conversion", () => {
    expect(convertQuantity(500, "gram", "kg")).toBe(0.5);
    expect(convertQuantity(1.5, "kg", "gram")).toBe(1500);
    expect(convertQuantity(250, "ml", "litre")).toBe(0.25);
    expect(convertQuantity(2, "dozen", "piece")).toBe(24);
    expect(convertQuantity(2, "litre", "kg")).toBeNull();
    expect(convertQuantity(2, "packet", "piece")).toBeNull();
  });

  it("formats money in Indian style", () => {
    expect(formatMoney(1234.5)).toBe("₹1,234.50");
    expect(formatMoney(0)).toBe("₹0.00");
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(formatQuantity(1.5)).toBe("1.5");
    expect(formatQuantity(3)).toBe("3");
  });

  it("normalises Hinglish spellings consistently", () => {
    expect(normalizeText("चीनी")).toBe(normalizeText("chini"));
    expect(normalizeText("Shakkar")).toBe(normalizeText("sakkar"));
    expect(normalizeText("Aata")).toBe(normalizeText("atta"));
    expect(normalizeText("3 किलो")).toBe("3 kilo");
  });
});
