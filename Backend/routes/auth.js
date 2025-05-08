require('dotenv').config(); // Load .env variables at the top

const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Path to OTP storage file
const dataDir = path.join(__dirname, '../data');
const OTP_FILE = path.join(dataDir, 'otp-store.json');

// Ensure the data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize or load OTP store
let otpStore = {};
try {
  if (fs.existsSync(OTP_FILE)) {
    const data = fs.readFileSync(OTP_FILE, 'utf8');
    otpStore = JSON.parse(data);
    console.log('Loaded OTP store from file');
  } else {
    fs.writeFileSync(OTP_FILE, JSON.stringify({}));
    console.log('Created new OTP store file');
  }
} catch (error) {
  console.error('Error initializing OTP store:', error);
  otpStore = {};
}

// Save OTP store to file
function saveOtpStore() {
  try {
    fs.writeFileSync(OTP_FILE, JSON.stringify(otpStore));
    console.log('OTP store saved to file');
  } catch (error) {
    console.error('Error saving OTP store:', error);
  }
}

// Load OTP store from file
function loadOtpStore() {
  try {
    if (fs.existsSync(OTP_FILE)) {
      const data = fs.readFileSync(OTP_FILE, 'utf8');
      otpStore = JSON.parse(data);
      console.log('OTP store reloaded from file');
    }
  } catch (error) {
    console.error('Error loading OTP store:', error);
    otpStore = {};
  }
}

// Remove expired OTPs
function cleanupExpiredOtps() {
  const now = Date.now();
  let changed = false;

  Object.keys(otpStore).forEach(email => {
    if (otpStore[email].expiresAt < now) {
      console.log(`Removing expired OTP for ${email}`);
      delete otpStore[email];
      changed = true;
    }
  });

  if (changed) saveOtpStore();
}

// Run cleanup every minute
setInterval(cleanupExpiredOtps, 60 * 1000);

// Rate limiter for OTP requests
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: 'Too many OTP requests. Please try again later.'
});

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Validate MGIT email
function isValidCollegeEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._-]+@mgit\.ac\.in$/;
  return emailRegex.test(email);
}

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Route: Send OTP
router.post('/send-otp', otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Received OTP request for:', email);

    if (!isValidCollegeEmail(email)) {
      return res.status(400).json({ success: false, msg: 'Please use your college email (@mgit.ac.in)' });
    }

    const otp = generateOTP();
    console.log(`Generated OTP for ${email}: ${otp}`);

    otpStore[email] = {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000
    };

    saveOtpStore();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP for MGIT Student Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">MGIT Student Portal</h2>
          <p>Your One-Time Password (OTP) is:</p>
          <h1 style="background-color: #f3f4f6; padding: 10px; text-align: center; font-size: 32px; letter-spacing: 5px;">
            ${otp}
          </h1>
          <p>This OTP is valid for 10 minutes.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Email sent to:', email);

    res.status(200).json({ success: true, msg: 'OTP sent successfully' });
  } catch (err) {
    console.error('Error in /send-otp:', err);
    res.status(500).json({ success: false, msg: 'Failed to send OTP' });
  }
});

// Route: Verify OTP
router.post('/verify-otp', (req, res) => {
  try {
    loadOtpStore();

    const { email, otp } = req.body;
    console.log('Verifying OTP:', { email, otp });

    if (!otpStore[email]) {
      return res.status(400).json({ success: false, msg: 'OTP not found or expired. Please request a new one.' });
    }

    const stored = otpStore[email];

    if (Date.now() > stored.expiresAt) {
      delete otpStore[email];
      saveOtpStore();
      return res.status(400).json({ success: false, msg: 'OTP has expired. Please request a new one.' });
    }

    if (stored.otp !== otp) {
      return res.status(400).json({ success: false, msg: 'Invalid OTP. Please try again.' });
    }

    delete otpStore[email];
    saveOtpStore();
    console.log('OTP verified successfully');

    res.status(200).json({ success: true, msg: 'Email verified successfully' });
  } catch (err) {
    console.error('Error in /verify-otp:', err);
    res.status(500).json({ success: false, msg: 'Server error. Try again later.' });
  }
});

// Debug route for development
router.get('/debug-otp-store', (req, res) => {
  if (process.env.NODE_ENV === 'development') {
    return res.json({ otpStore });
  }
  return res.status(403).json({ msg: 'Forbidden' });
});

module.exports = router;
