require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const http = require("http");

const connectDB = require("./config/db");

// ========================================
// 1. IMPORT SERVICES
// ========================================

const { expireAttempts } = require("./services/examAttemptService");

// ========================================
// 2. IMPORT ROUTES
// ========================================

const authRoutes = require("./routes/authRoutes");
const academicSessionRoutes = require("./routes/academicSessionRoutes");
const termRoutes = require("./routes/termRoutes");
const classRoutes = require("./routes/classRoutes");
const subjectRoutes = require("./routes/subjectRoutes");
const teacherAssignmentRoutes = require("./routes/teacherAssignmentRoutes");
const studentRoutes = require("./routes/studentRoutes");
const enrollmentRoutes = require("./routes/enrollmentRoutes");
const questionRoutes = require("./routes/questionRoutes");
const examinationRoutes = require("./routes/examinationRoutes");
const examAttemptRoutes = require("./routes/examAttemptRoutes");
const resultRoutes = require("./routes/resultRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const studentPortalRoutes = require("./routes/studentPortalRoutes");
const teacherDashboardRoutes = require("./routes/teacherDashboardRoutes");
const adminDashboardRoutes = require("./routes/adminDashboardRoutes");

// ========================================
// 3. SERVER CONFIGURATION
// ========================================

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

app.disable("x-powered-by");

if (isProduction) {
  app.set("trust proxy", 1);
}

// Background worker reference
let expiryWorker = null;

// ========================================
// 4. SECURITY MIDDLEWARE
// ========================================

app.use(helmet());

// ========================================
// 5. CORS CONFIGURATION
// ========================================

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ========================================
// 6. REQUEST PARSING
// ========================================

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

// ========================================
// 7. REQUEST LOGGING
// ========================================

if (!isProduction) {
  app.use((req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
      console.log(
        `${req.method} ${req.originalUrl} - ${res.statusCode} - ${
          Date.now() - start
        }ms`,
      );
    });

    next();
  });
}

// ========================================
// 8. RATE LIMITING
// ========================================

// Authentication rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication requests. Please try again later.",
  },
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  // Examination routes have dedicated protection planned.
  skip: (req) => {
    return (
      req.path.startsWith("/exam-attempts") ||
      req.path.startsWith("/examinations")
    );
  },

  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

// Apply general API rate limiter
app.use("/api", apiLimiter);

// ========================================
// 9. HEALTH CHECK
// ========================================

app.get("/api/health", (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;

  res.status(dbConnected ? 200 : 503).json({
    success: dbConnected,
    message: dbConnected
      ? "School CBT API is running"
      : "Database connection unavailable",
    environment: NODE_ENV,
    database: dbConnected ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// ========================================
// 10. API ROUTES
// ========================================

// Authentication
app.use("/api/auth", authLimiter, authRoutes);

// Administrator Portal
app.use("/api/admin-portal", adminDashboardRoutes);

// Academic Management
app.use("/api/academic-sessions", academicSessionRoutes);
app.use("/api/terms", termRoutes);
app.use("/api/classes", classRoutes);

// Subject Management
app.use("/api/subjects", subjectRoutes);

// Teacher Management
app.use("/api/teachers", teacherRoutes);

// Teacher Management
app.use("/api/teacher-assignments", teacherAssignmentRoutes);

// Teacher Portal
app.use("/api/teacher-portal", teacherDashboardRoutes);

// Student Management
app.use("/api/students", studentRoutes);

// Student Enrollment
app.use("/api/enrollments", enrollmentRoutes);

// Student Portal
app.use("/api/student-portal", studentPortalRoutes);

// Question Bank
app.use("/api/questions", questionRoutes);

// Examination Management
app.use("/api/examinations", examinationRoutes);

// Examination Attempts
app.use("/api/exam-attempts", examAttemptRoutes);

// Results Management - To be registered later
app.use("/api/results", resultRoutes);

// ========================================
// 11. NOT FOUND HANDLER
// ========================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

// ========================================
// 12. GLOBAL ERROR HANDLER
// ========================================

app.use((err, req, res, next) => {
  console.error("Application Error:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  // Invalid JSON
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request body",
    });
  }

  // Payload too large
  if (err.status === 413) {
    return res.status(413).json({
      success: false,
      message: "Request payload is too large",
    });
  }

  // CORS error
  if (err.message === "Origin not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A record with this information already exists.",
    });
  }

  // Invalid MongoDB ObjectId
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid resource identifier.",
    });
  }

  // Mongoose validation
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: isProduction
      ? "An internal server error occurred"
      : err.message || "Internal server error",
  });
});

// ========================================
// 13. EXAMINATION EXPIRY WORKER
// ========================================

const startExpiryWorker = async () => {
  try {
    // Process attempts that expired while the server was offline.
    const processed = await expireAttempts();

    console.log(
      `Examination expiry worker initialized. Processed: ${processed}`,
    );

    // Check for expired attempts every 15 seconds.
    expiryWorker = setInterval(() => {
      expireAttempts().catch((error) => {
        console.error("Examination expiry worker error:", error.message);
      });
    }, 15 * 1000);

    expiryWorker.unref();
  } catch (error) {
    console.error("Examination expiry worker startup error:", error.message);

    throw error;
  }
};

// ========================================
// 14. SERVER STARTUP
// ========================================

const startServer = async () => {
  try {
    await connectDB();

    // Initialize examination expiry processing.
    await startExpiryWorker();

    server.listen(PORT, () => {
      console.log("-----------------------------------");
      console.log("SCHOOL CBT BACKEND");
      console.log("-----------------------------------");
      console.log(`Environment: ${NODE_ENV}`);
      console.log(`Port: ${PORT}`);
      console.log("Database: Connected");
      console.log("-----------------------------------");
      console.log("REGISTERED MODULES");
      console.log("-----------------------------------");
      console.log("Authentication: Registered");
      console.log("Academic Sessions: Registered");
      console.log("Terms: Registered");
      console.log("Classes: Registered");
      console.log("Subjects: Registered");
      console.log("Teacher Assignments: Registered");
      console.log("Student Management: Registered");
      console.log("Student Enrollment: Registered");
      console.log("Question Bank: Registered");
      console.log("Examination Management: Registered");
      console.log("Examination Attempts: Registered");
      console.log("-----------------------------------");
      console.log("Examination Expiry Worker: Running");
      console.log("Server: Running");
      console.log("-----------------------------------");
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);

    if (expiryWorker) {
      clearInterval(expiryWorker);
    }

    await mongoose.disconnect().catch(() => {});

    process.exit(1);
  }
};

// ========================================
// 15. GRACEFUL SHUTDOWN
// ========================================

let isShuttingDown = false;

const shutdown = async (signal) => {
  if (isShuttingDown) return;

  isShuttingDown = true;

  console.log(`${signal} received. Shutting down server...`);

  // Stop examination expiry worker.
  if (expiryWorker) {
    clearInterval(expiryWorker);
    expiryWorker = null;
  }

  // Stop accepting new connections.
  server.close(async (error) => {
    try {
      await mongoose.disconnect();

      if (error) {
        console.error("Server shutdown error:", error.message);
        process.exit(1);
      }

      console.log("Server and database connections closed.");
      process.exit(0);
    } catch (err) {
      console.error("Database shutdown error:", err.message);
      process.exit(1);
    }
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ========================================
// 16. START APPLICATION
// ========================================

startServer();
