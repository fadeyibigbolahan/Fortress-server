const express = require("express");

const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const {
  createExamination,
  getExaminations,
  getExaminationById,
  updateExamination,
  publishExamination,
  closeExamination,
  cancelExamination,
} = require("../controllers/examinationController");

// Authentication and authorization
router.use(protect, authorize("admin", "exam_officer"));

// Create examination
router.post("/", createExamination);

// Get all examinations
router.get("/", getExaminations);

// Get individual examination
router.get("/:id", getExaminationById);

// Update draft examination
router.patch("/:id", updateExamination);

// Publish examination
router.patch("/:id/publish", publishExamination);

// Close examination
router.patch("/:id/close", closeExamination);

// Cancel examination
router.patch("/:id/cancel", cancelExamination);

module.exports = router;
