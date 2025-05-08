const express = require("express");
const connectDB = require("./db");
const cors = require("cors");
require("dotenv").config();

const crypto = require('crypto');
const experienceRoutes = require('./routes/experienceRoutes');
const app = express();
connectDB();

app.use(cors());
app.use(express.json());

// Import routes
const authRoutes = require('./routes/auth');

// Use routes
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('Authentication API is running');
});
app.use('/api/experiences', require('./routes/experienceRoutes')); 

app.use('/api/experiences', experienceRoutes);



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

