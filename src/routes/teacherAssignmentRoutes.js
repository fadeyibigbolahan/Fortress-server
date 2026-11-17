const express = require("express");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const controller = require("../controllers/teacherAssignmentController");

const router = express.Router();

// Teachers can view their own assignments
router.get("/my", protect, authorize("teacher"), controller.getMyAssignments);

// Administrator-only management
router.use(protect, authorize("admin"));

// Get available active teachers
router.get("/teachers", controller.getAvailableTeachers);

router.post("/", controller.createAssignment);
router.get("/", controller.getAssignments);
router.get("/:id", controller.getAssignmentById);
router.patch("/:id", controller.updateAssignment);
router.patch("/:id/deactivate", controller.deactivateAssignment);

module.exports = router;
