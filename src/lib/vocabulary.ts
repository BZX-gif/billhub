import type { Unit } from "./types";
import { normalizeText } from "./text";

/**
 * Built-in spoken-term → concept lexicon. This is deliberately a *concept*
 * mapping, not a product list: it only helps connect a spoken word to the
 * shopkeeper's own catalogue. It never invents a product or a price.
 */
export interface AliasGroup {
  /** Canonical English concept used for matching, e.g. "sugar". */
  concept: string;
  /** Spoken forms, in Devanagari and/or Latin (Hinglish). */
  words: string[];
}

export const ALIAS_GROUPS: AliasGroup[] = [
  { concept: "sugar", words: ["chini", "cheeni", "shakkar", "sakkar", "sugar", "चीनी", "शक्कर"] },
  { concept: "flour", words: ["aata", "atta", "gehu ka aata", "gehun ka aata", "wheat flour", "flour", "आटा", "गेहूं का आटा", "गेहूँ का आटा"] },
  { concept: "rice", words: ["chawal", "chaawal", "rice", "चावल"] },
  { concept: "oil", words: ["tel", "tail", "oil", "तेल"] },
  { concept: "soybean oil", words: ["soybean oil", "soyabean oil", "soya oil", "refined oil", "soybean tel", "soya bean oil", "सोयाबीन तेल"] },
  { concept: "mustard oil", words: ["sarson ka tel", "sarson tel", "sarson oil", "mustard oil", "सरसों का तेल", "सरसों तेल"] },
  { concept: "dal", words: ["dal", "daal", "dhal", "lentils", "lentil", "दाल"] },
  { concept: "toor dal", words: ["arhar dal", "toor dal", "tur dal", "arhar", "अरहर दाल", "तूर दाल", "अरहर"] },
  { concept: "maggi", words: ["maggi", "magi", "maggy", "noodles", "noodle", "मैगी", "नूडल्स"] },
  { concept: "biscuits", words: ["biscuit", "biscuits", "biskut", "parle g", "parle", "बिस्किट", "पारले जी"] },
  { concept: "salt", words: ["namak", "salt", "नमक"] },
  { concept: "milk", words: ["doodh", "dudh", "milk", "दूध"] },
  { concept: "tea", words: ["chai patti", "chai", "tea", "tea patti", "चाय", "चाय पत्ती"] },
  { concept: "detergent", words: ["surf", "surf excel", "detergent", "washing powder", "सर्फ", "डिटर्जेंट"] },
  { concept: "soap", words: ["sabun", "soap", "साबुन"] },
  { concept: "besan", words: ["besan", "gram flour", "बेसन"] },
  { concept: "ghee", words: ["ghee", "घी"] },
  { concept: "bread", words: ["bread", "ब्रेड"] },
  { concept: "eggs", words: ["anda", "ande", "egg", "eggs", "अंडा", "अंडे"] },
  { concept: "onion", words: ["pyaz", "pyaaz", "kanda", "onion", "प्याज"] },
  { concept: "potato", words: ["aloo", "alu", "potato", "आलू"] },
  { concept: "tomato", words: ["tamatar", "tomato", "टमाटर"] },
  { concept: "poha", words: ["poha", "पोहा"] },
  { concept: "suji", words: ["suji", "rava", "sooji", "सूजी", "रवा"] },
  { concept: "jaggery", words: ["gud", "gur", "jaggery", "गुड़"] },
  { concept: "vermicelli", words: ["sevai", "seviyan", "vermicelli", "सेवई"] },
  { concept: "papad", words: ["papad", "पापड़"] },
  { concept: "chips", words: ["chips", "चिप्स"] },
  { concept: "cold drink", words: ["cold drink", "thanda", "soft drink", "कोल्ड ड्रिंक", "ठंडा"] },
];

/** Map normalised spoken word → canonical concept. */
export const SPOKEN_TO_CONCEPT: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const group of ALIAS_GROUPS) {
    for (const word of group.words) {
      const key = normalizeText(word);
      if (key && !map.has(key)) map.set(key, group.concept);
    }
  }
  return map;
})();

const UNIT_WORD_GROUPS: Array<[Unit, string[]]> = [
  ["kg", ["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms", "किलो", "किलोग्राम", "केजी"]],
  ["gram", ["gram", "grams", "gm", "gms", "g", "ग्राम", "ग्राम्स"]],
  ["litre", ["litre", "litres", "liter", "liters", "ltr", "ltrs", "l", "लीटर"]],
  ["ml", ["ml", "mls", "millilitre", "millilitres", "milliliter", "milliliters", "mili", "मिली", "मिलीलीटर"]],
  ["piece", ["piece", "pieces", "pcs", "pc", "nos", "no", "nag", "पीस", "नग"]],
  ["packet", ["packet", "packets", "pkt", "pkts", "pack", "packs", "packet", "पैकेट", "पैकेट्स"]],
  ["dozen", ["dozen", "dozens", "darjan", "dazan", "दर्जन"]],
];

export const UNIT_WORDS: Map<string, Unit> = (() => {
  const map = new Map<string, Unit>();
  for (const [unit, words] of UNIT_WORD_GROUPS) {
    for (const word of words) {
      const key = normalizeText(word);
      if (key && !map.has(key)) map.set(key, unit);
    }
  }
  return map;
})();

/** Filler words that carry no product meaning. */
const FILLER_WORDS = [
  "add", "jodo", "jod", "jodo", "karo", "kardo", "kar", "kariye", "kijiye",
  "dijiye", "chahiye", "mujhe", "please", "plz", "of", "some", "thoda", "dena",
  "hai", "hain", "और", "जोड़ो", "करो", "करदो", "चाहिए", "मुझे", "दीजिए",
  "जोड़", "प्लीज़", "है",
  // Interjections and wake words. Only whole words are removed, so they can
  // never damage a real product name; an utterance made only of these is
  // ignored instead of becoming a phantom "product".
  "uh", "uhh", "uhhh", "um", "umm", "umh", "hm", "hmm", "hmmm", "mm", "mmm",
  "ah", "aah", "oh", "ooh", "er", "erm", "arre", "arey", "aray", "matlab",
  "means", "ok", "okay", "okey", "hello", "helo", "hi", "namaste", "test",
  "testing", "i", "want", "need", "give", "would", "like",
];

export const FILLER_TOKENS: Set<string> = new Set(
  FILLER_WORDS.map((word) => normalizeText(word)).filter(Boolean),
);

/** Words used to split one spoken sentence into multiple items. */
export const SEGMENT_SPLIT_REGEX =
  /\s+(?:aur|and|plus|with|fir|phir)\s+|\s*[,;]\s*|\s*\n+\s*/;

/** English/Hindi phrase numbers that must be handled before splitting. */
export const PHRASE_NUMBER_FIXES: Array<[RegExp, string]> = [
  [/\bone and a half\b/gi, " dedh "],
  [/\btwo and a half\b/gi, " dhai "],
  [/\bthree and a half\b/gi, " sade teen "],
  [/\b1 and a half\b/gi, " dedh "],
  [/\b2 and a half\b/gi, " dhai "],
  [/\bएक और आधा\b/g, " dedh "],
];

/**
 * Expand a spoken word to the concept it refers to, if known.
 * Example: "chini" → "sugar".
 */
export function conceptForWord(word: string): string | undefined {
  return SPOKEN_TO_CONCEPT.get(normalizeText(word));
}

export function unitForWord(word: string): Unit | undefined {
  return UNIT_WORDS.get(normalizeText(word));
}
