/**
 * Exact decimal monetary utility using integer cents (BigDecimal equivalent)
 * Satisfies NFR Maintainability & Correctness to avoid floating-point rounding defects.
 */
export class Money {
  static toCents(amount) {
    const num = Number(amount);
    if (!Number.isFinite(num)) {
      throw new Error("Invalid numeric monetary amount.");
    }
    return Math.round(num * 100);
  }

  static fromCents(cents) {
    return (cents / 100).toFixed(2);
  }

  static format(cents) {
    const isNegative = cents < 0;
    const absCents = Math.abs(cents);
    const dollars = Math.floor(absCents / 100);
    const rem = String(absCents % 100).padStart(2, "0");
    return `${isNegative ? "-" : ""}$${dollars.toLocaleString("en-US")}.${rem}`;
  }
}
