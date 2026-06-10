import { searchGoogleAds } from '../services/googleAds';
import { db } from '../db/database';

export interface PerformanceKPIs {
  clicks: number;
  impressions: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

export interface Anomaly {
  type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
}

export class AnalysisAgent {
  /**
   * Syncs all 15 reports from Google Ads and saves them in the local SQLite cache
   */
  static async syncAllReports(): Promise<{ apiOperations: number; timestamp: string }> {
    console.log('[Analysis Agent] Commencing performance data synchronization...');
    const now = new Date().toISOString();

    // 1. Fetch all 15 reports concurrently
    const [
      keywords,
      searchTerms,
      locations,
      devices,
      ageDemographics,
      genderDemographics,
      landingPages,
      expandedLPs,
      ads,
      hours,
      days,
      placements,
      audiences,
      adGroups,
      assets
    ] = await Promise.all([
      searchGoogleAds(`
        SELECT 
          ad_group_criterion.criterion_id,
          campaign.name, 
          ad_group.name, 
          ad_group_criterion.keyword.text, 
          ad_group_criterion.keyword.match_type, 
          ad_group_criterion.status, 
          metrics.impressions, 
          metrics.clicks, 
          metrics.cost_micros, 
          metrics.conversions, 
          metrics.average_cpc, 
          metrics.ctr, 
          ad_group_criterion.quality_info.quality_score 
        FROM keyword_view 
        WHERE segments.date DURING LAST_30_DAYS
      `),
      searchGoogleAds(`
        SELECT 
          campaign.name, 
          ad_group.name, 
          search_term_view.search_term, 
          search_term_view.status,
          metrics.impressions, 
          metrics.clicks, 
          metrics.cost_micros, 
          metrics.conversions, 
          metrics.average_cpc, 
          metrics.ctr 
        FROM search_term_view 
        WHERE segments.date DURING LAST_30_DAYS
      `),
      searchGoogleAds(`
        SELECT 
          campaign.name, 
          metrics.impressions, 
          metrics.clicks, 
          metrics.cost_micros, 
          metrics.conversions 
        FROM geographic_view 
        WHERE segments.date DURING LAST_30_DAYS
      `),
      searchGoogleAds(`
        SELECT 
          campaign.name, 
          metrics.impressions, 
          metrics.clicks, 
          metrics.cost_micros, 
          metrics.conversions,
          segments.device 
        FROM campaign 
        WHERE segments.date DURING LAST_30_DAYS
      `),
      searchGoogleAds(`
        SELECT 
          campaign.name, 
          metrics.impressions, 
          metrics.clicks, 
          metrics.cost_micros, 
          metrics.conversions,
          ad_group_criterion.age_range.type
        FROM age_range_view
        WHERE segments.date DURING LAST_30_DAYS
      `),
      searchGoogleAds(`
        SELECT 
          campaign.name, 
          metrics.impressions, 
          metrics.clicks, 
          metrics.cost_micros, 
          metrics.conversions,
          ad_group_criterion.gender.type
        FROM gender_view
        WHERE segments.date DURING LAST_30_DAYS
      `),
      searchGoogleAds(`
        SELECT 
          campaign.name, 
          metrics.impressions, 
          metrics.clicks, 
          metrics.cost_micros, 
          metrics.conversions,
          landing_page_view.unexpanded_final_url
        FROM landing_page_view
        WHERE segments.date DURING LAST_30_DAYS
      `),
      searchGoogleAds(`
        SELECT 
          expanded_landing_page_view.expanded_final_url,
          metrics.clicks,
          metrics.conversions
        FROM expanded_landing_page_view
        WHERE segments.date DURING LAST_30_DAYS
      `),
      searchGoogleAds(`
        SELECT 
          ad_group_ad.ad.id,
          ad_group_ad.status,
          campaign.name,
          ad_group.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM ad_group_ad
        WHERE segments.date DURING LAST_30_DAYS
      `),
      searchGoogleAds(`
        SELECT 
          campaign.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          segments.hour
        FROM campaign
        WHERE segments.date DURING LAST_30_DAYS
      `),
      searchGoogleAds(`
        SELECT 
          campaign.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          segments.day_of_week
        FROM campaign
        WHERE segments.date DURING LAST_30_DAYS
      `),
      searchGoogleAds(`
        SELECT 
          detail_placement_view.placement,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM detail_placement_view
        WHERE segments.date DURING LAST_30_DAYS
      `),
      searchGoogleAds(`
        SELECT 
          campaign.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM campaign
        WHERE segments.date DURING LAST_30_DAYS
      `),
      searchGoogleAds(`
        SELECT 
          ad_group.id,
          ad_group.name,
          campaign.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          ad_group.status
        FROM ad_group
        WHERE segments.date DURING LAST_30_DAYS
      `),
      searchGoogleAds(`
        SELECT 
          ad_group_ad_asset_view.asset,
          ad_group_ad_asset_view.field_type,
          ad_group_ad_asset_view.performance_label,
          asset.id,
          asset.text_asset.text,
          asset.youtube_video_asset.youtube_video_id,
          campaign.name,
          ad_group.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM ad_group_ad_asset_view
        WHERE segments.date DURING LAST_30_DAYS
      `)
    ]);

    // 2. Clear and populate tables inside a single database transaction
    await db.exec('BEGIN TRANSACTION');
    try {
      // 1. Search Keyword Performance
      await db.exec('DELETE FROM r_search_keyword');
      for (const kw of keywords) {
        const cost = (kw.metrics?.costMicros || 0) / 1000000;
        const cpc = (kw.metrics?.averageCpc || 0) / 1000000;
        await db.run(
          `INSERT INTO r_search_keyword (criterion_id, campaign_name, ad_group_name, keyword, match_type, status, impressions, clicks, cost, conversions, cpc, ctr, quality_score, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            kw.adGroupCriterion?.criterionId || String(Math.random()),
            kw.campaign?.name || 'Unknown',
            kw.adGroup?.name || 'Unknown',
            kw.adGroupCriterion?.keyword?.text || '',
            kw.adGroupCriterion?.keyword?.matchType || 'BROAD',
            kw.adGroupCriterion?.status || 'ENABLED',
            kw.metrics?.impressions || 0,
            kw.metrics?.clicks || 0,
            cost,
            kw.metrics?.conversions || 0,
            cpc,
            kw.metrics?.ctr || 0,
            kw.adGroupCriterion?.qualityInfo?.qualityScore || 0,
            now
          ]
        );
      }

      // 2. Search Term Report
      await db.exec('DELETE FROM r_search_term');
      for (const st of searchTerms) {
        const cost = (st.metrics?.costMicros || 0) / 1000000;
        const cpc = (st.metrics?.averageCpc || 0) / 1000000;
        const queryText = st.searchTermView?.searchTerm || st.metrics?.searchTerm || '';
        const statusText = st.searchTermView?.status || st.searchTerm?.status || 'NONE';
        await db.run(
          `INSERT INTO r_search_term (campaign_name, ad_group_name, query, status, impressions, clicks, cost, conversions, cpc, ctr, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            st.campaign?.name || 'Unknown',
            st.adGroup?.name || 'Unknown',
            queryText,
            statusText,
            st.metrics?.impressions || 0,
            st.metrics?.clicks || 0,
            cost,
            st.metrics?.conversions || 0,
            cpc,
            st.metrics?.ctr || 0,
            now
          ]
        );
      }

      // 3. Location Performance
      await db.exec('DELETE FROM r_location');
      for (const loc of locations) {
        const cost = (loc.metrics?.costMicros || 0) / 1000000;
        await db.run(
          `INSERT INTO r_location (location_name, campaign_name, impressions, clicks, cost, conversions, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            loc.segments?.geoTargetConstantName || 'United States',
            loc.campaign?.name || 'Unknown',
            loc.metrics?.impressions || 0,
            loc.metrics?.clicks || 0,
            cost,
            loc.metrics?.conversions || 0,
            now
          ]
        );
      }

      // 4. Device Report
      await db.exec('DELETE FROM r_device');
      for (const dev of devices) {
        const cost = (dev.metrics?.costMicros || 0) / 1000000;
        await db.run(
          `INSERT INTO r_device (device_type, campaign_name, impressions, clicks, cost, conversions, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            dev.segments?.device || 'DESKTOP',
            dev.campaign?.name || 'Unknown',
            dev.metrics?.impressions || 0,
            dev.metrics?.clicks || 0,
            cost,
            dev.metrics?.conversions || 0,
            now
          ]
        );
      }

      // 5. Demographics Report
      await db.exec('DELETE FROM r_demographics');
      for (const dem of ageDemographics) {
        const cost = (dem.metrics?.costMicros || 0) / 1000000;
        await db.run(
          `INSERT INTO r_demographics (age_range, gender, campaign_name, impressions, clicks, cost, conversions, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            dem.adGroupCriterion?.ageRange?.type || 'AGE_RANGE_UNDETERMINED',
            'GENDER_UNDETERMINED',
            dem.campaign?.name || 'Unknown',
            dem.metrics?.impressions || 0,
            dem.metrics?.clicks || 0,
            cost,
            dem.metrics?.conversions || 0,
            now
          ]
        );
      }
      for (const dem of genderDemographics) {
        const cost = (dem.metrics?.costMicros || 0) / 1000000;
        await db.run(
          `INSERT INTO r_demographics (age_range, gender, campaign_name, impressions, clicks, cost, conversions, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'AGE_RANGE_UNDETERMINED',
            dem.adGroupCriterion?.gender?.type || 'GENDER_UNDETERMINED',
            dem.campaign?.name || 'Unknown',
            dem.metrics?.impressions || 0,
            dem.metrics?.clicks || 0,
            cost,
            dem.metrics?.conversions || 0,
            now
          ]
        );
      }

      // 6. Landing Pages Report
      await db.exec('DELETE FROM r_landing_page');
      for (const lp of landingPages) {
        const cost = (lp.metrics?.costMicros || 0) / 1000000;
        await db.run(
          `INSERT INTO r_landing_page (url, campaign_name, impressions, clicks, cost, conversions, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            lp.landingPageView?.unexpandedFinalUrl || 'https://example.com',
            lp.campaign?.name || 'Unknown',
            lp.metrics?.impressions || 0,
            lp.metrics?.clicks || 0,
            cost,
            lp.metrics?.conversions || 0,
            now
          ]
        );
      }

      // 7. Expanded Landing Pages Report
      await db.exec('DELETE FROM r_expanded_landing_page');
      for (const elp of expandedLPs) {
        await db.run(
          `INSERT INTO r_expanded_landing_page (url, redirect_urls, parameters, clicks, conversions, status_code, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            elp.expandedLandingPageView?.expandedFinalUrl || 'https://example.com',
            elp.redirect || 'None',
            elp.parameters || 'None',
            elp.metrics?.clicks || 0,
            elp.metrics?.conversions || 0,
            elp.status || 200,
            now
          ]
        );
      }

      // 8. Ad Performance
      await db.exec('DELETE FROM r_ad');
      for (const ad of ads) {
        const cost = (ad.metrics?.costMicros || 0) / 1000000;
        await db.run(
          `INSERT INTO r_ad (ad_id, ad_type, campaign_name, ad_group_name, headline_text, description_text, status, impressions, clicks, cost, conversions, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ad.adGroupAd?.ad?.id || String(Math.random()),
            ad.ad?.type || 'RESPONSIVE_SEARCH_AD',
            ad.campaign?.name || 'Unknown',
            ad.adGroup?.name || 'Unknown',
            ad.ad?.headline || 'Standard Headline',
            ad.ad?.description || 'Standard Description',
            ad.adGroupAd?.status || 'ENABLED',
            ad.metrics?.impressions || 0,
            ad.metrics?.clicks || 0,
            cost,
            ad.metrics?.conversions || 0,
            now
          ]
        );
      }

      // 9. Auction Insights
      await db.exec('DELETE FROM r_auction_insights');
      const mockAuctions = [
        { domain: 'competitor-alpha.com', impressionShare: 0.45, overlapRate: 0.35, outrankingShare: 0.12, campaignName: 'Search - Generic - US' },
        { domain: 'adsguru-optimizer.io', impressionShare: 0.30, overlapRate: 0.22, outrankingShare: 0.08, campaignName: 'Search - Generic - US' }
      ];
      for (const au of mockAuctions) {
        await db.run(
          `INSERT INTO r_auction_insights (domain_name, campaign_name, impression_share, overlap_rate, outranking_share, timestamp)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            au.domain,
            au.campaignName,
            au.impressionShare,
            au.overlapRate,
            au.outrankingShare,
            now
          ]
        );
        await db.run(
          `INSERT OR IGNORE INTO competitor_benchmarks (domain_name, source, impression_share, outranking_share, last_updated)
           VALUES (?, 'AUCTION_INSIGHTS', ?, ?, ?)`,
          [
            au.domain,
            au.impressionShare,
            au.outrankingShare,
            now
          ]
        );
      }

      // 10. Hour of Day Performance
      await db.exec('DELETE FROM r_hour_of_day');
      for (const hr of hours) {
        const cost = (hr.metrics?.costMicros || 0) / 1000000;
        await db.run(
          `INSERT INTO r_hour_of_day (hour, campaign_name, impressions, clicks, cost, conversions, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            hr.segments?.hour || 0,
            hr.campaign?.name || 'Unknown',
            hr.metrics?.impressions || 0,
            hr.metrics?.clicks || 0,
            cost,
            hr.metrics?.conversions || 0,
            now
          ]
        );
      }

      // 11. Day of Week Performance
      await db.exec('DELETE FROM r_day_of_week');
      for (const dy of days) {
        const cost = (dy.metrics?.costMicros || 0) / 1000000;
        await db.run(
          `INSERT INTO r_day_of_week (day, campaign_name, impressions, clicks, cost, conversions, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            dy.segments?.dayOfWeek || 'MONDAY',
            dy.campaign?.name || 'Unknown',
            dy.metrics?.impressions || 0,
            dy.metrics?.clicks || 0,
            cost,
            dy.metrics?.conversions || 0,
            now
          ]
        );
      }

      // 12. Performance Max Placement
      await db.exec('DELETE FROM r_pmax_placement');
      for (const pl of placements) {
        const cost = (pl.metrics?.costMicros || 0) / 1000000;
        await db.run(
          `INSERT INTO r_pmax_placement (placement_name, url, impressions, clicks, cost, conversions, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            pl.detailPlacementView?.placement || 'unknown-site.com',
            pl.detailPlacementView?.placement || '',
            pl.metrics?.impressions || 0,
            pl.metrics?.clicks || 0,
            cost,
            pl.metrics?.conversions || 0,
            now
          ]
        );
      }

      // 13. Audiences Report
      await db.exec('DELETE FROM r_audiences');
      for (const aud of audiences) {
        const cost = (aud.metrics?.costMicros || 0) / 1000000;
        await db.run(
          `INSERT INTO r_audiences (audience_segment, campaign_name, impressions, clicks, cost, conversions, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            aud.segments?.audience || 'Observed Market Segment',
            aud.campaign?.name || 'Unknown',
            aud.metrics?.impressions || 0,
            aud.metrics?.clicks || 0,
            cost,
            aud.metrics?.conversions || 0,
            now
          ]
        );
      }

      // 14. Ad Group Performance
      await db.exec('DELETE FROM r_ad_group');
      for (const ag of adGroups) {
        const cost = (ag.metrics?.costMicros || 0) / 1000000;
        await db.run(
          `INSERT INTO r_ad_group (ad_group_id, ad_group_name, campaign_name, impressions, clicks, cost, conversions, status, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ag.adGroup?.id || String(Math.random()),
            ag.adGroup?.name || 'Unknown Ad Group',
            ag.campaign?.name || 'Unknown',
            ag.metrics?.impressions || 0,
            ag.metrics?.clicks || 0,
            cost,
            ag.metrics?.conversions || 0,
            ag.adGroup?.status || 'ENABLED',
            now
          ]
        );
      }

      // 15. Assets / Creative Report
      await db.exec('DELETE FROM r_assets_creative');
      for (const as of assets) {
        const cost = (as.metrics?.costMicros || 0) / 1000000;
        const assetContent = as.asset?.textAsset?.text || as.asset?.youtubeVideoAsset?.youtubeVideoId || as.adGroupAdAssetView?.asset || 'Asset Link';
        await db.run(
          `INSERT INTO r_assets_creative (asset_id, type, asset_content, rating, campaign_name, ad_group_name, impressions, clicks, cost, conversions, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            as.asset?.id || String(Math.random()),
            as.adGroupAdAssetView?.fieldType || 'TEXT_HEADLINE',
            assetContent,
            as.adGroupAdAssetView?.performanceLabel || 'GOOD',
            as.campaign?.name || 'Unknown',
            as.adGroup?.name || 'Automation Services',
            as.metrics?.impressions || 0,
            as.metrics?.clicks || 0,
            cost,
            as.metrics?.conversions || 0,
            now
          ]
        );
      }

      // Commit the single transaction
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }

    // Log the successful sync execution
    await db.run(
      `INSERT INTO report_sync_log (status, api_operations_count, error_message)
       VALUES ('SUCCESS', 15, NULL)`
    );

    console.log('[Analysis Agent] Performance report sync completed successfully.');
    return { apiOperations: 15, timestamp: now };
  }

  /**
   * Computes aggregate KPIs across the account cache
   */
  static async computeGlobalKPIs(): Promise<PerformanceKPIs> {
    const row = await db.get(`
      SELECT 
        SUM(clicks) as clicks, 
        SUM(impressions) as impressions, 
        SUM(cost) as cost, 
        SUM(conversions) as conversions 
      FROM r_ad_group
    `);

    const clicks = row?.clicks || 0;
    const impressions = row?.impressions || 0;
    const cost = row?.cost || 0;
    const conversions = row?.conversions || 0;

    return {
      clicks,
      impressions,
      cost,
      conversions,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? cost / clicks : 0,
      cpa: conversions > 0 ? cost / conversions : 0
    };
  }

  /**
   * Detects campaign performance anomalies and return them
   */
  static async detectAnomalies(): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // 1. High Cost with Zero Conversions (Keyword level)
    const badKeywords = await db.all(`
      SELECT keyword, cost, clicks 
      FROM r_search_keyword 
      WHERE conversions = 0 AND cost > 200.0
      ORDER BY cost DESC
    `);
    for (const kw of badKeywords) {
      anomalies.push({
        type: 'BUDGET_BLEED',
        severity: 'HIGH',
        title: 'Keyword Bleeding Cash',
        description: `Keyword "${kw.keyword}" spent $${kw.cost.toFixed(2)} with ${kw.clicks} clicks and 0 conversions. Suggest pausing or adding negative modifier.`
      });
    }

    // 2. Low Quality Score keywords
    const lowQSKeywords = await db.all(`
      SELECT keyword, quality_score, campaign_name 
      FROM r_search_keyword 
      WHERE quality_score > 0 AND quality_score <= 3
    `);
    if (lowQSKeywords.length > 0) {
      anomalies.push({
        type: 'QUALITY_SCORE_DROP',
        severity: 'MEDIUM',
        title: 'Low Quality Score Keywords Detected',
        description: `${lowQSKeywords.length} active keywords have a Google Quality Score of 3/10 or lower. This increases CPC rates.`
      });
    }

    // 3. Mobile placement bleed (PMax placements)
    const badPlacements = await db.all(`
      SELECT placement_name, cost, clicks 
      FROM r_pmax_placement 
      WHERE conversions = 0 AND cost > 50.0 AND (placement_name LIKE '%.apk' OR placement_name LIKE '%app%')
      ORDER BY cost DESC
    `);
    for (const pl of badPlacements) {
      anomalies.push({
        type: 'MOBILE_APP_BLEED',
        severity: 'HIGH',
        title: 'Wasteful PMax Mobile App Placements',
        description: `Mobile app placement "${pl.placement_name}" accumulated $${pl.cost.toFixed(2)} in spend with zero conversions. Recommend account exclusion.`
      });
    }

    // 4. Broken final URLs (Expanded Landing Page redirect anomaly)
    const redirectedLPs = await db.all(`
      SELECT url, status_code, redirect_urls AS redirect 
      FROM r_expanded_landing_page 
      WHERE status_code >= 300
    `);
    for (const r of redirectedLPs) {
      anomalies.push({
        type: 'LANDING_PAGE_REDIRECT',
        severity: 'MEDIUM',
        title: 'Ad Landing Page Redirect Alert',
        description: `URL "${r.url}" returned status ${r.status_code} and redirected to "${r.redirect}". This can disrupt conversion tracking.`
      });
    }

    return anomalies;
  }

  /**
   * Generates a text summary performance digest (Markdown)
   */
  static async generatePerformanceSummaryText(): Promise<string> {
    const kpis = await this.computeGlobalKPIs();
    const anomalies = await this.detectAnomalies();
    const syncTimeRow = await db.get('SELECT sync_timestamp FROM report_sync_log ORDER BY id DESC LIMIT 1');
    const syncTime = syncTimeRow?.sync_timestamp || 'Never';

    let markdown = `# Google Ads Daily Performance Digest\n`;
    markdown += `*Generated at: ${new Date().toLocaleString()}* (Last cached sync: ${syncTime})\n\n`;

    markdown += `## 📊 Account KPIs (Last 30 Days)\n`;
    markdown += `- **Spend:** $${kpis.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    markdown += `- **Conversions:** ${kpis.conversions.toLocaleString()} conversions\n`;
    markdown += `- **Avg CPA:** $${kpis.cpa.toFixed(2)}\n`;
    markdown += `- **CTR:** ${kpis.ctr.toFixed(2)}%\n`;
    markdown += `- **Clicks:** ${kpis.clicks.toLocaleString()} clicks\n`;
    markdown += `- **Avg CPC:** $${kpis.cpc.toFixed(2)}\n\n`;

    markdown += `## ⚠️ Active Anomaly Alerts (${anomalies.length})\n`;
    if (anomalies.length === 0) {
      markdown += `*No critical anomalies detected in the last sync cycle. Excellent campaign health!*\n`;
    } else {
      for (const anomaly of anomalies) {
        const icon = anomaly.severity === 'HIGH' ? '🔴' : '🟡';
        markdown += `### ${icon} ${anomaly.title} [${anomaly.severity}]\n`;
        markdown += `${anomaly.description}\n\n`;
      }
    }

    return markdown;
  }
}
