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

// Render runs behind a reverse proxy.
if (isProduction) {
  app.set("trust proxy", 1);
}

// Background worker
let expiryWorker = null;
let isExpiryWorkerRunning = false;

// ========================================
// 4. SECURITY MIDDLEWARE
// ========================================

app.use(helmet());

// ========================================
// 5. CORS CONFIGURATION
// ========================================

const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

// Local development frontend.
if (!isProduction) {
  allowedOrigins.push("http://localhost:5173");
  allowedOrigins.push("http://127.0.0.1:5173");
}

// Warn if production frontend URL is missing.
if (isProduction && allowedOrigins.length === 0) {
  console.error(
    "WARNING: CLIENT_URL is not configured. Cross-origin frontend requests will be blocked.",
  );
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header, such as health checks.
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/+$/, "");

      if (allowedOrigins.includes(normalizedOrigin)) {
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

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  }),
);

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

// Authentication protection.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 300,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many authentication requests. Please try again later.",
  },

  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many authentication requests. Please try again later.",
    });
  },
});

// General API protection.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  // Allows for multiple students sharing a school network.
  limit: 3000,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many requests. Please slow down and try again later.",
  },

  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests. Please slow down and try again later.",
    });
  },
});

// Apply API protection.
app.use("/api", apiLimiter);

// ========================================
// 9. HEALTH CHECK
// ========================================

// Used by Render and monitoring services.
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

// Results Management
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
  if (res.headersSent) {
    return next(err);
  }

  // Avoid exposing internal details in production logs.
  if (isProduction) {
    console.error("Application Error:", {
      message: err.message,
      method: req.method,
      path: req.originalUrl,
    });
  } else {
    console.error("Application Error:", err);
  }

  // Invalid JSON
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request body.",
    });
  }

  // Payload too large
  if (err.status === 413) {
    return res.status(413).json({
      success: false,
      message: "Request payload is too large.",
    });
  }

  // CORS error
  if (err.message === "Origin not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Access denied.",
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
      message: isProduction
        ? "The submitted information is invalid."
        : err.message,
    });
  }

  // Default server error
  return res.status(err.status || 500).json({
    success: false,
    message: isProduction
      ? "An internal server error occurred."
      : err.message || "Internal server error.",
  });
});

// ========================================
// 13. EXAMINATION EXPIRY WORKER
// ========================================

// Uses recursive scheduling to prevent overlapping
// expiry jobs if one execution takes longer than 15 seconds.

const startExpiryWorker = async () => {
  if (typeof expireAttempts !== "function") {
    throw new Error(
      "expireAttempts is not exported correctly from examAttemptService.",
    );
  }

  const processExpiredAttempts = async () => {
    if (isExpiryWorkerRunning || isShuttingDown) {
      return;
    }

    isExpiryWorkerRunning = true;

    try {
      const processed = await expireAttempts();

      if (processed !== undefined && processed !== null) {
        console.log(
          `Examination expiry check completed. Processed: ${processed}`,
        );
      }
    } catch (error) {
      console.error("Examination expiry worker error:", error.message);
    } finally {
      isExpiryWorkerRunning = false;

      if (!isShuttingDown) {
        expiryWorker = setTimeout(processExpiredAttempts, 15 * 1000);

        expiryWorker.unref();
      }
    }
  };

  // Process expired examinations immediately at startup.
  await processExpiredAttempts();

  console.log("Examination expiry worker initialized.");
};

// ========================================
// 14. SERVER STARTUP
// ========================================

let isShuttingDown = false;

const startServer = async () => {
  try {
    // Connect to MongoDB.
    await connectDB();

    console.log("MongoDB connection established.");

    // Initialize examination expiry processing.
    await startExpiryWorker();

    // Start HTTP server.
    server.listen(PORT, () => {
      console.log("");
      console.log("===================================");
      console.log("       SCHOOL CBT BACKEND");
      console.log("===================================");
      console.log(`Environment: ${NODE_ENV}`);
      console.log(`Port: ${PORT}`);
      console.log("Database: Connected");
      console.log("CORS: Configured");
      console.log("Security: Helmet enabled");
      console.log("Rate Limiting: Enabled");
      console.log("===================================");
      console.log("REGISTERED MODULES");
      console.log("===================================");
      console.log("Authentication: Registered");
      console.log("Administrator Portal: Registered");
      console.log("Academic Sessions: Registered");
      console.log("Terms: Registered");
      console.log("Classes: Registered");
      console.log("Subjects: Registered");
      console.log("Teacher Management: Registered");
      console.log("Teacher Assignments: Registered");
      console.log("Teacher Portal: Registered");
      console.log("Student Management: Registered");
      console.log("Student Enrollment: Registered");
      console.log("Student Portal: Registered");
      console.log("Question Bank: Registered");
      console.log("Examination Management: Registered");
      console.log("Examination Attempts: Registered");
      console.log("Results Management: Registered");
      console.log("===================================");
      console.log("Examination Expiry Worker: Running");
      console.log("Server: Running");
      console.log("===================================");
      console.log("");
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);

    if (expiryWorker) {
      clearTimeout(expiryWorker);
      expiryWorker = null;
    }

    await mongoose.disconnect().catch(() => {});

    process.exit(1);
  }
};

// ========================================
// 15. GRACEFUL SHUTDOWN
// ========================================

const shutdown = async (signal) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`${signal} received. Shutting down server...`);

  // Stop examination expiry worker.
  if (expiryWorker) {
    clearTimeout(expiryWorker);
    expiryWorker = null;
  }

  // Stop accepting new HTTP connections.
  server.close(async (error) => {
    try {
      await mongoose.disconnect();

      if (error) {
        console.error("Server shutdown error:", error.message);

        process.exit(1);
      }

      console.log("HTTP server and database connections closed.");

      process.exit(0);
    } catch (err) {
      console.error("Database shutdown error:", err.message);

      process.exit(1);
    }
  });
};

// Handle deployment shutdown signals.
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("SIGINT", () => shutdown("SIGINT"));

// ========================================
// 16. START APPLICATION
// ========================================

startServer();
