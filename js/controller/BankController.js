import { BankingException } from "../domain/BankingException.js";

/**
 * Application controller handling RBAC authorization (FR-02), audit logging, and latency measurement.
 */
export class BankController {
  constructor(bankService) {
    this.bankService = bankService;
    this.role = "ADMIN"; // ADMIN | CUSTOMER
    this.activeCustomerId = null;
    this.lastLatencyMs = 0;
  }

  setSession(role, customerId = null) {
    this.role = role;
    this.activeCustomerId = customerId;
    this.bankService.logAudit(
      this.getActorLabel(),
      "SESSION_SWITCH",
      "SUCCESS",
      `Switched active role to ${role}${customerId ? ` (${customerId})` : ""}`
    );
  }

  getActorLabel() {
    if (this.role === "ADMIN") return "TELLER_ADMIN";
    return `CUSTOMER:${this.activeCustomerId || "UNBOUND"}`;
  }

  requireAdmin() {
    if (this.role !== "ADMIN") {
      throw new BankingException("Access Denied (FR-02): Privileged operation requires Teller / Admin role.");
    }
  }

  requireOwnershipOrAdmin(accountNumber) {
    if (this.role === "ADMIN") return;
    const acc = this.bankService.getAccount(accountNumber);
    if (acc.owner.getCustomerId() !== this.activeCustomerId) {
      throw new BankingException(`Access Denied (FR-02): Account ${accountNumber} does not belong to active customer.`);
    }
  }

  execute(operationName, fn) {
    const start = performance.now();
    try {
      const result = fn();
      this.lastLatencyMs = performance.now() - start;
      this.bankService.logAudit(this.getActorLabel(), operationName, "SUCCESS", `Completed in ${this.lastLatencyMs.toFixed(2)} ms`);
      return { ok: true, data: result, latencyMs: this.lastLatencyMs };
    } catch (err) {
      this.lastLatencyMs = performance.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      this.bankService.logAudit(this.getActorLabel(), operationName, "REJECTED", message);
      return { ok: false, error: message, latencyMs: this.lastLatencyMs };
    }
  }

  openAccount(payload) {
    return this.execute("OPEN_ACCOUNT", () => {
      if (this.role === "CUSTOMER" && payload.customerId && payload.customerId !== this.activeCustomerId) {
        throw new BankingException("Customers can only open additional accounts under their own profile.");
      }
      return this.bankService.registerAccount(payload);
    });
  }

  deposit(accountNumber, amount, remarks) {
    return this.execute("DEPOSIT", () => {
      this.requireOwnershipOrAdmin(accountNumber);
      return this.bankService.deposit(accountNumber, amount, remarks);
    });
  }

  withdraw(accountNumber, amount, remarks) {
    return this.execute("WITHDRAW", () => {
      this.requireOwnershipOrAdmin(accountNumber);
      return this.bankService.withdraw(accountNumber, amount, remarks);
    });
  }

  transfer(srcAccountNumber, dstAccountNumber, amount, remarks, simulateFault = false) {
    return this.execute("ATOMIC_TRANSFER", () => {
      this.requireOwnershipOrAdmin(srcAccountNumber);
      return this.bankService.executeTransfer(srcAccountNumber, dstAccountNumber, amount, remarks, simulateFault);
    });
  }

  changeLifecycle(accountNumber, action) {
    return this.execute(`LIFECYCLE_${action}`, () => {
      this.requireAdmin();
      const acc = this.bankService.getAccount(accountNumber);
      if (action === "ACTIVATE") acc.activateKyc();
      else if (action === "FREEZE") acc.freeze();
      else if (action === "UNFREEZE") acc.unfreeze();
      else if (action === "CLOSE") acc.close();
      else throw new BankingException(`Unknown lifecycle action: ${action}`);
      return acc;
    });
  }
}
