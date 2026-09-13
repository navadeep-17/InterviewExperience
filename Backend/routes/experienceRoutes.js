const express = require('express');
const router = express.Router();
const Experience = require('../models/Experience');
const Comment = require('../models/Comment');
const { authMiddleware } = require('../middleware/authMiddleware');
const { createExperience, upvoteExperience, downvoteExperience, pickExperienceContent, presentExperience, ContentInputError, validId } = require('../controllers/experienceController');

// POST: Create new experience (user from token)
router.post('/', authMiddleware, createExperience);

// GET: Fetch all experiences with user's name, latest comment (with user), pagination, filters
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page: rawPage = '1', limit: rawLimit = '10', sortOrder = 'latest' } = req.query;
    const positiveInteger = value => typeof value === 'string' && /^[1-9]\d*$/.test(value) && value === value.trim() && Number.isSafeInteger(Number(value));
    if (!positiveInteger(rawPage) || !positiveInteger(rawLimit) ||
        Object.keys(req.query).some(key => /^(page|limit|company|role|department|difficulty|sortOrder)\[/.test(key))) throw new ContentInputError();
    const page = Number(rawPage);
    const limit = Math.min(Number(rawLimit), 50);
    const skip = (page - 1) * limit;
    if (!Number.isSafeInteger(skip) || !['latest', 'oldest'].includes(sortOrder)) throw new ContentInputError();
    const filter = {};
    for (const key of ['company', 'role', 'department', 'difficulty']) {
      const value = req.query[key];
      if (value === undefined) continue;
      if (typeof value !== 'string') throw new ContentInputError();
      if (!value) continue;
      if (key === 'difficulty') {
        if (!['Easy', 'Medium', 'Hard'].includes(value)) throw new ContentInputError();
        filter.difficulty = value;
      } else {
        filter[key] = { $regex: value.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&'), $options: 'i' };
      }
    }
    const sort = { createdAt: sortOrder === 'oldest' ? 1 : -1 };

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
      experiences: experiences.map(presentExperience),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(error instanceof ContentInputError ? 400 : 500).json({ message: 'Unable to process experience request' });
  }
});

// PUT: Update experience (ownership check)
router.put('/:id', authMiddleware, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid experience ID' });
  try {
    const experience = await Experience.findById(req.params.id);

    if (!experience) return res.status(404).json({ message: 'Experience not found' });
    if (experience.user.toString() !== req.user._id)
      return res.status(403).json({ message: 'Unauthorized' });

    const content = pickExperienceContent(req.body);
    for (const [field, value] of Object.entries(content)) experience[field] = value;
    await experience.save();
    res.json(presentExperience(experience));
  } catch (error) {
    res.status(error instanceof ContentInputError ? 400 : 500).json({ message: 'Unable to process experience request' });
  }
});

// DELETE: Delete experience (ownership check)
router.delete('/:id', authMiddleware, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid experience ID' });
  try {
    const experience = await Experience.findById(req.params.id);

    if (!experience) return res.status(404).json({ message: 'Experience not found' });
    if (experience.user.toString() !== req.user._id)
      return res.status(403).json({ message: 'Unauthorized' });

    await Comment.deleteMany({ experienceId: experience._id });
    await experience.deleteOne();
    res.json({ message: 'Experience deleted successfully' });
  } catch (error) {
    res.status(error instanceof ContentInputError ? 400 : 500).json({ message: 'Unable to process experience request' });
  }
});

// Get all posts by a user
router.get('/user/:userId', authMiddleware, async (req, res) => {
  if (!validId(req.params.userId)) return res.status(400).json({ message: 'Invalid user ID' });
  try {
    const posts = await Experience.find({ user: req.params.userId })
      .sort({ createdAt: -1 })
      .populate('user', 'name department graduationYear avatar _id');
    res.json(posts.map(presentExperience));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user posts' });
  }
});

router.post('/:id/upvote', authMiddleware, upvoteExperience);
router.post('/:id/downvote', authMiddleware, downvoteExperience);

module.exports = router;


