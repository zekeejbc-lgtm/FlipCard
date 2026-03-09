/**
 * 1SF Directory - Email Templates
 * Professional, no emojis
 * Logo: Mandirigmang Filipino
 * Motto: "Para sa Wika, Para sa Bayan"
 * 
 * Color Palette:
 * - Deep Espresso: #43281C (primary dark)
 * - Antique Cream: #F7F3EB (background)
 * - Sienna Brown: #8B5E3C (accent)
 * - Warm Tan: #BC9B7A (secondary)
 * - Charcoal Black: #1A1A1A (text)
 */

const EMAIL_ASSETS = {
  logoUrl: 'https://drive.google.com/uc?id=11Cy4Q7OhXR5o2ziCyuCwsyJ0evlw5U-1'
};

const EMAIL_COLORS = {
  deepEspresso: '#43281C',
  antiqueCream: '#F7F3EB',
  siennaBrown: '#8B5E3C',
  warmTan: '#BC9B7A',
  charcoalBlack: '#1A1A1A'
};

/**
 * Build a polished email verification template
 * @param {Object} payload
 * @param {string} payload.code - 6-digit OTP code
 * @param {string} payload.emailType - 'personal' | 'school'
 * @param {string} [payload.recipientEmail]
 * @returns {{subject: string, html: string}}
 */
function buildVerificationEmail(payload) {
  const { code, emailType, recipientEmail } = payload;
  const emailLabel = emailType === 'school' ? 'School Email Verification' : 'Email Verification';
  const subject = `1SF Directory | ${emailLabel}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background:${EMAIL_COLORS.antiqueCream}; font-family:'Segoe UI', Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" style="background:${EMAIL_COLORS.antiqueCream}; padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 6px 18px rgba(67,40,28,0.12);">
          <!-- Header with Deep Espresso background -->
          <tr>
            <td style="padding:24px 32px 16px 32px; background:${EMAIL_COLORS.deepEspresso};">
              <table width="100%" role="presentation">
                <tr>
                  <td width="72" valign="middle" align="left">
                    <img src="${EMAIL_ASSETS.logoUrl}" alt="Mandirigmang Filipino" width="64" height="64" style="display:block; border-radius:8px; object-fit:cover; border:2px solid ${EMAIL_COLORS.warmTan};" />
                  </td>
                  <td valign="middle" align="left" style="color:${EMAIL_COLORS.antiqueCream}; padding-left:14px;">
                    <div style="font-size:20px; font-weight:700; letter-spacing:0.3px;">Mandirigmang Filipino</div>
                    <div style="font-size:13px; color:${EMAIL_COLORS.warmTan}; margin-top:4px; font-style:italic;">"Para sa Wika, Para sa Bayan"</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent bar -->
          <tr>
            <td style="height:4px; background:linear-gradient(90deg, ${EMAIL_COLORS.siennaBrown}, ${EMAIL_COLORS.warmTan});"></td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px 32px 16px 32px;">
              <div style="font-size:22px; font-weight:700; color:${EMAIL_COLORS.deepEspresso}; margin-bottom:10px;">${emailLabel}</div>
              <div style="font-size:14px; color:${EMAIL_COLORS.charcoalBlack}; line-height:1.7;">
                Use the code below to verify your ${emailType === 'school' ? 'school email' : 'email address'}. This code is valid for a limited time.
              </div>
            </td>
          </tr>

          <!-- OTP Code Box with Sienna Brown theme -->
          <tr>
            <td style="padding:12px 32px 24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${EMAIL_COLORS.antiqueCream}; border:2px solid ${EMAIL_COLORS.siennaBrown}; border-radius:12px;">
                <tr>
                  <td align="center" style="padding:24px 16px;">
                    <div style="font-size:12px; color:${EMAIL_COLORS.siennaBrown}; font-weight:600; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Your Verification Code</div>
                    <div style="font-size:36px; letter-spacing:10px; font-weight:700; color:${EMAIL_COLORS.deepEspresso};">${code}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security notice -->
          <tr>
            <td style="padding:0 32px 20px 32px;">
              <div style="font-size:14px; color:#57534e; line-height:1.6;">
                If you did not request this verification, you can safely ignore this email. No changes will be made to your account.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px; background:${EMAIL_COLORS.antiqueCream}; border-top:1px solid ${EMAIL_COLORS.warmTan};">
              <div style="font-size:12px; color:${EMAIL_COLORS.siennaBrown}; line-height:1.6;">
                Sent to <strong>${recipientEmail || 'your email'}</strong> as part of 1SF Directory verification.
              </div>
              <div style="font-size:11px; color:${EMAIL_COLORS.warmTan}; margin-top:8px;">
                1SF Directory | Mandirigmang Filipino
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

/**
 * Send verification email using MailApp
 * @param {Object} payload
 * @param {string} payload.to - recipient email
 * @param {string} payload.code - 6-digit OTP code
 * @param {string} payload.emailType - 'personal' | 'school'
 */
function sendVerificationEmail(payload) {
  const { to, code, emailType } = payload;
  const { subject, html } = buildVerificationEmail({ code, emailType, recipientEmail: to });
  MailApp.sendEmail({ to, subject, htmlBody: html });
  return { success: true, subject };
}
