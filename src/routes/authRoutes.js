const express = require("express");

const { login, getMe, logout } = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Public authentication route
router.post("/login", login);

// Protected authentication routes
router.get("/me", protect, getMe);
router.post("/logout", protect, logout);

module.exports = router;
