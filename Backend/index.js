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
const getHealth = require('./utils/health');

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

// Public readiness check; read the connection state on every request.
app.get('/health', (req, res) => {
  const { statusCode, body } = getHealth(mongoose.connection.readyState);
  res.status(statusCode).json(body);
});

// --- Socket.IO Integration ---
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: corsOptions });
app.set('io', io);

configureRealtime(io);

// Accept traffic only after database and default-group initialization succeed.
async function startServer() {
  await connectDB();
  await seedDefaultGroups();
  http.listen(process.env.PORT || 5000, () => {
    console.log(`Server running on port ${process.env.PORT || 5000}`);
  });
}

startServer().catch(() => {
  // Connection errors may contain credentials; keep startup logging bounded.
  console.error('Backend startup failed during initialization.');
  process.exit(1);
});
