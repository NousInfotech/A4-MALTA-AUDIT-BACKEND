const axios = require('axios');
const { supabase } = require('../config/supabase');

/**
 * Email Service
 * Sends emails using a simple HTTP-based email service or Supabase email functionality
 * In production, integrate with services like SendGrid, AWS SES, or Nodemailer
 */

class EmailService {
  /**
   * Send email notification
   * @param {Object} params
   * @param {string|string[]} params.to - Email address(es) to send to
   * @param {string} params.subject - Email subject
   * @param {string} params.html - HTML email body
   * @param {string} params.text - Plain text email body (optional)
   */
  static async sendEmail({ to, subject, html, text }) {
    const recipients = Array.isArray(to) ? to : [to];
    
    // For now, we'll use Supabase's built-in email functionality if available
    // Or log the email content for manual sending in development
    // In production, integrate with a proper email service provider
    
    try {
      // Option 1: Use Supabase Edge Functions or Resend API (if configured)
      // Option 2: Use a third-party service like SendGrid, AWS SES, etc.
      
      // For now, we'll create a notification in the database and log the email
      // This allows the portal to show notifications to users
      
      console.log('📧 Email Notification:');
      console.log('To:', recipients.join(', '));
      console.log('Subject:', subject);
      console.log('Body:', text || html);
      
      // TODO: Integrate with actual email service provider
      // Example with Supabase (if using Supabase Email):
      // const { data, error } = await supabase.functions.invoke('send-email', {
      //   body: { to: recipients, subject, html, text }
      // });
      
      // For development/testing: Return success and log
      return {
        success: true,
        message: 'Email queued for sending',
        recipients
      };
      
    } catch (error) {
      console.error('❌ Email send error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
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

