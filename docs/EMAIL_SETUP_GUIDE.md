# Email Service Setup Guide - Gmail

This guide explains how to configure the email service for production use with Gmail and Nodemailer.

## Overview

The email service uses Nodemailer to send emails via Gmail SMTP. This is a simple and reliable solution for production email sending.

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file or deployment environment:

```env
# Enable/Disable Email Sending
EMAIL_ENABLED=true  # Set to 'true' for production, 'false' for development

# Gmail SMTP Configuration
SMTP_HOST=smtp.gmail.com  # Gmail SMTP server (default)
SMTP_PORT=587             # Gmail uses port 587 for TLS
SMTP_SECURE=false         # Gmail uses TLS (not SSL)
SMTP_USER=your-email@gmail.com  # Your Gmail address
SMTP_PASS=xxxx xxxx xxxx xxxx   # Gmail app-specific password (16 characters)

# Optional: From address (defaults to SMTP_USER if not set)
EMAIL_FROM=your-email@gmail.com
```

### Gmail Setup Steps

1. **Enable 2-Factor Authentication** on your Google account
   - Go to https://myaccount.google.com/security
   - Enable 2-Step Verification if not already enabled

2. **Generate an App-Specific Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "Audit Portal" as the name
   - Click "Generate"
   - Copy the generated 16-character password (format: xxxx xxxx xxxx xxxx)
   - **Important**: This is NOT your regular Gmail password. You must use an app-specific password.

3. **Configure Environment Variables**:
   ```env
   EMAIL_ENABLED=true
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=xxxx xxxx xxxx xxxx  # The 16-character app-specific password
   EMAIL_FROM=your-email@gmail.com
   ```

4. **Important Notes**:
   - Do NOT use your regular Gmail password - it will NOT work
   - The app-specific password is 16 characters with spaces: `xxxx xxxx xxxx xxxx`
   - You can remove spaces when entering in `.env`: `xxxxxxxxxxxxxxxx`
   - If you lose the password, generate a new one
   - Each app-specific password can be revoked individually

## Testing Email Configuration

### 1. Install Dependencies

Make sure nodemailer is installed:
```bash
cd A4-MALTA-AUDIT-BACKEND
npm install
```

### 2. Start the Server

The server will automatically verify the Gmail SMTP connection on startup. Look for:
- ✅ `SMTP connection verified successfully` - Configuration is correct
- ✅ `Email service ready (From: your-email@gmail.com)` - Ready to send emails
- ❌ `SMTP connection verification failed` - Check your credentials

### 3. Test Email Sending

1. Create a document request with notification emails:
   - Go to an engagement
   - Create a new document request
   - Add email addresses in the "Notification Emails" field
   - Submit the request

2. Check:
   - Console logs show "✅ Email sent successfully"
   - Recipients receive the email
   - Email includes portal link

### 4. Development Mode

When `EMAIL_ENABLED=false`:
- Emails are logged to console instead of being sent
- Useful for development and testing
- All email details are printed for verification
- No actual emails are sent

## Troubleshooting

### Common Issues

#### "SMTP connection verification failed"

**Common causes and solutions:**

1. **Using regular Gmail password instead of app-specific password**
   - ❌ Don't use: Your regular Gmail password
   - ✅ Use: App-specific password from https://myaccount.google.com/apppasswords
   - Solution: Generate a new app-specific password and use it in `SMTP_PASS`

2. **2-Factor Authentication not enabled**
   - Solution: Enable 2-Step Verification on your Google account first
   - Then generate an app-specific password

3. **Incorrect app-specific password format**
   - Format should be: `xxxx xxxx xxxx xxxx` (16 characters)
   - You can enter with or without spaces in `.env` file
   - Make sure there are no extra spaces or characters

4. **Firewall blocking SMTP port 587**
   - Solution: Check your firewall/network settings
   - Port 587 (TLS) must be open for outbound connections

5. **"Less secure app access" error**
   - This is not needed if using app-specific passwords
   - App-specific passwords bypass the "less secure app" requirement

#### "Invalid email addresses"

**Cause:** Email address format is incorrect

**Solution:** Ensure all email addresses are in valid format: `user@domain.com`

#### "Email sent but not received"

**Common causes and solutions:**

1. **Email went to spam/junk folder**
   - Solution: Check recipient's spam/junk folder
   - Gmail may flag emails from new senders

2. **Gmail daily sending limits**
   - Free Gmail: 500 emails per day
   - Google Workspace: 2,000 emails per day
   - Solution: Monitor your daily sending volume
   - If exceeded, wait 24 hours or upgrade to Google Workspace

3. **Recipient email address is invalid**
   - Solution: Verify email addresses are correct
   - Check for typos in email addresses

4. **Gmail blocking emails (temporarily)**
   - If you send too many emails too quickly, Gmail may temporarily block
   - Solution: Wait a few minutes and try again
   - Implement rate limiting if sending bulk emails

### Production Best Practices

1. **Verify Sender Email**: Always verify your sender email with your SMTP provider
2. **Use Dedicated Email Domain**: Use a subdomain like `noreply@mail.yourdomain.com`
3. **Set up SPF/DKIM Records**: Improve email deliverability
4. **Monitor Email Bounce Rates**: Set up bounce/complaint handling
5. **Rate Limiting**: Implement rate limiting to avoid being marked as spam
6. **Email Templates**: Use consistent, professional email templates
7. **Unsubscribe Links**: Include unsubscribe links in transactional emails (if required by law)

## Security Considerations

1. **Never commit `.env` file**: Add it to `.gitignore`
2. **Always use app-specific passwords**: Never use your regular Gmail password
3. **Rotate app-specific passwords**: Regularly generate new app-specific passwords
4. **Revoke unused passwords**: Delete app-specific passwords you no longer use
5. **Limit access**: Only give SMTP credentials to necessary personnel
6. **Monitor logs**: Check for suspicious email sending activity
7. **Enable 2FA**: Always have 2-Factor Authentication enabled on your Google account

## Gmail Rate Limits

- **Free Gmail Account**: 500 emails per day
- **Google Workspace**: 2,000 emails per day

**Note**: 
- Daily limit resets at midnight Pacific Time
- If you exceed the limit, emails will fail until the next day
- Monitor your usage if sending many emails
- Consider Google Workspace upgrade if you need higher limits

## Support

For issues with:
- **Gmail Setup**: https://support.google.com/mail
- **App-Specific Passwords**: https://support.google.com/accounts/answer/185833
- **Nodemailer**: https://nodemailer.com/about

