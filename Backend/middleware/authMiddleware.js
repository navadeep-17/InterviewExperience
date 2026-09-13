const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { normalizeEmail, isAllowedCollegeEmail } = require('../utils/userPolicy');


// Registration controller (if needed elsewhere)
const register = async (req, res) => {
  const { name, email, password, graduationYear, department } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      graduationYear,
      department
    });

    await newUser.save();

    // Generate token with _id
    const token = jwt.sign(
      { _id: newUser._id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({ token });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ msg: 'Server error during registration' });
  }
};

// Login controller (if needed elsewhere)
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Generate token with _id
    const token = jwt.sign(
      { _id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ msg: 'Server error during login' });
  }
};

// Auth middleware (this is what you should import in experienceRoutes.js)
const authMiddleware = async (req, res, next) => {
  const authorization = req.header('Authorization');
  const match = typeof authorization === 'string' && authorization.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }
  let decoded;
  try {
    decoded = jwt.verify(match[1], process.env.JWT_SECRET);
    if (!decoded || typeof decoded._id !== 'string' || !/^[a-f\d]{24}$/i.test(decoded._id)) {
      return res.status(401).json({ message: 'Token is not valid' });
    }
  } catch (err) {
    return res.status(401).json({ message: 'Token is not valid' });
  }
  try {
    const user = await User.findById(decoded._id).select('_id email name department isVerified');
    if (!user) return res.status(401).json({ message: 'Account no longer exists' });
    if (user.isVerified !== true || !isAllowedCollegeEmail(user.email)) {
      return res.status(403).json({ message: 'A verified college account is required' });
    }
    req.user = {
      _id: user._id.toString(),
      email: normalizeEmail(user.email),
      name: user.name,
      department: user.department,
    };
  } catch (err) {
    return res.status(500).json({ message: 'Unable to authenticate account' });
  }
  next();
};

module.exports = { register, login, authMiddleware };
