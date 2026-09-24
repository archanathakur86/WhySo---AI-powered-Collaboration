import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import assistantRoutes from "./routes/assistantRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || "*", methods: ["GET", "POST"] },
});

app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// attach io to req so controllers can emit real-time events if needed
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.get("/", (req, res) => {
  res.json({ success: true, message: "WhySo API is running" });
});
app.get("/health", (req, res) => {
  res.status(200).send("ok");
});
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/comments", commentRoutes);

// Socket.io - real-time presence & collaboration indicators
io.on("connection", (socket) => {
  socket.on("join_project", (projectId) => {
    socket.join(`project_${projectId}`);
    socket.to(`project_${projectId}`).emit("user_joined", { socketId: socket.id });
  });

  socket.on("leave_project", (projectId) => {
    socket.leave(`project_${projectId}`);
  });

  socket.on("editing_note", ({ projectId, noteId, userName }) => {
    socket.to(`project_${projectId}`).emit("someone_editing", { noteId, userName });
  });

  socket.on("disconnect", () => {
    // presence cleanup handled client-side via room membership
  });
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`WhySo backend running on port ${PORT}`);
});