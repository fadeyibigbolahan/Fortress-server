const adminDashboardService = require("../services/adminDashboardService");

const getDashboard = async (req, res, next) => {
  try {
    const dashboard = await adminDashboardService.getAdminDashboard();

    res.status(200).json({
      success: true,
      message: "Administrator dashboard loaded successfully.",
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
};
