/**
 * GST helpers: validation, normalisation and invoice labelling.
 *
 * VoiceBill does not calculate tax — a kirana bill shows the prices the
 * shopkeeper charges. What a GST bill must carry is the supplier's GSTIN and
 * the invoice date, so those are what this module looks after.
 */

/** State codes used by GSTIN (first two digits). */
const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
};

/** 2 digits + 5 letters + 4 digits + 1 letter + 1 digit/alphanumeric. */
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

/**
 * Uppercase and strip spaces/dashes, capped at 15 characters so a paste or an
 * extra keystroke in an input field cannot overflow the field.
 */
export function normalizeGstin(input: string): string {
  return upperKey(input).slice(0, 15);
}

function upperKey(input: string): string {
  return (input ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/**
 * True when the value is exactly a structurally valid 15-character GSTIN.
 * Extra characters are rejected rather than silently truncating into a
 * different (but valid-looking) number.
 */
export function isValidGstin(input: string): boolean {
  return GSTIN_PATTERN.test(upperKey(input));
}

/** Two-digit state code, or null when the value is not a valid GSTIN. */
export function gstinStateCode(input: string): string | null {
  if (!isValidGstin(input)) return null;
  return upperKey(input).slice(0, 2);
}

/** Human-readable state name for the GSTIN, when known. */
export function gstinStateName(input: string): string | null {
  const code = gstinStateCode(input);
  return code ? (GST_STATE_CODES[code] ?? null) : null;
}

/**
 * What to print on a bill. A GSTIN is only shown once it is complete and
 * valid — a half-typed number on a customer's bill would be worse than none.
 */
export function printableGstin(input: string | undefined | null): string | null {
  if (!input) return null;
  return isValidGstin(input) ? upperKey(input) : null;
}

/** Label used for the bill's date line on printed receipts. */
export const INVOICE_DATE_LABEL = "Invoice date";

/** Shape of a date input value and the stored draft bill date. */
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate an invoice date typed by the shopkeeper.
 * Returns the YYYY-MM-DD value, or null when it is not a real calendar date.
 */
export function normalizeBillDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!DAY_KEY_PATTERN.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  // Reject impossible dates such as 2026-02-31, which Date silently rolls over.
  const [year, month, day] = trimmed.split("-").map(Number);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return trimmed;
}

/**
 * Combine a chosen bill date with the current clock time.
 * A bill dated today keeps the exact moment; a back-dated bill is stamped at
 * the same wall-clock time so the printed time stays believable.
 */
export function billTimestamp(billDate: string | undefined | null, now: Date = new Date()): Date {
  const day = normalizeBillDate(billDate);
  if (!day) return now;
  const [year, month, date] = day.split("-").map(Number);
  if (
    year === now.getFullYear() &&
    month === now.getMonth() + 1 &&
    date === now.getDate()
  ) {
    return now;
  }
  return new Date(
    year,
    month - 1,
    date,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );
}
