import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import { config } from '../config';

/**
 * Sends a daily performance digest email.
 * Tries SMTP (Nodemailer) first if credentials are provided, then falls back to Gmail API,
 * and finally prints to the terminal console if all methods fail.
 */
export async function sendGmailDigest(to: string, subject: string, htmlContent: string): Promise<boolean> {
  if (config.MOCK_MODE) {
    console.log(`[MOCK EMAIL] To: ${to}`);
    console.log(`[MOCK EMAIL] Subject: ${subject}`);
    console.log(`[MOCK EMAIL] Content Preview:\n${htmlContent.substring(0, 500)}...\n[End Preview]`);
    return true;
  }

  // 1. Try sending via SMTP (Nodemailer) if user/pass are configured in .env
  if (config.SMTP_USER && config.SMTP_PASSWORD) {
    console.log(`[Email Service] Attempting to send email via SMTP (Nodemailer)...`);
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASSWORD,
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000,
      });

      await transporter.sendMail({
        from: config.SMTP_USER,
        to,
        subject,
        html: htmlContent,
      });

      console.log(`Daily Performance Digest email sent successfully via SMTP to ${to}`);
      return true;
    } catch (smtpError: any) {
      console.warn(`[Email Service] SMTP transmission failed: ${smtpError.message}`);
      console.log('Falling back to Google Gmail API...');
    }
  }

  // 2. Fall back to standard Google Gmail API OAuth client
  try {
    const oauth2Client = new google.auth.OAuth2(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET
    );
    
    oauth2Client.setCredentials({
      refresh_token: config.GOOGLE_ADS_REFRESH_TOKEN,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client, timeout: 10000 });

    // Compose SMTP message structure
    const messageParts = [
      `To: ${to}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${subject}`,
      '',
      htmlContent,
    ];
    const message = messageParts.join('\n');

    // Base64url encode the message
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(`Daily Performance Digest email sent successfully via Gmail API to ${to}`);
    return true;
  } catch (error: any) {
    console.warn(`\n[Gmail API] Note: Could not send email via Gmail API (${error?.message}).`);
    console.warn(`Reason: The current Google OAuth2 Refresh Token only has permissions for Google Ads. To enable direct email delivery, re-auth with the 'https://www.googleapis.com/auth/gmail.send' scope, or configure SMTP_USER & GMAIL_APP_PASSWORD in your .env file.`);
    console.warn(`[FALLBACK] Printing the Performance Digest email content directly to the console instead:`);
    console.log('\n================================== EMAIL DIGEST FALLBACK LOG ==================================');
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`-----------------------------------------------------------------------------------------------`);
    console.log(htmlContent);
    console.log('===============================================================================================\n');
    return false;
  }
}
