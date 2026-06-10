import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

// Resolve database path inside backend/data directory
const DATA_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_PATH = path.join(DATA_DIR, 'google_ads_optimizer.db');

const verboseSqlite = sqlite3.verbose();
const dbConnection = new verboseSqlite.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open SQLite database:', err);
  } else {
    console.log(`SQLite database connected at: ${DB_PATH}`);
  }
});

// Helper wrappers for Promises
export const db = {
  run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      dbConnection.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },

  get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      dbConnection.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    });
  },

  all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      dbConnection.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  },

  exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      dbConnection.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

// Migration script to initialize schema
export async function initializeDatabase() {
  console.log('Initializing database schema...');
  
  // Table 1: Sync log
  await db.run(`
    CREATE TABLE IF NOT EXISTS report_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT,
      api_operations_count INTEGER,
      error_message TEXT
    )
  `);

  // Table 2: Recommendations Queue
  await db.run(`
    CREATE TABLE IF NOT EXISTS recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id TEXT,
      campaign_name TEXT,
      ad_group_id TEXT,
      ad_group_name TEXT,
      type TEXT,
      details TEXT, -- JSON payload
      status TEXT DEFAULT 'PENDING', -- PENDING, SYNCING, APPLIED, FAILED, DISMISSED
      safety_status TEXT DEFAULT 'PASSED', -- PASSED, FAILED
      safety_notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      applied_at TEXT,
      error_message TEXT
    )
  `);

  // Table 3: Audit Trail Log
  await db.run(`
    CREATE TABLE IF NOT EXISTS audit_trail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recommendation_id INTEGER,
      action TEXT, -- APPROVE, DISMISS, EDIT, APPLY_SUCCESS, APPLY_FAILED
      user_notes TEXT,
      details_before TEXT, -- JSON payload
      details_after TEXT,  -- JSON payload
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table 4: Competitor Benchmarks
  await db.run(`
    CREATE TABLE IF NOT EXISTS competitor_benchmarks (
      domain_name TEXT PRIMARY KEY,
      source TEXT, -- PRELOADED, AUCTION_INSIGHTS
      impression_share REAL,
      outranking_share REAL,
      last_updated TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table 5: Keyword Search Volume
  await db.run(`
    CREATE TABLE IF NOT EXISTS keyword_search_volume (
      keyword TEXT PRIMARY KEY,
      volume INTEGER,
      intent_score REAL,
      source TEXT, -- CSV_IMPORT, LLM_ESTIMATE
      last_updated TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table 6: Global Settings
  await db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Run one-time drops to migrate old schemas
  await db.run('DROP TABLE IF EXISTS r_search_keyword');
  await db.run('DROP TABLE IF EXISTS r_ad');
  await db.run('DROP TABLE IF EXISTS r_ad_group');
  await db.run('DROP TABLE IF EXISTS r_assets_creative');

  // Report Tables (1 to 15)
  // 1. Search Keyword Performance
  await db.run(`
    CREATE TABLE IF NOT EXISTS r_search_keyword (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      criterion_id TEXT,
      campaign_name TEXT,
      ad_group_name TEXT,
      keyword TEXT,
      match_type TEXT,
      status TEXT,
      impressions INTEGER,
      clicks INTEGER,
      cost REAL,
      conversions REAL,
      cpc REAL,
      ctr REAL,
      quality_score INTEGER,
      timestamp TEXT
    )
  `);

  // 2. Search Term Report
  await db.run(`
    CREATE TABLE IF NOT EXISTS r_search_term (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_name TEXT,
      ad_group_name TEXT,
      query TEXT,
      status TEXT,
      impressions INTEGER,
      clicks INTEGER,
      cost REAL,
      conversions REAL,
      cpc REAL,
      ctr REAL,
      timestamp TEXT
    )
  `);

  // 3. Location Performance
  await db.run(`
    CREATE TABLE IF NOT EXISTS r_location (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_name TEXT,
      campaign_name TEXT,
      impressions INTEGER,
      clicks INTEGER,
      cost REAL,
      conversions REAL,
      timestamp TEXT
    )
  `);

  // 4. Device Report
  await db.run(`
    CREATE TABLE IF NOT EXISTS r_device (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_type TEXT,
      campaign_name TEXT,
      impressions INTEGER,
      clicks INTEGER,
      cost REAL,
      conversions REAL,
      timestamp TEXT
    )
  `);

  // 5. Demographics Report
  await db.run(`
    CREATE TABLE IF NOT EXISTS r_demographics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      age_range TEXT,
      gender TEXT,
      campaign_name TEXT,
      impressions INTEGER,
      clicks INTEGER,
      cost REAL,
      conversions REAL,
      timestamp TEXT
    )
  `);

  // 6. Landing Pages Report
  await db.run(`
    CREATE TABLE IF NOT EXISTS r_landing_page (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT,
      campaign_name TEXT,
      impressions INTEGER,
      clicks INTEGER,
      cost REAL,
      conversions REAL,
      timestamp TEXT
    )
  `);

  // 7. Expanded Landing Pages Report
  await db.run(`
    CREATE TABLE IF NOT EXISTS r_expanded_landing_page (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT,
      redirect_urls TEXT,
      parameters TEXT,
      clicks INTEGER,
      conversions REAL,
      status_code INTEGER,
      timestamp TEXT
    )
  `);

  // 8. Ad Performance
  await db.run(`
    CREATE TABLE IF NOT EXISTS r_ad (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ad_id TEXT,
      ad_type TEXT,
      campaign_name TEXT,
      ad_group_name TEXT,
      headline_text TEXT,
      description_text TEXT,
      status TEXT,
      impressions INTEGER,
      clicks INTEGER,
      cost REAL,
      conversions REAL,
      timestamp TEXT
    )
  `);

  // 9. Auction Insights
  await db.run(`
    CREATE TABLE IF NOT EXISTS r_auction_insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain_name TEXT,
      campaign_name TEXT,
      impression_share REAL,
      overlap_rate REAL,
      outranking_share REAL,
      timestamp TEXT
    )
  `);

  // 10. Hour of Day Performance
  await db.run(`
    CREATE TABLE IF NOT EXISTS r_hour_of_day (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hour INTEGER,
      campaign_name TEXT,
      impressions INTEGER,
      clicks INTEGER,
      cost REAL,
      conversions REAL,
      timestamp TEXT
    )
  `);

  // 11. Day of Week Performance
  await db.run(`
    CREATE TABLE IF NOT EXISTS r_day_of_week (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT,
      campaign_name TEXT,
      impressions INTEGER,
      clicks INTEGER,
      cost REAL,
      conversions REAL,
      timestamp TEXT
    )
  `);

  // 12. Performance Max Placement
  await db.run(`
    CREATE TABLE IF NOT EXISTS r_pmax_placement (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      placement_name TEXT,
      url TEXT,
      impressions INTEGER,
      clicks INTEGER,
      cost REAL,
      conversions REAL,
      timestamp TEXT
    )
  `);

  // 13. Audiences Report
  await db.run(`
    CREATE TABLE IF NOT EXISTS r_audiences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audience_segment TEXT,
      campaign_name TEXT,
      impressions INTEGER,
      clicks INTEGER,
      cost REAL,
      conversions REAL,
      timestamp TEXT
    )
  `);

  // 14. Ad Group Performance
  await db.run(`
    CREATE TABLE IF NOT EXISTS r_ad_group (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ad_group_id TEXT,
      ad_group_name TEXT,
      campaign_name TEXT,
      impressions INTEGER,
      clicks INTEGER,
      cost REAL,
      conversions REAL,
      status TEXT,
      timestamp TEXT
    )
  `);

  // 15. Assets / Creative Report
  await db.run(`
    CREATE TABLE IF NOT EXISTS r_assets_creative (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id TEXT,
      type TEXT, -- HEADLINE, DESCRIPTION, IMAGE, VIDEO
      asset_content TEXT, -- text or URL
      rating TEXT, -- BEST, GOOD, LOW, UNKNOWN
      campaign_name TEXT,
      ad_group_name TEXT,
      impressions INTEGER,
      clicks INTEGER,
      cost REAL,
      conversions REAL,
      timestamp TEXT
    )
  `);

  // Default settings
  await db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('global_cpa_cap', '50.0')`);
  await db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('budget_threshold_percentage', '20.0')`);
  await db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('bid_threshold_percentage', '20.0')`);

  console.log('Database schema initialization completed.');
}
