import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config/env';

export class EmailService {
  private static transporter: Transporter | null = null;

  private static async getTransporter(): Promise<Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    if (config.email.smtp.host && config.email.smtp.user) {
      // Production / configured SMTP transport
      this.transporter = nodemailer.createTransport({
        host: config.email.smtp.host,
        port: config.email.smtp.port,
        secure: config.email.smtp.port === 465,
        auth: {
          user: config.email.smtp.user,
          pass: config.email.smtp.pass,
        },
      });
    } else {
      // Local development fallback: create an Ethereal test account or simulated transport
      const testAccount = await nodemailer.createTestAccount().catch(() => null);
      if (testAccount) {
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
      } else {
        // Fallback stream / json transport if offline
        this.transporter = nodemailer.createTransport({
          jsonTransport: true,
        });
      }
    }

    return this.transporter;
  }

  /**
   * Sends a one-time email verification link and 6-digit verification code using Nodemailer.
   *
   * @param to Recipient email address
   * @param name User's full name
   * @param token Cryptographically secure one-time verification token
   * @param code Optional 6-digit verification code
   */
  static async sendVerificationEmail(
    to: string,
    name: string,
    token: string,
    code?: string
  ): Promise<{ messageId: string; previewUrl?: string | false }> {
    const transporter = await this.getTransporter();
    const verificationUrl = `${config.appUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

    const codeSectionHtml = code
      ? `
    <div style="margin: 24px 0; text-align: center;">
      <p style="margin-bottom: 8px; font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Your Verification Code</p>
      <div style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #006a60; background: #e6f4ea; padding: 16px 28px; border-radius: 10px; border: 1px dashed #006a60; font-family: monospace;">
        ${code}
      </div>
    </div>
      `
      : '';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify your Rota Account</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
    .logo { font-size: 24px; font-weight: 700; color: #006a60; margin-bottom: 24px; letter-spacing: -0.5px; }
    h1 { font-size: 20px; font-weight: 600; margin-top: 0; color: #0f172a; }
    p { font-size: 15px; line-height: 1.6; color: #475569; margin: 16px 0; }
    .btn-container { margin: 28px 0; text-align: center; }
    .btn { display: inline-block; background-color: #006a60; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; }
    .note { font-size: 13px; color: #64748b; background-color: #f8fafc; padding: 12px 16px; border-radius: 6px; border-left: 3px solid #006a60; }
    .fallback { font-size: 12px; color: #94a3b8; word-break: break-all; margin-top: 24px; }
    .footer { margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Rota</div>
    <h1>Verify Your Email Address</h1>
    <p>Hi ${escapeHtml(name)},</p>
    <p>Thank you for creating an account on Rota. Please verify your email address to activate your workforce management account.</p>
    ${codeSectionHtml}
    <div class="btn-container">
      <a href="${verificationUrl}" class="btn" target="_blank">Verify Email Address</a>
    </div>
    <div class="note">
      This one-time verification link and code are valid for <strong>24 hours</strong>. Once used, they will automatically expire.
    </div>
    <p class="fallback">
      If the button above does not work, copy and paste this link into your browser:<br>
      <a href="${verificationUrl}" style="color: #006a60;">${verificationUrl}</a>
    </p>
    <div class="footer">
      If you did not sign up for Rota, you can safely ignore this email.
    </div>
  </div>
</body>
</html>
    `.trim();

    const textContent = `
Hi ${name},

Thank you for creating an account on Rota. Please verify your email address.
${code ? `Your 6-digit verification code is: ${code}\n\n` : ''}
Or click the link below to verify directly:
${verificationUrl}

This one-time verification link and code are valid for 24 hours.

If you did not sign up for Rota, you can safely ignore this email.
    `.trim();

    const info = await transporter.sendMail({
      from: config.email.from,
      to,
      subject: 'Verify your Rota Account',
      text: textContent,
      html: htmlContent,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    return {
      messageId: info.messageId,
      previewUrl,
    };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
