import type { AppData, Bill, Product, Settings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import {
  sanitizeBills,
  sanitizeProducts,
  sanitizeSettings,
} from "./storage";

export const BACKUP_VERSION = 1;

export interface BackupPayload {
  app: "voicebill";
  version: number;
  exportedAt: string;
  products: Product[];
  bills: Bill[];
  settings: Settings;
}

export function buildBackup(data: Pick<AppData, "products" | "bills" | "settings">): BackupPayload {
  return {
    app: "voicebill",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    products: data.products,
    bills: data.bills,
    settings: { ...data.settings, setupComplete: true },
  };
}

export function serializeBackup(
  data: Pick<AppData, "products" | "bills" | "settings">,
): string {
  return JSON.stringify(buildBackup(data), null, 2);
}

export interface ParsedBackup {
  ok: true;
  products: Product[];
  bills: Bill[];
  settings: Settings;
  exportedAt?: string;
}

export interface BackupError {
  ok: false;
  error: string;
}

export function parseBackup(text: string): ParsedBackup | BackupError {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not valid JSON. Choose a VoiceBill backup file." };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "This file does not look like a VoiceBill backup." };
  }
  const record = parsed as Record<string, unknown>;
  const hasProducts = Array.isArray(record.products);
  const hasBills = Array.isArray(record.bills);
  if (!hasProducts && !hasBills) {
    return { ok: false, error: "Backup must contain a products list or a bills list." };
  }

  const products = sanitizeProducts(record.products);
  const bills = sanitizeBills(record.bills);
  // Restoring data always means the shop is set up: an older/partial backup
  // must never bounce the shopkeeper back to the first-run screen.
  const settings = record.settings
    ? { ...sanitizeSettings(record.settings), setupComplete: true }
    : { ...DEFAULT_SETTINGS, setupComplete: true };

  if (products.length === 0 && bills.length === 0) {
    return { ok: false, error: "No usable products or bills were found in this backup." };
  }

  return {
    ok: true,
    products,
    bills,
    settings,
    exportedAt: typeof record.exportedAt === "string" ? record.exportedAt : undefined,
  };
}

/** Trigger a browser download for a text file. */
export function downloadTextFile(filename: string, content: string, mime = "application/json"): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function backupFilename(now = new Date()): string {
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  return `voicebill-backup-${stamp}.json`;
}
