const studentPortalService = require("../services/studentPortalService");

// ========================================
// 1. STUDENT DASHBOARD
// ========================================

const getDashboard = async (req, res, next) => {
  try {
    const dashboard = await studentPortalService.getStudentDashboard(
      req.user._id,
    );

    res.status(200).json({
      success: true,
      dashboard,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 2. LIST STUDENT EXAMINATIONS
// ========================================

const getMyExaminations = async (req, res, next) => {
  try {
    const result = await studentPortalService.getMyExaminations(
      req.user._id,
      req.query,
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 3. GET EXAMINATION DETAILS
// ========================================

const getMyExaminationById = async (req, res, next) => {
  try {
    const examination = await studentPortalService.getMyExaminationById(
      req.params.id,
      req.user._id,
    );

    res.status(200).json({
      success: true,
      examination,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
  getMyExaminations,
  getMyExaminationById,
};
