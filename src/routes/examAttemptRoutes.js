const express = require("express");

const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const {
  startExamination,
  getMyAttempt,
  saveAnswer,
  submitAttempt,
} = require("../controllers/examAttemptController");

// Student-only examination endpoints
router.use(protect, authorize("student"));

// Start an examination
router.post("/examinations/:examinationId/start", startExamination);

// Recover or retrieve an existing attempt
router.get("/:id", getMyAttempt);

// Save an answer
router.patch("/:id/answers", saveAnswer);

// Submit examination
router.post("/:id/submit", submitAttempt);

module.exports = router;
