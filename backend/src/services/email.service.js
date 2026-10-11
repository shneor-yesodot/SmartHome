/**
 * E-mail service (external service #2).
 * Sends transactional e-mails through SMTP using Nodemailer.
 */
const env = require('../config/env');
const { transporter, isSmtpConfigured } = require('../config/mailer');
const logger = require('../utils/logger');

const money = (n) => `${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 2 })} ₪`;

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Shared RTL layout for all e-mails. */
const layout = (title, bodyHtml) => `
<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;background:#F6FAF7;padding:24px;color:#16241D">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #E3EAE5;border-radius:16px;overflow:hidden">
    <div style="background:#12A05C;color:#ffffff;padding:18px 24px;font-size:18px;font-weight:bold">SmartHome</div>
    <div style="padding:24px;line-height:1.7">
      <h2 style="margin:0 0 12px;font-size:20px">${escapeHtml(title)}</h2>
      ${bodyHtml}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #E3EAE5;font-size:12px;color:#7C8B83">
      הודעה זו נשלחה אוטומטית ממערכת SmartHome - ניהול משק בית חכם.
    </div>
  </div>
</div>`;

/** `devNote` (a code or a link) is printed to the log when SMTP is not configured, so development still works. */
const send = async ({ to, subject, html, devNote }) => {
  try {
    const info = await transporter.sendMail({ from: env.smtp.from, to, subject, html });
    if (!isSmtpConfigured) {
      logger.info(`[mail:preview] to=${to} subject="${subject}" (SMTP not configured)${devNote ? ` -> ${devNote}` : ''}`);
    }
    return info;
  } catch (err) {
    // A failed e-mail must never break the business flow that triggered it
    logger.error(`Failed to send e-mail to ${to}:`, err.message);
    return null;
  }
};

const sendWelcome = (user) =>
  send({
    to: user.email,
    subject: 'ברוכים הבאים ל-SmartHome',
    html: layout(
      `שלום ${user.name}, טוב שהצטרפת`,
      `<p>החשבון שלך נוצר בהצלחה. הוספנו עבורך קטגוריות התחלתיות, ואפשר כבר לתעד את העסקה הראשונה.</p>
       <p>מומלץ להתחיל מהגדרת תקציב חודשי ומהעלאת קבלה ראשונה.</p>`
    ),
  });

const sendBudgetAlert = (user, { categoryName, spent, limit, percent, exceeded }) =>
  send({
    to: user.email,
    subject: exceeded ? `חריגה מתקציב: ${categoryName}` : `מתקרבים לתקציב: ${categoryName}`,
    html: layout(
      exceeded ? `חרגת מהתקציב בקטגוריה ${categoryName}` : `ניצלת ${Math.round(percent)}% מהתקציב בקטגוריה ${categoryName}`,
      `<table style="width:100%;border-collapse:collapse">
         <tr><td style="padding:6px 0;color:#52635A">הוצאות החודש</td><td style="font-weight:bold">${money(spent)}</td></tr>
         <tr><td style="padding:6px 0;color:#52635A">תקציב חודשי</td><td style="font-weight:bold">${money(limit)}</td></tr>
         <tr><td style="padding:6px 0;color:#52635A">ניצול</td><td style="font-weight:bold;color:${exceeded ? '#D93F3F' : '#B7791F'}">${Math.round(percent)}%</td></tr>
       </table>`
    ),
  });

const sendMonthlySummary = (user, report) =>
  send({
    to: user.email,
    subject: `סיכום חודשי ${report.period.label}`,
    html: layout(
      `הסיכום שלך לחודש ${report.period.label}`,
      `<table style="width:100%;border-collapse:collapse">
         <tr><td style="padding:6px 0;color:#52635A">הכנסות</td><td style="font-weight:bold;color:#12A05C">${money(report.totals.income)}</td></tr>
         <tr><td style="padding:6px 0;color:#52635A">הוצאות</td><td style="font-weight:bold;color:#D93F3F">${money(report.totals.expense)}</td></tr>
         <tr><td style="padding:6px 0;color:#52635A">חיסכון</td><td style="font-weight:bold">${money(report.totals.savings)} (${report.totals.savingsRate}%)</td></tr>
       </table>
       ${
         report.categories.length
           ? `<p style="margin-top:16px">הקטגוריה הגדולה ביותר: <b>${escapeHtml(report.categories[0].name)}</b> - ${money(report.categories[0].total)}</p>`
           : ''
       }`
    ),
  });

const sendVerificationCode = (user, code) =>
  send({
    to: user.email,
    subject: 'קוד האימות שלך ל-SmartHome',
    devNote: `code ${code}`,
    html: layout(
      'אימות כתובת האימייל',
      `<p>זה הקוד שלך להשלמת ההרשמה:</p>
       <p style="font-size:30px;font-weight:bold;letter-spacing:6px;color:#12A05C;margin:12px 0">${code}</p>
       <p style="color:#52635A">הקוד תקף ל-10 דקות. אם לא נרשמת ל-SmartHome, אפשר להתעלם מהודעה זו.</p>`
    ),
  });

const sendPasswordReset = (user, link) =>
  send({
    to: user.email,
    subject: 'איפוס סיסמה ל-SmartHome',
    devNote: link,
    html: layout(
      'איפוס סיסמה',
      `<p>התקבלה בקשה לאיפוס הסיסמה לחשבון שלך.</p>
       <p style="margin:18px 0"><a href="${escapeHtml(link)}" style="background:#12A05C;color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">בחירת סיסמה חדשה</a></p>
       <p style="color:#52635A">הקישור תקף לשעה אחת. אם לא ביקשת לאפס סיסמה, אפשר להתעלם מהודעה זו.</p>`
    ),
  });

module.exports = { sendWelcome, sendBudgetAlert, sendMonthlySummary, sendVerificationCode, sendPasswordReset };
