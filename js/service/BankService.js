import { Customer } from "../domain/Customer.js";
import { SavingsAccount, CurrentAccount, AccountStatus } from "../domain/Account.js";
import { BankingException } from "../domain/BankingException.js";
import { Money } from "../domain/Money.js";

/**
 * Core business service handling account registry, transactions, and atomic transfers.
 * Matches Figure 2 Sequence Diagram & Section 11 Class Diagram.
 */
export class BankService {
  constructor() {
    this.customers = new Map();
    this.accounts = new Map();
    this.auditLogs = [];
    this.customerSeq = 1001;
    this.accountSeq = 500100;
  }

  logAudit(actor, operation, outcome, details) {
    const entry = Object.freeze({
      timestamp: new Date().toLocaleTimeString(),
      actor,
      operation,
      outcome,
      details
    });
    this.auditLogs.unshift(entry);
  }

  registerCustomer(fullName) {
    const customerId = `CUST-${this.customerSeq++}`;
    const customer = new Customer(customerId, fullName);
    this.customers.set(customerId, customer);
    return customer;
  }

  getCustomer(customerId) {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new BankingException(`Customer ${customerId} not found.`);
    }
    return customer;
  }

  getAllCustomers() {
    return Array.from(this.customers.values());
  }

  registerAccount({ customerId, fullName, accountType, initialDepositDollars, status = AccountStatus.ACTIVE }) {
    const initialBalanceCents = Money.toCents(initialDepositDollars);
    let customer;
    let createdNewCustomer = false;

    if (customerId) {
      customer = this.getCustomer(customerId);
    } else {
      customer = this.registerCustomer(fullName);
      createdNewCustomer = true;
    }

    const accountNumber = `ACC-${this.accountSeq++}`;
    let account;

    try {
      if (accountType === "SAVINGS") {
        account = new SavingsAccount({
          accountNumber,
          owner: customer,
          initialBalanceCents,
          status
        });
      } else if (accountType === "CURRENT") {
        account = new CurrentAccount({
          accountNumber,
          owner: customer,
          initialBalanceCents,
          status
        });
      } else {
        throw new BankingException(`Unsupported account type: ${accountType}`);
      }
    } catch (err) {
      if (createdNewCustomer) {
        this.customers.delete(customer.getCustomerId());
        this.customerSeq--;
      }
      this.accountSeq--;
      throw err;
    }

    this.accounts.set(accountNumber, account);
    return account;
  }

  getAccount(accountNumber) {
    const acc = this.accounts.get(accountNumber);
    if (!acc) {
      throw new BankingException(`Account ${accountNumber} does not exist.`);
    }
    return acc;
  }

  getAllAccounts() {
    return Array.from(this.accounts.values());
  }

  deposit(accountNumber, amountDollars, remarks) {
    const acc = this.getAccount(accountNumber);
    const amountCents = Money.toCents(amountDollars);
    return acc.deposit(amountCents, remarks || "Deposit");
  }

  withdraw(accountNumber, amountDollars, remarks) {
    const acc = this.getAccount(accountNumber);
    const amountCents = Money.toCents(amountDollars);
    return acc.withdraw(amountCents, remarks || "Withdrawal");
  }

  /**
   * Atomic Inter-Account Fund Transfer (FR-06 & Figure 2 Sequence Diagram).
   * Rolls back source debit and history if destination credit or post-debit step fails.
   */
  executeTransfer(srcAccountNumber, dstAccountNumber, amountDollars, remarks = "Fund Transfer", simulateFault = false) {
    if (srcAccountNumber === dstAccountNumber) {
      throw new BankingException("Source and destination accounts must be different.");
    }

    const src = this.getAccount(srcAccountNumber);
    const dst = this.getAccount(dstAccountNumber);
    const amountCents = Money.toCents(amountDollars);

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new BankingException("Transfer amount must be strictly greater than $0.00.");
    }

    // Step 3 & 4 in Sequence Diagram: requireActive() on both accounts before mutation
    src.requireActive();
    dst.requireActive();

    // Snapshot state for atomic rollback
    const srcPrevBalance = src.balanceCents;
    const srcPrevHistoryLen = src.history.length;
    const dstPrevBalance = dst.balanceCents;
    const dstPrevHistoryLen = dst.history.length;

    try {
      // Step 5: withdraw from source
      const debitTxn = src.withdraw(
        amountCents,
        `${remarks} (To ${dst.accountNumber})`,
        "TRANSFER_OUT"
      );

      // Optional fault simulation to demonstrate NFR Reliability & Atomicity rollback
      if (simulateFault) {
        throw new BankingException("Simulated network/ledger fault mid-transfer. Rolling back source debit.");
      }

      // Step 6: deposit to destination
      const creditTxn = dst.deposit(
        amountCents,
        `${remarks} (From ${src.accountNumber})`,
        "TRANSFER_IN"
      );

      return { debitTxn, creditTxn };
    } catch (err) {
      // Atomic Rollback: restore exact pre-transaction state
      src.balanceCents = srcPrevBalance;
      src.history.length = srcPrevHistoryLen;
      dst.balanceCents = dstPrevBalance;
      dst.history.length = dstPrevHistoryLen;
      throw err;
    }
  }
}
