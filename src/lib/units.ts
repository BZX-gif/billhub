import {
  UNIT_FAMILY,
  UNIT_LABEL,
  UNIT_SIZE,
  type Unit,
  UNITS,
} from "./types";

/** Round a rupee amount to paise precision (avoids 0.1 + 0.2 issues). */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function toPaise(rupees: number): number {
  return Math.round((Number.isFinite(rupees) ? rupees : 0) * 100);
}

export function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

/** Format a number of rupees for display: ₹1,234.50 */
export function formatMoney(value: number, symbol = "₹"): string {
  const safe = Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
  return `${symbol}${formatted}`;
}

/** Compact money for tight spaces: drops .00, keeps .50 */
export function formatMoneyShort(value: number, symbol = "₹"): string {
  const safe = roundMoney(Number.isFinite(value) ? value : 0);
  const hasPaise = Math.abs(safe % 1) > 0.001;
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(safe);
  return `${symbol}${formatted}`;
}

/** Format a quantity without trailing zeros: 3 → "3", 1.5 → "1.5", 0.25 → "0.25" */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(rounded);
}

export function formatUnit(quantity: number, unit: Unit): string {
  return `${formatQuantity(quantity)} ${UNIT_LABEL[unit]}`;
}

export function clampQuantity(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  // Never allow insane quantities from a misheard number.
  return Math.min(Math.round(value * 1000) / 1000, 1_000_000);
}

/**
 * Convert a quantity from one unit to another within the same family.
 * Returns null when units cannot be converted safely (e.g. litre → kg).
 */
export function convertQuantity(quantity: number, from: Unit, to: Unit): number | null {
  if (from === to) return quantity;
  if (UNIT_FAMILY[from] !== UNIT_FAMILY[to]) return null;
  const base = quantity * UNIT_SIZE[from];
  const converted = base / UNIT_SIZE[to];
  return Math.round(converted * 1_000_000) / 1_000_000;
}

/** Price per `from` unit converted to a price per `to` unit. */
export function convertUnitPrice(pricePerFrom: number, from: Unit, to: Unit): number | null {
  if (from === to) return pricePerFrom;
  if (UNIT_FAMILY[from] !== UNIT_FAMILY[to]) return null;
  return roundMoney((pricePerFrom * UNIT_SIZE[from]) / UNIT_SIZE[to]);
}

export function isUnit(value: unknown): value is Unit {
  return typeof value === "string" && (UNITS as readonly string[]).includes(value);
}
