const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const {
  normalizeEmail, getAllowedEmailDomains, isAllowedCollegeEmail,
  safeAuthUser, safeOwnProfile, safeStudentProfile, pickProfileUpdates,
} = require('../utils/userPolicy');

// Synthetic fixtures only; no environment files or application credentials.
const fixture = {
  _id: '111111111111111111111111',
  name: 'Student', email: 'student@mgit.ac.in', department: 'CSE',
  graduationYear: '2027', avatar: 'avatar.svg', rollNumber: 'TEST-1',
  currentlyStudying: 'Yes', phoneNumber: 'test-phone',
  password: 'sensitive-password-fixture', otp: 'sensitive-otp-fixture',
  otpExpiry: new Date(), isVerified: true, __v: 3, internalFutureField: 'private',
};

test('absent configuration defaults to mgit.ac.in', () => {
  const previous = process.env.ALLOWED_EMAIL_DOMAINS;
  delete process.env.ALLOWED_EMAIL_DOMAINS;
  try {
    assert.deepEqual(getAllowedEmailDomains(), ['mgit.ac.in']);
    assert.equal(isAllowedCollegeEmail('student@mgit.ac.in'), true);
  } finally {
    if (previous === undefined) delete process.env.ALLOWED_EMAIL_DOMAINS;
    else process.env.ALLOWED_EMAIL_DOMAINS = previous;
  }
});

test('email normalization is case-insensitive and whitespace tolerant', () => {
  assert.equal(normalizeEmail('  STUDENT@MGIT.AC.IN \n'), 'student@mgit.ac.in');
  assert.equal(isAllowedCollegeEmail('  STUDENT@MGIT.AC.IN ', 'mgit.ac.in'), true);
  for (const input of [null, undefined, 123, {}, [], { $ne: null }]) {
    assert.equal(normalizeEmail(input), '');
    assert.equal(isAllowedCollegeEmail(input, 'mgit.ac.in'), false);
  }
});

test('only exact configured domains match', () => {
  for (const email of [
    'student@gmail.com', 'user@mgit.ac.in.evil.com', 'user@sub.mgit.ac.in',
    'user@@mgit.ac.in', '@mgit.ac.in', 'a b@mgit.ac.in', 'a@mgit.ac.in.',
  ]) assert.equal(isAllowedCollegeEmail(email, 'mgit.ac.in'), false, email);
  const config = ' MGIT.AC.IN, example.edu, sub.mgit.ac.in, ';
  assert.deepEqual(getAllowedEmailDomains(config), ['mgit.ac.in', 'example.edu', 'sub.mgit.ac.in']);
  assert.equal(isAllowedCollegeEmail('user@EXAMPLE.EDU', config), true);
  assert.equal(isAllowedCollegeEmail('user@sub.mgit.ac.in', config), true);
  assert.equal(isAllowedCollegeEmail('user@mgit.ac.in', ' , '), false);
});

for (const [name, serialize, expected] of [
  ['AUTH USER', safeAuthUser, ['_id', 'name', 'email', 'department', 'graduationYear', 'avatar']],
  ['OWN PROFILE', safeOwnProfile, ['_id', 'name', 'email', 'graduationYear', 'department', 'rollNumber', 'currentlyStudying', 'phoneNumber', 'avatar']],
  ['STUDENT PROFILE', safeStudentProfile, ['_id', 'name', 'department', 'graduationYear', 'currentlyStudying', 'avatar']],
]) {
  test(name + ' uses an explicit response allowlist for plain objects and Mongoose documents', () => {
    for (const user of [fixture, new User(fixture)]) {
      assert.deepEqual(Object.keys(serialize(user)).sort(), [...expected].sort());
      const json = JSON.stringify(serialize(user));
      assert.equal(json.includes('sensitive-'), false);
      for (const key of ['password', 'otp', 'otpExpiry', 'isVerified', '__v', 'internalFutureField']) {
        assert.equal(Object.hasOwn(serialize(user), key), false);
      }
    }
  });
}

test('profile update allowlist accepts only the six editable fields', () => {
  const allowed = {
    name: 'Updated Name', graduationYear: '2028', rollNumber: 'TEST-2',
    currentlyStudying: 'No', phoneNumber: '', avatar: '',
  };
  assert.deepEqual(pickProfileUpdates(allowed), allowed);
});

test('protected fields and MongoDB operators are consistently stripped', () => {
  const protectedFields = {
    department: 'ECE', email: 'other@mgit.ac.in', password: 'fixture',
    isVerified: true, otp: 'fixture', otpExpiry: 'future', _id: 'other', __v: 0,
    $set: { isVerified: true }, 'email.domain': 'evil.com',
  };
  for (const [key, value] of Object.entries(protectedFields)) {
    assert.deepEqual(pickProfileUpdates({ name: 'Updated', [key]: value }), { name: 'Updated' });
  }
  assert.deepEqual(pickProfileUpdates(protectedFields), {});
  assert.deepEqual(pickProfileUpdates({ ...fixture, name: 'Updated' }), {
    name: 'Updated', graduationYear: '2027', rollNumber: 'TEST-1',
    currentlyStudying: 'Yes', phoneNumber: 'test-phone', avatar: 'avatar.svg',
  });
});

test('profile updates reject malformed bodies/values and ignore inherited properties', () => {
  for (const body of [null, undefined, [], 'text', { name: { $ne: '' } }, { avatar: 1 }]) {
    assert.throws(() => pickProfileUpdates(body), TypeError);
  }
  assert.deepEqual(pickProfileUpdates(Object.create({ name: 'Inherited' })), {});
  const body = JSON.parse('{"__proto__":{"isVerified":true},"name":"Student"}');
  assert.deepEqual(pickProfileUpdates(body), { name: 'Student' });
  assert.equal({}.isVerified, undefined);
});

test('User email setters normalize new and updated email values', () => {
  const user = new User({ email: ' STUDENT@MGIT.AC.IN ' });
  assert.equal(user.email, 'student@mgit.ac.in');
  user.email = ' OTHER@MGIT.AC.IN ';
  assert.equal(user.email, 'other@mgit.ac.in');
});
