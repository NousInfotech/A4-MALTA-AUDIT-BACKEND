/**
 * Email Configuration - Gmail SMTP
 * 
 * Environment Variables Required:
 * - SMTP_HOST: Gmail SMTP hostname (smtp.gmail.com)
 * - SMTP_PORT: SMTP port (587 for TLS)
 * - SMTP_SECURE: false for TLS (587)
 * - SMTP_USER: Your Gmail address
 * - SMTP_PASS: Gmail app-specific password (NOT your regular password)
 * - EMAIL_FROM: Email address to send from (defaults to SMTP_USER if not set)
 * - EMAIL_ENABLED: Set to 'true' to enable actual email sending, 'false' for development logging only
 * 
 * Gmail Setup:
 *   1. Enable 2-Factor Authentication on your Google account
 *   2. Generate an App-Specific Password:
 *      - Go to https://myaccount.google.com/apppasswords
 *      - Select "Mail" and "Other (Custom name)"
 *      - Enter "Audit Portal" as the name
 *      - Copy the generated 16-character password
 *   3. Use this password in SMTP_PASS (not your regular Gmail password)
 */

const nodemailer = require('nodemailer');

const isEmailEnabled = process.env.EMAIL_ENABLED === 'true' || process.env.NODE_ENV === 'production';

// Gmail SMTP Configuration from environment variables
const smtpConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com', // Default to Gmail
  port: parseInt(process.env.SMTP_PORT || '587', 10), // Default to 587 (TLS)
  secure: false, // Gmail uses TLS on port 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

// Default from email address
const defaultFrom = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@audit-portal.com';

// Create transporter
let transporter = null;

if (isEmailEnabled) {
  // Validate required SMTP configuration
  if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
    console.warn('⚠️ Email enabled but SMTP configuration incomplete. Required: SMTP_HOST, SMTP_USER, SMTP_PASS');
    console.warn('⚠️ Email sending will be disabled. Emails will only be logged.');
  } else {
    try {
      transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.auth.user,
          pass: smtpConfig.auth.pass
        },
        // Optional: Add TLS options for better security
        tls: {
          // Do not fail on invalid certs (useful for self-signed certs in development)
          rejectUnauthorized: process.env.NODE_ENV === 'production'
        }
      });

      // Verify connection on startup (async)
      transporter.verify()
        .then(() => {
          console.log('✅ SMTP connection verified successfully');
          console.log(`📧 Email service ready (From: ${defaultFrom})`);
        })
        .catch((error) => {
          console.error('❌ SMTP connection verification failed:', error.message);
          console.error('❌ Email sending will be disabled. Please check your SMTP configuration.');
          transporter = null;
        });
    } catch (error) {
      console.error('❌ Failed to create email transporter:', error.message);
      transporter = null;
    }
  }
} else {
  console.log('ℹ️ Email sending is disabled (EMAIL_ENABLED=false or NODE_ENV != production)');
  console.log('ℹ️ Emails will be logged to console instead');
}

module.exports = {
  transporter,
  isEmailEnabled,
  defaultFrom,
  smtpConfig
};

