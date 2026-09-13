const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Experience = require('../models/Experience');
const { authMiddleware } = require('../middleware/authMiddleware');
const validId = id => typeof id === 'string' && id.length === 24 && /^[a-f\d]{24}$/i.test(id);
const validText = text => typeof text === 'string' && text.trim().length > 0;
const MAX_NESTING = 3;

router.post('/', authMiddleware, async (req, res) => {
  const { experienceId, text, parentCommentId = null } = req.body || {};
  if (!validId(experienceId) || !validText(text) || (parentCommentId !== null && !validId(parentCommentId))) {
    return res.status(400).json({ message: 'Invalid comment input' });
  }
  try {
    const experience = await Experience.findById(experienceId).select('_id');
    if (!experience) return res.status(404).json({ message: 'Experience not found' });
    const visited = new Set();
    let parentId = parentCommentId;
    while (parentId !== null) {
      const key = String(parentId).toLowerCase();
      if (!validId(key) || visited.has(key) || visited.size >= MAX_NESTING - 1) {
        return res.status(400).json({ message: 'Invalid comment nesting' });
      }
      visited.add(key);
      const parent = await Comment.findById(key).select('experienceId parentCommentId');
      if (!parent) return res.status(404).json({ message: 'Parent comment not found' });
      if (String(parent.experienceId).toLowerCase() !== experienceId.toLowerCase()) {
        return res.status(400).json({ message: 'Parent must belong to the same experience' });
      }
      parentId = parent.parentCommentId ?? null;
    }
    const comment = new Comment({ experienceId, user: req.user._id, text: text.trim(), parentCommentId });
    await comment.save();
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ message: 'Unable to create comment' });
  }
});

router.get('/experience/:experienceId', authMiddleware, async (req, res) => {
  if (!validId(req.params.experienceId)) return res.status(400).json({ message: 'Invalid experience ID' });
  try {
    const comments = await Comment.find({ experienceId: req.params.experienceId })
      .populate('user', '_id name avatar')
      .sort({ createdAt: 1 });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch comments' });
  }
});

router.get('/experience/:experienceId/count', authMiddleware, async (req, res) => {
  if (!validId(req.params.experienceId)) return res.status(400).json({ message: 'Invalid experience ID' });
  try {
    const count = await Comment.countDocuments({ experienceId: req.params.experienceId });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Unable to count comments' });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid comment ID' });
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (String(comment.user) !== req.user._id) return res.status(403).json({ message: 'Only the author may edit' });
    if (!validText(req.body?.text)) return res.status(400).json({ message: 'Invalid comment text' });
    comment.text = req.body.text.trim();
    await comment.save();
    res.json(comment);
  } catch (error) {
    res.status(500).json({ message: 'Unable to update comment' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid comment ID' });
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (String(comment.user) !== req.user._id) return res.status(403).json({ message: 'Only the author may delete' });
    // Iterative traversal avoids stack overflow and visits legacy cycles only once.
    const visited = new Set();
    const pending = [String(comment._id)];
    while (pending.length) {
      const id = pending.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      const replies = await Comment.find({ parentCommentId: id, experienceId: comment.experienceId }).select('_id');
      for (const reply of replies) pending.push(String(reply._id));
    }
    await Comment.deleteMany({ _id: { $in: [...visited] }, experienceId: comment.experienceId });
    res.json({ message: 'Comment and replies deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to delete comment' });
  }
});

module.exports = router;
