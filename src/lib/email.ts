/**
 * Email Service for Evolvo API
 * 
 * Uses Plunk for transactional emails.
 */

import Plunk from "@plunk/node";
import { logError } from "./logger";

// Initialize Plunk client if API key is available
const plunk = process.env.PLUNK_API_KEY
  ? new Plunk(process.env.PLUNK_API_KEY)
  : null;

// Default sender address
const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@evolvo.xyz";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@evolvo.xyz";

/**
 * Email templates
 */
const templates = {
  paymentFailed: (userName: string, amount: string) => ({
    subject: "Payment Failed - Action Required",
    body: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #ff8a3d; margin: 0;">Evolvo</h1>
        </div>
        
        <h2 style="color: #1a1b20; margin-bottom: 20px;">Payment Failed</h2>
        
        <p style="color: #4a5568; line-height: 1.6;">
          Hi ${userName},
        </p>
        
        <p style="color: #4a5568; line-height: 1.6;">
          We weren't able to process your payment of <strong>${amount}</strong> for your Evolvo subscription.
        </p>
        
        <p style="color: #4a5568; line-height: 1.6;">
          Please update your payment method to continue using Evolvo without interruption.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://evolvo.xyz/settings" 
             style="background: #ff8a3d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 999px; font-weight: 500;">
            Update Payment Method
          </a>
        </div>
        
        <p style="color: #718096; font-size: 14px;">
          If you need help, reply to this email or contact us at ${SUPPORT_EMAIL}.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        
        <p style="color: #a0aec0; font-size: 12px; text-align: center;">
          © ${new Date().getFullYear()} Evolvo. All rights reserved.
        </p>
      </div>
    `,
  }),

  subscriptionCanceled: (userName: string, endDate: string) => ({
    subject: "Your Evolvo Subscription Has Been Canceled",
    body: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #ff8a3d; margin: 0;">Evolvo</h1>
        </div>
        
        <h2 style="color: #1a1b20; margin-bottom: 20px;">Subscription Canceled</h2>
        
        <p style="color: #4a5568; line-height: 1.6;">
          Hi ${userName},
        </p>
        
        <p style="color: #4a5568; line-height: 1.6;">
          Your Evolvo subscription has been canceled. You'll continue to have access to your
          current plan features until <strong>${endDate}</strong>.
        </p>
        
        <p style="color: #4a5568; line-height: 1.6;">
          After that date, your account will be downgraded to the Free plan. Your projects
          will remain available, but some features may be limited.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://evolvo.xyz/pricing" 
             style="background: #ff8a3d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 999px; font-weight: 500;">
            Resubscribe
          </a>
        </div>
        
        <p style="color: #718096; font-size: 14px;">
          We'd love to have you back! If there's anything we can improve, let us know at ${SUPPORT_EMAIL}.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        
        <p style="color: #a0aec0; font-size: 12px; text-align: center;">
          © ${new Date().getFullYear()} Evolvo. All rights reserved.
        </p>
      </div>
    `,
  }),

  adminVerification: (code: string) => ({
    subject: "Your Evolvo Admin Verification Code",
    body: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0b0b0d;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #00f0ff; margin: 0; font-size: 28px;">Evolvo Admin</h1>
        </div>
        
        <div style="background: linear-gradient(180deg, rgba(30,31,37,0.9), rgba(20,21,26,0.95)); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; text-align: center;">
          <p style="color: #a8acb5; font-size: 14px; margin: 0 0 20px 0;">
            Your verification code is:
          </p>
          
          <div style="background: rgba(0,240,255,0.1); border: 1px solid rgba(0,240,255,0.3); border-radius: 12px; padding: 20px; margin: 0 auto; max-width: 200px;">
            <p style="color: #00f0ff; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: monospace;">
              ${code}
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 12px; margin: 20px 0 0 0;">
            This code expires in 10 minutes.
          </p>
        </div>
        
        <p style="color: #4a5568; font-size: 12px; text-align: center; margin-top: 30px;">
          If you didn't request this code, you can safely ignore this email.
        </p>
        
        <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 30px 0;" />
        
        <p style="color: #4a5568; font-size: 11px; text-align: center;">
          © ${new Date().getFullYear()} Evolvo. All rights reserved.
        </p>
      </div>
    `,
  }),
};

/**
 * Send an email using Plunk
 */
async function sendEmail(
  to: string,
  template: { subject: string; body: string }
): Promise<{ success: boolean; error?: string }> {
  if (!plunk) {
    console.warn("Email service not configured (PLUNK_API_KEY missing)");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const response = await plunk.emails.send({
      to,
      subject: template.subject,
      body: template.body,
      from: FROM_EMAIL,
    });

    if (!response.success) {
      logError(new Error("Plunk email failed"), { context: "email", to, subject: template.subject });
      return { success: false, error: "Failed to send email" };
    }

    return { success: true };
  } catch (err) {
    logError(err, { context: "email", to, subject: template.subject });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Send payment failed notification
 */
export async function sendPaymentFailedEmail(
  email: string,
  userName: string,
  amount: string
): Promise<{ success: boolean; error?: string }> {
  const template = templates.paymentFailed(userName, amount);
  return sendEmail(email, template);
}

/**
 * Send subscription canceled notification
 */
export async function sendSubscriptionCanceledEmail(
  email: string,
  userName: string,
  endDate: string
): Promise<{ success: boolean; error?: string }> {
  const template = templates.subscriptionCanceled(userName, endDate);
  return sendEmail(email, template);
}

/**
 * Send admin verification code
 */
export async function sendAdminVerificationEmail(
  email: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const template = templates.adminVerification(code);
  return sendEmail(email, template);
}

export default {
  sendPaymentFailedEmail,
  sendSubscriptionCanceledEmail,
  sendAdminVerificationEmail,
};
