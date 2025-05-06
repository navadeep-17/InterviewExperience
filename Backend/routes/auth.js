const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  const { name, email, password, graduationYear, department } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: "User exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, graduationYear, department });
    await user.save();

    const token = jwt.sign({ id: user._id }, "jwtsecret", { expiresIn: "1h" });
    res.json({ token, user: { id: user._id, name, email } });
  } catch (err) {
    console.log("Error registering user:", err);  // Corrected log statement
    res.status(500).json({ msg: "Server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, "jwtsecret", { expiresIn: "1h" });
    res.json({ token, user: { id: user._id, name: user.name, email } });
  } catch (err) {
    console.log("Error logging in:", err);  // Corrected log statement
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
