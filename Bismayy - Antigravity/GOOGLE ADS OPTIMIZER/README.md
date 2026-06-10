# MAPO - Google Ads Optimization Copilot

Welcome to **MAPO** (Multi-Agent Performance Optimizer), an agentic AI companion for analyzing, auditing, and optimizing Google Ads campaigns.

---

## 🔑 Access Credentials

To access the live hosted dashboard, enter the following HTTP Basic Authentication credentials when prompted:

* **Username**: `admin`
* **Password**: `ads-copilot-2026`

---

## ⚙️ Prototype Scope & Safety Constraints

Please note the following technical characteristics and safeguards configured for this prototype:

1. **Read-Only Safeguard (`READ_ONLY_MODE=true`)**
   * **Behavior**: External users can freely edit, dismiss, and approve recommendations (budget adjustments, bid updates, keyword exclusions) in the **Approval Queue** or placement exclusions.
   * **Safety**: Approved items will transition to `"Applied"` and write to the **Audit Trail**, but **no mutation calls are pushed to the live Google Ads campaign**. This protects the live account from unauthorized spending changes during public demonstrations.

2. **Fixed Account Scope (No Selector / Onboarding)**
   * The application is pre-authenticated using a specific Developer Token and OAuth2 client credentials targeting a dedicated Google Ads manager account (MCC) operating on Client Customer ID: **`3869663219`**.
   * Because this is a prototype, there is no general onboarding flow, external OAuth login consent screen, or account selector dropdown.

3. **Data Cache & Synchronization Latency**
   * The dashboard reads from a local SQLite reporting cache to provide sub-second view loads.
   * Clicking **Sync Cache** or running the daily cron cycle fetches and parses 15 multi-dimensional reports (keywords, search terms, locations, devices, etc.) concurrently. A full cache sync takes between **5 to 15 seconds**.
   * If the cache is empty on startup (e.g., brand-new container boot), a glassmorphic polling overlay will block interaction and automatically update the view once the background sync finishes.

---

## 🚀 Local Run Instructions

If running the application locally instead of using the hosted Render environment:

1. Install dependencies for all workspaces:
   ```bash
   npm run setup
   ```
2. Start both the Vite frontend and Express backend concurrently:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to **`http://localhost:3000`**.
