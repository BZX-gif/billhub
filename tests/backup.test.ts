import { describe, expect, it } from "vitest";
import { backupFilename, parseBackup, serializeBackup } from "@/lib/backup";
import { createSampleProducts } from "@/lib/sampleData";
import { testSettings } from "./helpers";

const products = createSampleProducts(new Date("2026-01-01T00:00:00Z")).slice(0, 3);
const settings = testSettings({ shopName: "Sharma Kirana Store", setupComplete: true });

describe("backup export and import", () => {
  it("round-trips products, bills and settings through JSON", () => {
    const json = serializeBackup({ products, bills: [], settings });
    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.products).toHaveLength(3);
    expect(parsed.products[0]?.name).toBe(products[0]?.name);
    expect(parsed.settings.shopName).toBe("Sharma Kirana Store");
    expect(parsed.settings.setupComplete).toBe(true);
  });

  it("always marks a restored shop as set up", () => {
    const json = JSON.stringify({
      app: "voicebill",
      version: 1,
      products,
      bills: [],
      settings: { ...settings, setupComplete: false },
    });
    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.settings.setupComplete).toBe(true);
  });

  it("rejects files that are not JSON", () => {
    const parsed = parseBackup("not a backup");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/valid JSON/i);
  });

  it("rejects unrelated JSON documents", () => {
    const parsed = parseBackup(JSON.stringify({ hello: "world" }));
    expect(parsed.ok).toBe(false);
  });

  it("rejects a backup with no usable rows", () => {
    const parsed = parseBackup(JSON.stringify({ products: [{}], bills: [{}] }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/no usable products/i);
  });

  it("names the file with the export date", () => {
    expect(backupFilename(new Date(2026, 10, 27))).toBe("voicebill-backup-2026-11-27.json");
  });
});
