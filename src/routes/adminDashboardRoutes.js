const express = require("express");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const controller = require("../controllers/adminDashboardController");

const router = express.Router();

router.use(protect, authorize("admin"));

router.get("/dashboard", controller.getDashboard);

module.exports = router;
