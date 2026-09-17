const nodemailer = require('nodemailer');

const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 10000;

function createResendTransport() {
  return {
    async sendMail(mail) {
      const apiKey = process.env.RESEND_API_KEY?.trim();
      const from = process.env.EMAIL_FROM?.trim();

      if (!apiKey || !from) {
        throw new Error('Transactional email service is not configured');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);

      try {
        const response = await fetch(RESEND_EMAIL_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [mail.to],
            subject: mail.subject,
            text: mail.text,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Transactional email provider rejected request (${response.status})`);
        }

        try {
          return await response.json();
        } catch {
          return { accepted: [mail.to] };
        }
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function createMailTransport() {
  if (process.env.RESEND_API_KEY?.trim()) {
    return createResendTransport();
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

module.exports = { createMailTransport };
