import { Money } from "./Money.js";
import { Transaction } from "./Transaction.js";
import { BankingException } from "./BankingException.js";

export const AccountStatus = Object.freeze({
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  FROZEN: "FROZEN",
  CLOSED: "CLOSED"
});

/**
 * Abstract Account base class matching Section 11 Class Diagram & State Machine (Section 9).
 */
export class Account {
  constructor({ accountNumber, owner, initialBalanceCents = 0, status = AccountStatus.ACTIVE }) {
    if (new.target === Account) {
      throw new TypeError("Cannot instantiate abstract Account class directly.");
    }
    this.accountNumber = accountNumber;
    this.owner = owner;
    this.balanceCents = initialBalanceCents;
    this.status = status;
    this.history = [];
  }

  requireActive() {
    if (this.status !== AccountStatus.ACTIVE) {
      throw new BankingException(
        `Account ${this.accountNumber} is ${this.status}. Operation requires ACTIVE status.`
      );
    }
  }

  recordTransaction(type, amountCents, remarks) {
    const txnId = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const entry = new Transaction({
      txnId,
      type,
      amountCents,
      balanceAfterCents: this.balanceCents,
      timestamp: new Date().toLocaleString(),
      remarks
    });
    this.history.push(entry);
    return entry;
  }

  deposit(amountCents, remarks = "Deposit", txnType = "DEPOSIT") {
    this.requireActive();
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new BankingException("Deposit amount must be strictly greater than $0.00.");
    }
    this.balanceCents += amountCents;
    return this.recordTransaction(txnType, amountCents, remarks);
  }

  withdraw(_amountCents, _remarks, _txnType) {
    throw new Error("Abstract method withdraw() must be implemented by subclass.");
  }

  getHistory() {
    return [...this.history];
  }

  getTypeLabel() {
    return "ACCOUNT";
  }

  // State Machine Transitions (FR-07 & Figure 3)
  activateKyc() {
    if (this.status !== AccountStatus.PENDING) {
      throw new BankingException(`Only PENDING accounts can be activated via KYC (current: ${this.status}).`);
    }
    this.status = AccountStatus.ACTIVE;
  }

  freeze() {
    if (this.status !== AccountStatus.ACTIVE) {
      throw new BankingException(`Only ACTIVE accounts can be frozen (current: ${this.status}).`);
    }
    this.status = AccountStatus.FROZEN;
  }

  unfreeze() {
    if (this.status !== AccountStatus.FROZEN) {
      throw new BankingException(`Only FROZEN accounts can be unfrozen (current: ${this.status}).`);
    }
    this.status = AccountStatus.ACTIVE;
  }

  close() {
    if (this.status === AccountStatus.CLOSED) {
      throw new BankingException(`Account ${this.accountNumber} is already CLOSED.`);
    }
    if (this.status !== AccountStatus.ACTIVE) {
      throw new BankingException(`Account must be ACTIVE before closing (current: ${this.status}).`);
    }
    if (this.balanceCents !== 0) {
      throw new BankingException(
        `Cannot close account ${this.accountNumber}: balance must be $0.00 (current balance: ${Money.format(this.balanceCents)}).`
      );
    }
    this.status = AccountStatus.CLOSED;
  }
}

/**
 * SavingsAccount enforcing minimum balance policy (FR-01, FR-05).
 */
export class SavingsAccount extends Account {
  constructor(params) {
    const minBalanceCents = params.minBalanceCents ?? 50000; // $500.00
    if (params.initialBalanceCents < minBalanceCents) {
      throw new BankingException(
        `SavingsAccount requires a minimum initial deposit of ${Money.format(minBalanceCents)}.`
      );
    }
    super(params);
    this.minBalanceCents = minBalanceCents;
    if (this.balanceCents > 0) {
      this.recordTransaction("DEPOSIT", this.balanceCents, "Initial Opening Deposit");
    }
  }

  getTypeLabel() {
    return "SAVINGS";
  }

  withdraw(amountCents, remarks = "Withdrawal", txnType = "WITHDRAWAL") {
    this.requireActive();
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new BankingException("Withdrawal amount must be strictly greater than $0.00.");
    }
    const projectedBalance = this.balanceCents - amountCents;
    if (projectedBalance < this.minBalanceCents) {
      throw new BankingException(
        `Insufficient funds: SavingsAccount ${this.accountNumber} requires a minimum balance of ${Money.format(this.minBalanceCents)}. Available to withdraw: ${Money.format(Math.max(0, this.balanceCents - this.minBalanceCents))}.`
      );
    }
    this.balanceCents = projectedBalance;
    return this.recordTransaction(txnType, amountCents, remarks);
  }
}

/**
 * CurrentAccount enforcing overdraft limit policy (FR-01, FR-05).
 */
export class CurrentAccount extends Account {
  constructor(params) {
    if (params.initialBalanceCents < 0) {
      throw new BankingException("CurrentAccount initial deposit cannot be negative.");
    }
    super(params);
    this.overdraftLimitCents = params.overdraftLimitCents ?? 100000; // $1,000.00
    if (this.balanceCents > 0) {
      this.recordTransaction("DEPOSIT", this.balanceCents, "Initial Opening Deposit");
    }
  }

  getTypeLabel() {
    return "CURRENT";
  }

  withdraw(amountCents, remarks = "Withdrawal", txnType = "WITHDRAWAL") {
    this.requireActive();
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new BankingException("Withdrawal amount must be strictly greater than $0.00.");
    }
    const projectedBalance = this.balanceCents - amountCents;
    if (projectedBalance < -this.overdraftLimitCents) {
      throw new BankingException(
        `Overdraft limit exceeded on CurrentAccount ${this.accountNumber}. Max overdraft: ${Money.format(this.overdraftLimitCents)}. Available funds: ${Money.format(this.balanceCents + this.overdraftLimitCents)}.`
      );
    }
    this.balanceCents = projectedBalance;
    return this.recordTransaction(txnType, amountCents, remarks);
  }
}
