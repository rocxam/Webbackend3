require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Import DB (this ensures it connects)
require("./config/db");

// Test route
app.get("/", (req, res) => {
    res.send("Backend running...");
});

// Routes
const authRoutes = require("./routes/auth");
app.use("/api", authRoutes);

// Start server
app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});