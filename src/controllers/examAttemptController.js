const examAttemptService = require("../services/examAttemptService");

// ========================================
// 1. START EXAMINATION
// ========================================

const startExamination = async (req, res, next) => {
  try {
    const result = await examAttemptService.startExamination(
      req.params.examinationId,
      req.user._id,
      req.ip,
    );

    res.status(result.resumed ? 200 : 201).json({
      success: true,
      message: result.resumed
        ? "Your examination has been recovered."
        : "Examination started successfully.",
      resumed: result.resumed,
      attempt: result.attempt,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 2. GET / RECOVER ATTEMPT
// ========================================

const getMyAttempt = async (req, res, next) => {
  try {
    const attempt = await examAttemptService.getMyAttempt(
      req.params.id,
      req.user._id,
      req.ip,
    );

    res.status(200).json({
      success: true,
      attempt,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 3. SAVE ANSWER
// ========================================

const saveAnswer = async (req, res, next) => {
  try {
    const result = await examAttemptService.saveAnswer(
      req.params.id,
      req.user._id,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "Answer saved successfully.",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 4. SUBMIT EXAMINATION
// ========================================

const submitAttempt = async (req, res, next) => {
  try {
    const result = await examAttemptService.submitAttempt(
      req.params.id,
      req.user._id,
      req.ip,
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  startExamination,
  getMyAttempt,
  saveAnswer,
  submitAttempt,
};
