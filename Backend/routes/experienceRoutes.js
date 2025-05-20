const express = require('express');
const router = express.Router();
const Experience = require('../models/Experience');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');
const { upvoteExperience, downvoteExperience } = require('../controllers/experienceController');

// POST: Create new experience (user from token)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const experience = new Experience({
      ...req.body,
      user: req.user._id
    });
    await experience.save();
    res.status(201).json(experience);
  } catch (err) {
    res.status(400).json({ message: 'Server error', error: err.message });
  }
});

// GET: Fetch all experiences with user's name, latest comment (with user), pagination, filters
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (req.query.company) filter.company = { $regex: req.query.company, $options: 'i' };
    if (req.query.role) filter.role = { $regex: req.query.role, $options: 'i' };
    if (req.query.department) filter.department = { $regex: req.query.department, $options: 'i' };
    if (req.query.difficulty) filter.difficulty = { $regex: `^${req.query.difficulty}$`, $options: 'i' };

    // Sorting
    let sort = { createdAt: -1 };
    if (req.query.sortOrder === 'oldest') {
      sort = { createdAt: 1 };
    }

    const total = await Experience.countDocuments(filter);
    const experiences = await Experience.find(filter)
      .populate('user', 'name department graduationYear avatar _id')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Fetch latest comment for each experience, populate user name in aggregation
    const experienceIds = experiences.map(exp => exp._id);
    const latestComments = await Comment.aggregate([
      { $match: { experienceId: { $in: experienceIds } } },
      { $sort: { createdAt: -1 } },
      { $group: {
          _id: "$experienceId",
          text: { $first: "$text" },
          createdAt: { $first: "$createdAt" },
          user: { $first: "$user" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      {
        $unwind: {
          path: "$userInfo",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          text: 1,
          createdAt: 1,
          user: {
            name: "$userInfo.name"
          }
        }
      }
    ]);

    // Map latest comments to experiences
    const userMap = {};
    for (const comment of latestComments) {
      userMap[comment._id.toString()] = {
        text: comment.text,
        createdAt: comment.createdAt,
        user: { name: comment.user?.name || 'Someone' }
      };
    }
    experiences.forEach(exp => {
      exp.latestComment = userMap[exp._id.toString()] || null;
    });

    res.json({
      experiences,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT: Update experience (ownership check)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const experience = await Experience.findById(req.params.id);

    if (!experience) return res.status(404).json({ message: 'Experience not found' });
    if (experience.user.toString() !== req.user._id)
      return res.status(403).json({ message: 'Unauthorized' });

    Object.assign(experience, req.body);
    await experience.save();
    res.json(experience);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE: Delete experience (ownership check)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const experience = await Experience.findById(req.params.id);

    if (!experience) return res.status(404).json({ message: 'Experience not found' });
    if (experience.user.toString() !== req.user._id)
      return res.status(403).json({ message: 'Unauthorized' });

    await experience.deleteOne();
    res.json({ message: 'Experience deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all posts by a user
router.get('/user/:userId', async (req, res) => {
  try {
    const posts = await Experience.find({ user: req.params.userId })
      .sort({ createdAt: -1 })
      .populate('user', 'name department graduationYear avatar _id');
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user posts' });
  }
});

router.post('/:id/upvote', authMiddleware, upvoteExperience);
router.post('/:id/downvote', authMiddleware, downvoteExperience);

module.exports = router;


