// routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { authMiddleware } = require('../middleware/authMiddleware');
const nodemailer = require('nodemailer');
const Group = require('../models/Group'); // Add at the top
const {
  AUTH_USER_FIELDS, OWN_PROFILE_FIELDS, STUDENT_PROFILE_FIELDS,
  normalizeEmail, buildEmailLookup, isAllowedCollegeEmail, safeAuthUser, safeOwnProfile,
  safeStudentProfile, pickProfileUpdates,
} = require('../utils/userPolicy');
const router = express.Router();

// Apply the same normalized college-email policy to every active auth flow.
const requireCollegeEmail = (req, res, next) => {
  const email = normalizeEmail(req.body?.email);
  if (!isAllowedCollegeEmail(email)) {
    return res.status(400).json({ message: 'Use an allowed college email address' });
  }
  req.body.email = email;
  next();
};

const hasValidOtp = (user, otp) => (
  user && typeof otp === 'string' && otp.length > 0 &&
  user.otp === otp && user.otpExpiry != null &&
  Number.isFinite(new Date(user.otpExpiry).getTime()) &&
  Date.now() <= new Date(user.otpExpiry).getTime()
);

// Generate JWT
const generateToken = (user) => {
  const payload = { _id: user._id, email: user.email, name: user.name };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
};

// Sign Up - User Registration
router.post('/register', requireCollegeEmail, async (req, res) => {
  const { name, email, password, graduationYear, department, context } = req.body;

  try {
    const userExists = await User.findOne(buildEmailLookup(email)).select('_id');
    if (userExists) return res.status(400).json({ message: 'Email already in use' });

    const user = new User({
      name,
      email,
      password,
      graduationYear,
      department,
      isVerified: false
    });
    await user.save();

    // Add user to their department group
    const group = await Group.findOne({ name: department });
    if (group && !group.members.includes(user._id)) {
      group.members.push(user._id);
      await group.save();
    }

    // Generate OTP and send email
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 5 * 60 * 1000;
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send OTP via email with context
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    let messageText = `Your RoundRelay registration OTP is: ${otp}`;
    if (context === 'welcome') {
      messageText = `Welcome to RoundRelay!\nYour OTP for registration is: ${otp}`;
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'RoundRelay - Registration OTP',
      text: messageText,
    });

    res.status(201).json({ message: 'Registration successful. Please verify your email.' });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed' });
  }
});

// Login - User Authentication
router.post('/login', requireCollegeEmail, async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne(buildEmailLookup(email)).select([...AUTH_USER_FIELDS, 'password', 'isVerified'].join(' '));
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (user.isVerified !== true || !isAllowedCollegeEmail(user.email)) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: safeAuthUser(user),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update current user's profile
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const updates = pickProfileUpdates(req.body);
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No editable profile fields provided' });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id, { $set: updates }, { new: true, runValidators: true }
    ).select(OWN_PROFILE_FIELDS.join(' '));
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(safeOwnProfile(user));
  } catch (error) {
    const invalid = error instanceof TypeError || ['ValidationError', 'CastError'].includes(error.name);
    res.status(invalid ? 400 : 500).json({ message: invalid ? 'Invalid profile updates' : 'Profile update failed' });
  }
});

// Get current user's profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(OWN_PROFILE_FIELDS.join(' '));
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(safeOwnProfile(user));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users except the current user
router.get('/all', authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } }).select(STUDENT_PROFILE_FIELDS.join(' '));
    res.json(users.map(safeStudentProfile));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Send OTP (general purpose)
router.post('/send-otp', requireCollegeEmail, async (req, res) => {
  const { email, context } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes

  const user = await User.findOneAndUpdate(buildEmailLookup(email), { otp, otpExpiry }).select('_id');
  if (!user) return res.status(404).json({ message: 'User not found' });

  // Send OTP via email with context
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  let messageText = `Your RoundRelay OTP code is: ${otp}. This OTP is valid for 5 minutes. Do not share it with anyone.`;
  if (context === 'welcome') {
    messageText = `Welcome to RoundRelay!\nYour OTP for registration is: ${otp}\nThis OTP is valid for 5 minutes.\nDo not share it with anyone.`;
  } else if (context === 'reset') {
    messageText = `Your RoundRelay password reset OTP is: ${otp}. This OTP is valid for 5 minutes. Do not share it with anyone.`;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: context === 'welcome' ? 'RoundRelay - Registration OTP'
      : context === 'reset' ? 'RoundRelay - Password Reset OTP' : 'RoundRelay - OTP Code',
    text: messageText,
  });

  res.json({ message: 'OTP sent' });
});

// Verify OTP
router.post('/verify-otp', requireCollegeEmail, async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne(buildEmailLookup(email)).select([...AUTH_USER_FIELDS, 'otp', 'otpExpiry', 'isVerified'].join(' '));
  if (!hasValidOtp(user, otp)) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }
  user.otp = undefined;
  user.otpExpiry = undefined;
  user.isVerified = true;
  await user.save();

  // Generate JWT and return user info
  const token = generateToken(user);
  res.json({ token, user: safeAuthUser(user) });
});

// Request password reset (send OTP)
router.post('/forgot-password', requireCollegeEmail, async (req, res) => {
  const { email, context } = req.body;
  const user = await User.findOne(buildEmailLookup(email)).select('_id email');
  if (!user) return res.status(404).json({ message: 'User not found' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = Date.now() + 5 * 60 * 1000;
  user.otp = otp;
  user.otpExpiry = otpExpiry;
  await user.save();

  // Send OTP via email with context
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  let messageText = `RoundRelay password reset OTP: ${otp}. This one-time code is valid for 5 minutes. Do not share it with anyone.`;
  if (context === 'reset') {
    messageText = `RoundRelay password reset OTP: ${otp}. This one-time code is valid for 5 minutes. Do not share it with anyone.`;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'RoundRelay - Password Reset OTP',
    text: messageText,
  });

  res.json({ message: 'OTP sent to your email.' });
});

// Reset password
router.post('/reset-password', requireCollegeEmail, async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const user = await User.findOne(buildEmailLookup(email)).select('_id otp otpExpiry isVerified');
  if (!hasValidOtp(user, otp)) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }
  if (user.isVerified !== true) {
    return res.status(403).json({ message: 'Please verify your email before resetting password.' });
  }
  user.password = newPassword; // Don't hash here!
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();
  res.json({ message: 'Password reset successful. You can now log in.' });
});

// Express 5 forwards rejected async handlers here. Never expose provider,
// database, or validation error details through authentication responses.
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(500).json({ message: 'Authentication request failed' });
});

module.exports = router;
