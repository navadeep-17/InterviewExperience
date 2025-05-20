const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const { authMiddleware } = require('../middleware/authMiddleware');

// POST: Add a comment to an experience
router.post('/', authMiddleware, async (req, res) => {
     // console.log('POST /api/comments body:', req.body);
     // console.log('req.user:', req.user); // Add this line
     try {
          const { experienceId, text, parentCommentId } = req.body;
          const user = req.user._id;
          const comment = new Comment({ experienceId, user, text, parentCommentId: parentCommentId || null });
          await comment.save();
          res.status(201).json(comment);
     } catch (err) {
          console.error('Failed to add comment:', err.message);
          res.status(400).json({ message: 'Failed to add comment', error: err.message });
     }
});

// GET: Get all comments for an experience (flat list)
router.get('/experience/:experienceId', async (req, res) => {
     try {
          const comments = await Comment.find({ experienceId: req.params.experienceId })
               .populate('user', 'name avatar email')
               .sort({ createdAt: 1 });
          res.json(comments);
     } catch (err) {
          res.status(500).json({ message: 'Failed to fetch comments', error: err.message });
     }
});

// GET: Get comment count for an experience
router.get('/experience/:experienceId/count', async (req, res) => {
     try {
          const count = await Comment.countDocuments({ experienceId: req.params.experienceId });
          res.json({ count });
     } catch (err) {
          res.status(500).json({ message: 'Failed to fetch comment count', error: err.message });
     }
});

// PUT: Edit a comment by ID
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment) return res.status(404).json({ message: 'Comment not found' });

        // Only allow the comment's author to edit
        if (comment.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        comment.text = req.body.text;
        await comment.save();
        res.json(comment);
    } catch (err) {
        res.status(400).json({ message: 'Failed to update comment', error: err.message });
    }
});

// Helper function to recursively delete replies
async function deleteCommentAndReplies(commentId) {
    const replies = await Comment.find({ parentCommentId: commentId });
    for (const reply of replies) {
        await deleteCommentAndReplies(reply._id);
    }
    await Comment.deleteOne({ _id: commentId });
}

// DELETE: Delete a comment by ID (and all its replies)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment) return res.status(404).json({ message: 'Comment not found' });

        // Only allow the comment's author to delete
        if (comment.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        await deleteCommentAndReplies(comment._id); // <-- Use recursive delete
        res.json({ message: 'Comment and replies deleted' });
    } catch (err) {
        res.status(400).json({ message: 'Failed to delete comment', error: err.message });
    }
});

module.exports = router;