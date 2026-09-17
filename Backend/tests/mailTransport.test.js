const test = require('node:test');
const assert = require('node:assert/strict');
const { createMailTransport } = require('../utils/mailTransport');

function withBrevoEnv(t) {
  const previousKey = process.env.BREVO_API_KEY;
  const previousFrom = process.env.EMAIL_FROM;
  const previousFetch = global.fetch;

  process.env.BREVO_API_KEY = 'xkeysib-test-fixture';
  process.env.EMAIL_FROM = 'roundrelay.sender@example.com';

  t.after(() => {
    if (previousKey === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = previousKey;
    if (previousFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = previousFrom;
    global.fetch = previousFetch;
  });
}

test('Brevo transport sends OTP mail over HTTPS without exposing the API key in the body', async t => {
  withBrevoEnv(t);
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 201,
      async json() { return { messageId: 'email-fixture' }; },
    };
  };

  const transport = createMailTransport();
  const result = await transport.sendMail({
    from: 'legacy@gmail.com',
    to: 'student@mgit.ac.in',
    subject: 'RoundRelay - Registration OTP',
    text: 'Your RoundRelay registration OTP is: 123456',
  });

  assert.deepEqual(result, { messageId: 'email-fixture' });
  assert.equal(request.url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['api-key'], 'xkeysib-test-fixture');
  assert.equal(request.options.headers['Content-Type'], 'application/json');

  const body = JSON.parse(request.options.body);
  assert.deepEqual(body, {
    sender: {
      name: 'RoundRelay',
      email: 'roundrelay.sender@example.com',
    },
    to: [{ email: 'student@mgit.ac.in' }],
    subject: 'RoundRelay - Registration OTP',
    textContent: 'Your RoundRelay registration OTP is: 123456',
  });
  assert.equal(request.options.body.includes('xkeysib-test-fixture'), false);
});

test('Brevo transport fails closed on provider rejection', async t => {
  withBrevoEnv(t);
  global.fetch = async () => ({ ok: false, status: 403 });

  const transport = createMailTransport();
  await assert.rejects(
    transport.sendMail({
      to: 'student@mgit.ac.in',
      subject: 'RoundRelay - OTP Code',
      text: 'OTP fixture',
    }),
    /Transactional email provider rejected request \(403\)/,
  );
});
