const express = require("express");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const controller = require("../controllers/academicSessionController");

const router = express.Router();

router.use(protect, authorize("admin"));

router.post("/", controller.createSession);
router.get("/", controller.getSessions);
router.get("/current", controller.getCurrentSession);
router.get("/:id", controller.getSessionById);
router.patch("/:id", controller.updateSession);
router.patch("/:id/activate", controller.activateSession);
router.patch("/:id/complete", controller.completeSession);

module.exports = router;
