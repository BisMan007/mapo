import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import { db, initializeDatabase } from './db/database';
import { runSyncCycle, initializeScheduler } from './cron';
import { AnalysisAgent } from './agents/analysisAgent';
import { AuditAgent } from './agents/auditAgent';
import { CreativeAgent } from './agents/creativeAgent';
import { CompetitiveAgent } from './agents/competitiveAgent';

const app = express();

app.use(cors());
app.use(express.json());

// 1. Basic HTTP Authentication Gateway
if (config.BASIC_AUTH_ENABLED) {
  app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Google Ads Optimizer Copilot"');
      return res.status(401).send('Authentication required.');
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    if (user === config.ADMIN_USERNAME && pass === config.ADMIN_PASSWORD) {
      return next();
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Google Ads Optimizer Copilot"');
    return res.status(401).send('Invalid credentials.');
  });
}

// 2. Serve static frontend bundle from Vite React build
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// Bootstrapping: DB schema and Cron scheduling
async function bootstrap() {
  try {
    await initializeDatabase();
    
    // Auto-run a mock sync cycle on first boot if database is brand new and has no data
    const hasData = await db.get('SELECT id FROM r_search_keyword LIMIT 1');
    if (!hasData) {
      console.log('No cached report data found. Performing initial boot synchronization...');
      await runSyncCycle();
    }

    initializeScheduler();
  } catch (error) {
    console.error('Bootstrapping failed:', error);
  }
}

// ==========================================
// 0. VERSION CHECK API
// ==========================================
app.get('/api/version', (req, res) => {
  res.json({ version: 'v1.0.1-timeouts' });
});

// ==========================================
// 1. REPORTS & METRICS API
// ==========================================

// Helper to get date range scale factor
function getScaleFactor(range: string | undefined): number {
  if (range === '7d') return 7 / 30;
  if (range === '14d') return 14 / 30;
  return 1.0;
}

// Global aggregate KPIs
app.get('/api/reports/kpis', async (req, res) => {
  const range = req.query.range as string | undefined;
  const scale = getScaleFactor(range);
  try {
    const kpis = await AnalysisAgent.computeGlobalKPIs();
    const syncLog = await db.get('SELECT sync_timestamp FROM report_sync_log ORDER BY id DESC LIMIT 1');
    const lastSyncIso = syncLog?.sync_timestamp ? new Date(syncLog.sync_timestamp.replace(' ', 'T') + 'Z').toISOString() : 'Never';
    res.json({
      clicks: Math.round(kpis.clicks * scale),
      impressions: Math.round(kpis.impressions * scale),
      cost: kpis.cost * scale,
      conversions: Math.round(kpis.conversions * scale),
      ctr: kpis.ctr,
      cpc: kpis.cpc,
      cpa: kpis.cpa,
      last_sync: lastSyncIso
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Anomalies list
app.get('/api/reports/anomalies', async (req, res) => {
  try {
    const anomalies = await AnalysisAgent.detectAnomalies();
    res.json(anomalies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Daily text digest (Markdown)
app.get('/api/reports/digest', async (req, res) => {
  try {
    const md = await AnalysisAgent.generatePerformanceSummaryText();
    res.json({ markdown: md });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sync triggers
app.post('/api/reports/sync', async (req, res) => {
  try {
    const result = await runSyncCycle();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sync history list
app.get('/api/reports/sync-history', async (req, res) => {
  try {
    const history = await db.all('SELECT * FROM report_sync_log ORDER BY id DESC LIMIT 20');
    const formattedHistory = history.map(h => ({
      ...h,
      sync_timestamp: h.sync_timestamp ? new Date(h.sync_timestamp.replace(' ', 'T') + 'Z').toISOString() : h.sync_timestamp
    }));
    res.json(formattedHistory);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Specific reporting cache grids
app.get('/api/reports/data/:type', async (req, res) => {
  const { type } = req.params;
  const range = req.query.range as string | undefined;
  const scale = getScaleFactor(range);
  try {
    let sql = '';
    if (type === 'keywords') sql = 'SELECT * FROM r_search_keyword ORDER BY clicks DESC';
    else if (type === 'search-terms') sql = 'SELECT * FROM r_search_term ORDER BY clicks DESC';
    else if (type === 'locations') sql = 'SELECT * FROM r_location ORDER BY clicks DESC';
    else if (type === 'devices') sql = 'SELECT * FROM r_device ORDER BY clicks DESC';
    else if (type === 'demographics') sql = 'SELECT * FROM r_demographics ORDER BY clicks DESC';
    else if (type === 'landing-pages') sql = 'SELECT * FROM r_landing_page ORDER BY clicks DESC';
    else if (type === 'ad-performance') sql = 'SELECT * FROM r_ad ORDER BY clicks DESC';
    else if (type === 'hour-of-day') sql = 'SELECT * FROM r_hour_of_day ORDER BY hour ASC';
    else if (type === 'day-of-week') sql = 'SELECT * FROM r_day_of_week';
    else if (type === 'pmax-placements') sql = 'SELECT * FROM r_pmax_placement ORDER BY clicks DESC';
    else if (type === 'audiences') sql = 'SELECT * FROM r_audiences ORDER BY clicks DESC';
    else if (type === 'ad-groups') sql = 'SELECT * FROM r_ad_group ORDER BY clicks DESC';
    else if (type === 'creative-assets') sql = 'SELECT * FROM r_assets_creative ORDER BY impressions DESC';
    else return res.status(400).json({ error: `Invalid report type: ${type}` });

    const data = await db.all(sql);
    
    if (scale !== 1.0) {
      const scaledData = data.map(row => {
        const clicks = row.clicks !== undefined ? Math.round(row.clicks * scale) : undefined;
        const impressions = row.impressions !== undefined ? Math.round(row.impressions * scale) : undefined;
        const cost = row.cost !== undefined ? row.cost * scale : undefined;
        const conversions = row.conversions !== undefined ? Math.round(row.conversions * scale) : undefined;
        
        const ctr = (impressions !== undefined && clicks !== undefined && impressions > 0) 
          ? (clicks / impressions) * 100 
          : row.ctr;
        const cpc = (cost !== undefined && clicks !== undefined && clicks > 0) 
          ? cost / clicks 
          : row.cpc;
        const cpa = (cost !== undefined && conversions !== undefined && conversions > 0) 
          ? cost / conversions 
          : row.cpa;

        const updated = { ...row };
        if (clicks !== undefined) updated.clicks = clicks;
        if (impressions !== undefined) updated.impressions = impressions;
        if (cost !== undefined) updated.cost = cost;
        if (conversions !== undefined) updated.conversions = conversions;
        if (ctr !== undefined) updated.ctr = ctr;
        if (cpc !== undefined) updated.cpc = cpc;
        if (cpa !== undefined) updated.cpa = cpa;
        return updated;
      });
      return res.json(scaledData);
    }
    
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Auction insights
app.get('/api/reports/competitors', async (req, res) => {
  try {
    const list = await CompetitiveAgent.getTopCompetitors();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 2. RECOMMENDATIONS QUEUE API
// ==========================================

// Get pending queue
app.get('/api/recommendations', async (req, res) => {
  try {
    const queue = await db.all("SELECT * FROM recommendations WHERE status IN ('PENDING', 'SYNCING', 'FAILED') ORDER BY id DESC");
    res.json(queue);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Approve recommendation
app.post('/api/recommendations/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  try {
    const result = await AuditAgent.applyRecommendation(parseInt(id, 10), notes);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Dismiss recommendation
app.post('/api/recommendations/:id/dismiss', async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  try {
    const success = await AuditAgent.dismissRecommendation(parseInt(id, 10), notes);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Edit recommendation details before approving
app.post('/api/recommendations/:id/edit', async (req, res) => {
  const { id } = req.params;
  const { details, notes } = req.body; // new details JSON
  try {
    const rec = await db.get('SELECT * FROM recommendations WHERE id = ?', [id]);
    if (!rec) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    // Safety Audit the edited parameters
    const draft = {
      campaign_id: rec.campaign_id,
      campaign_name: rec.campaign_name,
      ad_group_id: rec.ad_group_id,
      ad_group_name: rec.ad_group_name,
      type: rec.type,
      details: details
    };

    const audited = await AuditAgent.auditDraftRecommendation(draft);

    // Save update in recommendations
    await db.run(
      'UPDATE recommendations SET details = ?, safety_status = ?, safety_notes = ? WHERE id = ?',
      [JSON.stringify(audited.details), audited.safety_status, audited.safety_notes, id]
    );

    // Add to audit trail log
    await db.run(
      "INSERT INTO audit_trail (recommendation_id, action, user_notes, details_before, details_after) VALUES (?, 'EDIT', ?, ?, ?)",
      [id, notes || 'Edited recommendation parameters', rec.details, JSON.stringify(audited.details)]
    );

    res.json({ success: true, audited });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Audit Trail
app.get('/api/audit-trail', async (req, res) => {
  try {
    const logs = await db.all('SELECT * FROM audit_trail ORDER BY id DESC LIMIT 100');
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. KEYWORD PLANNING WORKSPACE API
// ==========================================

// Manual CSV Keyword Upload
app.post('/api/keywords/upload-csv', async (req, res) => {
  const { keywords } = req.body; // Array of { keyword, volume, intent_score }
  try {
    if (!Array.isArray(keywords)) {
      return res.status(400).json({ error: 'Keywords must be an array.' });
    }

    const now = new Date().toISOString();
    for (const kw of keywords) {
      await db.run(
        `INSERT OR REPLACE INTO keyword_search_volume (keyword, volume, intent_score, source, last_updated)
         VALUES (?, ?, ?, 'CSV_IMPORT', ?)`,
        [kw.keyword.trim().toLowerCase(), kw.volume || 0, kw.intent_score || 0.5, now]
      );
    }

    res.json({ success: true, count: keywords.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// LLM relative volume and intent estimation
app.post('/api/keywords/llm-estimate', async (req, res) => {
  const { keyword } = req.body;
  try {
    const now = new Date().toISOString();
    // Simulate LLM scoring (or use GPT to extract intent category)
    const mockVolume = Math.floor(Math.random() * 5000) + 100;
    const mockIntent = Math.random();

    await db.run(
      `INSERT OR REPLACE INTO keyword_search_volume (keyword, volume, intent_score, source, last_updated)
       VALUES (?, ?, ?, 'LLM_ESTIMATE', ?)`,
      [keyword.trim().toLowerCase(), mockVolume, mockIntent, now]
    );

    res.json({
      keyword,
      volume: mockVolume,
      intent_score: mockIntent,
      source: 'LLM_ESTIMATE'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get search volumes index
app.get('/api/keywords/volumes', async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM keyword_search_volume ORDER BY volume DESC');
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. CREATIVE STUDIO & PLACEMENT API
// ==========================================

// Generate AI creatives
app.post('/api/creative/generate', async (req, res) => {
  const { prompt, type, engine } = req.body; // type: COPY | IMAGE | VIDEO
  try {
    if (type === 'COPY') {
      const copy = await CreativeAgent.generateAdCopy(prompt);
      return res.json({ type, prompt, copy });
    } else {
      const asset = await CreativeAgent.generateVisualAsset(prompt, engine);
      return res.json(asset);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upload creative asset to Google Ads API
app.post('/api/creative/upload', async (req, res) => {
  const { imageUrl, assetName } = req.body;
  try {
    const result = await CreativeAgent.uploadAssetToGoogleAds(imageUrl, assetName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. GLOBAL SETTINGS API
// ==========================================

app.get('/api/settings', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM settings');
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings', async (req, res) => {
  const { settings } = req.body; // array of { key, value }
  try {
    for (const s of settings) {
      await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Fallback Route: Serve React index.html for all non-API client routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// Start listening
const PORT = process.env.PORT || config.PORT;
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Google Ads Optimizer backend server running on http://0.0.0.0:${PORT}`);
  bootstrap();
});
