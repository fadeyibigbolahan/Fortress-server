const express = require("express");

const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  archiveQuestion,
  getQuestionStatistics,
} = require("../controllers/questionController");

// Authentication and role protection
router.use(protect, authorize("admin", "teacher"));

// Question statistics
router.get("/statistics", getQuestionStatistics);

// Create question
router.post("/", createQuestion);

// Get all questions
router.get("/", getQuestions);

// Get individual question
router.get("/:id", getQuestionById);

// Update question
router.patch("/:id", updateQuestion);

// Archive question
router.patch("/:id/archive", archiveQuestion);

module.exports = router;
