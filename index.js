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
const groupRoutes = require("./routes/groups");
const sessionRoutes = require("./routes/sessions");
const userRoutes = require("./routes/users");
const adminRoutes = require("./routes/admin");
app.use("/api", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/sessions", sessionRoutes);

// Start server
app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});
