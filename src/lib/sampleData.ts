import type { Product, Unit } from "./types";

type SampleSeed = {
  key: string;
  name: string;
  price: number;
  unit: Unit;
  aliases: string[];
};

/**
 * Optional starter catalogue shown during first-time setup.
 * Always flagged `isSample: true` so it is clearly identified and easy to remove.
 * The shopkeeper may skip it entirely.
 */
const SAMPLE_SEEDS: SampleSeed[] = [
  { key: "sugar", name: "Sugar", price: 45, unit: "kg", aliases: ["chini", "cheeni", "shakkar", "sakkar", "चीनी", "शक्कर"] },
  { key: "flour", name: "Wheat Flour (Aata)", price: 40, unit: "kg", aliases: ["aata", "atta", "gehu ka aata", "flour", "आटा"] },
  { key: "rice", name: "Rice", price: 55, unit: "kg", aliases: ["chawal", "chaawal", "चावल"] },
  { key: "soybean-oil", name: "Soybean Oil", price: 130, unit: "litre", aliases: ["soyabean oil", "soya oil", "refined oil", "सोयाबीन तेल"] },
  { key: "mustard-oil", name: "Mustard Oil", price: 150, unit: "litre", aliases: ["sarson ka tel", "sarson tel", "mustard tel", "सरसों का तेल"] },
  { key: "toor-dal", name: "Toor Dal", price: 120, unit: "kg", aliases: ["arhar dal", "toor dal", "tur dal", "अरहर दाल"] },
  { key: "maggi", name: "Maggi Noodles", price: 14, unit: "packet", aliases: ["maggi", "magi", "noodles", "मैगी"] },
  { key: "biscuits", name: "Parle-G Biscuits", price: 10, unit: "packet", aliases: ["parle g", "parle", "biscuit", "biskut", "बिस्किट"] },
  { key: "salt", name: "Tata Salt", price: 25, unit: "kg", aliases: ["namak", "salt", "नमक"] },
  { key: "milk", name: "Amul Milk", price: 28, unit: "packet", aliases: ["doodh", "dudh", "milk", "दूध"] },
  { key: "tea", name: "Red Label Tea", price: 520, unit: "kg", aliases: ["chai patti", "chai", "tea", "चाय"] },
  { key: "surf", name: "Surf Excel", price: 120, unit: "packet", aliases: ["surf", "detergent", "washing powder", "सर्फ"] },
  { key: "soap", name: "Lifebuoy Soap", price: 42, unit: "piece", aliases: ["sabun", "soap", "साबुन"] },
  { key: "besan", name: "Besan", price: 110, unit: "kg", aliases: ["besan", "gram flour", "बेसन"] },
  { key: "potato", name: "Potato", price: 30, unit: "kg", aliases: ["aloo", "alu", "आलू"] },
  { key: "onion", name: "Onion", price: 35, unit: "kg", aliases: ["pyaz", "pyaaz", "kanda", "प्याज"] },
  { key: "eggs", name: "Eggs", price: 7, unit: "piece", aliases: ["anda", "ande", "अंडा"] },
  { key: "suji", name: "Suji (Rava)", price: 48, unit: "kg", aliases: ["suji", "rava", "sooji", "सूजी"] },
];

export function createSampleProducts(now = new Date()): Product[] {
  const timestamp = now.toISOString();
  return SAMPLE_SEEDS.map((seed) => ({
    id: `sample-${seed.key}`,
    name: seed.name,
    price: seed.price,
    unit: seed.unit,
    aliases: seed.aliases,
    createdAt: timestamp,
    updatedAt: timestamp,
    isSample: true,
  }));
}
