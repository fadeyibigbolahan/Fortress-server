const express = require("express");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const controller = require("../controllers/classController");

const router = express.Router();

router.use(protect, authorize("admin"));

router.post("/", controller.createClass);
router.get("/", controller.getClasses);
router.get("/:id", controller.getClassById);
router.patch("/:id", controller.updateClass);
router.patch("/:id/deactivate", controller.deactivateClass);

module.exports = router;
