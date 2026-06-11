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

## 🔑 Regenerating Google Ads & Gmail API Refresh Tokens

If the Google Ads refresh token expires or needs to be updated, follow these steps to generate a permanent token using the **Google OAuth2 Playground**:

### Step 1: Configure OAuth Playground Credentials
1. Go to the [Google OAuth2 Playground](https://developers.google.com/oauthplayground/).
2. Click the **Gear Icon (OAuth2 configuration)** in the top-right corner.
3. Check the box **"Use own OAuth credentials"**.
4. Enter your OAuth Client ID and Client Secret (retrieve these values from your local `.env` file or Render Environment Variables):
   * **OAuth Client ID**: `YOUR_GOOGLE_CLIENT_ID`
   * **OAuth Client Secret**: `YOUR_GOOGLE_CLIENT_SECRET`
5. Ensure **Access type** is set to **Offline** (required to get a refresh token).
6. Click **Close**.

> [!NOTE]
> If you encounter a `redirect_uri_mismatch` error, go to your [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials), edit your Client ID, and add `https://developers.google.com/oauthplayground` to the **Authorized redirect URIs** list.

### Step 2: Authorize Scopes (Google Ads & Gmail API)
1. In Step 1 on the left side of the Playground, scroll down to the custom scope input box.
2. Paste both scopes separated by a space:
   `https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/gmail.send`
3. Click **Authorize APIs** and log in with your Google Ads manager/client account.

> [!IMPORTANT]
> **Why both scopes?** Cloud hosts (like Render, AWS, Heroku) block outbound SMTP ports (25, 465, 587) by default to prevent spam. Specifying the `gmail.send` scope allows the backend to bypass SMTP firewalls entirely by transmitting the daily Performance Digest email via the Gmail REST API over standard HTTPS (port 443), which is always open.

### Step 3: Exchange for Refresh Token
1. In Step 2, click the **Exchange authorization code for tokens** button.
2. Copy the generated **Refresh token** string.
3. Paste the new token into Render's Environment Variables as `GOOGLE_ADS_REFRESH_TOKEN` and trigger a redeployment.

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
