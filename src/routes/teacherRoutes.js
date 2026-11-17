const express = require("express");

const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const {
  createTeacher,
  getTeachers,
  getTeacherById,
  updateTeacher,
  updateTeacherStatus,
  getTeacherAssignments,
  getTeacherStatistics,
} = require("../controllers/teacherController");

// All teacher management routes require admin authentication.
router.use(protect, authorize("admin"));

// Teacher statistics
router.get("/statistics", getTeacherStatistics);

// Register teacher
router.post("/", createTeacher);

// Get all teachers
router.get("/", getTeachers);

// Get teacher profile
router.get("/:id", getTeacherById);

// Get assignments belonging to a teacher
router.get("/:id/assignments", getTeacherAssignments);

// Update teacher information
router.patch("/:id", updateTeacher);

// Change teacher account status
router.patch("/:id/status", updateTeacherStatus);

module.exports = router;
