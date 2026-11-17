const express = require("express");

const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const {
  getTeacherGradingQueue,
  getAttemptForGrading,
  gradeTheoryAnswer,
  getTeacherResults,
  listResults,
  approveResult,
  releaseResult,
  getMyReleasedResults,
  getExaminationResultStatistics,
  getClassPerformanceStatistics,
  getStudentPerformanceStatistics,
} = require("../controllers/resultController");

// All result routes require authentication.
router.use(protect);

// ========================================
// TEACHER ROUTES
// ========================================

// Get examinations awaiting theory grading.
router.get(
  "/teacher/grading-queue",
  authorize("teacher"),
  getTeacherGradingQueue,
);

// Get a student's submitted examination for grading.
router.get(
  "/teacher/attempts/:attemptId",
  authorize("teacher"),
  getAttemptForGrading,
);

// Grade an individual theory answer.
router.patch(
  "/teacher/attempts/:attemptId/questions/:questionId/grade",
  authorize("teacher"),
  gradeTheoryAnswer,
);

// ========================================
// STUDENT ROUTES
// ========================================

// Students can only retrieve their own released results.
router.get("/my", authorize("student"), getMyReleasedResults);

// ========================================
// ADMIN / EXAM OFFICER ROUTES
// ========================================

// List and filter examination results.
router.get("/", authorize("admin", "exam_officer"), listResults);

// Approve a completed result.
router.patch(
  "/:resultId/approve",
  authorize("admin", "exam_officer"),
  approveResult,
);

// Release an approved result.
router.patch(
  "/:resultId/release",
  authorize("admin", "exam_officer"),
  releaseResult,
);

// ========================================
// ADMIN / EXAM OFFICER: REPORTING
// ========================================

router.get(
  "/statistics/examinations/:examinationId",
  authorize("admin", "exam_officer"),
  getExaminationResultStatistics,
);

router.get(
  "/statistics/classes",
  authorize("admin", "exam_officer"),
  getClassPerformanceStatistics,
);

router.get(
  "/statistics/students/:studentId",
  authorize("admin", "exam_officer"),
  getStudentPerformanceStatistics,
);

// Get completed examination results for the teacher's assigned classes.
router.get("/teacher/results", authorize("teacher"), getTeacherResults);

module.exports = router;
