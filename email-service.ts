// server/email-service.ts
import { MailService } from "@sendgrid/mail";
import * as EmailService from "./email-service";


if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailer = new MailService();
mailer.setApiKey(process.env.SENDGRID_API_KEY);

const FROM_EMAIL =
  process.env.FROM_EMAIL || "no-reply@vitecab.com";

const API_BASE_URL =
  process.env.API_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  "http://localhost:5000";

const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || "http://localhost:5173";

// -------- helpers ----------
type MaybeUser = { email: string } | string;
const toEmail = (v: MaybeUser) => (typeof v === "string" ? v : v?.email || "");

async function sendWithRetry(
  payload: Parameters<typeof mailer.send>[0],
  attempts = 3
) {
  let lastErr: any;
  for (let i = 1; i <= attempts; i++) {
    try {
      await mailer.send(payload);
      return true;
    } catch (err: any) {
      lastErr = err;
      const code = err?.code || err?.cause?.code;
      // transient DNS / timeout
      if (code !== "EAI_AGAIN" && code !== "ETIMEDOUT") break;
      await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
  console.error("SendGrid email error:", lastErr?.response?.body || lastErr);
  return false;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<boolean> {
  const ok = await sendWithRetry({
    to,
    from: FROM_EMAIL,
    subject,
    html,
    text: text || "",
  });
  if (ok) console.log(`Email sent to ${to} :: ${subject}`);
  return ok;
}

/* ---------- shared HTML styling helpers ---------- */
function wrapEmail(title: string, inner: string) {
  return `
  <html>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:Inter,Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
            <tr>
              <td style="background:#e63946;color:#fff;padding:16px 24px;font-size:20px;font-weight:700;">
                ${title}
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                ${inner}
              </td>
            </tr>
            <tr>
              <td style="background:#0f172a;color:#cbd5e1;padding:12px 24px;font-size:12px;text-align:center">
                © ${new Date().getFullYear()} ViteCab. All rights reserved.
              </td>
            </tr>
          </table>
          <div style="font-size:12px;color:#94a3b8;margin-top:12px;">This is an automated email.</div>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

function btn(href: string, label: string) {
  return `<a href="${href}" target="_blank" rel="noopener"
            style="display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;
                   padding:12px 18px;border-radius:8px;font-weight:600">${label}</a>`;
}

/* ---------- core flows ---------- */

export async function sendVerificationEmail(
  userOrEmail: MaybeUser,
  token: string
) {
  const email = toEmail(userOrEmail);
  const verifyUrl = `${FRONTEND_BASE_URL}/auth/email-verification?token=${encodeURIComponent(
    token
  )}`;

  const subject = "Verify your ViteCab account";
  const html = wrapEmail(
    "🔐 Verify Your Email",
    `
      <p>Welcome to <strong>ViteCab</strong>!</p>
      <p>Please verify your email to continue.</p>
      <p style="margin:16px 0">${btn(verifyUrl, "Verify my email")}</p>
      <p style="font-size:12px;color:#64748b">If the button doesn't work, copy this URL:<br/>${verifyUrl}</p>
    `
  );
  const text = `Verify your ViteCab account: ${verifyUrl}`;
  return sendEmail(email, subject, html, text);
}

export async function sendPasswordResetEmail(
  userOrEmail: MaybeUser,
  token: string
) {
  const email = toEmail(userOrEmail);
  const resetUrl = `${FRONTEND_BASE_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;

  const subject = "Reset your ViteCab password";
  const html = wrapEmail(
    "↩️ Reset Password",
    `
      <p>We received a password reset request for your account.</p>
      <p style="margin:16px 0">${btn(resetUrl, "Reset my password")}</p>
      <p style="font-size:12px;color:#64748b">If the button doesn't work, copy this URL:<br/>${resetUrl}</p>
    `
  );
  const text = `Reset your ViteCab password: ${resetUrl}`;
  return sendEmail(email, subject, html, text);
}

/* === Partner: applicant confirmation (routes.ts expects this exact name/signature) === */
export async function sendPartnerApplicationConfirmation(opts: {
  email: string;
  fullName: string;
  company?: string;
  website: string;
  country: string;
  payoutMethod: string;
  description: string;
}) {
  const { email, fullName, company = "", website, country, payoutMethod, description } = opts;

  const subject = "We received your partner application";
  const body = `
    <p style="margin:0 0 12px 0">Hi <b>${fullName}</b>,</p>
    <p style="margin:0 0 12px 0">Thanks for your partner application. Our team will review it within 24–48 hours.</p>

    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:8px 0 16px 0">
      <p style="margin:0 0 8px 0;color:#0f172a;font-weight:600">Summary</p>
      ${company ? `<p style="margin:2px 0"><b>Company:</b> ${company}</p>` : ""}
      <p style="margin:2px 0"><b>Website/Social:</b> ${website}</p>
      <p style="margin:2px 0"><b>Country:</b> ${country}</p>
      <p style="margin:2px 0"><b>Payout Method:</b> ${payoutMethod}</p>
      <p style="margin:8px 0"><b>Your plan to promote:</b><br/>${description}</p>
    </div>

    <p style="margin:0 0 8px 0;color:#334155">We’ll get back to you by email.</p>
  `;
  const html = wrapEmail("✅ Application Received", body);
  const text =
`Hi ${fullName},
Thanks for your partner application. We will review it within 24–48 hours.

${company ? `Company: ${company}\n` : ""}Website: ${website}
Country: ${country}
Payout: ${payoutMethod}
Plan: ${description}`;

  return sendEmail(email, subject, html, text);
}

/* === Partner: admin notification (routes.ts passes NO adminEmail; read it from .env) === */
export async function sendPartnerApplicationNotification(opts: {
  fullName: string;
  email: string;
  company?: string;
  website: string;
  country: string;
  payoutMethod: string;
  description: string;
}) {
  const adminEmail =
    process.env.PARTNER_ADMIN_INBOX ||
    process.env.ADMIN_EMAIL ||
    "partners@vitecab.com";

  const base = FRONTEND_BASE_URL;
  const adminPanel = `${base}/admin/partners`;

  const { fullName, email, company = "", website, country, payoutMethod, description } = opts;

  const subject = `New Partner Application: ${fullName}${company ? " (" + company + ")" : ""}`;

  const card = `
    <p style="margin:0 0 12px 0;color:#0f172a;font-weight:700">New Partner Application Received</p>
    <p style="margin:0 0 16px 0;color:#334155">A new partner application has been submitted to ViteCab and requires review.</p>

    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:8px 0 16px 0">
      <p style="margin:0 0 8px 0;color:#0f172a;font-weight:600">Applicant Details:</p>
      <p style="margin:2px 0"><b>Full Name:</b> ${fullName}</p>
      <p style="margin:2px 0"><b>Email:</b> ${email}</p>
      ${company ? `<p style="margin:2px 0"><b>Company:</b> ${company}</p>` : ""}
      <p style="margin:2px 0"><b>Website/Social:</b> ${website}</p>
      <p style="margin:2px 0"><b>Country:</b> ${country}</p>
      <p style="margin:2px 0"><b>Preferred Payout:</b> ${payoutMethod}</p>
      <p style="margin:8px 0"><b>Promotion Strategy:</b><br/>${description}</p>
    </div>

    <p style="margin:0 0 12px 0;color:#b91c1c"><b>Action Required:</b> Please review within 24–48 hours.</p>
    <ul style="margin:0 0 16px 18px;color:#334155">
      <li>Review the applicant’s website/social presence</li>
      <li>Verify legitimacy and audience quality</li>
      <li>Approve/Reject in the Admin Panel</li>
    </ul>

    ${btn(adminPanel, "Open Admin → Partner Approvals")}
  `;

  const html = wrapEmail("🌟 New Partner Application", card);
  const text =
`New Partner Application
Name: ${fullName}
Email: ${email}
${company ? `Company: ${company}\n` : ""}Website: ${website}
Country: ${country}
Payout: ${payoutMethod}
Plan: ${description}
Open Admin: ${adminPanel}`;

  // Send only to admin; applicant gets a separate confirmation
  await sendEmail(adminEmail, subject, html, text);
  return true;
}

// === Partner: approval email (routes often use this name) ===
export async function sendPartnerWelcomeEmail(opts: {
  email: string;
  fullName: string;
  username?: string;
  tempPassword: string;
  loginUrl?: string;
}) {
  const { email, fullName, tempPassword, username } = opts;

  // ✅ SAFE login URL builder:
  // 1) /auth/login open karega
  // 2) agar aapke project me /login hai to /auth/login page redirect kar dega (Step 2 me bana rahe hain)
  const base = process.env.FRONTEND_BASE_URL || "http://localhost:5174";
  const loginUrl = opts.loginUrl || `${base}/auth/login`;

  const subject = "Your partner account has been approved";
  const html = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:24px;font-family:Arial,sans-serif;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden">
            <tr>
              <td style="padding:24px 24px 8px 24px;border-bottom:1px solid #eee">
                <img src="https://vitecab.com/vitecab-logo.svg" alt="ViteCab" style="height:34px">
              </td>
            </tr>
            <tr>
              <td style="padding:24px">
                <h2 style="margin:0 0 12px 0;color:#111;">Welcome, ${fullName}!</h2>
                <p style="margin:0 0 16px 0;color:#444;">
                  Your partner account has been <b>approved</b>. Use the temporary credentials below to login:
                </p>
                <table cellpadding="0" cellspacing="0" style="margin:12px 0 16px 0">
                  ${username ? `<tr><td style="padding:6px 12px;background:#f7f7f7;border-radius:6px">Username: <b>${username}</b></td></tr>` : ``}
                  <tr><td style="padding:6px 12px;background:#f7f7f7;border-radius:6px;margin-top:8px;display:inline-block">Temporary Password: <b>${tempPassword}</b></td></tr>
                </table>
                <p style="margin:0 0 18px 0;color:#444;">Please login and change your password immediately.</p>
                <p>
                  <a href="${loginUrl}" style="background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block">Log in to your account</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;color:#888;font-size:12px;border-top:1px solid #eee">
                © ViteCab — Automated partner onboarding
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
  const text =
    `Hi ${fullName}, Your partner account has been approved.\n` +
    (username ? `Username: ${username}\n` : "") +
    `Temporary Password: ${tempPassword}\nLogin: ${loginUrl}\nPlease change your password after login.`;

  return sendEmail(email, subject, html, text);
}

export async function sendWelcomeEmail(userOrEmail: MaybeUser) {
  const email = toEmail(userOrEmail);
  const subject = "Welcome to ViteCab";
  const html = wrapEmail(
    "🎉 Welcome",
    `<p>Your email has been verified successfully.</p><p>You can now log in to your account.</p>`
  );
  const text = "Your email has been verified successfully. You can now log in.";
  return sendEmail(email, subject, html, text);
}

// keep your booking confirmation too
export async function sendBookingConfirmation(params: {
  to: string;
  bookingId: string;
  bookingDetails: any;
}): Promise<boolean> {
  const { to, bookingId, bookingDetails } = params;
  const isImmediate = bookingDetails.bookingType === "now";
  const total = bookingDetails.totalPrice ?? bookingDetails.totalAmount ?? 0;

  const html = `
  <html><body style="font-family:Inter,Segoe UI,Arial,sans-serif">
    <h2>ViteCab Booking Confirmation</h2>
    <p>Booking ID: <strong>${bookingId}</strong></p>
    <p>Status: ${isImmediate ? "Immediate" : "Scheduled"}</p>
    <p>From: ${bookingDetails.pickupLocation}</p>
    <p>To: ${bookingDetails.dropoffLocation}</p>
    <p>Total: €${(Number(total) || 0).toFixed(2)}</p>
  </body></html>`;
  const text = `Booking ${bookingId} - €${(Number(total) || 0).toFixed(2)}`;

  return sendWithRetry({
    to,
    from: FROM_EMAIL,
    subject: `ViteCab Booking Confirmed - ${bookingId} ${
      isImmediate ? "(Immediate)" : "(Scheduled)"
    }`,
    html,
    text,
  });
}
// === ViteCab: driver/KYC/billing helpers (used by routes.ts) ===
export async function sendDocsReadyForReviewEmail(driver: any) {
  const admin =
    process.env.PARTNER_ADMIN_INBOX ||
    process.env.ADMIN_EMAIL ||
    "admin@example.com";

  const subject = "Driver docs ready for review";
  const html = wrapEmail(
    "📄 Driver Documents Ready",
    `<p>Driver <b>#${driver?.id}</b> submitted all required documents.</p>`
  );
  const text = `Driver #${driver?.id} submitted all documents.`;

  return sendEmail(admin, subject, html, text);
}

export async function sendKycRequestReviewEmail(driver: any) {
  const admin =
    process.env.PARTNER_ADMIN_INBOX ||
    process.env.ADMIN_EMAIL ||
    "admin@example.com";

  const notes = driver?.manualKycNotes || "-";
  const subject = "KYC review requested";
  const html = wrapEmail(
    "📝 KYC Review Requested",
    `<p>Driver <b>#${driver?.id}</b> requested manual KYC review.</p>
     <p><b>Notes:</b> ${notes}</p>`
  );
  const text = `Driver #${driver?.id} requested KYC review. Notes: ${notes}`;

  return sendEmail(admin, subject, html, text);
}

export async function sendKycDecisionEmail(driver: any, decision: "approved" | "rejected") {
  const to = (driver?.user?.email || driver?.email || "").toString();
  if (!to) return false;

  const subject = `Your KYC was ${decision}`;
  const html = wrapEmail(
    "🔎 KYC Decision",
    `<p>Your KYC status: <b>${decision.toUpperCase()}</b>.</p>`
  );
  const text = `Your KYC status: ${decision}`;

  return sendEmail(to, subject, html, text);
}

export async function sendPayoutUpdatedEmail(driver: any) {
  const to = (driver?.user?.email || driver?.email || "").toString();
  if (!to) return false;

  const subject = "Payout method updated";
  const html = wrapEmail("💸 Payout Updated", `<p>Your payout method has been updated.</p>`);
  const text = "Your payout method has been updated.";

  return sendEmail(to, subject, html, text);
}

// Optional: notify user/admin that a billing statement was generated.
// Keep it lightweight; routes already stream the file.
export async function sendInvoiceEmail(_userId: number, _format: string) {
  return true; // no-op; customize later if you want an email alert
}
// === /helpers ===

/* ---- Named service object (routes use: EmailService.x) ---- */
export const EmailService = {
  sendEmail,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPartnerApplicationConfirmation,
  sendPartnerApplicationNotification,
  sendPartnerWelcomeEmail,
  sendBookingConfirmation,

  // NEW:
  sendDocsReadyForReviewEmail,
  sendKycRequestReviewEmail,
  sendKycDecisionEmail,
  sendPayoutUpdatedEmail,
  sendInvoiceEmail,
};

// ---- Also attach to globalThis so routes can call without importing ----
;(globalThis as any).EmailService = EmailService;

// default export (in case)
export default EmailService;
