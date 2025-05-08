const express = require("express");
const connectDB = require("./db");
const cors = require("cors");
require("dotenv").config();


const experienceRoutes = require('./routes/experienceRoutes');
const app = express();
connectDB();

app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use('/api/experiences', require('./routes/experienceRoutes')); 
  // Make sure the path is correct

// Middleware setup (if needed)


// Define routes
app.use('/api/experiences', experienceRoutes);



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

