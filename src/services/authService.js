const jwt = require("jsonwebtoken");
const User = require("../models/User");

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000;

// Generate JWT
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });
};

// Find user using available login identifiers
const findUserByIdentifier = async (identifier) => {
  const normalized = identifier.trim();

  return User.findOne({
    $or: [
      { username: normalized.toLowerCase() },
      { email: normalized.toLowerCase() },
      { admissionNumber: normalized.toUpperCase() },
      { staffId: normalized.toUpperCase() },
    ],
  }).select("+password +failedLoginAttempts +lockUntil");
};

// Authenticate user
const loginUser = async (identifier, password) => {
  const user = await findUserByIdentifier(identifier);

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (user.status !== "active") {
    throw new Error("ACCOUNT_INACTIVE");
  }

  // Check account lockout
  if (user.lockUntil && user.lockUntil > Date.now()) {
    throw new Error("ACCOUNT_LOCKED");
  }

  // Check password
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    user.failedLoginAttempts += 1;

    if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_TIME);
      user.failedLoginAttempts = 0;
    }

    await user.save();

    throw new Error("INVALID_CREDENTIALS");
  }

  // Successful login
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  user.lastLoginAt = new Date();

  await user.save();

  const token = generateToken(user._id);

  return { user, token };
};

module.exports = {
  loginUser,
  generateToken,
};
