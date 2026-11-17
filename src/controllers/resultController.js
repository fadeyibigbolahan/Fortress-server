const resultService = require("../services/resultService");

const getUserId = (req) => req.user._id || req.user.id;

// ========================================
// TEACHER: GET GRADING QUEUE
// ========================================

const getTeacherGradingQueue = async (req, res, next) => {
  try {
    const results = await resultService.getTeacherGradingQueue(
      getUserId(req),
      req.query,
    );

    res.status(200).json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// TEACHER: GET ATTEMPT FOR GRADING
// ========================================

const getAttemptForGrading = async (req, res, next) => {
  try {
    const result = await resultService.getAttemptForGrading(
      req.params.attemptId,
      getUserId(req),
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// TEACHER: GRADE THEORY ANSWER
// ========================================

const gradeTheoryAnswer = async (req, res, next) => {
  try {
    const result = await resultService.gradeTheoryAnswer(
      req.params.attemptId,
      req.params.questionId,
      getUserId(req),
      req.body,
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// ADMIN / EXAM OFFICER: LIST RESULTS
// ========================================

const listResults = async (req, res, next) => {
  try {
    const result = await resultService.listResults(req.query);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// ADMIN / EXAM OFFICER: APPROVE RESULT
// ========================================

const approveResult = async (req, res, next) => {
  try {
    const result = await resultService.approveResult(
      req.params.resultId,
      getUserId(req),
    );

    res.status(200).json({
      success: true,
      message: "Result approved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// ADMIN / EXAM OFFICER: RELEASE RESULT
// ========================================

const releaseResult = async (req, res, next) => {
  try {
    const result = await resultService.releaseResult(
      req.params.resultId,
      getUserId(req),
    );

    res.status(200).json({
      success: true,
      message: "Result released successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// STUDENT: GET MY RELEASED RESULTS
// ========================================

const getMyReleasedResults = async (req, res, next) => {
  try {
    const results = await resultService.getMyReleasedResults(
      getUserId(req),
      req.query,
    );

    res.status(200).json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// ADMIN / EXAM OFFICER: EXAMINATION STATISTICS
// ========================================

const getExaminationResultStatistics = async (req, res, next) => {
  try {
    const result = await resultService.getExaminationResultStatistics(
      req.params.examinationId,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// ADMIN / EXAM OFFICER: CLASS PERFORMANCE
// ========================================

const getClassPerformanceStatistics = async (req, res, next) => {
  try {
    const result = await resultService.getClassPerformanceStatistics(req.query);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// ADMIN / EXAM OFFICER: STUDENT PERFORMANCE
// ========================================

const getStudentPerformanceStatistics = async (req, res, next) => {
  try {
    const result = await resultService.getStudentPerformanceStatistics(
      req.params.studentId,
      req.query,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// TEACHER: GET STUDENT RESULTS
// ========================================

const getTeacherResults = async (req, res, next) => {
  try {
    const result = await resultService.getTeacherResults(
      getUserId(req),
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

module.exports = {
  getTeacherGradingQueue,
  getAttemptForGrading,
  gradeTheoryAnswer,
  listResults,
  approveResult,
  releaseResult,
  getMyReleasedResults,
  getExaminationResultStatistics,
  getClassPerformanceStatistics,
  getStudentPerformanceStatistics,
  getTeacherResults,
};
