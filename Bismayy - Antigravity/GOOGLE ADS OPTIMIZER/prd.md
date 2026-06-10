# Product Requirement Document (PRD)
## Google Ads Multi-Dimensional Analytics & Optimization Tool (Internal Copilot)

**Author:** Principal Product Manager  
**Status:** Draft for Review (v12.0)  
**Date:** June 5, 2026  

---

### 1. Executive Summary & Objective

Our organization requires an internal **Google Ads Multi-Dimensional Analytics & Optimization Copilot** tailored for our single live advertiser account (`GOOGLE_ADS_LOGIN_CUSTOMER_ID`). The goal of this tool is to identify waste, highlight conversion opportunities, and optimize performance across multiple dimensions (campaigns, search terms, ad assets, locations, devices, demographics, and bidding strategies).

The copilot will analyze performance metrics and automatically generate actionable optimization recommendations. To guarantee safety and prevent unintended budget spend, no recommendations will be applied autonomously. Instead, the tool will implement a strict **"Human-in-the-Loop" (HITL) approval mechanism**.

---

### 2. Product Constraints

To operate safely and reliably, the product must conform to the following operational limits:

1. **Google Ads API Quota Limit:** The advertiser account operates under the Google Ads API **Explorer Access level**, which restricts execution to a maximum of **2,880 API operations per day**. The product must handle this constraint by utilizing a background caching mechanism so that user browsing and reporting do not trigger live API requests.
2. **No Autonomous Changes:** Under no circumstances is the tool allowed to make direct changes to the Google Ads account automatically. All changes must go through the Approval Queue and require manual user interaction.
3. **Audit Log Trail:** Every single approved mutation, dismissal, or execution must be permanently logged with a timestamp and status to provide a complete audit trail of the account optimization history.
4. **Safety Thresholds:** To prevent accidental high-risk changes, the system must enforce strict boundaries on proposed changes:
   - Max single daily budget adjustment: **±20%**
   - Max single bid adjustment: **±20%**
   - Absolute CPA Cap: The system must block recommendations that bid above a configurable Cost-Per-Acquisition cap.

---

### 3. External Dependencies

The application relies on the following external platforms and services:

1. **Google Ads API (v17):** For downloading performance reports and executing campaign/ad group/asset mutations.
2. **OAuth 2.0 Credentials:** Relies on valid `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_ADS_REFRESH_TOKEN` to maintain authorized access.
3. **AI Generation Engines (Text, Image & Video):**
   - **Google Vertex AI / Gemini:** For image generation (Imagen 3) and video generation (Google Veo).
   - **OpenAI API:** For text brainstorming, copy generation, and alternative image generation (DALL-E 3).
4. **Gmail API / SMTP:** To authorize and send daily performance digest emails to the user.
5. **Local Hosting Environment:** Runs as a local application (`localhost`) with direct access to local system resources and storage.

---

### 4. Input Reports & Product Use Cases

The tool is required to ingest 15 performance reports to analyze the account across different dimensions:

| Report Type | Product Use Case |
|---|---|
| **1. Search Keyword Report** | Identifies poor keyword CTR, high spend, and low Quality Score keywords to pause or optimize. |
| **2. Search Term Report** | Discovers actual user queries to add as Negative Keywords or new Exact Match Keywords. |
| **3. Location Performance** | Flags geographical performance to adjust location-specific bid modifiers. |
| **4. Device Report** | Evaluates conversion rates on Mobile vs. Desktop to recommend device bid modifiers. |
| **5. Demographics Report** | Detects wasteful spend on low-ROI Age/Gender groups. |
| **6. Landing Pages Report** | Identifies high-cost final destination URLs with low conversion rates. |
| **7. Expanded Landing Pages Report** | Audits parameters and tracking redirect issues. |
| **8. Ad Performance** | Analyzes standard ad-level performance for creative testing. |
| **9. Auction Insights** | Monitors competitor impressions and outranking shares. |
| **10. Hour of Day Performance** | Identifies high-cost hourly conversion dead-zones to recommend ad scheduling. |
| **11. Day of Week Performance** | Pinpoints days of the week with poor ROI to recommend day-of-week bid modifiers. |
| **12. Performance Max Placement** | Audits PMax traffic to identify placements on low-quality mobile apps or sites. |
| **13. Audiences Report** | Evaluates observed audience segments to recommend bid modifier adjustments. |
| **14. Ad Group Performance** | Compares cost and conversions across ad groups to suggest budget shifts. |
| **15. Assets / Creative Report** | Details headlines/descriptions performance labels (`BEST`/`GOOD`/`LOW`) inside Responsive Search Ads (RSA). |

---

### 5. Recommendation Taxonomy

The product must generate recommendations categorized into 14 distinct action types:

1. **`ADD_NEGATIVE_KEYWORD`:** Add negative keywords to Campaign or Ad Group.
2. **`ADD_EXACT_KEYWORD`:** Target high-converting queries as Exact Match keywords.
3. **`ADJUST_KEYWORD_BID`:** Tune max CPC bids on individual targeted keywords.
4. **`ADJUST_GEO_BID`:** Increase/decrease location-specific bid modifiers.
5. **`ADJUST_DEVICE_BID`:** Set bid modifiers for Mobile, Desktop, or Tablet.
6. **`EXCLUDE_DEMOGRAPHIC`:** Exclude non-converting age/gender cohorts.
7. **`REPLACE_RSA_ASSET`:** Swap `LOW` performing headline/description copy inside Responsive Search Ads.
8. **`ADJUST_DAILY_BUDGET`:** Raise or lower campaign daily budgets (within the ±20% safety cap).
9. **`ADJUST_BIDDING_STRATEGY_TARGET`:** Adjust Target CPA or Target ROAS.
10. **`ADD_PMAX_PLACEMENT_EXCLUSION`:** Exclude low-quality placements at the Account Level.
11. **`ADJUST_AUDIENCE_BID`:** Apply bid modifiers to target audience lists.
12. **`REDIRECT_LANDING_PAGE`:** Update final URL destinations to higher-converting pages.
13. **`PAUSE_AD_GROUP`:** Stop spending on unprofitable ad groups.
14. **`GENERATE_PMAX_CREATIVE_ASSET`:** Generate new ad assets (images/videos) to populate asset groups.

---

### 6. User Experience & Control Flows

The product must offer a seamless, high-control interactive experience:

#### A. Nightly Sync & Digest Workflow
1. The tool syncs report metrics in the background during off-peak hours.
2. The recommendation engine processes the data and queues suggestions.
3. An email summary containing performance KPIs and a list of new recommendations is sent to the user's Gmail.

#### B. Recommendation Execution Flow
- **Approval Queue:** All suggestions sit in a central dashboard queue.
- **Actions:** The user can click **Approve** (marks for execution), **Dismiss** (hides from active queue), or **Edit** (modifies bid/budget change before approving).
- **Execution Path:** Approved changes are pushed via the API, or in the case of generated creatives, can be downloaded locally for manual upload.

---

### 7. Feature Breakdown & Core Views

The localhost web interface must feature 6 core workspaces:

#### A. Main Dashboard
- Highlights aggregate account metrics (CPA, Conversions, Cost, CTR).
- Displays system status, current daily API operations count, and cache age.
- Shows key anomaly alerts and summary widgets of the pending queue.

#### B. Search & Keywords Audit
- Displays active keywords mapped to actual search terms and competitor auction trends.
- Includes a **Manual CSV Volume Uploader** to import Keyword Planner search volumes.
- Provides a workspace to request AI keyword ideas, map them to volume data, and queue them.

#### C. Creative Studio & Placement Panel
- Displays ad copy headlines/descriptions with performance ratings (`BEST`/`GOOD`/`LOW`).
- Features the **AI Asset Generator** where the user can input prompts to create images (Gemini Imagen 3 / OpenAI DALL-E 3) and videos (Google Veo).
- Offers a dual-action interface to **"Upload to Ads API"** or **"Download Locally"**.
- Identifies PMax placement site/app lists with a one-click button to push exclusions.

#### D. Targeting & Bid Adjustments Workspace
- Displays conversion matrix views across Locations, Devices, Demographics, Audiences, and Scheduling (Hour/Day).
- Suggests bid modifier adjustments based on ROI discrepancies.

#### E. Central Approval Queue
- Lists all pending recommendations across all reports in a sortable, searchable data grid.
- Allows bulk approvals and dismissals.
- Tracks execution status (Pending, Syncing, Applied, Failed).

---

### 8. Functional Agent Requirements

The backend intelligence must be structured as 5 cooperating functional agents:

1. **Analysis & Reporting Agent:** Responsible for fetching raw report streams, computing KPIs, identifying anomalies, and writing the daily performance summaries.
2. **Competitive Research Agent:** Benchmarks competitors using preloaded domains and dynamic domains from Auction Insights. Scrapes Google Search result headers to map market keyword themes.
3. **Recommendation Generator Agent:** Ingests cached data and competitor insights to generate raw draft recommendations mapping to the 14 taxonomy types.
4. **Audit & QA Agent:** Verifies proposed recommendations against strict safety limits (±20% adjustment caps, CPA caps, keyword cannibalization) before queuing them, and audits post-sync API execution success.
5. **Creative Generation Agent:** Formulates copywriting templates and generates ad creatives (images/videos) utilizing Google Cloud Vertex AI (Imagen 3 / Veo) and OpenAI APIs.

---

### 9. Success Criteria & Scope Boundaries

#### In-Scope
- Local performance caching and offline recommendation generation.
- The 14 optimization recommendation types.
- AI creative asset generation (images/videos) with direct Ads upload or local file downloads.
- Nightly synchronization, local reporting UI, and daily Gmail digests.

#### Out-of-Scope (Strictly Excluded)
- **Autonomous Bidding/Execution:** The tool will never make direct changes without manual user click/approval.
- **Off-Platform Keyword Planner Queries:** All keyword volumes must be imported manually via CSV due to Developer Token limits.
- **Multi-Account Support:** Limited to the single configured advertiser account.

---

### 10. Public URL Production Deployment & Security

To support "Proof of Execution" on a live public URL (e.g., Render, Railway, or Google Cloud Run) while maintaining strict advertiser safety:

1. **Basic HTTP Authentication**: Enforced via Express server routing when `BASIC_AUTH_ENABLED` is true. The default access credentials are username `admin` and password `ads-copilot-2026` (configurable in `.env`).
2. **Read-Only Mode Zero-Mutation Safeguard**: Activated via `READ_ONLY_MODE=true`. When enabled, the Audit Agent intercepts all recommendations queued for execution. The dashboard will show the recommendation as successfully "Applied", but the API mutation call will be bypassed, guaranteeing zero risk to live budget spend.
3. **Persistent SQLite Volumes**: The hosting environment must map a persistent disk volume to the backend directory (`/app/backend/data/`) to retain SQL databases, sync logs, and settings across container redeployments.
4. **Integrated React Static Assets**: The Express backend will serve compiled React assets from `frontend/dist` on a single port to eliminate multi-service proxying in production.

---

### 11. Nodemailer SMTP Email Delivery

Due to restrictions on the Google Ads OAuth2 refresh token scope (which lacks direct `gmail.send` API write permissions):
1. **SMTP Delivery Mode**: The system uses `nodemailer` with a 16-character secure Google App Password (`GMAIL_APP_PASSWORD`) and Gmail address (`SMTP_USER`) to transmit daily performance digests.
2. **Fallback Logging**: In the absence of SMTP credentials, the server outputs the full HTML performance digest to the backend console for developer auditing.

