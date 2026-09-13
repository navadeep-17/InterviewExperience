const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { normalizeEmail, isAllowedCollegeEmail } = require('../utils/userPolicy');

class AuthenticationError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.code = status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : 'SERVER_ERROR';
  }
}

// Shared by HTTP and Socket.IO; JWT claims never supply current account identity.
const authenticateToken = async (token) => {
  if (typeof token !== 'string' || !token.trim()) {
    throw new AuthenticationError(401, 'No token, authorization denied');
  }
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new AuthenticationError(401, 'Token is not valid');
  }
  if (!decoded || typeof decoded._id !== 'string' || !/^[a-f\d]{24}$/i.test(decoded._id)) {
    throw new AuthenticationError(401, 'Token is not valid');
  }
  let user;
  try {
    user = await User.findById(decoded._id).select('_id email name department isVerified');
  } catch (err) {
    throw new AuthenticationError(500, 'Unable to authenticate account');
  }
  if (!user) throw new AuthenticationError(401, 'Account no longer exists');
  if (user.isVerified !== true || !isAllowedCollegeEmail(user.email)) {
    throw new AuthenticationError(403, 'A verified college account is required');
  }
  return {
    _id: user._id.toString(),
    email: normalizeEmail(user.email),
    name: user.name,
    department: user.department,
  };
};

const authMiddleware = async (req, res, next) => {
  const authorization = req.header('Authorization');
  const match = typeof authorization === 'string' && authorization.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }
  try {
    req.user = await authenticateToken(match[1]);
  } catch (err) {
    const known = err instanceof AuthenticationError;
    return res.status(known ? err.status : 500).json({
      message: known ? err.message : 'Unable to authenticate account',
    });
  }
  next();
};

module.exports = { authMiddleware, authenticateToken, AuthenticationError };
