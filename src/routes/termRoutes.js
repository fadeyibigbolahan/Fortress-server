const express = require("express");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const controller = require("../controllers/termController");

const router = express.Router();

router.use(protect, authorize("admin"));

router.post("/", controller.createTerm);
router.get("/", controller.getTerms);
router.get("/current", controller.getCurrentTerm);
router.get("/:id", controller.getTermById);
router.patch("/:id", controller.updateTerm);
router.patch("/:id/activate", controller.activateTerm);
router.patch("/:id/complete", controller.completeTerm);

module.exports = router;
