// Backend/controllers/experienceController.js

const Experience = require('../models/Experience');

exports.createExperience = async (req, res) => {
     try {
          const newExperience = new Experience({
               user: req.user.id,
               ...req.body,
          });

          const savedExperience = await newExperience.save();
          res.status(201).json(savedExperience);
     } catch (error) {
          console.error('Error creating experience:', error);
          res.status(500).json({ message: 'Server error while creating experience' });
     }
};

exports.upvoteExperience = async (req, res) => {
  try {
    const experience = await Experience.findById(req.params.id);
    if (!experience) {
      return res.status(404).json({ message: 'Experience not found' });
    }

    const userId = req.user._id.toString();

    // Remove from downvotedBy if present
    experience.downvotedBy = experience.downvotedBy.filter(id => id.toString() !== userId);

    // If already upvoted, remove upvote (toggle)
    if (experience.upvotedBy.some(id => id.toString() === userId)) {
      experience.upvotedBy = experience.upvotedBy.filter(id => id.toString() !== userId);
      experience.upvotes = Math.max(0, experience.upvotes - 1);
    } else {
      experience.upvotedBy.push(userId);
      experience.upvotes += 1;
      // Remove from downvotes if switching
      if (experience.downvotes > 0) experience.downvotes -= 1;
    }

    await experience.save();
    res.json({ upvotes: experience.upvotes, downvotes: experience.downvotes });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.downvoteExperience = async (req, res) => {
  try {
    const experience = await Experience.findById(req.params.id);
    if (!experience) {
      return res.status(404).json({ message: 'Experience not found' });
    }

    const userId = req.user._id.toString();

    // Remove from upvotedBy if present
    experience.upvotedBy = experience.upvotedBy.filter(id => id.toString() !== userId);

    // If already downvoted, remove downvote (toggle)
    if (experience.downvotedBy.some(id => id.toString() === userId)) {
      experience.downvotedBy = experience.downvotedBy.filter(id => id.toString() !== userId);
      experience.downvotes = Math.max(0, experience.downvotes - 1);
    } else {
      experience.downvotedBy.push(userId);
      experience.downvotes += 1;
      // Remove from upvotes if switching
      if (experience.upvotes > 0) experience.upvotes -= 1;
    }

    await experience.save();
    res.json({ upvotes: experience.upvotes, downvotes: experience.downvotes });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
