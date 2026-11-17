const enrollmentService = require("../services/enrollmentService");

// ========================================
// 1. CREATE ENROLLMENT
// ========================================

const createEnrollment = async (req, res, next) => {
  try {
    const enrollment = await enrollmentService.createEnrollment(
      req.body,
      req.user._id,
    );

    res.status(201).json({
      success: true,
      message: "Student enrolled successfully.",
      enrollment,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 2. GET ALL ENROLLMENTS
// ========================================

const getEnrollments = async (req, res, next) => {
  try {
    const result = await enrollmentService.getEnrollments(req.query);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 3. GET ENROLLMENT BY ID
// ========================================

const getEnrollmentById = async (req, res, next) => {
  try {
    const enrollment = await enrollmentService.getEnrollmentById(req.params.id);

    res.status(200).json({
      success: true,
      enrollment,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 4. PROMOTE STUDENT
// ========================================

const promoteStudent = async (req, res, next) => {
  try {
    const enrollment = await enrollmentService.promoteStudent(
      req.params.id,
      req.body,
      req.user._id,
    );

    res.status(200).json({
      success: true,
      message: "Student promoted successfully.",
      enrollment,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 5. REPEAT STUDENT
// ========================================

const repeatStudent = async (req, res, next) => {
  try {
    const enrollment = await enrollmentService.repeatStudent(
      req.params.id,
      req.body,
      req.user._id,
    );

    res.status(200).json({
      success: true,
      message: "Student repetition recorded successfully.",
      enrollment,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 6. WITHDRAW STUDENT
// ========================================

const withdrawStudent = async (req, res, next) => {
  try {
    const enrollment = await enrollmentService.withdrawStudent(
      req.params.id,
      req.body.remarks,
    );

    res.status(200).json({
      success: true,
      message: "Student withdrawn from this enrollment successfully.",
      enrollment,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 7. ENROLLMENT STATISTICS
// ========================================

const getEnrollmentStatistics = async (req, res, next) => {
  try {
    const statistics = await enrollmentService.getEnrollmentStatistics(
      req.query,
    );

    res.status(200).json({
      success: true,
      statistics,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createEnrollment,
  getEnrollments,
  getEnrollmentById,
  promoteStudent,
  repeatStudent,
  withdrawStudent,
  getEnrollmentStatistics,
};
