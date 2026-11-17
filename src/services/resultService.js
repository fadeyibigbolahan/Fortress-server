const mongoose = require("mongoose");

const ExamAttempt = require("../models/ExamAttempt");
const Examination = require("../models/Examination");
const TeacherAssignment = require("../models/TeacherAssignment");
const Result = require("../models/Result");
const User = require("../models/User");

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.status = statusCode;
  return error;
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const roundToTwo = (value) => Number((value || 0).toFixed(2));

// ========================================
// 1. LOAD SECURE EXAMINATION
// ========================================

const loadSecureExamination = async (examinationId) => {
  return Examination.findById(examinationId).select(
    "+questions.options.isCorrect +questions.markingGuide",
  );
};

// ========================================
// 2. VERIFY TEACHER ASSIGNMENT
// ========================================

const verifyTeacherAssignment = async (teacherId, attempt) => {
  const examination = await Examination.findById(attempt.examination);

  if (!examination) {
    throw createError("Examination not found.", 404);
  }

  const assignment = await TeacherAssignment.findOne({
    teacher: teacherId,
    subject: examination.subject,
    class: attempt.schoolClass,
    academicSession: attempt.academicSession,
    status: "active",
  });

  if (!assignment) {
    throw createError("You are not authorized to grade this examination.", 403);
  }

  return examination;
};

// ========================================
// 3. DETERMINE EXAMINATION GRADING MODE
// ========================================

const determineGradingMode = (questions) => {
  const hasObjective = questions.some(
    (question) => question.questionType === "objective",
  );

  const hasTheory = questions.some(
    (question) => question.questionType === "theory",
  );

  if (hasObjective && hasTheory) return "mixed";
  if (hasTheory) return "manual";

  return "automatic";
};

// ========================================
// 4. CREATE OR UPDATE RESULT
// ========================================

const syncResultFromAttempt = async (attempt, examination) => {
  if (attempt.gradingStatus !== "graded") {
    return null;
  }

  const gradingMode = determineGradingMode(examination.questions);

  const gradedTeachers = [
    ...new Set(
      attempt.questions
        .filter(
          (question) => question.questionType === "theory" && question.gradedBy,
        )
        .map((question) => question.gradedBy.toString()),
    ),
  ];

  let result = await Result.findOne({
    attempt: attempt._id,
  });

  if (result && ["approved", "released"].includes(result.gradingStatus)) {
    return result;
  }

  const resultData = {
    attempt: attempt._id,
    student: attempt.student,
    examination: examination._id,
    academicSession: attempt.academicSession,
    term: attempt.term,
    schoolClass: attempt.schoolClass,
    subject: examination.subject,

    gradingMode,

    objectiveMarks: attempt.objectiveMarks || 0,
    theoryMarks: attempt.theoryMarks || 0,
    totalAwardedMarks: attempt.totalAwardedMarks || 0,
    totalPossibleMarks: attempt.totalPossibleMarks,

    passMarks: examination.passMarks,

    gradingStatus: "pending_review",
    gradedBy: gradedTeachers,
  };

  if (result) {
    Object.assign(result, resultData);
    await result.save();

    return result;
  }

  try {
    result = await Result.create(resultData);
    return result;
  } catch (error) {
    if (error.code === 11000) {
      const existing = await Result.findOne({
        attempt: attempt._id,
      });

      if (existing) {
        if (["approved", "released"].includes(existing.gradingStatus)) {
          return existing;
        }

        Object.assign(existing, resultData);
        await existing.save();

        return existing;
      }
    }

    throw error;
  }
};

// ========================================
// 5. GET TEACHER GRADING QUEUE
// ========================================

const getTeacherGradingQueue = async (teacherId, filters = {}) => {
  const assignments = await TeacherAssignment.find({
    teacher: teacherId,
    status: "active",
  }).select("subject class academicSession");

  if (!assignments.length) {
    return [];
  }

  const examinationConditions = assignments.map((assignment) => ({
    subject: assignment.subject,
    schoolClass: assignment.class,
    academicSession: assignment.academicSession,
  }));

  const examinationFilter = {
    $or: examinationConditions,
  };

  if (filters.examinationId) {
    if (!isValidId(filters.examinationId)) {
      throw createError("Invalid examination ID.");
    }

    examinationFilter._id = filters.examinationId;
  }

  const examinations = await Examination.find(examinationFilter).select(
    "_id title subject schoolClass",
  );

  if (!examinations.length) {
    return [];
  }

  const examinationMap = new Map(
    examinations.map((examination) => [
      examination._id.toString(),
      examination,
    ]),
  );

  const examinationIds = examinations.map((examination) => examination._id);

  const attempts = await ExamAttempt.find({
    examination: { $in: examinationIds },
    status: { $in: ["submitted", "auto_submitted"] },
    gradingStatus: {
      $in: ["pending", "partially_graded"],
    },
  })
    .populate("student", "firstName lastName admissionNumber")
    .populate("schoolClass", "name level arm")
    .sort({ submittedAt: 1 });

  return attempts.map((attempt) => {
    const examination = examinationMap.get(attempt.examination.toString());

    return {
      attemptId: attempt._id,
      examinationId: attempt.examination,

      examination: examination
        ? {
            id: examination._id,
            title: examination.title,
          }
        : null,

      student: attempt.student,
      schoolClass: attempt.schoolClass,
      submittedAt: attempt.submittedAt,
      status: attempt.status,
      gradingStatus: attempt.gradingStatus,

      totalQuestions: attempt.questions.length,

      theoryQuestions: attempt.questions.filter(
        (question) => question.questionType === "theory",
      ).length,

      gradedTheoryQuestions: attempt.questions.filter(
        (question) =>
          question.questionType === "theory" &&
          question.gradingStatus === "graded",
      ).length,
    };
  });
};

// ========================================
// 6. GET ATTEMPT FOR MANUAL GRADING
// ========================================

const getAttemptForGrading = async (attemptId, teacherId) => {
  if (!isValidId(attemptId)) {
    throw createError("Invalid attempt ID.");
  }

  const attempt = await ExamAttempt.findById(attemptId)
    .populate("student", "firstName lastName admissionNumber")
    .populate("schoolClass", "name level arm");

  if (!attempt) {
    throw createError("Examination attempt not found.", 404);
  }

  if (!["submitted", "auto_submitted"].includes(attempt.status)) {
    throw createError("Only submitted examinations can be graded.", 409);
  }

  await verifyTeacherAssignment(teacherId, attempt);

  const existingResult = await Result.findOne({
    attempt: attempt._id,
  });

  if (
    existingResult &&
    ["approved", "released"].includes(existingResult.gradingStatus)
  ) {
    throw createError(
      "This result has already been approved and cannot be edited.",
      409,
    );
  }

  const examination = await loadSecureExamination(attempt.examination);

  if (!examination) {
    throw createError("Examination not found.", 404);
  }

  const questions = attempt.questions.map((question) => {
    const originalQuestion = examination.questions.id(question.examQuestionId);

    return {
      id: question._id,
      questionText: question.questionText,
      questionType: question.questionType,
      responseText: question.responseText,
      marks: question.marks,
      awardedMarks: question.awardedMarks,
      gradingStatus: question.gradingStatus,
      teacherFeedback: question.teacherFeedback || "",

      markingGuide:
        question.questionType === "theory"
          ? originalQuestion?.markingGuide || ""
          : undefined,

      options: question.questionType === "objective" ? question.options : [],
    };
  });

  return {
    attemptId: attempt._id,

    examination: {
      id: examination._id,
      title: examination.title,
    },

    student: attempt.student,
    schoolClass: attempt.schoolClass,
    submittedAt: attempt.submittedAt,
    status: attempt.status,
    gradingStatus: attempt.gradingStatus,
    objectiveMarks: attempt.objectiveMarks,
    theoryMarks: attempt.theoryMarks,
    totalPossibleMarks: attempt.totalPossibleMarks,
    questions,
  };
};

// ========================================
// 7. GRADE THEORY ANSWER
// ========================================

const gradeTheoryAnswer = async (attemptId, questionId, teacherId, data) => {
  if (!isValidId(attemptId) || !isValidId(questionId)) {
    throw createError("Invalid attempt or question ID.");
  }

  const { awardedMarks, feedback = "" } = data;

  if (
    awardedMarks === undefined ||
    awardedMarks === null ||
    typeof awardedMarks !== "number" ||
    !Number.isFinite(awardedMarks)
  ) {
    throw createError("Enter a valid awarded mark.");
  }

  if (typeof feedback !== "string" || feedback.length > 2000) {
    throw createError(
      "Feedback must be text and cannot exceed 2,000 characters.",
    );
  }

  const attempt = await ExamAttempt.findById(attemptId);

  if (!attempt) {
    throw createError("Examination attempt not found.", 404);
  }

  if (!["submitted", "auto_submitted"].includes(attempt.status)) {
    throw createError("Only submitted examinations can be graded.", 409);
  }

  const examination = await verifyTeacherAssignment(teacherId, attempt);

  const existingResult = await Result.findOne({
    attempt: attempt._id,
  });

  if (
    existingResult &&
    ["approved", "released"].includes(existingResult.gradingStatus)
  ) {
    throw createError(
      "This result has already been approved and cannot be changed.",
      409,
    );
  }

  const question = attempt.questions.id(questionId);

  if (!question) {
    throw createError(
      "Question does not belong to this examination attempt.",
      404,
    );
  }

  if (question.questionType !== "theory") {
    throw createError("Only theory questions require manual grading.", 400);
  }

  if (awardedMarks < 0 || awardedMarks > question.marks) {
    throw createError(`Awarded marks must be between 0 and ${question.marks}.`);
  }

  const originalQuestion = examination.questions.id(question.examQuestionId);

  if (!originalQuestion) {
    throw createError("Original examination question could not be found.", 500);
  }

  question.awardedMarks = awardedMarks;
  question.teacherFeedback = feedback.trim();
  question.gradingStatus = "graded";
  question.gradedBy = teacherId;
  question.gradedAt = new Date();

  const theoryQuestions = attempt.questions.filter(
    (item) => item.questionType === "theory",
  );

  const pendingTheory = theoryQuestions.filter(
    (item) => item.gradingStatus !== "graded",
  );

  const theoryMarks = theoryQuestions.reduce(
    (sum, item) =>
      sum + (item.gradingStatus === "graded" ? item.awardedMarks || 0 : 0),
    0,
  );

  attempt.theoryMarks = theoryMarks;

  attempt.totalAwardedMarks = (attempt.objectiveMarks || 0) + theoryMarks;

  attempt.gradingStatus =
    pendingTheory.length > 0 ? "partially_graded" : "graded";

  await attempt.save();

  let result = null;

  if (attempt.gradingStatus === "graded") {
    result = await syncResultFromAttempt(attempt, examination);
  }

  return {
    success: true,

    message:
      attempt.gradingStatus === "graded"
        ? "All examination questions have been graded. The result is ready for review."
        : "Theory answer graded successfully. Other theory answers are still awaiting grading.",

    question: {
      id: question._id,
      awardedMarks: question.awardedMarks,
      maximumMarks: question.marks,
      gradingStatus: question.gradingStatus,
    },

    gradingProgress: {
      totalTheoryQuestions: theoryQuestions.length,
      gradedTheoryQuestions: theoryQuestions.length - pendingTheory.length,
      pendingTheoryQuestions: pendingTheory.length,
    },

    attemptGradingStatus: attempt.gradingStatus,
    resultId: result?._id || null,
  };
};

// ========================================
// 8. CREATE AUTOMATIC RESULT AFTER SUBMISSION
// ========================================

const createAutomaticResult = async (attemptId) => {
  if (!isValidId(attemptId)) {
    throw createError("Invalid attempt ID.");
  }

  const attempt = await ExamAttempt.findById(attemptId);

  if (!attempt) {
    throw createError("Examination attempt not found.", 404);
  }

  if (attempt.gradingStatus !== "graded") {
    throw createError("The examination has not completed grading.", 409);
  }

  const examination = await loadSecureExamination(attempt.examination);

  if (!examination) {
    throw createError("Examination not found.", 404);
  }

  const gradingMode = determineGradingMode(examination.questions);

  if (gradingMode !== "automatic") {
    throw createError(
      "This examination requires manual grading before result generation.",
      409,
    );
  }

  return syncResultFromAttempt(attempt, examination);
};

// ========================================
// 9. LIST RESULTS (ADMIN / EXAM OFFICER)
// ========================================

const listResults = async (filters = {}) => {
  const query = {};

  if (filters.examinationId) {
    if (!isValidId(filters.examinationId)) {
      throw createError("Invalid examination ID.");
    }

    query.examination = filters.examinationId;
  }

  if (filters.studentId) {
    if (!isValidId(filters.studentId)) {
      throw createError("Invalid student ID.");
    }

    query.student = filters.studentId;
  }

  if (filters.schoolClass) {
    if (!isValidId(filters.schoolClass)) {
      throw createError("Invalid class ID.");
    }

    query.schoolClass = filters.schoolClass;
  }

  if (filters.academicSession) {
    if (!isValidId(filters.academicSession)) {
      throw createError("Invalid academic session ID.");
    }

    query.academicSession = filters.academicSession;
  }

  if (filters.term) {
    if (!isValidId(filters.term)) {
      throw createError("Invalid term ID.");
    }

    query.term = filters.term;
  }

  if (filters.status) {
    const allowedStatuses = ["pending_review", "approved", "released"];

    if (!allowedStatuses.includes(filters.status)) {
      throw createError("Invalid result status.");
    }

    query.gradingStatus = filters.status;
  }

  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));

  const [results, total] = await Promise.all([
    Result.find(query)
      .populate("student", "firstName lastName admissionNumber")
      .populate("examination", "title")
      .populate("schoolClass", "name level arm")
      .populate("subject", "name code")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),

    Result.countDocuments(query),
  ]);

  return {
    results,

    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ========================================
// 10. APPROVE RESULT
// ========================================

const approveResult = async (resultId, approverId) => {
  if (!isValidId(resultId)) {
    throw createError("Invalid result ID.");
  }

  const result = await Result.findById(resultId);

  if (!result) {
    throw createError("Result not found.", 404);
  }

  if (result.gradingStatus !== "pending_review") {
    throw createError("Only results pending review can be approved.", 409);
  }

  result.gradingStatus = "approved";
  result.approvedBy = approverId;
  result.approvedAt = new Date();

  await result.save();

  return result;
};

// ========================================
// 11. RELEASE RESULT
// ========================================

const releaseResult = async (resultId, releasedBy) => {
  if (!isValidId(resultId)) {
    throw createError("Invalid result ID.");
  }

  const result = await Result.findById(resultId);

  if (!result) {
    throw createError("Result not found.", 404);
  }

  if (result.gradingStatus !== "approved") {
    throw createError("Only approved results can be released.", 409);
  }

  result.gradingStatus = "released";
  result.releasedBy = releasedBy;
  result.releasedAt = new Date();

  await result.save();

  return result;
};

// ========================================
// 12. VERIFY EXAMINATION RESULTS ARE COMPLETE
// ========================================

const verifyExaminationResultsComplete = async (examinationId) => {
  if (!isValidId(examinationId)) {
    throw createError("Invalid examination ID.");
  }

  const examination =
    await Examination.findById(examinationId).select("_id title");

  if (!examination) {
    throw createError("Examination not found.", 404);
  }

  const completedAttempts = await ExamAttempt.find({
    examination: examinationId,
    status: {
      $in: ["submitted", "auto_submitted"],
    },
  }).select("_id gradingStatus");

  if (!completedAttempts.length) {
    throw createError(
      "There are no submitted examination attempts to process.",
      409,
    );
  }

  const ungradedAttempts = completedAttempts.filter(
    (attempt) => attempt.gradingStatus !== "graded",
  );

  if (ungradedAttempts.length > 0) {
    throw createError(
      `${ungradedAttempts.length} submitted attempt(s) are still awaiting grading.`,
      409,
    );
  }

  const results = await Result.find({
    examination: examinationId,
  });

  if (results.length !== completedAttempts.length) {
    throw createError(
      "Some completed examination attempts do not yet have generated results.",
      409,
    );
  }

  return {
    examination,
    results,
    completedAttempts: completedAttempts.length,
  };
};

// ========================================
// 13. BULK APPROVE EXAMINATION RESULTS
// ========================================

const approveExaminationResults = async (examinationId, approverId) => {
  const { examination, results, completedAttempts } =
    await verifyExaminationResultsComplete(examinationId);

  const pendingResults = results.filter(
    (result) => result.gradingStatus === "pending_review",
  );

  const alreadyApproved = results.filter((result) =>
    ["approved", "released"].includes(result.gradingStatus),
  );

  const invalidResults = results.filter(
    (result) =>
      !["pending_review", "approved", "released"].includes(
        result.gradingStatus,
      ),
  );

  if (invalidResults.length > 0) {
    throw createError("Some results have an invalid approval status.", 409);
  }

  let approvedCount = 0;

  for (const result of pendingResults) {
    const updated = await Result.findOneAndUpdate(
      {
        _id: result._id,
        gradingStatus: "pending_review",
      },
      {
        $set: {
          gradingStatus: "approved",
          approvedBy: approverId,
          approvedAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (updated) {
      approvedCount++;
    }
  }

  const remainingPending = await Result.countDocuments({
    examination: examinationId,
    gradingStatus: "pending_review",
  });

  if (remainingPending > 0) {
    throw createError(
      "Some results could not be approved. Refresh and review the examination results.",
      409,
    );
  }

  return {
    success: true,
    message: "Examination results approved successfully.",

    examination: {
      id: examination._id,
      title: examination.title,
    },

    totalResults: results.length,
    newlyApproved: approvedCount,
    previouslyApprovedOrReleased: alreadyApproved.length,
    completedAttempts,
  };
};

// ========================================
// 14. BULK RELEASE EXAMINATION RESULTS
// ========================================

const releaseExaminationResults = async (examinationId, releasedBy) => {
  const { examination, results, completedAttempts } =
    await verifyExaminationResultsComplete(examinationId);

  const pendingApproval = results.filter(
    (result) => result.gradingStatus === "pending_review",
  );

  if (pendingApproval.length > 0) {
    throw createError(
      `${pendingApproval.length} result(s) still require approval before publication.`,
      409,
    );
  }

  const invalidResults = results.filter(
    (result) => !["approved", "released"].includes(result.gradingStatus),
  );

  if (invalidResults.length > 0) {
    throw createError("Some results are not eligible for publication.", 409);
  }

  const approvedResults = results.filter(
    (result) => result.gradingStatus === "approved",
  );

  let releasedCount = 0;

  for (const result of approvedResults) {
    const updated = await Result.findOneAndUpdate(
      {
        _id: result._id,
        gradingStatus: "approved",
      },
      {
        $set: {
          gradingStatus: "released",
          releasedBy,
          releasedAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (updated) {
      releasedCount++;
    }
  }

  const unreleasedCount = await Result.countDocuments({
    examination: examinationId,
    gradingStatus: { $ne: "released" },
  });

  if (unreleasedCount > 0) {
    throw createError(
      "Some results could not be released. Refresh and review the examination results.",
      409,
    );
  }

  return {
    success: true,
    message: "Examination results released successfully.",

    examination: {
      id: examination._id,
      title: examination.title,
    },

    totalResults: results.length,
    newlyReleased: releasedCount,
    completedAttempts,
  };
};

// ========================================
// 15. GET STUDENT'S RELEASED RESULTS
// ========================================

const getMyReleasedResults = async (studentId, filters = {}) => {
  const query = {
    student: studentId,
    gradingStatus: "released",
  };

  if (filters.academicSession) {
    if (!isValidId(filters.academicSession)) {
      throw createError("Invalid academic session ID.");
    }

    query.academicSession = filters.academicSession;
  }

  if (filters.term) {
    if (!isValidId(filters.term)) {
      throw createError("Invalid term ID.");
    }

    query.term = filters.term;
  }

  const results = await Result.find(query)
    .populate("examination", "title")
    .populate("subject", "name code")
    .populate("schoolClass", "name level arm")
    .populate("academicSession", "name")
    .populate("term", "name termNumber")
    .sort({ releasedAt: -1 });

  return results;
};

// ========================================
// 16. EXAMINATION PERFORMANCE STATISTICS
// ========================================

const getExaminationResultStatistics = async (examinationId) => {
  if (!isValidId(examinationId)) {
    throw createError("Invalid examination ID.");
  }

  const examination = await Examination.findById(examinationId).select(
    "title subject schoolClass totalMarks passMarks",
  );

  if (!examination) {
    throw createError("Examination not found.", 404);
  }

  const [attemptCounts, statistics, statusCounts] = await Promise.all([
    ExamAttempt.aggregate([
      {
        $match: {
          examination: new mongoose.Types.ObjectId(examinationId),
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),

    Result.aggregate([
      {
        $match: {
          examination: new mongoose.Types.ObjectId(examinationId),
        },
      },
      {
        $group: {
          _id: null,
          totalResults: { $sum: 1 },
          averagePercentage: { $avg: "$percentage" },
          highestPercentage: { $max: "$percentage" },
          lowestPercentage: { $min: "$percentage" },
          totalPassed: {
            $sum: {
              $cond: ["$isPassed", 1, 0],
            },
          },
          totalFailed: {
            $sum: {
              $cond: ["$isPassed", 0, 1],
            },
          },
        },
      },
    ]),

    Result.aggregate([
      {
        $match: {
          examination: new mongoose.Types.ObjectId(examinationId),
        },
      },
      {
        $group: {
          _id: "$gradingStatus",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const attemptSummary = {
    inProgress: 0,
    submitted: 0,
    autoSubmitted: 0,
  };

  attemptCounts.forEach((item) => {
    if (item._id === "in_progress") {
      attemptSummary.inProgress = item.count;
    }

    if (item._id === "submitted") {
      attemptSummary.submitted = item.count;
    }

    if (item._id === "auto_submitted") {
      attemptSummary.autoSubmitted = item.count;
    }
  });

  const resultSummary = statistics[0] || {
    totalResults: 0,
    averagePercentage: 0,
    highestPercentage: 0,
    lowestPercentage: 0,
    totalPassed: 0,
    totalFailed: 0,
  };

  const statuses = {
    pendingReview: 0,
    approved: 0,
    released: 0,
  };

  statusCounts.forEach((item) => {
    if (item._id === "pending_review") {
      statuses.pendingReview = item.count;
    }

    if (item._id === "approved") {
      statuses.approved = item.count;
    }

    if (item._id === "released") {
      statuses.released = item.count;
    }
  });

  const totalResults = resultSummary.totalResults;

  return {
    examination,
    attempts: attemptSummary,

    results: {
      total: totalResults,
      pendingReview: statuses.pendingReview,
      approved: statuses.approved,
      released: statuses.released,
      passed: resultSummary.totalPassed,
      failed: resultSummary.totalFailed,

      passRate:
        totalResults > 0
          ? roundToTwo((resultSummary.totalPassed / totalResults) * 100)
          : 0,

      averagePercentage: roundToTwo(resultSummary.averagePercentage),

      highestPercentage: resultSummary.highestPercentage || 0,
      lowestPercentage: resultSummary.lowestPercentage || 0,
    },
  };
};

// ========================================
// 17. CLASS PERFORMANCE STATISTICS
// ========================================

const getClassPerformanceStatistics = async (filters = {}) => {
  const { schoolClass, academicSession, term, subject } = filters;

  if (!isValidId(schoolClass)) {
    throw createError("A valid class ID is required.");
  }

  if (!isValidId(academicSession)) {
    throw createError("A valid academic session ID is required.");
  }

  const match = {
    schoolClass: new mongoose.Types.ObjectId(schoolClass),
    academicSession: new mongoose.Types.ObjectId(academicSession),
  };

  if (term) {
    if (!isValidId(term)) {
      throw createError("Invalid term ID.");
    }

    match.term = new mongoose.Types.ObjectId(term);
  }

  if (subject) {
    if (!isValidId(subject)) {
      throw createError("Invalid subject ID.");
    }

    match.subject = new mongoose.Types.ObjectId(subject);
  }

  const [summary, subjectPerformance] = await Promise.all([
    Result.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalResults: { $sum: 1 },
          averagePercentage: { $avg: "$percentage" },
          passed: {
            $sum: {
              $cond: ["$isPassed", 1, 0],
            },
          },
          failed: {
            $sum: {
              $cond: ["$isPassed", 0, 1],
            },
          },
        },
      },
    ]),

    Result.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$subject",
          totalStudents: { $sum: 1 },
          averagePercentage: { $avg: "$percentage" },
          highestPercentage: { $max: "$percentage" },
          lowestPercentage: { $min: "$percentage" },
          passed: {
            $sum: {
              $cond: ["$isPassed", 1, 0],
            },
          },
          failed: {
            $sum: {
              $cond: ["$isPassed", 0, 1],
            },
          },
        },
      },
      {
        $lookup: {
          from: "subjects",
          localField: "_id",
          foreignField: "_id",
          as: "subject",
        },
      },
      {
        $unwind: {
          path: "$subject",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          subjectId: "$_id",
          subjectName: "$subject.name",
          subjectCode: "$subject.code",
          totalStudents: 1,

          averagePercentage: {
            $round: [{ $ifNull: ["$averagePercentage", 0] }, 2],
          },

          highestPercentage: {
            $ifNull: ["$highestPercentage", 0],
          },

          lowestPercentage: {
            $ifNull: ["$lowestPercentage", 0],
          },

          passed: 1,
          failed: 1,

          passRate: {
            $round: [
              {
                $multiply: [
                  {
                    $divide: ["$passed", "$totalStudents"],
                  },
                  100,
                ],
              },
              2,
            ],
          },
        },
      },
      { $sort: { subjectName: 1 } },
    ]),
  ]);

  const result = summary[0] || {
    totalResults: 0,
    averagePercentage: 0,
    passed: 0,
    failed: 0,
  };

  return {
    schoolClass,
    academicSession,
    term: term || null,

    summary: {
      totalResults: result.totalResults,

      averagePercentage: roundToTwo(result.averagePercentage),

      passed: result.passed,
      failed: result.failed,

      passRate:
        result.totalResults > 0
          ? roundToTwo((result.passed / result.totalResults) * 100)
          : 0,
    },

    subjectPerformance,
  };
};

// ========================================
// 18. STUDENT PERFORMANCE STATISTICS
// ========================================

const getStudentPerformanceStatistics = async (studentId, filters = {}) => {
  if (!isValidId(studentId)) {
    throw createError("Invalid student ID.");
  }

  const student = await User.findOne({
    _id: studentId,
    role: "student",
  }).select("firstName lastName admissionNumber");

  if (!student) {
    throw createError("Student not found.", 404);
  }

  // Only released results are visible in student performance data.
  const query = {
    student: new mongoose.Types.ObjectId(studentId),
    gradingStatus: "released",
  };

  if (filters.academicSession) {
    if (!isValidId(filters.academicSession)) {
      throw createError("Invalid academic session ID.");
    }

    query.academicSession = new mongoose.Types.ObjectId(
      filters.academicSession,
    );
  }

  if (filters.term) {
    if (!isValidId(filters.term)) {
      throw createError("Invalid term ID.");
    }

    query.term = new mongoose.Types.ObjectId(filters.term);
  }

  const [summary, subjectPerformance, examinationHistory] = await Promise.all([
    Result.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalExaminations: { $sum: 1 },
          averagePercentage: { $avg: "$percentage" },
          highestPercentage: { $max: "$percentage" },
          passed: {
            $sum: {
              $cond: ["$isPassed", 1, 0],
            },
          },
          failed: {
            $sum: {
              $cond: ["$isPassed", 0, 1],
            },
          },
        },
      },
    ]),

    Result.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$subject",
          totalExaminations: { $sum: 1 },
          averagePercentage: { $avg: "$percentage" },
          highestPercentage: { $max: "$percentage" },
          passed: {
            $sum: {
              $cond: ["$isPassed", 1, 0],
            },
          },
        },
      },
      {
        $lookup: {
          from: "subjects",
          localField: "_id",
          foreignField: "_id",
          as: "subject",
        },
      },
      { $unwind: "$subject" },
      {
        $project: {
          _id: 0,
          subjectName: "$subject.name",
          subjectCode: "$subject.code",
          totalExaminations: 1,

          averagePercentage: {
            $round: [{ $ifNull: ["$averagePercentage", 0] }, 2],
          },

          highestPercentage: {
            $ifNull: ["$highestPercentage", 0],
          },

          passed: 1,
        },
      },
    ]),

    Result.find(query)
      .populate("examination", "title")
      .populate("subject", "name code")
      .populate("term", "name termNumber")
      .sort({ releasedAt: -1 }),
  ]);

  const result = summary[0] || {
    totalExaminations: 0,
    averagePercentage: 0,
    highestPercentage: 0,
    passed: 0,
    failed: 0,
  };

  return {
    student,

    summary: {
      totalExaminations: result.totalExaminations,

      averagePercentage: roundToTwo(result.averagePercentage),

      highestPercentage: result.highestPercentage || 0,
      passed: result.passed,
      failed: result.failed,
    },

    subjectPerformance,
    examinationHistory,
  };
};

// ========================================
// 19. GET TEACHER'S STUDENT RESULTS
// ========================================

const getTeacherResults = async (teacherId, filters = {}) => {
  // Get the teacher's active assignments.
  const assignments = await TeacherAssignment.find({
    teacher: teacherId,
    status: "active",
  }).select("subject class academicSession");

  if (!assignments.length) {
    return {
      results: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      },
    };
  }

  // Restrict results to the teacher's assigned subjects,
  // classes and academic sessions.
  const assignmentConditions = assignments.map((assignment) => ({
    subject: assignment.subject,
    schoolClass: assignment.class,
    academicSession: assignment.academicSession,
  }));

  const query = {
    $or: assignmentConditions,
  };

  // Optional filters.
  if (filters.examinationId) {
    if (!isValidId(filters.examinationId)) {
      throw createError("Invalid examination ID.");
    }

    query.examination = filters.examinationId;
  }

  if (filters.studentId) {
    if (!isValidId(filters.studentId)) {
      throw createError("Invalid student ID.");
    }

    query.student = filters.studentId;
  }

  if (filters.schoolClass) {
    if (!isValidId(filters.schoolClass)) {
      throw createError("Invalid class ID.");
    }

    query.schoolClass = filters.schoolClass;
  }

  if (filters.subject) {
    if (!isValidId(filters.subject)) {
      throw createError("Invalid subject ID.");
    }

    query.subject = filters.subject;
  }

  if (filters.status) {
    const allowedStatuses = ["pending_review", "approved", "released"];

    if (!allowedStatuses.includes(filters.status)) {
      throw createError("Invalid result status.");
    }

    query.gradingStatus = filters.status;
  }

  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));

  const [results, total] = await Promise.all([
    Result.find(query)
      .populate("student", "firstName lastName admissionNumber")
      .populate("examination", "title")
      .populate("schoolClass", "name level arm")
      .populate("subject", "name code")
      .populate("academicSession", "name")
      .populate("term", "name termNumber")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),

    Result.countDocuments(query),
  ]);

  return {
    results,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ========================================
// EXPORTS
// ========================================

module.exports = {
  getTeacherGradingQueue,
  getAttemptForGrading,
  gradeTheoryAnswer,
  getTeacherResults,
  createAutomaticResult,
  listResults,
  approveResult,
  releaseResult,
  approveExaminationResults,
  releaseExaminationResults,
  getMyReleasedResults,
  getExaminationResultStatistics,
  getClassPerformanceStatistics,
  getStudentPerformanceStatistics,
};
