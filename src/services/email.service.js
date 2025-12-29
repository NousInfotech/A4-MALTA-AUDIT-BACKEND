const { transporter, isEmailEnabled, defaultFrom } = require('../config/email');

/**
 * Email Service
 * Production-ready email service using Nodemailer
 * Supports multiple SMTP providers (Gmail, SendGrid, AWS SES, Office 365, etc.)
 */

class EmailService {
  /**
   * Send email notification
   * @param {Object} params
   * @param {string|string[]} params.to - Email address(es) to send to
   * @param {string} params.subject - Email subject
   * @param {string} params.html - HTML email body
   * @param {string} params.text - Plain text email body (optional, will be generated from HTML if not provided)
   * @param {string} params.from - From email address (optional, uses default if not provided)
   * @param {string} params.replyTo - Reply-to email address (optional)
   * @param {Array} params.cc - CC email addresses (optional)
   * @param {Array} params.bcc - BCC email addresses (optional)
   */
  static async sendEmail({ 
    to, 
    subject, 
    html, 
    text, 
    from = defaultFrom,
    replyTo,
    cc,
    bcc 
  }) {
    const recipients = Array.isArray(to) ? to : [to];
    
    // Validate recipients
    if (!recipients || recipients.length === 0) {
      throw new Error('No recipients specified');
    }
    
    // Validate email addresses format (basic validation)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipients.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`);
    }

    // Log email details (always log for audit trail)
    console.log('📧 Email Notification:');
    console.log('  From:', from);
    console.log('  To:', recipients.join(', '));
    if (cc) console.log('  CC:', Array.isArray(cc) ? cc.join(', ') : cc);
    if (bcc) console.log('  BCC:', Array.isArray(bcc) ? bcc.join(', ') : bcc);
    console.log('  Subject:', subject);
    
    // If email is disabled or transporter is not available, just log and return
    if (!isEmailEnabled || !transporter) {
      console.log('⚠️ Email sending disabled - logging email content:');
      console.log('  HTML:', html ? 'Present' : 'Not provided');
      console.log('  Text:', text || 'Not provided (will be generated from HTML)');
      
      return {
        success: true,
        message: 'Email logged (sending disabled)',
        recipients,
        sent: false
      };
    }

    try {
      // Prepare mail options
      const mailOptions = {
        from: from,
        to: recipients.join(', '),
        subject: subject,
        html: html,
        text: text || this.htmlToText(html), // Generate plain text from HTML if not provided
        replyTo: replyTo || from
      };

      if (cc) {
        mailOptions.cc = Array.isArray(cc) ? cc.join(', ') : cc;
      }

      if (bcc) {
        mailOptions.bcc = Array.isArray(bcc) ? bcc.join(', ') : bcc;
      }

      // Send email via Nodemailer
      const info = await transporter.sendMail(mailOptions);
      
      console.log('✅ Email sent successfully');
      console.log('  Message ID:', info.messageId);
      console.log('  Response:', info.response);

      return {
        success: true,
        message: 'Email sent successfully',
        recipients,
        messageId: info.messageId,
        sent: true
      };
      
    } catch (error) {
      console.error('❌ Email send error:', error);
      console.error('  Error details:', error.message);
      
      // Don't throw error in non-production to prevent breaking the request
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Failed to send email: ${error.message}`);
      } else {
        console.warn('⚠️ Email sending failed but continuing (non-production mode)');
        return {
          success: false,
          message: `Email send failed: ${error.message}`,
          recipients,
          sent: false,
          error: error.message
        };
      }
    }
  }

  /**
   * Convert HTML to plain text (basic conversion)
   * @param {string} html - HTML content
   * @returns {string} Plain text content
   */
  static htmlToText(html) {
    if (!html) return '';
    
    // Basic HTML to text conversion
    // Remove HTML tags and decode HTML entities
    let text = html
      .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove style tags
      .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script tags
      .replace(/<[^>]+>/g, ' ') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp;
      .replace(/&amp;/g, '&') // Replace &amp;
      .replace(/&lt;/g, '<') // Replace &lt;
      .replace(/&gt;/g, '>') // Replace &gt;
      .replace(/&quot;/g, '"') // Replace &quot;
      .replace(/&#39;/g, "'") // Replace &#39;
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
    
    return text;
  }

  /**
   * Send document request notification email
   * @param {Object} params
   */
  static async sendDocumentRequestEmail({
    to,
    documentRequestName,
    category,
    description,
    requesterName,
    engagementTitle,
    portalUrl
  }) {
    const subject = `New Document Request: ${documentRequestName || category}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Document Request</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p><strong>${requesterName}</strong> has requested documents for the engagement: <strong>${engagementTitle}</strong></p>
            
            <h3>Request Details:</h3>
            <ul>
              <li><strong>Category:</strong> ${category}</li>
              <li><strong>Request Name:</strong> ${documentRequestName || category}</li>
              ${description ? `<li><strong>Description:</strong> ${description}</li>` : ''}
            </ul>
            
            ${portalUrl ? `
              <a href="${portalUrl}" class="button">View Request in Portal</a>
            ` : ''}
            
            <div class="footer">
              <p>This is an automated notification from the Audit Portal. Please log in to view and respond to this request.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
New Document Request

Hello,

${requesterName} has requested documents for the engagement: ${engagementTitle}

Request Details:
- Category: ${category}
- Request Name: ${documentRequestName || category}
${description ? `- Description: ${description}` : ''}

${portalUrl ? `View this request in the portal: ${portalUrl}` : ''}

This is an automated notification from the Audit Portal. Please log in to view and respond to this request.
    `;
    
    return await this.sendEmail({
      to,
      subject,
      html,
      text
    });
  }
}

module.exports = EmailService;

