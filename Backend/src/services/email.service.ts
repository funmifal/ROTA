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
   * Identifies test, example, or simulated dummy emails to avoid sending real
   * SMTP requests that result in inbox bounce-back notifications.
   */
  private static isTestOrDummyEmail(email: string): boolean {
    const lower = email.toLowerCase().trim();
    return (
      lower.endsWith('@example.com') ||
      lower.endsWith('@test.com') ||
      lower.endsWith('@rota.com') ||
      lower.endsWith('.test') ||
      lower.endsWith('.example') ||
      lower.endsWith('@mailinator.com') ||
      lower.includes('loadtest') ||
      lower.includes('test_') ||
      lower.includes('staff_') ||
      lower.includes('dummy_')
    );
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
    if (this.isTestOrDummyEmail(to)) {
      console.log(`[EmailService] Simulated delivery to test address ${to} (bypassed external SMTP to prevent bounce).`);
      return { messageId: `simulated_verification_${Date.now()}` };
    }

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

This one-time verification link and code are valid for 15 minutes.

If you did not sign up for Rota, you can safely ignore this email.
    `.trim();

    try {
      const info = await transporter.sendMail({
        from: config.email.from,
        to,
        subject: 'Verify your Rota Account',
        text: textContent,
        html: htmlContent,
      });

      console.log(`[EmailService] Verification email successfully sent to ${to} (Message ID: ${info.messageId})`);

      const previewUrl = nodemailer.getTestMessageUrl(info);

      return {
        messageId: info.messageId,
        previewUrl,
      };
    } catch (err: any) {
      console.error(`[EmailService] Failed to send verification email to ${to}:`, err.message);
      throw err;
    }
  }

  /**
   * Sends a team invitation email with direct acceptance link.
   */
  static async sendInvitationEmail(
    to: string,
    inviterName: string,
    businessName: string,
    role: string,
    token: string
  ): Promise<{ messageId: string }> {
    if (this.isTestOrDummyEmail(to)) {
      console.log(`[EmailService] Simulated delivery to test address ${to} (bypassed external SMTP to prevent bounce).`);
      return { messageId: `simulated_invitation_${Date.now()}` };
    }

    const transporter = await this.getTransporter();
    const inviteUrl = `${config.appUrl}/invite/${encodeURIComponent(token)}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; }
    .header { font-size: 24px; font-weight: 700; color: #2f6b5f; margin-bottom: 20px; }
    .button { display: inline-block; background-color: #2f6b5f; color: #ffffff !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .footer { margin-top: 28px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">Join ${escapeHtml(businessName)} on Rota</div>
    <p>Hi there,</p>
    <p><strong>${escapeHtml(inviterName)}</strong> has invited you to join the team at <strong>${escapeHtml(businessName)}</strong> as a <strong>${escapeHtml(role)}</strong> on Rota.</p>
    <div style="text-align: center;">
      <a href="${inviteUrl}" class="button">Accept Invitation</a>
    </div>
    <p style="font-size: 13px; color: #64748b;">Or copy and paste this link into your browser:</p>
    <p style="font-size: 12px; color: #2f6b5f; word-break: break-all;">${inviteUrl}</p>
    <p style="font-size: 12px; color: #64748b;">This invitation link will expire in 7 days.</p>
    <div class="footer">
      Rota Workforce Management • Simplifying shift schedules for teams.
    </div>
  </div>
</body>
</html>
    `.trim();

    const textContent = `
Hi there,

${inviterName} has invited you to join ${businessName} as a ${role} on Rota.

Accept your invitation here:
${inviteUrl}

This invitation link expires in 7 days.
    `.trim();

    try {
      const info = await transporter.sendMail({
        from: config.email.from,
        to,
        subject: `You're invited to join ${businessName} on Rota`,
        text: textContent,
        html: htmlContent,
      });

      console.log(`[EmailService] Team invitation sent to ${to} for ${businessName} (Message ID: ${info.messageId})`);
      return { messageId: info.messageId };
    } catch (err: any) {
      console.error(`[EmailService] Failed to send invitation email to ${to}:`, err.message);
      throw err;
    }
  }

  /**
   * Sends a password reset email with single-use, expiring token link.
   */
  static async sendPasswordResetEmail(
    to: string,
    name: string,
    token: string
  ): Promise<{ messageId: string }> {
    if (this.isTestOrDummyEmail(to)) {
      console.log(`[EmailService] Simulated delivery to test address ${to} (bypassed external SMTP to prevent bounce).`);
      return { messageId: `simulated_password_reset_${Date.now()}` };
    }

    const transporter = await this.getTransporter();
    const resetUrl = `${config.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const deepLinkUrl = `rota://reset-password?token=${encodeURIComponent(token)}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; }
    .header { font-size: 24px; font-weight: 700; color: #006a60; margin-bottom: 20px; }
    .button { display: inline-block; background-color: #006a60; color: #ffffff !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .footer { margin-top: 28px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; }
    .note { font-size: 13px; color: #b45309; background-color: #fffbeb; padding: 12px; border-radius: 6px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">Reset Your Rota Password</div>
    <p>Hi ${escapeHtml(name)},</p>
    <p>We received a request to reset your password for your Rota account. Click the button below to choose a new password:</p>
    <div style="text-align: center;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </div>
    <div class="note">
      This password reset link is <strong>single-use</strong> and expires in <strong>1 hour</strong>.
    </div>
    <p style="font-size: 13px; color: #64748b;">If you are on your mobile phone with Rota installed, you can also use this app link:<br>
      <a href="${deepLinkUrl}" style="color: #006a60;">Open in Rota App</a>
    </p>
    <div class="footer">
      If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
    </div>
  </div>
</body>
</html>
    `.trim();

    const textContent = `
Hi ${name},

We received a request to reset your password for your Rota account.
Reset your password here:
${resetUrl}

This link is single-use and expires in 1 hour.

If you did not request this, please ignore this email.
    `.trim();

    try {
      const info = await transporter.sendMail({
        from: config.email.from,
        to,
        subject: 'Reset your Rota Password',
        text: textContent,
        html: htmlContent,
      });

      console.log(`[EmailService] Password reset email sent to ${to} (Message ID: ${info.messageId})`);
      return { messageId: info.messageId };
    } catch (err: any) {
      console.error(`[EmailService] Failed to send password reset email to ${to}:`, err.message);
      throw err;
    }
  }

  /**
   * Sends a magic login link for passwordless authentication.
   */
  static async sendMagicLinkEmail(
    to: string,
    token: string
  ): Promise<{ messageId: string }> {
    if (this.isTestOrDummyEmail(to)) {
      console.log(`[EmailService] Simulated delivery to test address ${to} (bypassed external SMTP to prevent bounce).`);
      return { messageId: `simulated_magic_link_${Date.now()}` };
    }

    const transporter = await this.getTransporter();
    const magicUrl = `${config.appUrl}/magic-login?token=${encodeURIComponent(token)}`;
    const deepLinkUrl = `rota://magic-login?token=${encodeURIComponent(token)}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; }
    .header { font-size: 24px; font-weight: 700; color: #006a60; margin-bottom: 20px; }
    .button { display: inline-block; background-color: #006a60; color: #ffffff !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .footer { margin-top: 28px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; }
    .note { font-size: 13px; color: #0369a1; background-color: #f0f9ff; padding: 12px; border-radius: 6px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">Log In to Rota</div>
    <p>Hi there,</p>
    <p>Use this 6-digit code or click the button below to sign in instantly without a password:</p>

    <div style="margin: 24px 0; padding: 20px; background: #f0fdf4; border: 2px dashed #006a60; border-radius: 12px; text-align: center;">
      <p style="margin: 0 0 10px 0; font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Your 6-Digit Login Code</p>
      <div style="font-family: monospace; font-size: 38px; font-weight: 800; color: #006a60; letter-spacing: 10px;">${escapeHtml(token)}</div>
    </div>

    <div style="text-align: center;">
      <a href="${magicUrl}" class="button">Log In Instantly</a>
    </div>

    <div class="note">
      This login code is <strong>single-use</strong> and expires in <strong>15 minutes</strong>.
    </div>

    <p style="font-size: 13px; color: #64748b; text-align: center;">If you are on your mobile phone:<br>
      <a href="${deepLinkUrl}" style="color: #006a60; font-weight: 600;">Open Directly in Rota App</a>
    </p>
    <div class="footer">
      If you did not request this login code, you can safely ignore this email.
    </div>
  </div>
</body>
</html>
    `.trim();

    const textContent = `
Hi there,

Your 6-digit Rota login code is:
${token}

Or click this link to log in directly:
${magicUrl}

This code is single-use and expires in 15 minutes.
    `.trim();

    try {
      const info = await transporter.sendMail({
        from: config.email.from,
        to,
        subject: 'Your Magic Login Link for Rota',
        text: textContent,
        html: htmlContent,
      });

      console.log(`[EmailService] Magic link email sent to ${to} (Message ID: ${info.messageId})`);
      return { messageId: info.messageId };
    } catch (err: any) {
      console.error(`[EmailService] Failed to send magic link email to ${to}:`, err.message);
      throw err;
    }
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
