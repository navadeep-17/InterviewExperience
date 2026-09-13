const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const Group = require('../models/Group');
const GroupMessage = require('../models/GroupMessage');
const validId = id => typeof id === 'string' && id.length === 24 && /^[a-f\d]{24}$/i.test(id);

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
  const { groupId } = req.params;
  if (!validId(groupId)) return res.status(400).json({ message: 'Invalid group ID' });
  try {
    const group = await Group.findOne({ _id: groupId, members: req.user._id }).select('_id');
    if (!group) return res.status(403).json({ message: 'Not a group member' });
    const messages = await GroupMessage.find({ groupId })
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
  const { groupId } = req.params;
  const content = req.body?.content;
  if (!validId(groupId)) return res.status(400).json({ message: 'Invalid group ID' });
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ message: 'A non-empty message is required' });
  }
  try {
    const senderId = req.user._id;
    const group = await Group.findOne({ _id: groupId, members: senderId }).select('_id');
    if (!group) {
      return res.status(403).json({ message: 'Not a group member' });
    }

    const message = await GroupMessage.create({
      groupId,
      senderId,
      content
    });

    res.json(message);
  } catch (err) {
    res.status(500).json({ message: 'Failed to send group message' });
  }
});

// Delete a message from a group
router.delete('/messages/:messageId', authMiddleware, async (req, res) => {
  const { messageId } = req.params;
  if (!validId(messageId)) return res.status(400).json({ message: 'Invalid message ID' });
  try {
    const message = await GroupMessage.findById(messageId).select('senderId');
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (String(message.senderId) !== req.user._id) {
      return res.status(403).json({ message: 'Only the sender may delete this message' });
    }
    const result = await GroupMessage.deleteOne({ _id: messageId, senderId: req.user._id });
    if (!result.deletedCount) return res.status(404).json({ message: 'Message not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete group message' });
  }
});

module.exports = router;
