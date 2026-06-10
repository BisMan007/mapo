import { db } from '../db/database';
import { mutateGoogleAds } from '../services/googleAds';
import { config } from '../config';

export interface AuditedRecommendation {
  campaign_id: string;
  campaign_name: string;
  ad_group_id: string;
  ad_group_name: string;
  type: string;
  details: any;
  safety_status: 'PASSED' | 'FAILED';
  safety_notes: string;
}

export class AuditAgent {
  /**
   * Audits a recommendation draft against strict safety thresholds before placing it in the queue.
   */
  static async auditDraftRecommendation(draft: any): Promise<AuditedRecommendation> {
    const audited: AuditedRecommendation = {
      campaign_id: draft.campaign_id || '',
      campaign_name: draft.campaign_name || '',
      ad_group_id: draft.ad_group_id || '',
      ad_group_name: draft.ad_group_name || '',
      type: draft.type,
      details: draft.details,
      safety_status: 'PASSED',
      safety_notes: 'Passed all safety and bidding thresholds.'
    };

    // Get limits from database settings
    const settingsList = await db.all('SELECT key, value FROM settings');
    const settingsMap = new Map(settingsList.map((s) => [s.key, s.value]));

    const cpaCap = parseFloat(settingsMap.get('global_cpa_cap') || '50.0');
    const budgetPctCap = parseFloat(settingsMap.get('budget_threshold_percentage') || '20.0') / 100.0;
    const bidPctCap = parseFloat(settingsMap.get('bid_threshold_percentage') || '20.0') / 100.0;

    // 1. Audit Daily Budget Adjustments (Max ±20%)
    if (draft.type === 'ADJUST_DAILY_BUDGET') {
      const current = parseFloat(draft.details.current_budget || '0');
      const suggested = parseFloat(draft.details.suggested_budget || '0');
      if (current > 0) {
        const diffPercent = Math.abs((suggested - current) / current);
        if (diffPercent > budgetPctCap) {
          audited.safety_status = 'FAILED';
          audited.safety_notes = `REJECTED: Budget adjustment of ${(diffPercent * 100).toFixed(1)}% exceeds safety limit of ${(budgetPctCap * 100).toFixed(0)}%.`;
        }
      }
    }

    // 2. Audit Keyword Bid Adjustments (Max ±20%)
    if (draft.type === 'ADJUST_KEYWORD_BID') {
      const current = parseFloat(draft.details.current_bid || '0');
      const suggested = parseFloat(draft.details.suggested_bid || '0');
      if (current > 0) {
        const diffPercent = Math.abs((suggested - current) / current);
        if (diffPercent > bidPctCap) {
          audited.safety_status = 'FAILED';
          audited.safety_notes = `REJECTED: Bid adjustment of ${(diffPercent * 100).toFixed(1)}% exceeds safety limit of ${(bidPctCap * 100).toFixed(0)}%.`;
        }
      }

      // Absolute CPA Cap Check (Safeguard: bid should not be higher than 30% of target CPA cap)
      if (suggested > cpaCap * 0.3) {
        audited.safety_status = 'FAILED';
        audited.safety_notes = `REJECTED: Proposed CPC bid of $${suggested.toFixed(2)} exceeds 30% CPA absolute cap protection ($${(cpaCap * 0.3).toFixed(2)}).`;
      }
    }

    // 3. Audit Bidding Strategy Targets
    if (draft.type === 'ADJUST_BIDDING_STRATEGY_TARGET') {
      const suggestedTarget = parseFloat(draft.details.suggested_target || '0');
      if (suggestedTarget > cpaCap) {
        audited.safety_status = 'FAILED';
        audited.safety_notes = `REJECTED: Proposed Target CPA of $${suggestedTarget.toFixed(2)} exceeds absolute account CPA cap of $${cpaCap.toFixed(2)}.`;
      }
    }

    // 4. Audit Keyword Cannibalization & Conflict Checks
    if (draft.type === 'ADD_EXACT_KEYWORD') {
      const keyword = draft.details.keyword;
      // Search if this keyword exists in negative keywords lists
      const existsInNegatives = await db.get(
        "SELECT keyword FROM r_search_keyword WHERE keyword = ? AND match_type LIKE '%NEGATIVE%'",
        [keyword]
      );
      if (existsInNegatives) {
        audited.safety_status = 'FAILED';
        audited.safety_notes = `REJECTED: Proposed exact match keyword "${keyword}" is currently excluded by an active Negative Keyword.`;
      }
    }

    return audited;
  }

  /**
   * Applies an approved recommendation, pushes it to Google Ads, and logs to audit trail.
   */
  static async applyRecommendation(id: number, userNotes: string = ''): Promise<{ success: boolean; error?: string }> {
    const rec = await db.get('SELECT * FROM recommendations WHERE id = ?', [id]);
    if (!rec) {
      return { success: false, error: 'Recommendation not found.' };
    }

    if (rec.status !== 'PENDING' && rec.status !== 'FAILED') {
      return { success: false, error: 'Recommendation is not in a modifiable state.' };
    }

    // Mark as syncing
    await db.run("UPDATE recommendations SET status = 'SYNCING' WHERE id = ?", [id]);

    const details = JSON.parse(rec.details);
    const operations: any[] = [];

    // Map recommendation types to Google Ads API REST mutation payloads
    try {
      if (rec.type === 'ADD_NEGATIVE_KEYWORD') {
        operations.push({
          adGroupCriterionOperation: {
            create: {
              adGroup: `customers/8568546384/adGroups/${rec.ad_group_id || 'ag1'}`,
              status: 'ENABLED',
              negative: true,
              keyword: {
                text: details.keyword,
                matchType: 'EXACT'
              }
            }
          }
        });
      } else if (rec.type === 'ADD_EXACT_KEYWORD') {
        operations.push({
          adGroupCriterionOperation: {
            create: {
              adGroup: `customers/8568546384/adGroups/${rec.ad_group_id || 'ag1'}`,
              status: 'ENABLED',
              negative: false,
              keyword: {
                text: details.keyword,
                matchType: 'EXACT'
              }
            }
          }
        });
      } else if (rec.type === 'ADJUST_KEYWORD_BID') {
        operations.push({
          adGroupCriterionOperation: {
            update: {
              resourceName: `customers/8568546384/adGroupCriteria/${details.criterion_id}`,
              cpcBidMicros: Math.round(details.suggested_bid * 1000000)
            },
            updateMask: 'cpcBidMicros'
          }
        });
      } else if (rec.type === 'ADJUST_DAILY_BUDGET') {
        operations.push({
          campaignBudgetOperation: {
            update: {
              resourceName: `customers/8568546384/campaignBudgets/b1`,
              amountMicros: Math.round(details.suggested_budget * 1000000)
            },
            updateMask: 'amountMicros'
          }
        });
      } else {
        // Fallback or local mock operations
        operations.push({
          mockOperation: {
            type: rec.type,
            details: details
          }
        });
      }

      // Execute mutations on Google Ads REST endpoint
      let result;
      if (config.READ_ONLY_MODE) {
        console.log(`[READ-ONLY MODE] Bypassed Google Ads mutate call for recommendation ID ${id}:`, JSON.stringify(operations, null, 2));
        result = { results: operations.map(() => ({ resourceName: `customers/8568546384/mutations/read_only_bypassed_${id}` })) };
      } else {
        result = await mutateGoogleAds(operations);
      }

      // Success
      const now = new Date().toISOString();
      await db.run(
        "UPDATE recommendations SET status = 'APPLIED', applied_at = ?, error_message = NULL WHERE id = ?",
        [now, id]
      );

      // Write to Audit Trail
      await db.run(
        `INSERT INTO audit_trail (recommendation_id, action, user_notes, details_before, details_after)
         VALUES (?, 'APPROVE', ?, ?, ?)`,
        [
          id,
          userNotes || 'Approved via dashboard',
          rec.details,
          JSON.stringify({ result: 'Success', applied_at: now })
        ]
      );

      console.log(`[Audit Agent] Recommendation ID ${id} applied successfully.`);
      return { success: true };
    } catch (error: any) {
      const errMsg = error?.response?.data?.error?.message || error.message;
      await db.run(
        "UPDATE recommendations SET status = 'FAILED', error_message = ? WHERE id = ?",
        [errMsg, id]
      );

      // Log failure in Audit Trail
      await db.run(
        `INSERT INTO audit_trail (recommendation_id, action, user_notes, details_before, details_after)
         VALUES (?, 'APPLY_FAILED', ?, ?, ?)`,
        [
          id,
          `Failed: ${errMsg}`,
          rec.details,
          JSON.stringify({ error: errMsg })
        ]
      );

      console.error(`[Audit Agent] Recommendation ID ${id} execution failed:`, errMsg);
      return { success: false, error: errMsg };
    }
  }

  /**
   * Dismisses a recommendation from the queue and logs it.
   */
  static async dismissRecommendation(id: number, userNotes: string = ''): Promise<boolean> {
    const rec = await db.get('SELECT * FROM recommendations WHERE id = ?', [id]);
    if (!rec) return false;

    await db.run("UPDATE recommendations SET status = 'DISMISSED' WHERE id = ?", [id]);

    await db.run(
      `INSERT INTO audit_trail (recommendation_id, action, user_notes, details_before, details_after)
       VALUES (?, 'DISMISS', ?, ?, NULL)`,
      [id, userNotes || 'Dismissed by user', rec.details]
    );

    return true;
  }
}
