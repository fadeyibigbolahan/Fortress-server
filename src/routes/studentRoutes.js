const express = require("express");

const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const {
  createStudent,
  getStudents,
  getStudentById,
  updateStudent,
  updateStudentStatus,
  getStudentStatistics,
} = require("../controllers/studentController");

// All student management routes require admin authentication.
router.use(protect, authorize("admin"));

// Student statistics
router.get("/statistics", getStudentStatistics);

// Register student
router.post("/", createStudent);

// Get all students
router.get("/", getStudents);

// Get student profile
router.get("/:id", getStudentById);

// Update student information
router.patch("/:id", updateStudent);

// Change student status
router.patch("/:id/status", updateStudentStatus);

module.exports = router;
