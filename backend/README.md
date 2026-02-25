# Groona Backend - Developer KT Documentation

This document provides a comprehensive overview of the Groona backend, its architecture, data flow, and configuration for developers and maintainers.

---

## 🏗 Project Architecture & Hierarchy

The backend is built with **Node.js** and **Express**, using **MongoDB** (via Mongoose) for data storage and **Socket.io** for real-time features.

### Directory Structure

```text
backend/
├── config/             # Configuration files (DB connection, etc.)
│   └── db.js           # MongoDB connection logic
├── controllers/        # Request handling logic (Application Layer)
├── handlers/           # Event handlers (Socket.io, etc.)
├── helpers/            # Utility functions and shared logic
├── middleware/         # Express middleware (Auth, CORS, etc.)
├── models/             # Database models
│   ├── definitions/    # JSON-based schema definitions
│   └── SchemaDefinitions.js # Dynamic Mongoose model loader
├── routes/             # API route definitions
├── scripts/            # Maintenance and cron job scripts
├── services/           # Business logic and external integrations
├── uploads/            # Local storage for uploaded files
└── server.js           # main entry point
```

---

## 🚀 Backend Flow & Entry Point

### 1. Initialization (`server.js`)
The `server.js` file is the heart of the application. It performs the following steps:
- **Environment Setup**: Loads variables from `.env` using `dotenv`.
- **Database Connection**: Calls `connectDB()` from `config/db.js`.
- **Middleware**: Configures CORS (Cross-Origin Resource Sharing), JSON body parsing (1MB limit), and static file serving for `/uploads` and `/public`.
- **Route Mounting**: Mounts all major API modules (Auth, Projects, Tasks, AI Assistant, etc.) under the `/api` prefix.
- **Server Start**: Initializes an HTTP server and starts listening on the configured `PORT`.

### 2. Request Lifecycle
A typical API request follows this path:
1. **Route** (`routes/`): Matches the URL pattern and (optionally) applies middleware like `auth.js`.
2. **Controller** (`controllers/`): Processes the request data, interacts with services or models.
3. **Service** (`services/`): (Optional) Handles complex business logic or external API calls.
4. **Model** (`models/`): Queries or updates the MongoDB database.

---

## 🗄 Database Connection & Models

### Connection Flow
The database connection is managed in `backend/config/db.js`. It uses the `MONGO_URI` environment variable to connect to the MongoDB Atlas cluster.
- **Tool**: Mongoose
- **Config**: `{ family: 4 }` is used to prioritize IPv4, resolving certain connection issues with MongoDB Atlas.

### Dynamic Schema System
Groona uses a unique dynamic schema system found in `backend/models/SchemaDefinitions.js`.
1. **JSON Definitions**: Data structures are defined in JSON files inside `models/definitions/`.
2. **Dynamic Loading**: `SchemaDefinitions.js` iterates through these JSON files and converts them into Mongoose Schemas and Models at runtime.
3. **Common Fields**: Every naturally generated model includes `created_date` and `updated_date` in IST (Indian Standard Time).

---

## 🔑 API Keys & Environment Variables

All sensitive configuration is stored in the `.env` file. Below are the key variables and where they are used:

| Variable | Usage | Primary File |
| :--- | :--- | :--- |
| `MONGO_URI` | MongoDB Connection String | `config/db.js` |
| `RESEND_API_KEY` | Sending Emails (SDK) | `services/emailService.js` |
| `MAIL_FROM` | Default Email Sender Identity | `services/emailService.js` |
| `GEMINI_API_KEY` | AI Assistant Logic (Google Gemini) | `services/ai*Service.js` |
| `FRONTEND_URL` | Used for constructing links in emails | Multiple Services |
| `PORT` | The port the server runs on | `server.js` |
| `CORS_ORIGINS` | Allowed frontend domains | `server.js` |

---

## 📡 Real-time Communication (Socket.IO)

Real-time updates are handled in `server.js` using Socket.IO.
- **Tenant Isolation**: Users join "rooms" based on their `tenant_id`.
- **Live Updates**: Events like `project_change` are broadcast to specific tenant rooms to ensure all active users see updates immediately without refreshing.
- **Chat**: Supports `send_message` and `receive_message` events for internal project communication.

---

## 🛠 Integration Services

### AI Assistant
The `groonaAssistant` and `aiAssistantService` routes handle AI-powered tasks. They use Google Gemini to:
- Extract task details from natural language conversation.
- Help generate project structures.
- Analyze workloads and provide suggestions.

### Email Service
The `emailService.js` provides a centralized way to send emails using **Resend**. It utilizes HTML templates defined in `utils/emailTemplates.js`.

### File Uploads
Handled via **Multer** in `routes/upload.js`. Files are currently stored locally in the `backend/uploads/` directory and served statically.

---

*For further details on specific routes or models, please refer to the comments within the respective files.*
