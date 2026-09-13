const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');
const { STUDENT_PROFILE_FIELDS, safeStudentProfile } = require('../utils/userPolicy');

// Student profiles are available only to authenticated college accounts.
router.get('/:id', authMiddleware, async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }
  try {
    const user = await User.findById(req.params.id).select(STUDENT_PROFILE_FIELDS.join(' '));
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(safeStudentProfile(user));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
