const questionService = require("../services/questionService");

// ========================================
// 1. CREATE QUESTION
// ========================================

const createQuestion = async (req, res, next) => {
  try {
    const question = await questionService.createQuestion(req.body, req.user);

    res.status(201).json({
      success: true,
      message: "Question created successfully.",
      question,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 2. GET ALL QUESTIONS
// ========================================

const getQuestions = async (req, res, next) => {
  try {
    const result = await questionService.getQuestions(req.query, req.user);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 3. GET QUESTION BY ID
// ========================================

const getQuestionById = async (req, res, next) => {
  try {
    const question = await questionService.getQuestionById(
      req.params.id,
      req.user,
    );

    res.status(200).json({
      success: true,
      question,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 4. UPDATE QUESTION
// ========================================

const updateQuestion = async (req, res, next) => {
  try {
    const question = await questionService.updateQuestion(
      req.params.id,
      req.body,
      req.user,
    );

    res.status(200).json({
      success: true,
      message: "Question updated successfully.",
      question,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 5. ARCHIVE QUESTION
// ========================================

const archiveQuestion = async (req, res, next) => {
  try {
    const question = await questionService.archiveQuestion(
      req.params.id,
      req.user,
    );

    res.status(200).json({
      success: true,
      message: "Question archived successfully.",
      question,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 6. QUESTION STATISTICS
// ========================================

const getQuestionStatistics = async (req, res, next) => {
  try {
    const statistics = await questionService.getQuestionStatistics(
      req.query,
      req.user,
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
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  archiveQuestion,
  getQuestionStatistics,
};
