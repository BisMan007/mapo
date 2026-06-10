import axios from 'axios';
import { config } from '../config';
import { db } from '../db/database';

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

let cachedAccessToken: string | null = null;
let tokenExpirationTime: number = 0;

// Counter for API operations performed today
let dailyOperationsCount = 0;

/**
 * Refreshes and returns a valid OAuth2 Access Token
 */
export async function getAccessToken(): Promise<string> {
  if (config.MOCK_MODE) {
    return 'mock_access_token';
  }

  const now = Date.now();
  if (cachedAccessToken && now < tokenExpirationTime) {
    return cachedAccessToken;
  }

  try {
    const response = await axios.post<TokenResponse>('https://oauth2.googleapis.com/token', null, {
      params: {
        client_id: config.GOOGLE_CLIENT_ID,
        client_secret: config.GOOGLE_CLIENT_SECRET,
        refresh_token: config.GOOGLE_ADS_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      },
    });

    cachedAccessToken = response.data.access_token;
    // Buffer of 5 minutes before expiration
    tokenExpirationTime = now + (response.data.expires_in - 300) * 1000;
    console.log('Successfully refreshed Google Ads Access Token.');
    return cachedAccessToken;
  } catch (error: any) {
    console.error('Error refreshing access token:', error?.response?.data || error.message);
    throw new Error('Failed to refresh Google Ads Access Token.');
  }
}

/**
 * Tracks API operations and checks against the daily limit of 2,880
 */
function trackOperations(count: number) {
  dailyOperationsCount += count;
  if (dailyOperationsCount > 2880) {
    console.warn(`WARNING: Daily Google Ads API operation limit exceeded (${dailyOperationsCount}/2880)`);
  }
}

export function getDailyOperationsCount(): number {
  return dailyOperationsCount;
}

export function resetDailyOperationsCount() {
  dailyOperationsCount = 0;
}

/**
 * Executes a GAQL (Google Ads Query Language) search request
 */
export async function searchGoogleAds(query: string): Promise<any[]> {
  trackOperations(1);

  if (config.MOCK_MODE) {
    return getMockReportData(query);
  }

  const accessToken = await getAccessToken();
  const customerId = config.GOOGLE_ADS_OPERATING_CUSTOMER_ID;
  const loginCustomerId = config.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  const apiVersion = config.GOOGLE_ADS_API_VERSION;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': config.GOOGLE_ADS_DEVELOPER_TOKEN,
    'Content-Type': 'application/json',
  };

  if (loginCustomerId && loginCustomerId !== customerId) {
    headers['login-customer-id'] = loginCustomerId;
  }

  try {
    const url = `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}/googleAds:search`;
    const response = await axios.post(
      url,
      { query },
      { headers }
    );
    return response.data.results || [];
  } catch (error: any) {
    console.error('Google Ads API search error:', JSON.stringify(error?.response?.data || error.message, null, 2));
    throw error;
  }
}

/**
 * Executes mutate operations (campaign updates, negative keywords addition)
 */
export async function mutateGoogleAds(operations: any[]): Promise<any> {
  trackOperations(operations.length);

  if (config.MOCK_MODE) {
    console.log(`[MOCK MODE] Executed ${operations.length} mutations:`, JSON.stringify(operations, null, 2));
    return { results: operations.map(() => ({ resourceName: 'customers/8568546384/mutations/mock_mutated' })) };
  }

  const accessToken = await getAccessToken();
  const customerId = config.GOOGLE_ADS_OPERATING_CUSTOMER_ID;
  const loginCustomerId = config.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  const apiVersion = config.GOOGLE_ADS_API_VERSION;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': config.GOOGLE_ADS_DEVELOPER_TOKEN,
    'Content-Type': 'application/json',
  };

  if (loginCustomerId && loginCustomerId !== customerId) {
    headers['login-customer-id'] = loginCustomerId;
  }

  try {
    const url = `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}/googleAds:mutate`;
    const response = await axios.post(
      url,
      { mutateOperations: operations },
      { headers }
    );
    return response.data;
  } catch (error: any) {
    console.error('Google Ads API mutate error:', error?.response?.data || error.message);
    throw error;
  }
}

/**
 * Generates synthetic Google Ads report streams for Mock Mode
 */
function getMockReportData(query: string): any[] {
  const q = query.toLowerCase();

  // 1. Search Keyword Performance
  if (q.includes('ad_group_criterion') && q.includes('keyword')) {
    return [
      {
        adGroupCriterion: { resourceName: 'customers/8568546384/adGroupCriteria/k1', criterionId: '101', keyword: { text: 'google ads automation', matchType: 'BROAD' }, status: 'ENABLED', qualityScore: 5 },
        campaign: { name: 'Search - Generic - US' },
        adGroup: { name: 'Automation Services' },
        metrics: { impressions: 10000, clicks: 500, costMicros: 1250000000, conversions: 5, averageCpc: 2500000 }
      },
      {
        adGroupCriterion: { resourceName: 'customers/8568546384/adGroupCriteria/k2', criterionId: '102', keyword: { text: 'ads optimizer', matchType: 'EXACT' }, status: 'ENABLED', qualityScore: 8 },
        campaign: { name: 'Search - Generic - US' },
        adGroup: { name: 'Automation Services' },
        metrics: { impressions: 5000, clicks: 450, costMicros: 900000000, conversions: 35, averageCpc: 2000000 }
      },
      {
        adGroupCriterion: { resourceName: 'customers/8568546384/adGroupCriteria/k3', criterionId: '103', keyword: { text: 'free ad monitoring tool', matchType: 'BROAD' }, status: 'ENABLED', qualityScore: 3 },
        campaign: { name: 'Search - Generic - US' },
        adGroup: { name: 'Automation Services' },
        metrics: { impressions: 12000, clicks: 800, costMicros: 2400000000, conversions: 0, averageCpc: 3000000 } // CPA Inefficient (Waste)
      }
    ];
  }

  // 2. Search Term Report
  if (q.includes('search_term_view')) {
    return [
      {
        searchTermView: { resourceName: 'customers/8568546384/searchTermViews/st1' },
        campaign: { name: 'Search - Generic - US' },
        adGroup: { name: 'Automation Services' },
        metrics: { searchTerm: 'google ads bid optimizer tool', impressions: 1200, clicks: 180, costMicros: 360000000, conversions: 12 }, // High CTR, good conversions (Exact Keyword Candidate)
        searchTerm: { status: 'NONE' }
      },
      {
        searchTermView: { resourceName: 'customers/8568546384/searchTermViews/st2' },
        campaign: { name: 'Search - Generic - US' },
        adGroup: { name: 'Automation Services' },
        metrics: { searchTerm: 'cheap ads tool free login cracked', impressions: 850, clicks: 95, costMicros: 220000000, conversions: 0 }, // Unprofitable query (Negative Keyword Candidate)
        searchTerm: { status: 'NONE' }
      }
    ];
  }

  // 3. Location Performance
  if (q.includes('location_view') || q.includes('geographic_view')) {
    return [
      {
        campaign: { name: 'Search - Generic - US' },
        geographicView: { countryCriterionId: '2840' }, // USA
        metrics: { impressions: 20000, clicks: 1500, costMicros: 3500000000, conversions: 50 },
        segments: { geoTargetConstantName: 'California' }
      },
      {
        campaign: { name: 'Search - Generic - US' },
        geographicView: { countryCriterionId: '2840' },
        metrics: { impressions: 15000, clicks: 1200, costMicros: 3000000000, conversions: 8 }, // High cost, low conversion (Negative Bid Modifier Candidate)
        segments: { geoTargetConstantName: 'New York' }
      }
    ];
  }

  // 4. Device Report
  if (q.includes('device')) {
    return [
      {
        campaign: { name: 'Search - Generic - US' },
        metrics: { impressions: 15000, clicks: 1100, costMicros: 2500000000, conversions: 40 },
        segments: { device: 'DESKTOP' }
      },
      {
        campaign: { name: 'Search - Generic - US' },
        metrics: { impressions: 25000, clicks: 2200, costMicros: 5000000000, conversions: 10 }, // High Cost, low conversions on mobile (Device Bid Adjustment)
        segments: { device: 'MOBILE' }
      }
    ];
  }

  // 5. Demographics Report
  if (q.includes('age_range_view') || q.includes('gender_view')) {
    return [
      {
        campaign: { name: 'Search - Generic - US' },
        metrics: { impressions: 8000, clicks: 450, costMicros: 1000000000, conversions: 25 },
        ageRangeView: { ageRange: { type: 'AGE_RANGE_25_34' } },
        genderView: { gender: { type: 'FEMALE' } }
      },
      {
        campaign: { name: 'Search - Generic - US' },
        metrics: { impressions: 12000, clicks: 900, costMicros: 1800000000, conversions: 0 }, // 18-24 Waste (Exclude Demographic)
        ageRangeView: { ageRange: { type: 'AGE_RANGE_18_24' } },
        genderView: { gender: { type: 'MALE' } }
      }
    ];
  }

  // 6. Landing Pages Report
  if (q.includes('landing_page_view') && !q.includes('expanded')) {
    return [
      {
        campaign: { name: 'Search - Generic - US' },
        metrics: { impressions: 18000, clicks: 1300, costMicros: 2600000000, conversions: 45 },
        expandedLandingPageView: { expandedLandingPage: 'https://example.com/pricing' }
      },
      {
        campaign: { name: 'Search - Generic - US' },
        metrics: { impressions: 9000, clicks: 700, costMicros: 1400000000, conversions: 1 }, // Poor landing page (Redirect Landing Page candidate)
        expandedLandingPageView: { expandedLandingPage: 'https://example.com/broken-feature-demo' }
      }
    ];
  }

  // 7. Expanded Landing Pages Report
  if (q.includes('landing_page_view') && q.includes('expanded')) {
    return [
      {
        expandedLandingPageView: { expandedLandingPage: 'https://example.com/pricing' },
        metrics: { clicks: 1300, conversions: 45 },
        status: 200,
        redirect: 'None'
      },
      {
        expandedLandingPageView: { expandedLandingPage: 'https://example.com/broken-feature-demo' },
        metrics: { clicks: 700, conversions: 1 },
        status: 301,
        redirect: 'https://example.com/not-found'
      }
    ];
  }

  // 8. Ad Performance
  if (q.includes('ad_group_ad')) {
    return [
      {
        adGroupAd: { resourceName: 'customers/8568546384/adGroupAds/ad1', status: 'ENABLED' },
        campaign: { name: 'Search - Generic - US' },
        adGroup: { name: 'Automation Services' },
        ad: { id: '301', type: 'RESPONSIVE_SEARCH_AD', headline: 'AI Powered Ads Optimizer', description: 'Supercharge your campaign ROI instantly' },
        metrics: { impressions: 12000, clicks: 600, costMicros: 1500000000, conversions: 32 }
      }
    ];
  }

  // 9. Auction Insights
  if (q.includes('auction_insights')) {
    return [
      {
        campaign: { name: 'Search - Generic - US' },
        auctionInsight: { domain: 'competitor-alpha.com', impressionShare: 0.45, outrankingShare: 0.12, overlapRate: 0.35 }
      },
      {
        campaign: { name: 'Search - Generic - US' },
        auctionInsight: { domain: 'adsguru-optimizer.io', impressionShare: 0.30, outrankingShare: 0.08, overlapRate: 0.22 }
      }
    ];
  }

  // 10. Hour of Day Performance
  if (q.includes('segments') && q.includes('hour')) {
    return [
      {
        campaign: { name: 'Search - Generic - US' },
        metrics: { impressions: 15000, clicks: 1200, costMicros: 2800000000, conversions: 35 },
        segments: { hour: 14 } // 2:00 PM (Good ROI)
      },
      {
        campaign: { name: 'Search - Generic - US' },
        metrics: { impressions: 5000, clicks: 400, costMicros: 1000000000, conversions: 0 }, // 2:00 AM (Hour of Day Dead-Zone)
        segments: { hour: 2 }
      }
    ];
  }

  // 11. Day of Week Performance
  if (q.includes('segments') && q.includes('day_of_week')) {
    return [
      {
        campaign: { name: 'Search - Generic - US' },
        metrics: { impressions: 20000, clicks: 1600, costMicros: 3400000000, conversions: 42 },
        segments: { dayOfWeek: 'WEDNESDAY' }
      },
      {
        campaign: { name: 'Search - Generic - US' },
        metrics: { impressions: 8000, clicks: 600, costMicros: 1200000000, conversions: 1 }, // Poor Sunday performance (Day of Week Modifier)
        segments: { dayOfWeek: 'SUNDAY' }
      }
    ];
  }

  // 12. Performance Max Placement
  if (q.includes('detail_placement_view') || q.includes('pmax')) {
    return [
      {
        detailPlacementView: { placement: 'nytimes.com', placementType: 'WEBSITE' },
        metrics: { impressions: 10000, clicks: 150, costMicros: 300000000, conversions: 3 }
      },
      {
        detailPlacementView: { placement: 'coolflashlightgame.apk', placementType: 'MOBILE_APPLICATION' }, // Spam app
        metrics: { impressions: 45000, clicks: 2800, costMicros: 1200000000, conversions: 0 } // placement exclusion target
      }
    ];
  }

  // 13. Audiences Report
  if (q.includes('audience') || q.includes('user_interest')) {
    return [
      {
        campaign: { name: 'Search - Generic - US' },
        metrics: { impressions: 6000, clicks: 400, costMicros: 850000000, conversions: 18 },
        segments: { audience: 'In-Market: Advertising & Marketing Services' }
      },
      {
        campaign: { name: 'Search - Generic - US' },
        metrics: { impressions: 9000, clicks: 750, costMicros: 1500000000, conversions: 2 }, // Low ROI observed audience
        segments: { audience: 'Affinity: Casual Gamers' }
      }
    ];
  }

  // 14. Ad Group Performance
  if (q.includes('ad_group') && !q.includes('criterion') && !q.includes('ad_group_ad')) {
    return [
      {
        adGroup: { resourceName: 'customers/8568546384/adGroups/ag1', name: 'Automation Services', status: 'ENABLED' },
        campaign: { name: 'Search - Generic - US' },
        metrics: { impressions: 27000, clicks: 1750, costMicros: 4550000000, conversions: 40 }
      },
      {
        adGroup: { resourceName: 'customers/8568546384/adGroups/ag2', name: 'Legacy Keyword List', status: 'ENABLED' },
        campaign: { name: 'Search - Generic - US' },
        metrics: { impressions: 15000, clicks: 1100, costMicros: 3200000000, conversions: 1 } // Low ROI ad group (Pause Ad Group Candidate)
      }
    ];
  }

  // 15. Assets / Creative Report
  if (q.includes('asset') && !q.includes('ad_group_criterion')) {
    return [
      {
        asset: { id: 'as1', type: 'TEXT_HEADLINE', textAsset: { text: 'Free Google Ads Management Tool' } },
        campaign: { name: 'Search - Generic - US' },
        adGroup: { name: 'Automation Services' },
        metrics: { impressions: 10000, clicks: 500, costMicros: 1200000000, conversions: 5 },
        performanceLabel: 'LOW' // RSA Headline Replacement Candidate
      },
      {
        asset: { id: 'as2', type: 'TEXT_HEADLINE', textAsset: { text: 'Google Ads Optimizer Copilot' } },
        campaign: { name: 'Search - Generic - US' },
        adGroup: { name: 'Automation Services' },
        metrics: { impressions: 15000, clicks: 1250, costMicros: 2500000000, conversions: 45 },
        performanceLabel: 'BEST'
      }
    ];
  }

  return [];
}
