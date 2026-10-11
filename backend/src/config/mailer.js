const nodemailer = require('nodemailer');
const env = require('./env');

/**
 * When SMTP is not configured we fall back to a JSON transport:
 * messages are not sent, only returned to the caller (and logged).
 */
const isSmtpConfigured = Boolean(env.smtp.host && env.smtp.user);

const transporter = isSmtpConfigured
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    })
  : nodemailer.createTransport({ jsonTransport: true });

module.exports = { transporter, isSmtpConfigured };
