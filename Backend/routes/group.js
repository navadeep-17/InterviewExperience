const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const Group = require('../models/Group');
const GroupMessage = require('../models/GroupMessage');
const User = require('../models/User');

// Get all groups for the current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch groups' });
  }
});

// Get all messages for a group
router.get('/:groupId/messages', authMiddleware, async (req, res) => {
  try {
    const messages = await GroupMessage.find({ groupId: req.params.groupId })
      .sort('timestamp')
      .populate('senderId', 'name avatar')
      .lean();

    const populated = messages.map(msg => ({
      ...msg,
      senderName: msg.senderId?.name || 'Unknown',
      senderAvatar: msg.senderId?.avatar || '',
      senderId: msg.senderId?._id || msg.senderId
    }));

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch group messages' });
  }
});

// Send a message to a group
router.post('/:groupId/messages', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    const groupId = req.params.groupId;
    const senderId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group || !group.members.includes(senderId)) {
      return res.status(403).json({ message: 'Not a group member' });
    }

    const sender = await User.findById(senderId);
    const message = await GroupMessage.create({
      groupId,
      senderId,
      senderName: sender.name,
      content,
      timestamp: new Date()
    });

    // Optionally emit via socket here if you want

    res.json(message);
  } catch (err) {
    res.status(500).json({ message: 'Failed to send group message' });
  }
});

// Delete a message from a group
router.delete('/messages/:messageId', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    await GroupMessage.findByIdAndDelete(messageId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete group message' });
  }
});

module.exports = router;