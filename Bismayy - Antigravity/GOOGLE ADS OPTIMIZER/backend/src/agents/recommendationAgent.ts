import { db } from '../db/database';
import { AuditAgent } from './auditAgent';

export interface DraftRecommendation {
  campaign_id: string;
  campaign_name: string;
  ad_group_id: string;
  ad_group_name: string;
  type: string;
  details: any; // JSON payload
}

export class RecommendationAgent {
  /**
   * Generates draft recommendations across all 14 taxonomy types based on SQLite performance report caches.
   */
  static async generateRecommendations(): Promise<number> {
    console.log('[Recommendation Agent] Scanning report metrics to generate draft recommendations...');
    
    // Clear out any old pending recommendations to avoid duplicates in the queue
    await db.exec("DELETE FROM recommendations WHERE status = 'PENDING'");

    const drafts: DraftRecommendation[] = [];

    // Get average CPA from settings (or default to 50)
    const cpaCapRow = await db.get("SELECT value FROM settings WHERE key = 'global_cpa_cap'");
    const cpaThreshold = parseFloat(cpaCapRow?.value || '50.0');

    // Fetch campaigns and average metrics
    const campaignStats = await db.all(`
      SELECT campaign_name, SUM(cost) as cost, SUM(conversions) as conversions 
      FROM r_ad_group 
      GROUP BY campaign_name
    `);

    // 1. ADD_NEGATIVE_KEYWORD & 2. ADD_EXACT_KEYWORD (from Search Term Report)
    const searchTerms = await db.all('SELECT * FROM r_search_term');
    for (const term of searchTerms) {
      if (term.conversions === 0 && term.cost > 25.0) {
        drafts.push({
          campaign_id: 'c1',
          campaign_name: term.campaign_name,
          ad_group_id: 'ag1',
          ad_group_name: term.ad_group_name,
          type: 'ADD_NEGATIVE_KEYWORD',
          details: {
            keyword: term.query,
            match_type: 'NEGATIVE_EXACT',
            reason: `Zero conversions with $${term.cost.toFixed(2)} spend.`
          }
        });
      } else if (term.conversions >= 5 && term.clicks > 15) {
        // High converting search query - target directly
        drafts.push({
          campaign_id: 'c1',
          campaign_name: term.campaign_name,
          ad_group_id: 'ag1',
          ad_group_name: term.ad_group_name,
          type: 'ADD_EXACT_KEYWORD',
          details: {
            keyword: term.query,
            match_type: 'EXACT',
            suggested_bid: term.cpc * 1.05,
            reason: `High conversion performance (${term.conversions} conversions).`
          }
        });
      }
    }

    // 3. ADJUST_KEYWORD_BID
    const keywords = await db.all('SELECT * FROM r_search_keyword');
    for (const kw of keywords) {
      const kwCpa = kw.conversions > 0 ? kw.cost / kw.conversions : kw.cost;
      if (kw.conversions > 2 && kwCpa < cpaThreshold * 0.7) {
        // High performer with low CPA, increase bid by 10% (safe)
        drafts.push({
          campaign_id: 'c1',
          campaign_name: kw.campaign_name,
          ad_group_id: 'ag1',
          ad_group_name: kw.ad_group_name,
          type: 'ADJUST_KEYWORD_BID',
          details: {
            criterion_id: kw.criterion_id,
            keyword: kw.keyword,
            current_bid: kw.cpc,
            suggested_bid: kw.cpc * 1.10,
            adjustment_percentage: 10,
            reason: `Excellent CPA of $${kwCpa.toFixed(2)} (well below target CPA cap of $${cpaThreshold.toFixed(2)}).`
          }
        });
      } else if (kw.conversions === 0 && kw.cost > 40.0) {
        // Zero conversions, decrease bid by 15% (safe)
        drafts.push({
          campaign_id: 'c1',
          campaign_name: kw.campaign_name,
          ad_group_id: 'ag1',
          ad_group_name: kw.ad_group_name,
          type: 'ADJUST_KEYWORD_BID',
          details: {
            criterion_id: kw.criterion_id,
            keyword: kw.keyword,
            current_bid: kw.cpc,
            suggested_bid: kw.cpc * 0.85,
            adjustment_percentage: -15,
            reason: `Inefficient spend of $${kw.cost.toFixed(2)} without conversions.`
          }
        });
      }
    }

    // 4. ADJUST_GEO_BID
    const geos = await db.all('SELECT * FROM r_location');
    for (const geo of geos) {
      const geoCpa = geo.conversions > 0 ? geo.cost / geo.conversions : geo.cost;
      if (geo.conversions === 0 && geo.cost > 100.0) {
        drafts.push({
          campaign_id: 'c1',
          campaign_name: geo.campaign_name,
          ad_group_id: '',
          ad_group_name: '',
          type: 'ADJUST_GEO_BID',
          details: {
            location_name: geo.location_name,
            current_modifier: 0,
            suggested_modifier: -15,
            reason: `High location spend of $${geo.cost.toFixed(2)} with no conversions.`
          }
        });
      } else if (geo.conversions >= 10 && geoCpa < cpaThreshold * 0.8) {
        drafts.push({
          campaign_id: 'c1',
          campaign_name: geo.campaign_name,
          ad_group_id: '',
          ad_group_name: '',
          type: 'ADJUST_GEO_BID',
          details: {
            location_name: geo.location_name,
            current_modifier: 0,
            suggested_modifier: 10,
            reason: `Highly profitable region. Average CPA is $${geoCpa.toFixed(2)}.`
          }
        });
      }
    }

    // 5. ADJUST_DEVICE_BID
    const devices = await db.all('SELECT * FROM r_device');
    for (const d of devices) {
      const dCpa = d.conversions > 0 ? d.cost / d.conversions : d.cost;
      if (d.device_type === 'MOBILE' && dCpa > cpaThreshold * 1.5) {
        drafts.push({
          campaign_id: 'c1',
          campaign_name: d.campaign_name,
          ad_group_id: '',
          ad_group_name: '',
          type: 'ADJUST_DEVICE_BID',
          details: {
            device: 'MOBILE',
            current_modifier: 0,
            suggested_modifier: -15,
            reason: `Mobile CPA of $${dCpa.toFixed(2)} is substantially higher than standard cap.`
          }
        });
      }
    }

    // 6. EXCLUDE_DEMOGRAPHIC
    const demos = await db.all('SELECT * FROM r_demographics');
    for (const dem of demos) {
      if (dem.conversions === 0 && dem.cost > 50.0 && dem.age_range.includes('18_24')) {
        drafts.push({
          campaign_id: 'c1',
          campaign_name: dem.campaign_name,
          ad_group_id: '',
          ad_group_name: '',
          type: 'EXCLUDE_DEMOGRAPHIC',
          details: {
            age_range: dem.age_range,
            gender: dem.gender,
            reason: `Demographic segment 18-24 has accumulated $${dem.cost.toFixed(2)} in wasteful clicks.`
          }
        });
      }
    }

    // 7. REPLACE_RSA_ASSET
    const assets = await db.all("SELECT * FROM r_assets_creative WHERE rating = 'LOW'");
    for (const as of assets) {
      drafts.push({
        campaign_id: 'c1',
        campaign_name: as.campaign_name,
        ad_group_id: 'ag1',
        ad_group_name: as.ad_group_name,
        type: 'REPLACE_RSA_ASSET',
        details: {
          asset_id: as.asset_id,
          current_text: as.asset_content,
          type: as.type,
          reason: `Ad creative rating listed as 'LOW' performance asset by Google Ads.`
        }
      });
    }

    // 8. ADJUST_DAILY_BUDGET
    for (const c of campaignStats) {
      const avgCpa = c.conversions > 0 ? c.cost / c.conversions : c.cost;
      if (c.conversions > 10 && avgCpa < cpaThreshold * 0.8) {
        // Highly efficient campaign, suggest budget increase (+15%)
        drafts.push({
          campaign_id: 'c1',
          campaign_name: c.campaign_name,
          ad_group_id: '',
          ad_group_name: '',
          type: 'ADJUST_DAILY_BUDGET',
          details: {
            current_budget: 100.0,
            suggested_budget: 115.0,
            adjustment_percentage: 15,
            reason: `Campaign is conversion-rich at a low CPA ($${avgCpa.toFixed(2)}).`
          }
        });
      }
    }

    // 9. ADJUST_BIDDING_STRATEGY_TARGET
    for (const c of campaignStats) {
      const avgCpa = c.conversions > 0 ? c.cost / c.conversions : c.cost;
      if (avgCpa > cpaThreshold * 1.3) {
        // High CPA, recommend lowering target CPA to force bid throttling
        drafts.push({
          campaign_id: 'c1',
          campaign_name: c.campaign_name,
          ad_group_id: '',
          ad_group_name: '',
          type: 'ADJUST_BIDDING_STRATEGY_TARGET',
          details: {
            strategy_type: 'TARGET_CPA',
            current_target: avgCpa,
            suggested_target: cpaThreshold,
            reason: `Campaign average CPA ($${avgCpa.toFixed(2)}) is exceeding target threshold.`
          }
        });
      }
    }

    // 10. ADD_PMAX_PLACEMENT_EXCLUSION
    const placements = await db.all('SELECT * FROM r_pmax_placement');
    for (const p of placements) {
      if (p.conversions === 0 && p.cost > 40.0 && (p.placement_name.includes('.apk') || p.placement_name.includes('app'))) {
        drafts.push({
          campaign_id: 'pmax',
          campaign_name: 'Performance Max - Main',
          ad_group_id: '',
          ad_group_name: '',
          type: 'ADD_PMAX_PLACEMENT_EXCLUSION',
          details: {
            placement: p.placement_name,
            reason: `Junk mobile app placement spent $${p.cost.toFixed(2)} with no conversions.`
          }
        });
      }
    }

    // 11. ADJUST_AUDIENCE_BID
    const audiences = await db.all('SELECT * FROM r_audiences');
    for (const aud of audiences) {
      const audCpa = aud.conversions > 0 ? aud.cost / aud.conversions : aud.cost;
      if (aud.conversions === 0 && aud.cost > 60.0) {
        drafts.push({
          campaign_id: 'c1',
          campaign_name: aud.campaign_name,
          ad_group_id: '',
          ad_group_name: '',
          type: 'ADJUST_AUDIENCE_BID',
          details: {
            audience_segment: aud.audience_segment,
            current_modifier: 0,
            suggested_modifier: -10,
            reason: `Audience segment accumulated $${aud.cost.toFixed(2)} with no conversions.`
          }
        });
      }
    }

    // 12. REDIRECT_LANDING_PAGE
    const landingPages = await db.all('SELECT * FROM r_landing_page');
    for (const lp of landingPages) {
      if (lp.conversions === 0 && lp.cost > 150.0 && lp.url.includes('broken')) {
        drafts.push({
          campaign_id: 'c1',
          campaign_name: lp.campaign_name,
          ad_group_id: '',
          ad_group_name: '',
          type: 'REDIRECT_LANDING_PAGE',
          details: {
            current_url: lp.url,
            suggested_url: 'https://example.com/pricing',
            reason: `Landing URL "${lp.url}" spent $${lp.cost.toFixed(2)} with 0 conversions. Redirecting to high-converting URL is recommended.`
          }
        });
      }
    }

    // 13. PAUSE_AD_GROUP
    const adGroups = await db.all('SELECT * FROM r_ad_group');
    for (const ag of adGroups) {
      if (ag.conversions === 0 && ag.cost > 300.0) {
        drafts.push({
          campaign_id: ag.ad_group_id,
          campaign_name: ag.campaign_name,
          ad_group_id: ag.ad_group_id,
          ad_group_name: ag.ad_group_name,
          type: 'PAUSE_AD_GROUP',
          details: {
            reason: `Ad Group "${ag.ad_group_name}" spent $${ag.cost.toFixed(2)} with 0 conversions.`
          }
        });
      }
    }

    // 14. GENERATE_PMAX_CREATIVE_ASSET
    const hasPmaxPlacements = await db.get('SELECT COUNT(*) as count FROM r_pmax_placement');
    const pmaxCampaign = await db.get(`
      SELECT campaign_name FROM r_device 
      WHERE campaign_name LIKE '%pmax%' OR campaign_name LIKE '%performance max%'
      LIMIT 1
    `);
    const hasPmax = (hasPmaxPlacements?.count || 0) > 0 || !!pmaxCampaign;

    if (hasPmax) {
      drafts.push({
        campaign_id: 'pmax',
        campaign_name: pmaxCampaign?.campaign_name || 'Performance Max - Main',
        ad_group_id: '',
        ad_group_name: '',
        type: 'GENERATE_PMAX_CREATIVE_ASSET',
        details: {
          asset_group_name: 'All Product Creative',
          required_type: 'IMAGE',
          size: '1200x628',
          reason: 'Requires fresh image creatives to populate PMax campaign inventory and improve creative strength.'
        }
      });
    }


    // Run each draft recommendation through the Audit Agent for safety checks
    let queuedCount = 0;
    for (const draft of drafts) {
      const audited = await AuditAgent.auditDraftRecommendation(draft);
      
      // Store in recommendations queue
      await db.run(
        `INSERT INTO recommendations (campaign_id, campaign_name, ad_group_id, ad_group_name, type, details, safety_status, safety_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          audited.campaign_id,
          audited.campaign_name,
          audited.ad_group_id,
          audited.ad_group_name,
          audited.type,
          JSON.stringify(audited.details),
          audited.safety_status,
          audited.safety_notes
        ]
      );
      queuedCount++;
    }

    console.log(`[Recommendation Agent] Added ${queuedCount} recommendations to the queue.`);
    return queuedCount;
  }
}
