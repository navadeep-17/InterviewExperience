// routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { authMiddleware } = require('../middleware/authMiddleware');
const Message = require('../models/Message');
const nodemailer = require('nodemailer');
const Group = require('../models/Group'); // Add at the top
const router = express.Router();

// Generate JWT
const generateToken = (user) => {
  const payload = { _id: user._id, email: user.email, name: user.name };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
};

// Sign Up - User Registration
router.post('/register', async (req, res) => {
  const { name, email, password, graduationYear, department, context } = req.body;

  try {
    const userExists = await User.findOne({ email });
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

    let messageText = `Your OTP code is ${otp}`;
    if (context === 'welcome') {
      messageText = `Welcome to InterviewHub!\nYour OTP for registration is: ${otp}`;
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP Code',
      text: messageText,
    });

    res.status(201).json({ message: 'Registration successful. Please verify your email.' });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

// Login - User Authentication
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log('No user found for email:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      console.log('User not verified:', email);
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Password mismatch for user:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update current user's profile
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const updates = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Profile update failed', error: error.message });
  }
});

// Get current user's profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all users except the current user
router.get('/all', authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } }).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Get message history between two users
router.get('/messages/:userId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const otherUserId = req.params.userId;
    const messages = await Message.find({
      $or: [
        { senderId: userId, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: userId }
      ]
    }).sort('timestamp');
    res.json({ messages }); // <-- FIXED
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// Send OTP (general purpose)
router.post('/send-otp', async (req, res) => {
  const { email, context } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes

  const user = await User.findOneAndUpdate({ email }, { otp, otpExpiry });
  if (!user) return res.status(404).json({ message: 'User not found' });

  // Send OTP via email with context
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  let messageText = `Your OTP code is ${otp}`;
  if (context === 'welcome') {
    messageText = `Welcome to CarerStories!\nYour OTP for registration is: ${otp}\nThis OTP is valid for 10 minutes.\nDo not share it with anyone.`;
  } else if (context === 'reset') {
    messageText = `Your OTP to reset your password is: ${otp}`;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'CarerStories - Register OTP',
    text: messageText,
  });

  res.json({ message: 'OTP sent' });
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email });
  if (!user || user.otp !== otp || Date.now() > user.otpExpiry) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }
  user.otp = undefined;
  user.otpExpiry = undefined;
  user.isVerified = true;
  await user.save();

  // Generate JWT and return user info
  const token = generateToken(user);
  res.json({ token, user });
});

// Request password reset (send OTP)
router.post('/forgot-password', async (req, res) => {
  const { email, context } = req.body;
  const user = await User.findOne({ email });
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

  let messageText = `CareerStories password reset OTP: ${otp}. This one-time code is valid for 10 minutes. Do not share it with anyone.`;
  if (context === 'reset') {
    messageText = `CareerStories password reset OTP: ${otp}. This one-time code is valid for 10 minutes. Do not share it with anyone.`;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'CareerStories: Password Reset OTP',
    text: messageText,
  });

  res.json({ message: 'OTP sent to your email.' });
});

// Reset password
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const user = await User.findOne({ email });
  if (!user || user.otp !== otp || Date.now() > user.otpExpiry) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }
  if (!user.isVerified) {
    return res.status(403).json({ message: 'Please verify your email before resetting password.' });
  }
  user.password = newPassword; // Don't hash here!
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();
  res.json({ message: 'Password reset successful. You can now log in.' });
});

// Delete a message
router.delete('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    await Message.findByIdAndDelete(messageId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;
