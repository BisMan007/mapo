import cron from 'node-cron';
import { AnalysisAgent } from './agents/analysisAgent';
import { RecommendationAgent } from './agents/recommendationAgent';
import { sendGmailDigest } from './services/gmail';
import { config } from './config';

/**
 * Runs the full synchronization and recommendation generation cycle.
 */
export async function runSyncCycle(): Promise<{
  success: boolean;
  timestamp: string;
  operations: number;
  newRecommendations: number;
  emailSent: boolean;
}> {
  console.log('--- STARTING SYNC & RECOMENDATION CYCLE ---');
  let success = false;
  let operations = 0;
  let newRecommendations = 0;
  let emailSent = false;
  const timestamp = new Date().toISOString();

  try {
    // 1. Sync reports (Analysis Agent)
    const syncResult = await AnalysisAgent.syncAllReports();
    operations = syncResult.apiOperations;

    // 2. Generate and audit recommendations (Recommendation Agent)
    newRecommendations = await RecommendationAgent.generateRecommendations();

    // 3. Generate daily performance markdown digest
    const digestMarkdown = await AnalysisAgent.generatePerformanceSummaryText();

    // Translate markdown into HTML for email
    const digestHtml = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
            h1 { color: #1a73e8; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
            h2 { color: #202124; margin-top: 24px; }
            h3 { color: #ea4335; margin-top: 16px; }
            ul { padding-left: 20px; }
            li { margin-bottom: 8px; }
            .kpi-box { background: #f8f9fa; border: 1px solid #dadce0; border-radius: 8px; padding: 16px; margin: 16px 0; }
          </style>
        </head>
        <body>
          ${digestMarkdown
            .replace(/# (.*)/g, '<h1>$1</h1>')
            .replace(/## (.*)/g, '<h2>$1</h2>')
            .replace(/### (.*)/g, '<h3>$1</h3>')
            .replace(/\n/g, '<br/>')
            .replace(/- \*\*(.*?)\*\*(.*)/g, '<li><strong>$1</strong>$2</li>')
          }
        </body>
      </html>
    `;

    // 4. Send Gmail performance digest email asynchronously in the background
    sendGmailDigest(
      config.NOTIFICATION_EMAIL,
      `Google Ads Digest: ${new Date().toLocaleDateString()} - ${newRecommendations} Action Items`,
      digestHtml
    ).then((sent) => {
      console.log(`[Email Digest] Async email dispatch finished. Status: ${sent ? 'Sent' : 'Failed'}`);
    }).catch((err) => {
      console.error('[Email Digest] Async email dispatch failed:', err?.message || err);
    });

    emailSent = true;

    success = true;
    console.log('--- SYNC & RECOMMENDATION CYCLE COMPLETED SUCCESSFULLY ---');
  } catch (error: any) {
    console.error('Error running sync cycle:', error.message);
  }

  return {
    success,
    timestamp,
    operations,
    newRecommendations,
    emailSent
  };
}

/**
 * Initializes the background cron scheduler (Runs nightly at 2:00 AM)
 */
export function initializeScheduler() {
  // Cron syntax: minute hour day-of-month month day-of-week
  // Runs every day at 02:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[Scheduler] Launching scheduled nightly sync job at 2:00 AM...');
    await runSyncCycle();
  });
  console.log('[Scheduler] Nightly synchronization scheduled at 2:00 AM.');
}
