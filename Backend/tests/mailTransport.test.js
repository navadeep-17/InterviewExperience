const test = require('node:test');
const assert = require('node:assert/strict');
const { createMailTransport } = require('../utils/mailTransport');

function withResendEnv(t) {
  const previousKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.EMAIL_FROM;
  const previousFetch = global.fetch;

  process.env.RESEND_API_KEY = 're_test_fixture';
  process.env.EMAIL_FROM = 'RoundRelay <noreply@example.com>';

  t.after(() => {
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
    if (previousFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = previousFrom;
    global.fetch = previousFetch;
  });
}

test('Resend transport sends OTP mail over HTTPS without exposing the API key in the body', async t => {
  withResendEnv(t);
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      async json() { return { id: 'email-fixture' }; },
    };
  };

  const transport = createMailTransport();
  const result = await transport.sendMail({
    from: 'legacy@gmail.com',
    to: 'student@mgit.ac.in',
    subject: 'RoundRelay - Registration OTP',
    text: 'Your RoundRelay registration OTP is: 123456',
  });

  assert.deepEqual(result, { id: 'email-fixture' });
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.Authorization, 'Bearer re_test_fixture');
  assert.equal(request.options.headers['Content-Type'], 'application/json');

  const body = JSON.parse(request.options.body);
  assert.deepEqual(body, {
    from: 'RoundRelay <noreply@example.com>',
    to: ['student@mgit.ac.in'],
    subject: 'RoundRelay - Registration OTP',
    text: 'Your RoundRelay registration OTP is: 123456',
  });
  assert.equal(request.options.body.includes('re_test_fixture'), false);
});

test('Resend transport fails closed on provider rejection', async t => {
  withResendEnv(t);
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
