const express = require("express");

const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const {
  createEnrollment,
  getEnrollments,
  getEnrollmentById,
  promoteStudent,
  repeatStudent,
  withdrawStudent,
  getEnrollmentStatistics,
} = require("../controllers/enrollmentController");

// All enrollment management routes require admin authentication.
router.use(protect, authorize("admin"));

// Enrollment statistics
router.get("/statistics", getEnrollmentStatistics);

// Create student enrollment
router.post("/", createEnrollment);

// Get all enrollments
router.get("/", getEnrollments);

// Get enrollment by ID
router.get("/:id", getEnrollmentById);

// Promote student
router.patch("/:id/promote", promoteStudent);

// Repeat student
router.patch("/:id/repeat", repeatStudent);

// Withdraw student
router.patch("/:id/withdraw", withdrawStudent);

module.exports = router;
