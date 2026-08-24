require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const collectionRoutes = require("./routes/collections");
const fileRoutes = require("./routes/files");
const reminderRoutes = require("./routes/reminders");
const notificationRoutes = require("./routes/notifications");
const assistantRoutes = require("./routes/assistant");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/collections", collectionRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/assistant", assistantRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`LifeGraph API listening on :${port}`));
