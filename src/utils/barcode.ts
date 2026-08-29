/**
 * Canonicalizes a barcode for storage and matching.
 *
 * The same physical product can be reported as UPC-A (12 digits) by one
 * scanner and EAN-13 (13 digits, leading zero) by another, so UPC-A is
 * padded to EAN-13. Applied at both save time and lookup time, matching
 * stays consistent regardless of which form the camera reports.
 */
export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 6 || digits.length > 14) {
    return null; // junk input — no real product code is this short/long
  }
  if (digits.length === 12) {
    return `0${digits}`;
  }
  return digits;
}

/** True when two stored/scanned codes identify the same product. */
export function barcodesMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) {
    return false;
  }
  return normalizeBarcode(a) === normalizeBarcode(b);
}
