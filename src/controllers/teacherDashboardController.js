const { getTeacherDashboard } = require("../services/teacherDashboardService");

const getDashboard = async (req, res, next) => {
  try {
    const dashboard = await getTeacherDashboard(req.user._id);

    return res.status(200).json({
      success: true,
      dashboard,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
};
