const express = require("express");
const connectDB = require("./db");
const cors = require("cors");
require("dotenv").config();
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
const mongoose = require("mongoose");
const Group = require('./models/Group');
const { configureRealtime } = require('./socket/realtime');

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

configureRealtime(io);

// Start the server
http.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});
