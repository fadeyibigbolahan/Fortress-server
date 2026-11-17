const express = require("express");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const { getDashboard } = require("../controllers/teacherDashboardController");

const router = express.Router();

// All teacher portal routes require authentication
// and an active teacher role.
router.use(protect, authorize("teacher"));

// Teacher dashboard
router.get("/dashboard", getDashboard);

module.exports = router;
