/**
 * Domain exception representing validation or business rule violations (FR-08).
 */
export class BankingException extends Error {
  constructor(message) {
    super(message);
    this.name = "BankingException";
  }
}
