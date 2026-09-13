const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { authMiddleware } = require('../middleware/authMiddleware');

const validId = id => typeof id === 'string' && id.length === 24 && /^[a-f\d]{24}$/i.test(id);
const positiveInteger = value => typeof value === 'string' && /^[1-9]\d*$/.test(value) &&
  value === value.trim() && Number.isSafeInteger(Number(value));

router.get('/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;
  if (!validId(userId)) return res.status(400).json({ message: 'Invalid user ID' });
  const { page = '1', limit = '20' } = req.query;
  if (!positiveInteger(page) || !positiveInteger(limit) ||
      Object.keys(req.query).some(key => /^(page|limit)\[/.test(key))) {
    return res.status(400).json({ message: 'Page and limit must be positive integers' });
  }
  const pageNumber = Number(page);
  const pageSize = Math.min(Number(limit), 50);
  const skip = (pageNumber - 1) * pageSize;
  if (!Number.isSafeInteger(skip)) return res.status(400).json({ message: 'Page is too large' });

  try {
    const currentUserId = req.user._id;
    const query = {
      $or: [
        { senderId: currentUserId, recipientId: userId },
        { senderId: userId, recipientId: currentUserId }
      ]
    };
    const totalMessages = await Message.countDocuments(query);
    const messages = await Message.find(query)
      .sort({ timestamp: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate('senderId', 'name avatar')
      .lean();
    const presented = messages.map(msg => ({
      ...msg,
      senderAvatar: msg.senderId?.avatar || '',
      senderName: msg.senderId?.name || '',
      senderId: msg.senderId?._id || msg.senderId
    }));
    res.json({ messages: presented.reverse(), hasMore: totalMessages - skip > pageSize });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

router.delete('/:messageId', authMiddleware, async (req, res) => {
  const { messageId } = req.params;
  if (!validId(messageId)) return res.status(400).json({ message: 'Invalid message ID' });
  try {
    const message = await Message.findById(messageId).select('senderId');
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (String(message.senderId) !== req.user._id) {
      return res.status(403).json({ message: 'Only the sender may delete this message' });
    }
    const result = await Message.deleteOne({ _id: messageId, senderId: req.user._id });
    if (!result.deletedCount) return res.status(404).json({ message: 'Message not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete message' });
  }
});

router.post('/markAsRead', authMiddleware, async (req, res) => {
  const senderId = req.body?.senderId;
  if (!validId(senderId)) return res.status(400).json({ message: 'Invalid sender ID' });
  try {
    const result = await Message.updateMany(
      { senderId, recipientId: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark messages as read' });
  }
});

module.exports = router;
