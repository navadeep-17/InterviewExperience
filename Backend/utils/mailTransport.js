const nodemailer = require('nodemailer');

const BREVO_EMAIL_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const TRANSACTIONAL_EMAIL_TIMEOUT_MS = 10000;

function createBrevoTransport() {
  return {
    async sendMail(mail) {
      const apiKey = process.env.BREVO_API_KEY?.trim();
      const fromEmail = process.env.EMAIL_FROM?.trim();

      if (!apiKey || !fromEmail) {
        throw new Error('Transactional email service is not configured');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TRANSACTIONAL_EMAIL_TIMEOUT_MS);

      try {
        const response = await fetch(BREVO_EMAIL_ENDPOINT, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: {
              name: 'RoundRelay',
              email: fromEmail,
            },
            to: [{ email: mail.to }],
            subject: mail.subject,
            textContent: mail.text,
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
  if (process.env.BREVO_API_KEY?.trim()) {
    return createBrevoTransport();
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
