const express = require("express");
const connectDB = require("./db");
const cors = require("cors");
require("dotenv").config();
const corsOptions = {
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
const mongoose = require("mongoose");
const User = require("./models/User");
const Message = require('./models/Message');
const Group = require('./models/Group');
const GroupMessage = require('./models/GroupMessage');

const app = express();

const DEFAULT_BRANCHES = [
  { name: "CSE", avatar: "" },
  { name: "ECE", avatar: "" },
  { name: "MECH", avatar: "" },
  { name: "CIVIL", avatar: "" },
  { name: "EEE", avatar: "" },
  { name: "IT", avatar: "" },
  { name: "CSB", avatar: "" },
  { name: "CSD", avatar: "" },
  { name: "CSM", avatar: "" }

  // Add more as needed
];

// Connect to the database
connectDB();

// Seed default branch groups if not present
async function seedDefaultGroups() {
  for (const branch of DEFAULT_BRANCHES) {
    const exists = await Group.findOne({ name: branch.name });
    if (!exists) {
      await Group.create({
        name: branch.name,
        avatar: branch.avatar,
        members: []
      });
      console.log(`Created default group: ${branch.name}`);
    }
  }
}
seedDefaultGroups();

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Import routes
const authRoutes = require('./routes/auth');
const experienceRoutes = require('./routes/experienceRoutes');
const commentRoutes = require('./routes/commentRoutes');
const messagesRouter = require('./routes/messages');
const userRoutes = require('./routes/users');
const groupRoutes = require('./routes/group');

// Authentication routes
app.use('/api/auth', authRoutes);

// Experiences routes
app.use('/api/experiences', experienceRoutes);

// Comments routes
app.use('/api/comments', commentRoutes);

// Messages routes (all message-related endpoints)
app.use('/api/messages', messagesRouter);

// Users routes
app.use('/api/users', userRoutes);

// Groups routes
app.use('/api/groups', groupRoutes);

// Home route to check if API is running
app.get('/', (req, res) => {
  res.send('Authentication API is running');
});

// --- Socket.IO Integration ---
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: corsOptions });
app.set('io', io);

const userIdToSocketId = {};
const users = {};

io.on('connection', (socket) => {
  socket.on('register', async (userId) => {
    // Join all groups the user is a member of
    const groups = await Group.find({ members: userId });
    groups.forEach(group => {
      socket.join(group._id.toString());
    });
    // Save mapping for personal chat
    socket.userId = userId;
    userIdToSocketId[userId] = socket.id;
  });

  // --- ADD THIS HANDLER FOR PERSONAL CHAT ---
  socket.on('send_message', async (msg) => {
    // Save to DB
    const message = await Message.create({
      senderId: msg.senderId,
      recipientId: msg.recipientId,
      content: msg.content,
      senderName: msg.senderName,
      timestamp: msg.timestamp || new Date(),
    });

    // Emit to recipient if online
    const recipientSocketId = userIdToSocketId[msg.recipientId];
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('receive_message', message);
    }
    // Emit to sender as well (so sender sees their own message)
    socket.emit('receive_message', message);
  });

  // Existing group message handler...
  socket.on('send_group_message', async (msg) => {
    // Save to DB
    const message = await GroupMessage.create({
      groupId: msg.groupId,
      senderId: msg.senderId,
      senderName: msg.senderName,
      content: msg.content,
      timestamp: new Date()
    });
    // Optionally fetch sender avatar
    const sender = await User.findById(msg.senderId);
    io.to(msg.groupId).emit('receive_group_message', {
      ...message.toObject(),
      sender: { name: sender.name, avatar: sender.avatar }
    });
  });
});

app.post('/api/messages/markAsRead', async (req, res) => {
  try {
    const { senderId, recipientId } = req.body;
    await Message.updateMany(
      { senderId, recipientId, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark messages as read', error: err.message });
  }
});

// Start the server
http.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});
