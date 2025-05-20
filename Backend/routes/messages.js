const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/messages/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const currentUserId = req.user._id;

  const query = {
    $or: [
      { senderId: currentUserId, recipientId: userId },
      { senderId: userId, recipientId: currentUserId }
    ]
  };

  const totalMessages = await Message.countDocuments(query);

  // Populate sender info
  const messages = await Message.find(query)
    .sort({ timestamp: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .populate('senderId', 'name avatar') // <-- Add this
    .lean();

  // Add senderAvatar and senderName to each message
  const messagesWithAvatar = messages.map(msg => ({
    ...msg,
    senderAvatar: msg.senderId?.avatar || "",
    senderName: msg.senderId?.name || "",
    senderId: msg.senderId?._id || msg.senderId // keep senderId as id
  }));

  res.json({
    messages: messagesWithAvatar.reverse(),
    hasMore: (page * limit) < totalMessages
  });
});

router.delete('/messages/:messageId', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    await Message.findByIdAndDelete(messageId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;