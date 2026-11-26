import { BankService } from "./service/BankService.js";
import { BankController } from "./controller/BankController.js";
import { AccountStatus } from "./domain/Account.js";
import { Money } from "./domain/Money.js";

const bankService = new BankService();
const controller = new BankController(bankService);
let selectedStatementAccount = null;

// Seed initial realistic bank data
function seedInitialData() {
  const c1 = bankService.registerCustomer("Aarav Sharma");
  const c2 = bankService.registerCustomer("Elena Rostova");
  const c3 = bankService.registerCustomer("Marcus Vance");

  const a1 = bankService.registerAccount({
    customerId: c1.getCustomerId(),
    accountType: "SAVINGS",
    initialDepositDollars: 2500.00,
    status: AccountStatus.ACTIVE
  });
  const a2 = bankService.registerAccount({
    customerId: c1.getCustomerId(),
    accountType: "CURRENT",
    initialDepositDollars: 1200.00,
    status: AccountStatus.ACTIVE
  });
  bankService.registerAccount({
    customerId: c2.getCustomerId(),
    accountType: "SAVINGS",
    initialDepositDollars: 5400.00,
    status: AccountStatus.ACTIVE
  });
  bankService.registerAccount({
    customerId: c3.getCustomerId(),
    accountType: "CURRENT",
    initialDepositDollars: 0.00,
    status: AccountStatus.PENDING
  });

  // Sample transaction activity
  bankService.deposit(a1.accountNumber, 500.00, "Monthly Payroll Credit");
  bankService.executeTransfer(a1.accountNumber, a2.accountNumber, 350.00, "Checking Replenishment");

  selectedStatementAccount = a1.accountNumber;
  bankService.logAudit("SYSTEM_BOOT", "SEED_LEDGER", "SUCCESS", "Initialized CoreBank domain entities & seed ledger.");
}

function showAlert(message, isError = false) {
  const banner = document.getElementById("alertBanner");
  banner.textContent = message;
  banner.className = `alert ${isError ? "error" : "success"}`;
}

function updateLatencyBadge(ms) {
  const el = document.getElementById("latencyIndicator");
  el.innerHTML = `Last Op: <strong>${ms.toFixed(2)} ms</strong>`;
}

function getVisibleAccounts() {
  const all = bankService.getAllAccounts();
  if (controller.role === "ADMIN") return all;
  return all.filter((acc) => acc.owner.getCustomerId() === controller.activeCustomerId);
}

function renderAll() {
  renderKpis();
  renderRoleSelectors();
  renderAccountsTable();
  renderStatement();
  renderTransactionDropdowns();
  renderLifecycleTable();
  renderAuditLog();
}

function renderKpis() {
  const customers = bankService.getAllCustomers();
  const accounts = bankService.getAllAccounts();
  const activeCount = accounts.filter((a) => a.status === AccountStatus.ACTIVE).length;
  const totalCents = accounts.reduce((sum, a) => sum + a.balanceCents, 0);

  document.getElementById("kpiCustomers").textContent = customers.length;
  document.getElementById("kpiActiveAccounts").textContent = `${activeCount} / ${accounts.length}`;
  document.getElementById("kpiLiquidity").textContent = Money.format(totalCents);
  document.getElementById("kpiAuditCount").textContent = bankService.auditLogs.length;
}

function renderRoleSelectors() {
  const customers = bankService.getAllCustomers();
  const activeCustSelect = document.getElementById("activeCustomerSelect");
  const existingCustSelect = document.getElementById("existingCustomerSelect");

  const prevActive = activeCustSelect.value || (customers[0] && customers[0].getCustomerId());
  activeCustSelect.innerHTML = customers
    .map((c) => `<option value="${c.getCustomerId()}">${c.getFullName()} (${c.getCustomerId()})</option>`)
    .join("");
  if (prevActive) activeCustSelect.value = prevActive;
  if (controller.role === "CUSTOMER") {
    controller.activeCustomerId = activeCustSelect.value;
  }

  existingCustSelect.innerHTML = customers
    .map((c) => `<option value="${c.getCustomerId()}">${c.getFullName()} (${c.getCustomerId()})</option>`)
    .join("");

  // Show/hide admin-only tabs
  document.querySelectorAll(".admin-only").forEach((el) => {
    el.style.display = controller.role === "ADMIN" ? "inline-block" : "none";
  });
}

function statusBadgeHtml(status) {
  const cls = {
    ACTIVE: "badge-active",
    PENDING: "badge-pending",
    FROZEN: "badge-frozen",
    CLOSED: "badge-closed"
  }[status] || "";
  return `<span class="badge ${cls}">${status}</span>`;
}

function renderAccountsTable() {
  const tbody = document.getElementById("accountsTableBody");
  const accounts = getVisibleAccounts();

  if (accounts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">No accounts visible for current role.</td></tr>`;
    return;
  }

  tbody.innerHTML = accounts
    .map(
      (acc) => `
      <tr>
        <td><strong>${acc.accountNumber}</strong></td>
        <td>${acc.owner.getFullName()}<br><small style="color:#64748b">${acc.owner.getCustomerId()}</small></td>
        <td>${acc.getTypeLabel()}</td>
        <td>${statusBadgeHtml(acc.status)}</td>
        <td><strong>${Money.format(acc.balanceCents)}</strong></td>
        <td>
          <button class="btn btn-sm btn-primary view-stmt-btn" data-acc="${acc.accountNumber}">Statement</button>
        </td>
      </tr>
    `
    )
    .join("");

  tbody.querySelectorAll(".view-stmt-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedStatementAccount = btn.dataset.acc;
      renderStatement();
    });
  });
}

function renderStatement() {
  const badge = document.getElementById("statementAccountBadge");
  const meta = document.getElementById("statementMeta");
  const tbody = document.getElementById("statementTableBody");

  if (!selectedStatementAccount || !bankService.accounts.has(selectedStatementAccount)) {
    badge.textContent = "None Selected";
    tbody.innerHTML = "";
    return;
  }

  const acc = bankService.getAccount(selectedStatementAccount);
  badge.textContent = `${acc.accountNumber} (${acc.getTypeLabel()})`;
  const policyText =
    acc.getTypeLabel() === "SAVINGS"
      ? `Min Balance Rule: ${Money.format(acc.minBalanceCents)}`
      : `Overdraft Limit: ${Money.format(acc.overdraftLimitCents)}`;

  meta.innerHTML = `
    <strong>Owner:</strong> ${acc.owner.getFullName()} (${acc.owner.getCustomerId()}) &nbsp;|&nbsp;
    <strong>Status:</strong> ${acc.status} &nbsp;|&nbsp;
    <strong>Current Balance:</strong> ${Money.format(acc.balanceCents)} &nbsp;|&nbsp;
    <strong>Policy:</strong> ${policyText}
  `;

  const history = acc.getHistory().slice().reverse();
  if (history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">No transactions recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = history
    .map(
      (txn) => `
      <tr>
        <td><code>${txn.txnId}</code></td>
        <td><strong>${txn.type}</strong></td>
        <td>${Money.format(txn.amountCents)}</td>
        <td>${Money.format(txn.balanceAfterCents)}</td>
        <td>${txn.timestamp}</td>
        <td>${txn.remarks}</td>
      </tr>
    `
    )
    .join("");
}

function renderTransactionDropdowns() {
  const visibleAccounts = getVisibleAccounts();
  const allAccounts = bankService.getAllAccounts();

  const formatOpt = (a) =>
    `<option value="${a.accountNumber}">${a.accountNumber} — ${a.owner.getFullName()} (${a.getTypeLabel()} | ${Money.format(a.balanceCents)} | ${a.status})</option>`;

  const visibleOpts = visibleAccounts.map(formatOpt).join("");
  const allOpts = allAccounts.map(formatOpt).join("");

  document.getElementById("depositAccountSelect").innerHTML = visibleOpts;
  document.getElementById("withdrawAccountSelect").innerHTML = visibleOpts;
  document.getElementById("transferSrcSelect").innerHTML = visibleOpts;
  document.getElementById("transferDstSelect").innerHTML = allOpts;

  if (allAccounts.length > 1) {
    document.getElementById("transferDstSelect").selectedIndex = 1;
  }
}

function renderLifecycleTable() {
  const tbody = document.getElementById("lifecycleTableBody");
  const accounts = bankService.getAllAccounts();

  tbody.innerHTML = accounts
    .map((acc) => {
      let actions = "";
      if (acc.status === AccountStatus.PENDING) {
        actions += `<button class="btn btn-sm btn-success lc-btn" data-acc="${acc.accountNumber}" data-act="ACTIVATE">Approve KYC (Activate)</button>`;
      }
      if (acc.status === AccountStatus.ACTIVE) {
        actions += `<button class="btn btn-sm btn-warning lc-btn" data-acc="${acc.accountNumber}" data-act="FREEZE">Freeze</button>`;
        actions += `<button class="btn btn-sm btn-danger lc-btn" data-acc="${acc.accountNumber}" data-act="CLOSE">Close ($0 Req)</button>`;
      }
      if (acc.status === AccountStatus.FROZEN) {
        actions += `<button class="btn btn-sm btn-primary lc-btn" data-acc="${acc.accountNumber}" data-act="UNFREEZE">Unfreeze</button>`;
      }
      if (acc.status === AccountStatus.CLOSED) {
        actions = `<span style="color:#64748b;font-size:0.8rem;">Terminal State</span>`;
      }

      return `
        <tr>
          <td><strong>${acc.accountNumber}</strong></td>
          <td>${acc.owner.getFullName()}</td>
          <td>${acc.getTypeLabel()}</td>
          <td><strong>${Money.format(acc.balanceCents)}</strong></td>
          <td>${statusBadgeHtml(acc.status)}</td>
          <td><div class="action-group">${actions}</div></td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll(".lc-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const res = controller.changeLifecycle(btn.dataset.acc, btn.dataset.act);
      updateLatencyBadge(res.latencyMs);
      if (res.ok) {
        showAlert(`Account ${btn.dataset.acc} transitioned to ${res.data.status}.`);
      } else {
        showAlert(res.error, true);
      }
      renderAll();
    });
  });
}

function renderAuditLog() {
  const tbody = document.getElementById("auditLogTableBody");
  tbody.innerHTML = bankService.auditLogs
    .map(
      (log) => `
      <tr>
        <td>${log.timestamp}</td>
        <td><code>${log.actor}</code></td>
        <td><strong>${log.operation}</strong></td>
        <td><span class="badge ${log.outcome === "SUCCESS" ? "badge-active" : "badge-closed"}">${log.outcome}</span></td>
        <td>${log.details}</td>
      </tr>
    `
    )
    .join("");
}

function bindEvents() {
  // Tab navigation
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  // Role switching (FR-02)
  const roleSelect = document.getElementById("roleSelect");
  const custWrapper = document.getElementById("customerSelectWrapper");
  const activeCustSelect = document.getElementById("activeCustomerSelect");

  roleSelect.addEventListener("change", () => {
    const role = roleSelect.value;
    if (role === "CUSTOMER") {
      custWrapper.style.display = "flex";
      controller.setSession("CUSTOMER", activeCustSelect.value);
    } else {
      custWrapper.style.display = "none";
      controller.setSession("ADMIN", null);
      // Switch away from hidden admin tab if needed
    }
    renderAll();
  });

  activeCustSelect.addEventListener("change", () => {
    controller.setSession("CUSTOMER", activeCustSelect.value);
    renderAll();
  });

  // Open Account Form (FR-01)
  const customerModeSelect = document.getElementById("customerModeSelect");
  customerModeSelect.addEventListener("change", () => {
    const isNew = customerModeSelect.value === "NEW";
    document.getElementById("newCustomerFields").style.display = isNew ? "block" : "none";
    document.getElementById("existingCustomerFields").style.display = isNew ? "none" : "block";
  });

  document.getElementById("accountTypeSelect").addEventListener("change", (e) => {
    document.getElementById("initialDepositInput").value = e.target.value === "SAVINGS" ? "500.00" : "0.00";
  });

  document.getElementById("openAccountForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const isNew = customerModeSelect.value === "NEW";
    const payload = {
      customerId: isNew ? null : document.getElementById("existingCustomerSelect").value,
      fullName: isNew ? document.getElementById("newCustomerName").value : null,
      accountType: document.getElementById("accountTypeSelect").value,
      initialDepositDollars: document.getElementById("initialDepositInput").value,
      status: document.getElementById("initialStatusSelect").value
    };

    const res = controller.openAccount(payload);
    updateLatencyBadge(res.latencyMs);
    if (res.ok) {
      selectedStatementAccount = res.data.accountNumber;
      showAlert(`Opened ${res.data.getTypeLabel()} account ${res.data.accountNumber} for ${res.data.owner.getFullName()}.`);
      document.getElementById("newCustomerName").value = "";
    } else {
      showAlert(res.error, true);
    }
    renderAll();
  });

  // Deposit Form (FR-04)
  document.getElementById("depositForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const acc = document.getElementById("depositAccountSelect").value;
    const amt = document.getElementById("depositAmount").value;
    const remarks = document.getElementById("depositRemarks").value;

    const res = controller.deposit(acc, amt, remarks);
    updateLatencyBadge(res.latencyMs);
    if (res.ok) {
      selectedStatementAccount = acc;
      showAlert(`Deposited $${Number(amt).toFixed(2)} into ${acc}. Txn ID: ${res.data.txnId}`);
      e.target.reset();
    } else {
      showAlert(res.error, true);
    }
    renderAll();
  });

  // Withdraw Form (FR-05)
  document.getElementById("withdrawForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const acc = document.getElementById("withdrawAccountSelect").value;
    const amt = document.getElementById("withdrawAmount").value;
    const remarks = document.getElementById("withdrawRemarks").value;

    const res = controller.withdraw(acc, amt, remarks);
    updateLatencyBadge(res.latencyMs);
    if (res.ok) {
      selectedStatementAccount = acc;
      showAlert(`Withdrew $${Number(amt).toFixed(2)} from ${acc}. Txn ID: ${res.data.txnId}`);
      e.target.reset();
    } else {
      showAlert(res.error, true);
    }
    renderAll();
  });

  // Atomic Transfer Form (FR-06)
  document.getElementById("transferForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const src = document.getElementById("transferSrcSelect").value;
    const dst = document.getElementById("transferDstSelect").value;
    const amt = document.getElementById("transferAmount").value;
    const remarks = document.getElementById("transferRemarks").value || "Inter-Account Transfer";
    const simulateFault = document.getElementById("simulateFaultCheckbox").checked;

    const res = controller.transfer(src, dst, amt, remarks, simulateFault);
    updateLatencyBadge(res.latencyMs);
    if (res.ok) {
      selectedStatementAccount = src;
      showAlert(`Atomic transfer of $${Number(amt).toFixed(2)} from ${src} to ${dst} succeeded.`);
      e.target.reset();
    } else {
      showAlert(`Transfer Rolled Back: ${res.error}`, true);
    }
    renderAll();
  });

  document.getElementById("clearLogViewBtn").addEventListener("click", renderAuditLog);
}

seedInitialData();
bindEvents();
renderAll();
