import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the .env file in the backend directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  MOCK_MODE: process.env.MOCK_MODE !== 'false', // Default to true if not explicitly false
  READ_ONLY_MODE: process.env.READ_ONLY_MODE === 'true',
  BASIC_AUTH_ENABLED: process.env.BASIC_AUTH_ENABLED !== 'false',

  // Basic HTTP Authentication Credentials
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'ads-copilot-2026',

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

  // Google API Credentials
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_ADS_REFRESH_TOKEN: process.env.GOOGLE_ADS_REFRESH_TOKEN || '',
  GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
  GOOGLE_ADS_API_VERSION: process.env.GOOGLE_ADS_API_VERSION || 'v24',

  GOOGLE_ADS_LOGIN_CUSTOMER_ID: (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/[- ]/g, ''),
  GOOGLE_ADS_OPERATING_CUSTOMER_ID: (process.env.GOOGLE_ADS_OPERATING_CUSTOMER_ID || '').replace(/[- ]/g, ''),

  // Email Digest
  NOTIFICATION_EMAIL: process.env.NOTIFICATION_EMAIL || 'your_email@gmail.com',
  
  // SMTP Credentials (for fallback sending via nodemailer if OAuth2 lacks permissions)
  SMTP_USER: process.env.SMTP_USER || process.env.GMAIL_USER || '',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD || '',
};
