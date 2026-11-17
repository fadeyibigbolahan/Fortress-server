const examinationService = require("../services/examinationService");

// ========================================
// 1. CREATE EXAMINATION
// ========================================

const createExamination = async (req, res, next) => {
  try {
    const examination = await examinationService.createExamination(
      req.body,
      req.user._id,
    );

    res.status(201).json({
      success: true,
      message: "Examination created successfully.",
      examination,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 2. GET ALL EXAMINATIONS
// ========================================

const getExaminations = async (req, res, next) => {
  try {
    const result = await examinationService.getExaminations(req.query);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 3. GET EXAMINATION BY ID
// ========================================

const getExaminationById = async (req, res, next) => {
  try {
    const examination = await examinationService.getExaminationById(
      req.params.id,
    );

    res.status(200).json({
      success: true,
      examination,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 4. UPDATE EXAMINATION
// ========================================

const updateExamination = async (req, res, next) => {
  try {
    const examination = await examinationService.updateExamination(
      req.params.id,
      req.body,
      req.user._id,
    );

    res.status(200).json({
      success: true,
      message: "Examination updated successfully.",
      examination,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 5. PUBLISH EXAMINATION
// ========================================

const publishExamination = async (req, res, next) => {
  try {
    const examination = await examinationService.publishExamination(
      req.params.id,
      req.user._id,
    );

    res.status(200).json({
      success: true,
      message: "Examination published successfully.",
      examination,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 6. CLOSE EXAMINATION
// ========================================

const closeExamination = async (req, res, next) => {
  try {
    const examination = await examinationService.closeExamination(
      req.params.id,
      req.user._id,
    );

    res.status(200).json({
      success: true,
      message: "Examination closed successfully.",
      examination,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 7. CANCEL EXAMINATION
// ========================================

const cancelExamination = async (req, res, next) => {
  try {
    const examination = await examinationService.cancelExamination(
      req.params.id,
      req.user._id,
    );

    res.status(200).json({
      success: true,
      message: "Examination cancelled successfully.",
      examination,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createExamination,
  getExaminations,
  getExaminationById,
  updateExamination,
  publishExamination,
  closeExamination,
  cancelExamination,
};
