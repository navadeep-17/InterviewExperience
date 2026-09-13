const AUTH_USER_FIELDS = Object.freeze([
  '_id', 'name', 'email', 'department', 'graduationYear', 'avatar',
]);
const OWN_PROFILE_FIELDS = Object.freeze([
  '_id', 'name', 'email', 'graduationYear', 'department', 'rollNumber',
  'currentlyStudying', 'phoneNumber', 'avatar',
]);
const STUDENT_PROFILE_FIELDS = Object.freeze([
  '_id', 'name', 'department', 'graduationYear', 'currentlyStudying', 'avatar',
]);
const PROFILE_UPDATE_FIELDS = Object.freeze([
  'name', 'graduationYear', 'rollNumber', 'currentlyStudying', 'phoneNumber', 'avatar',
]);

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function buildEmailLookup(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new TypeError('Email must be a non-empty string');
  const escaped = normalized.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
  // Match legacy casing without changing stored records or index definitions.
  return { email: new RegExp('^' + escaped + '$', 'i') };
}

function getAllowedEmailDomains(config = process.env.ALLOWED_EMAIL_DOMAINS) {
  return (config === undefined ? 'mgit.ac.in' : config)
    .split(',').map(domain => domain.trim().toLowerCase()).filter(Boolean);
}

function isAllowedCollegeEmail(email, config = process.env.ALLOWED_EMAIL_DOMAINS) {
  const normalized = normalizeEmail(email);
  if (!/^[^@\s]+@[^@\s]+$/.test(normalized)) return false;
  return getAllowedEmailDomains(config).includes(normalized.split('@')[1]);
}

function pickFields(user, fields) {
  const result = {};
  for (const field of fields) {
    if (user[field] !== undefined) result[field] = user[field];
  }
  return result;
}

const safeAuthUser = user => pickFields(user, AUTH_USER_FIELDS);
const safeOwnProfile = user => pickFields(user, OWN_PROFILE_FIELDS);
const safeStudentProfile = user => pickFields(user, STUDENT_PROFILE_FIELDS);

function pickProfileUpdates(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new TypeError('Profile updates must be an object');
  }
  const updates = {};
  // The existing frontend submits the entire profile. Ignore all non-editable
  // fields consistently, including protected fields and MongoDB operators.
  for (const field of PROFILE_UPDATE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    if (typeof body[field] !== 'string') {
      throw new TypeError('Profile fields must be strings');
    }
    updates[field] = body[field];
  }
  return updates;
}

module.exports = {
  AUTH_USER_FIELDS, OWN_PROFILE_FIELDS, STUDENT_PROFILE_FIELDS,
  PROFILE_UPDATE_FIELDS, normalizeEmail, buildEmailLookup, getAllowedEmailDomains,
  isAllowedCollegeEmail, safeAuthUser, safeOwnProfile, safeStudentProfile,
  pickProfileUpdates,
};
