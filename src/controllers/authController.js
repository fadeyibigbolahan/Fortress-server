const { loginUser } = require("../services/authService");

// =====================================
// LOGIN
// =====================================

const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Login identifier and password are required.",
      });
    }

    const { user, token } = await loginUser(identifier, password);

    res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        email: user.email,
        username: user.username,
        role: user.role,
        admissionNumber: user.admissionNumber,
        staffId: user.staffId,
        currentClass: user.currentClass,
        status: user.status,
      },
    });
  } catch (error) {
    if (error.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({
        success: false,
        message: "Invalid login credentials.",
      });
    }

    if (error.message === "ACCOUNT_INACTIVE") {
      return res.status(403).json({
        success: false,
        message:
          "Your account is not active. Contact the school administrator.",
      });
    }

    if (error.message === "ACCOUNT_LOCKED") {
      return res.status(423).json({
        success: false,
        message: "Account temporarily locked. Please try again later.",
      });
    }

    next(error);
  }
};

// =====================================
// GET CURRENT USER
// =====================================

const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      middleName: req.user.middleName,
      email: req.user.email,
      username: req.user.username,
      role: req.user.role,
      admissionNumber: req.user.admissionNumber,
      staffId: req.user.staffId,
      currentClass: req.user.currentClass,
      status: req.user.status,
    },
  });
};

// =====================================
// LOGOUT
// =====================================

const logout = async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully. Remove your authentication token.",
  });
};

module.exports = {
  login,
  getMe,
  logout,
};
