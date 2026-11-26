# CoreBank Enterprise — Bank Management System

A modular, zero-dependency, ready-to-run web application implementing all Functional Requirements (`FR-01` through `FR-08`), Non-Functional Requirements, and UML specifications (Use-Case, Sequence, State Machine, Activity, and Class Diagrams).

## Project Structure

```text
corebank_website/
├── index.html                    # Main UI dashboard
├── README.md                     # Setup & architecture guide
├── css/
│   └── styles.css                # Responsive styling & status badges
└── js/
    ├── app.js                    # UI state binding & seed data
    ├── domain/
    │   ├── Money.js              # Integer-cent BigDecimal precision arithmetic
    │   ├── Customer.js           # Customer domain entity
    │   ├── Transaction.js        # Immutable Object.freeze() audit entry
    │   ├── Account.js            # Abstract Account, SavingsAccount, CurrentAccount
    │   └── BankingException.js   # Domain validation & policy exception
    ├── service/
    │   └── BankService.js        # Business rules & atomic transfer rollback
    └── controller/
        └── BankController.js     # RBAC enforcement & sub-millisecond telemetry
```

## How to Run

Because the project uses native ES6 Modules (`<script type="module">`), serve the folder over a local HTTP server (opening `index.html` directly via `file://` may trigger browser CORS restrictions on ES modules):

### Option 1: Python (Built-in)
```bash
cd corebank_website
python3 -m http.server 8080
```
Open `http://localhost:8080` in your browser.

### Option 2: Node.js (`npx serve`)
```bash
cd corebank_website
npx serve .
```

### Option 3: VS Code Live Server
Open the `corebank_website` folder in VS Code and click **Go Live** in the bottom status bar.
