// routes/experience.js
const express = require('express');
const router = express.Router();
const Experience = require('../models/Experience');

// GET all experiences
router.get('/', async (req, res) => {
  try {
    const experiences = await Experience.find().sort({ date: -1 });
    res.json(experiences);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch experiences' });
  }
});

// POST new experience
router.post('/', async (req, res) => {
  try {
    const newExp = new Experience(req.body);
    await newExp.save();
    res.status(201).json(newExp);
  } catch (err) {
    res.status(400).json({ error: 'Failed to save experience' });
  }
});


module.exports = router;
