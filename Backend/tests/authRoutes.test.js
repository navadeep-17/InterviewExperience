const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Group = require('../models/Group');
const authRouter = require('../routes/auth');
const usersRouter = require('../routes/users');
const { authMiddleware } = require('../middleware/authMiddleware');

const currentId = '111111111111111111111111';
const targetId = '222222222222222222222222';
const account = {
  _id: currentId, name: 'Student', email: 'student@mgit.ac.in',
  department: 'CSE', graduationYear: '2027', avatar: 'avatar.svg',
  currentlyStudying: 'Yes', rollNumber: 'TEST-1', phoneNumber: 'test-phone',
  isVerified: true, password: 'password-fixture', otp: 'otp-fixture',
  otpExpiry: new Date(Date.now() + 300000), __v: 3, internalFutureField: 'private',
};
const authKeys = ['_id', 'name', 'email', 'department', 'graduationYear', 'avatar'].sort();
const ownKeys = [...authKeys, 'rollNumber', 'currentlyStudying', 'phoneNumber'].sort();
const studentKeys = ['_id', 'name', 'department', 'graduationYear', 'currentlyStudying', 'avatar'].sort();

function assertEmailLookup(filter) {
  assert.deepEqual(filter, { email: /^student@mgit\.ac\.in$/i });
}

// Intentionally return extra fields even after select(), exercising the
// serializer independently of the positive database projection.
function selected(value, requiredFields = []) {
  return {
    select(fields) {
      assert.equal(fields.includes('-'), false);
      for (const field of requiredFields) assert.ok(fields.split(' ').includes(field));
      return Promise.resolve(value);
    },
  };
}

function request(server, method, path, body, token = 'valid-fixture') {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const req = http.request({
      host: '127.0.0.1', port: server.address().port, path, method, headers,
    }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(text) }); }
        catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

test('auth/user HTTP acceptance matrix (isolated database, JWT and mail mocks)', async t => {
  const previousDomains = process.env.ALLOWED_EMAIL_DOMAINS;
  process.env.ALLOWED_EMAIL_DOMAINS = 'mgit.ac.in';
  t.after(() => {
    if (previousDomains === undefined) delete process.env.ALLOWED_EMAIL_DOMAINS;
    else process.env.ALLOWED_EMAIL_DOMAINS = previousDomains;
  });
  t.mock.method(jwt, 'verify', token => {
    if (token !== 'valid-fixture') throw new Error('Invalid or expired token');
    return { _id: currentId, email: 'stale@gmail.com', name: 'Stale JWT name' };
  });
  t.mock.method(jwt, 'sign', () => 'issued-token-fixture');
  t.mock.method(User, 'findById', id => selected(
    id.toString() === currentId ? { ...account } : { ...account, _id: targetId },
  ));
  // Unexpected database or mail access must fail rather than reach a service.
  for (const method of ['find', 'findOne', 'findOneAndUpdate', 'findByIdAndUpdate']) {
    t.mock.method(User, method, () => { throw new Error('Unexpected database call'); });
  }
  t.mock.method(nodemailer, 'createTransport', () => { throw new Error('Unexpected mail call'); });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.get('/identity', authMiddleware, (req, res) => res.json(req.user));
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  for (const token of [null, 'invalid-fixture', 'expired-fixture']) {
    await t.test('student profile rejects absent/invalid/expired JWT: ' + token, async () => {
      assert.equal((await request(server, 'GET', '/api/users/' + targetId, undefined, token)).status, 401);
    });
  }
  await t.test('malformed decoded identity is rejected before database lookup', async t => {
    t.mock.method(jwt, 'verify', () => ({ _id: { $ne: null } }));
    assert.equal((await request(server, 'GET', '/api/users/' + targetId)).status, 401);
  });
  await t.test('deleted account is rejected', async t => {
    t.mock.method(User, 'findById', () => selected(null));
    assert.equal((await request(server, 'GET', '/api/users/' + targetId)).status, 401);
  });
  for (const change of [{ isVerified: false }, { isVerified: undefined }, { email: 'student@gmail.com' }]) {
    await t.test('current database account policy rejects ' + JSON.stringify(change), async t => {
      t.mock.method(User, 'findById', () => selected({ ...account, ...change }));
      assert.equal((await request(server, 'GET', '/api/users/' + targetId)).status, 403);
    });
  }
  await t.test('request identity comes only from current database fields', async () => {
    const res = await request(server, 'GET', '/identity');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      _id: currentId, email: account.email, name: account.name, department: account.department,
    });
  });
  await t.test('student profile is authenticated and contains only student fields', async () => {
    const res = await request(server, 'GET', '/api/users/' + targetId);
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), studentKeys);
  });
  await t.test('invalid profile ID is a clean client error', async () => {
    assert.equal((await request(server, 'GET', '/api/users/not-an-object-id')).status, 400);
  });
  await t.test('missing student profile returns 404', async t => {
    t.mock.method(User, 'findById', id => selected(id === currentId ? account : null));
    assert.equal((await request(server, 'GET', '/api/users/' + targetId)).status, 404);
  });
  await t.test('own profile contains only own-profile fields', async () => {
    const res = await request(server, 'GET', '/api/auth/me');
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ownKeys);
  });
  await t.test('directory excludes requester and uses student fields', async t => {
    t.mock.method(User, 'find', filter => {
      assert.deepEqual(filter, { _id: { $ne: currentId } });
      return selected([{ ...account, _id: targetId }], studentKeys);
    });
    const res = await request(server, 'GET', '/api/auth/all');
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body[0]).sort(), studentKeys);
    assert.equal(res.body[0]._id, targetId);
  });
  await t.test('profile update allows a name and returns safe own profile', async t => {
    const update = t.mock.method(User, 'findByIdAndUpdate', (id, body, options) => {
      assert.equal(id, currentId);
      assert.deepEqual(body, { $set: { name: 'Updated Name' } });
      assert.deepEqual(options, { new: true, runValidators: true });
      return selected({ ...account, name: body.$set.name }, ownKeys);
    });
    const res = await request(server, 'PUT', '/api/auth/me', { name: 'Updated Name' });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Updated Name');
    assert.deepEqual(Object.keys(res.body).sort(), ownKeys);
    assert.equal(update.mock.callCount(), 1);
  });
  await t.test('whole-profile frontend payload cannot write protected fields', async t => {
    t.mock.method(User, 'findByIdAndUpdate', (id, body) => {
      assert.deepEqual(body, { $set: { name: 'Updated Name' } });
      return selected({ ...account, name: body.$set.name });
    });
    const res = await request(server, 'PUT', '/api/auth/me', {
      name: 'Updated Name', _id: targetId, email: 'other@mgit.ac.in', department: 'ECE',
      isVerified: true, password: 'attempt-fixture', otp: 'attempt-fixture',
      otpExpiry: 'future', __v: 4, $set: { isVerified: true },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.department, 'CSE');
    assert.equal(res.body.email, account.email);
  });
  await t.test('protected-only updates are rejected without a database write', async t => {
    const update = t.mock.method(User, 'findByIdAndUpdate', () => { throw new Error('Must not write'); });
    const res = await request(server, 'PUT', '/api/auth/me', {
      department: 'CSE', isVerified: true, password: 'attempt-fixture', otp: 'attempt-fixture',
    });
    assert.equal(res.status, 400);
    assert.equal(update.mock.callCount(), 0);
  });
  for (const path of ['register', 'login', 'send-otp', 'verify-otp', 'forgot-password', 'reset-password']) {
    await t.test(path + ' rejects disallowed and non-string emails before database access', async () => {
      for (const email of ['student@gmail.com', 'student@mgit.ac.in.evil.com', { $ne: null }]) {
        assert.equal((await request(server, 'POST', '/api/auth/' + path, { email })).status, 400);
      }
    });
  }
  await t.test('registration normalizes email and preserves department/group/OTP flow', async t => {
    t.mock.method(User, 'findOne', filter => {
      assertEmailLookup(filter);
      return selected(null);
    });
    const savedUsers = [];
    t.mock.method(User.prototype, 'save', async function () { savedUsers.push(this); return this; });
    const group = { members: [], async save() {} };
    t.mock.method(Group, 'findOne', async filter => {
      assert.deepEqual(filter, { name: 'CSE' });
      return group;
    });
    let sent = 0;
    t.mock.method(nodemailer, 'createTransport', () => ({
      async sendMail(mail) { assert.equal(mail.to, account.email); sent++; },
    }));
    const res = await request(server, 'POST', '/api/auth/register', {
      email: ' STUDENT@MGIT.AC.IN ', name: 'Student', password: 'password-fixture',
      department: 'CSE', graduationYear: '2027',
    });
    assert.equal(res.status, 201);
    assert.equal(savedUsers.length, 2);
    assert.equal(savedUsers[0].email, account.email);
    assert.equal(savedUsers[0].isVerified, false);
    assert.equal(group.members.length, 1);
    assert.equal(sent, 1);
    assert.deepEqual(Object.keys(res.body), ['message']);
  });
  await t.test('registration rejects a mixed-case legacy duplicate without saving a new user', async t => {
    const legacyUser = { ...account, email: 'Student@mgit.ac.in' };
    t.mock.method(User, 'findOne', filter => {
      assertEmailLookup(filter);
      return selected(filter.email.test(legacyUser.email) ? legacyUser : null);
    });
    const save = t.mock.method(User.prototype, 'save', async () => {
      throw new Error('Must not create a duplicate');
    });
    const res = await request(server, 'POST', '/api/auth/register', {
      email: 'student@mgit.ac.in', name: 'Student', password: 'password-fixture',
      department: 'CSE', graduationYear: '2027',
    });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { message: 'Email already in use' });
    assert.equal(save.mock.callCount(), 0);
  });
  await t.test('lowercase login finds a mixed-case legacy account and serializes safe auth user', async t => {
    const legacyUser = { ...account, email: 'Student@mgit.ac.in' };
    t.mock.method(User, 'findOne', filter => {
      assertEmailLookup(filter);
      return selected(filter.email.test(legacyUser.email) ? legacyUser : null, ['password', 'isVerified', ...authKeys]);
    });
    t.mock.method(bcrypt, 'compare', async (input, stored) => input === stored);
    const res = await request(server, 'POST', '/api/auth/login', {
      email: 'student@mgit.ac.in', password: 'password-fixture',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.token, 'issued-token-fixture');
    assert.deepEqual(Object.keys(res.body.user).sort(), authKeys);
  });
  await t.test('OTP verification selects OTP state and never serializes it', async t => {
    let saved = false;
    const user = { ...account, email: 'Student@mgit.ac.in', isVerified: false, async save() { saved = true; } };
    t.mock.method(User, 'findOne', filter => {
      assertEmailLookup(filter);
      return selected(filter.email.test(user.email) ? user : null, ['otp', 'otpExpiry']);
    });
    const res = await request(server, 'POST', '/api/auth/verify-otp', {
      email: ' STUDENT@MGIT.AC.IN ', otp: account.otp,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.token, 'issued-token-fixture');
    assert.deepEqual(Object.keys(res.body.user).sort(), authKeys);
    assert.equal(saved, true);
    assert.equal(user.isVerified, true);
    assert.equal(user.otp, undefined);
    assert.equal(user.otpExpiry, undefined);
  });
  for (const state of [
    { otp: undefined, otpExpiry: undefined }, { otp: account.otp, otpExpiry: undefined },
    { otp: account.otp, otpExpiry: new Date(0) }, { otp: account.otp, otpExpiry: 'invalid' },
  ]) {
    await t.test('OTP verification/reset reject absent or expired OTP state: ' + String(state.otpExpiry), async t => {
      t.mock.method(User, 'findOne', () => selected({ ...account, ...state }));
      for (const path of ['verify-otp', 'reset-password']) {
        const res = await request(server, 'POST', '/api/auth/' + path, { email: account.email, otp: state.otp });
        assert.equal(res.status, 400);
      }
    });
  }
  await t.test('password reset still saves a new password and clears OTP state', async t => {
    let saved = false;
    const user = { ...account, email: 'Student@mgit.ac.in', async save() { saved = true; } };
    t.mock.method(User, 'findOne', filter => {
      assertEmailLookup(filter);
      return selected(filter.email.test(user.email) ? user : null, ['otp', 'otpExpiry', 'isVerified']);
    });
    const res = await request(server, 'POST', '/api/auth/reset-password', {
      email: ' STUDENT@MGIT.AC.IN ', otp: account.otp, newPassword: 'new-password-fixture',
    });
    assert.equal(res.status, 200);
    assert.equal(saved, true);
    assert.equal(user.password, 'new-password-fixture');
    assert.equal(user.otp, undefined);
    assert.equal(user.otpExpiry, undefined);
    assert.deepEqual(Object.keys(res.body), ['message']);
  });
  for (const path of ['send-otp', 'forgot-password']) {
    await t.test(path + ' normalizes email and preserves OTP delivery', async t => {
      let saved = false;
      const user = { ...account, email: 'Student@mgit.ac.in', async save() { saved = true; } };
      const query = path === 'send-otp' ? 'findOneAndUpdate' : 'findOne';
      t.mock.method(User, query, (filter, update) => {
        assertEmailLookup(filter);
        if (update) {
          assert.deepEqual(Object.keys(update).sort(), ['otp', 'otpExpiry']);
          saved = true;
        }
        return selected(filter.email.test(user.email) ? user : null);
      });
      let sent = false;
      t.mock.method(nodemailer, 'createTransport', () => ({
        async sendMail(mail) { assert.equal(mail.to, account.email); sent = true; },
      }));
      const res = await request(server, 'POST', '/api/auth/' + path, { email: ' STUDENT@MGIT.AC.IN ' });
      assert.equal(res.status, 200);
      assert.equal(saved && sent, true);
      assert.deepEqual(Object.keys(res.body), ['message']);
    });
  }
  await t.test('database failures return generic errors without internal details', async t => {
    t.mock.method(User, 'findById', () => { throw new Error('private-database-detail'); });
    const res = await request(server, 'GET', '/api/users/' + targetId);
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { message: 'Unable to authenticate account' });
  });
  await t.test('async OTP failures return JSON without provider/internal details', async t => {
    t.mock.method(User, 'findOne', () => { throw new Error('private-provider-detail'); });
    const res = await request(server, 'POST', '/api/auth/verify-otp', { email: account.email });
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { message: 'Authentication request failed' });
  });
});
