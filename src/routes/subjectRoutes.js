const express = require("express");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const controller = require("../controllers/subjectController");

const router = express.Router();

router.use(protect);

// Admins and teachers can view subjects.
router.get("/", authorize("admin", "teacher"), controller.getSubjects);
router.get("/:id", authorize("admin", "teacher"), controller.getSubjectById);

// Only admins can manage subjects.
router.post("/", authorize("admin"), controller.createSubject);
router.patch("/:id", authorize("admin"), controller.updateSubject);
router.patch(
  "/:id/deactivate",
  authorize("admin"),
  controller.deactivateSubject,
);

module.exports = router;
