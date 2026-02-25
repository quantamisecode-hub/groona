// 1. LOAD ENVIRONMENT VARIABLES FIRST
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // Fix for MongoDB Atlas querySrv ECONNREFUSED issues

const dotenv = require('dotenv');
dotenv.config(); // Must be before other imports that use process.env

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const connectDB = require('./config/db');
const path = require('path');

// 2. Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);

// --- CONFIGURATION ---
// CORS origins from environment variable (comma-separated) or default
const corsOrigins = process.env.CORS_ORIGINS;
const allowedOrigins = corsOrigins
  ? corsOrigins.split(',').map(origin => origin.trim())
  : [
    // Development origins (always include for local development)
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "https://41be-2409-4091-4095-a02-c1fe-ef1e-c95d-e8f5.ngrok-free.app",
    // Production origins
    process.env.FRONTEND_URL || "https://app.quantemisecode.com",
    "https://app.quantumisecode.com",
    "https://quantemisecode.com",
    "https://quantumisecode.com",
    "https://www.quantemisecode.com",
    "https://www.quantumisecode.com",
    // Backend API domain (if needed for frontend)
    "https://api.quantumisecode.com"
  ].filter(Boolean);

// Log allowed origins for debugging
console.log('[Server] CORS Allowed Origins:', allowedOrigins);

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware: Attach IO to Request so Routes can use it
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Express CORS
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log(`[CORS] ✅ Allowed origin: ${origin}`);
      return callback(null, true);
    }

    // Always allow localhost for development (even if NODE_ENV is production)
    // This helps when testing locally against production backend
    const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);
    if (isLocalhost) {
      console.log(`[CORS] ✅ Allowing localhost origin: ${origin}`);
      return callback(null, true);
    }

    // Reject origin
    console.warn(`[CORS] ❌ Blocked origin: ${origin}`);
    console.warn(`[CORS] Allowed origins:`, allowedOrigins);
    const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  exposedHeaders: ["Content-Length", "Content-Type"],
  maxAge: 86400, // Cache preflight requests for 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Increase JSON body size limit to 1MB to handle large AI-generated reports
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// --- ROUTES ---
// Mount password reset route explicitly
app.use('/api', require('./routes/passwordReset'));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/functions', require('./routes/functions')); // MOVED UP
app.use('/api', require('./routes/api'));
app.use('/api/clients', require('./routes/clientManagement'));
app.use('/api/subtasks', require('./routes/subtaskOperations'));
app.use('/api/ai-assistant', require('./routes/aiAssistantService'));
app.use('/api/groona-assistant', require('./routes/groonaAssistant'));
app.use('/api/leave-management', require('./routes/leaveManagement'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/sprint-velocity', require('./routes/sprintVelocity'));

// Socket.IO Logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 1. Join Tenant Room
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  // 2. Chat Logic
  socket.on('send_message', (data) => {
    socket.to(data.chat_room).emit('receive_message', data);
  });

  // 3. Project Updates (Broadcast to Tenant)
  socket.on('notify_project_change', (data) => {
    if (data.tenant_id) {
      // Broadcast to everyone in the tenant EXCEPT sender
      socket.to(data.tenant_id).emit('project_change', data);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));