import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

function transporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
}

export async function sendMail({ to, subject, html }) {
  const from = process.env.SMTP_FROM || 'SmartHome <noreply@localhost>';
  const tx = transporter();
  if (!tx) {
    console.log('[email:dev]', { to, subject, html });
    return { queued: false, dev: true };
  }
  await tx.sendMail({ from, to, subject, html });
  return { queued: true };
}

export function otpEmail(code) {
  return {
    subject: 'SmartHome verification code',
    html: `<div dir="rtl" style="font-family:Arial,sans-serif"><h2>קוד אימות</h2><p>הקוד שלך: <strong style="font-size:24px">${code}</strong></p><p>הקוד תקף ל-10 דקות.</p></div>`,
  };
}

export function resetEmail(link) {
  return {
    subject: 'SmartHome password reset',
    html: `<div dir="rtl" style="font-family:Arial,sans-serif"><h2>איפוס סיסמה</h2><p><a href="${link}">לחצו כאן לאיפוס הסיסמה</a></p><p>הקישור תקף לשעה.</p></div>`,
  };
}
