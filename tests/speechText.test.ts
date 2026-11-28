import { describe, expect, it } from "vitest";
import {
  appendChunk,
  appendToList,
  continuesPrevious,
  isClearCommand,
  isHesitationOnly,
} from "@/lib/speechText";

describe("speech continuation", () => {
  it("treats a new chunk as the same list when it starts with a connector", () => {
    expect(continuesPrevious("3 kilo chini", "aur 2 kilo aata")).toBe(true);
    expect(continuesPrevious("3 kilo chini", "and 2 kilo atta")).toBe(true);
    expect(continuesPrevious("3 kilo chini", "plus 1 kilo namak")).toBe(true);
    expect(continuesPrevious("3 kilo chini", "फिर 2 किलो आटा")).toBe(true);
    expect(continuesPrevious("3 kilo chini", "ok 2 kilo aata")).toBe(true);
  });

  it("treats a bare quantity start as a fresh line", () => {
    expect(continuesPrevious("3 kilo chini", "2 kilo aata")).toBe(false);
    expect(continuesPrevious("2 kilo maggi", "sugar")).toBe(false);
  });

  it("does not split when the previous chunk ended mid-phrase", () => {
    expect(continuesPrevious("3 kilo", "chini")).toBe(true);
    expect(continuesPrevious("2 packet", "maggi")).toBe(true);
    expect(continuesPrevious("500 gram", "haldi")).toBe(true);
  });

  it("joins chunks without repeating the connector", () => {
    expect(appendChunk("3 kilo chini aur", "aur 2 kilo aata")).toBe("3 kilo chini aur 2 kilo aata");
    expect(appendChunk("3 kilo chini", "aur 2 kilo aata")).toBe("3 kilo chini aur 2 kilo aata");
    expect(appendChunk("3 kilo", "chini")).toBe("3 kilo chini");
    expect(appendChunk("3 kilo chini", "3 kilo chini")).toBe("3 kilo chini");
  });

  it("builds one running list from many pauses", () => {
    let list: string[] = [];
    list = appendToList(list, "3 kilo chini");
    list = appendToList(list, "aur 2 kilo aata");
    list = appendToList(list, "aur 1 litre tel");
    expect(list).toEqual(["3 kilo chini aur 2 kilo aata aur 1 litre tel"]);
  });

  it("keeps a genuinely separate sentence apart", () => {
    let list: string[] = [];
    list = appendToList(list, "3 kilo chini");
    list = appendToList(list, "2 packet maggi");
    expect(list).toEqual(["3 kilo chini", "2 packet maggi"]);
  });
});

describe("spoken commands and hesitation", () => {
  it("recognises clear/reset commands", () => {
    for (const phrase of ["clear", "Clear", "reset", "cancel", "start over", "naya bill", "साफ"]) {
      expect(isClearCommand(phrase), phrase).toBe(true);
    }
    expect(isClearCommand("2 kilo sugar")).toBe(false);
    expect(isClearCommand("clear the bill")).toBe(false);
  });

  it("treats hums, coughs and fillers as hesitation, not a list", () => {
    for (const phrase of ["hmm", "huh", "uh", "umm", "hhhh", "हम्म", "हूँ", "..."]) {
      expect(isHesitationOnly(phrase), phrase).toBe(true);
    }
    for (const phrase of ["3 kg sugar", "hmm sugar", "acha 2 kilo chini"]) {
      expect(isHesitationOnly(phrase), phrase).toBe(false);
    }
  });
});
