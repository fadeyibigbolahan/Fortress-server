const express = require("express");

const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const {
  getDashboard,
  getMyExaminations,
  getMyExaminationById,
} = require("../controllers/studentPortalController");

// Every student portal endpoint requires student authentication.
router.use(protect, authorize("student"));

// Dashboard
router.get("/dashboard", getDashboard);

// Student examinations
router.get("/examinations", getMyExaminations);

// Individual examination details
router.get("/examinations/:id", getMyExaminationById);

module.exports = router;
