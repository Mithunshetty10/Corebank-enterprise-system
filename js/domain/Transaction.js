import { Money } from "./Money.js";

/**
 * Immutable Transaction audit record matching Section 11 Class Diagram & FR-03.
 */
export class Transaction {
  constructor({ txnId, type, amountCents, balanceAfterCents, timestamp, remarks }) {
    this.txnId = txnId;
    this.type = type; // DEPOSIT | WITHDRAWAL | TRANSFER_OUT | TRANSFER_IN
    this.amountCents = amountCents;
    this.balanceAfterCents = balanceAfterCents;
    this.timestamp = timestamp || new Date().toISOString();
    this.remarks = remarks || "";
    Object.freeze(this); // Immutable audit entry
  }

  toString() {
    return `[${this.timestamp}] ${this.txnId} | ${this.type} | ${Money.format(this.amountCents)} | Bal: ${Money.format(this.balanceAfterCents)} | ${this.remarks}`;
  }
}
