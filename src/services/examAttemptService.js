const mongoose = require("mongoose");

const ExamAttempt = require("../models/ExamAttempt");
const Examination = require("../models/Examination");
const User = require("../models/User");
const StudentEnrollment = require("../models/StudentEnrollment");

const { createAutomaticResult } = require("./resultService");

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.status = statusCode;
  return error;
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ========================================
// 1. RANDOMIZE ARRAY
// ========================================

const shuffleArray = (items) => {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
};

// ========================================
// 2. BUILD STUDENT-SAFE ATTEMPT RESPONSE
// ========================================

const formatStudentAttempt = (attempt) => {
  const now = new Date();

  return {
    id: attempt._id,
    examination: attempt.examination,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt,
    serverTime: now,
    remainingSeconds:
      attempt.status === "in_progress"
        ? Math.max(
            0,
            Math.floor((attempt.expiresAt.getTime() - now.getTime()) / 1000),
          )
        : 0,
    totalQuestions: attempt.questions.length,
    totalPossibleMarks: attempt.totalPossibleMarks,

    questions: attempt.questions.map((question) => ({
      id: question._id,
      examQuestionId: question.examQuestionId,
      questionText: question.questionText,
      questionType: question.questionType,
      options: question.options.map((option) => ({
        optionId: option.optionId,
        text: option.text,
      })),
      marks: question.marks,
      selectedOptionId: question.selectedOptionId,
      responseText: question.responseText,
    })),
  };
};

// ========================================
// 3. VALIDATE STUDENT ELIGIBILITY
// ========================================

const validateStudentEligibility = async (studentId, examination) => {
  const student = await User.findOne({
    _id: studentId,
    role: "student",
    status: "active",
  });

  if (!student) {
    throw createError("Active student account not found.", 404);
  }

  const enrollment = await StudentEnrollment.findOne({
    student: studentId,
    academicSession: examination.academicSession,
    class: examination.schoolClass,
    status: "active",
  });

  if (!enrollment) {
    throw createError(
      "You are not enrolled in the class scheduled for this examination.",
      403,
    );
  }

  return student;
};

// ========================================
// 4. LOAD SECURE EXAMINATION SNAPSHOT
// ========================================

const loadSecureExamination = async (examinationId) => {
  return Examination.findById(examinationId).select(
    "+questions.options.isCorrect +questions.markingGuide",
  );
};

// ========================================
// 5. BUILD RANDOMIZED ATTEMPT QUESTIONS
// ========================================

const buildAttemptQuestions = (examination) => {
  let questions = examination.questions.map((question) => {
    let options = question.options.map((option) => ({
      optionId: option.optionId,
      text: option.text,
    }));

    if (examination.shuffleOptions && question.questionType === "objective") {
      options = shuffleArray(options);
    }

    return {
      examQuestionId: question._id,
      questionText: question.questionText,
      questionType: question.questionType,
      options: question.questionType === "objective" ? options : [],
      marks: question.marks,
      selectedOptionId: null,
      responseText: "",
      gradingStatus:
        question.questionType === "objective" ? "not_required" : "pending",
    };
  });

  if (examination.shuffleQuestions) {
    questions = shuffleArray(questions);
  }

  return questions;
};

// ========================================
// 6. START EXAMINATION
// ========================================

const startExamination = async (examinationId, studentId, ipAddress) => {
  if (!isValidId(examinationId)) {
    throw createError("Invalid examination ID.");
  }

  if (!isValidId(studentId)) {
    throw createError("Invalid student ID.");
  }

  const examination = await loadSecureExamination(examinationId);

  if (!examination) {
    throw createError("Examination not found.", 404);
  }

  const existingAttempt = await ExamAttempt.findOne({
    student: studentId,
    examination: examinationId,
  });

  // A previous attempt exists.
  if (existingAttempt) {
    if (existingAttempt.status !== "in_progress") {
      throw createError(
        "You have already completed this examination. A second attempt is not permitted.",
        409,
      );
    }

    if (new Date() >= existingAttempt.expiresAt) {
      await submitAttemptInternal(existingAttempt, "auto_submitted", ipAddress);

      throw createError(
        "Your examination time has expired. Your answers have been submitted.",
        409,
      );
    }

    return {
      resumed: true,
      attempt: formatStudentAttempt(existingAttempt),
    };
  }

  if (examination.status !== "published") {
    throw createError("This examination is not currently available.", 403);
  }

  const now = new Date();

  if (now < examination.startAt) {
    throw createError("This examination has not started yet.", 403);
  }

  if (now >= examination.endAt) {
    throw createError("The examination access period has ended.", 403);
  }

  await validateStudentEligibility(studentId, examination);

  if (!examination.questions || examination.questions.length === 0) {
    throw createError("This examination has no questions.", 400);
  }

  const expiresAt = new Date(
    Math.min(
      now.getTime() + examination.durationMinutes * 60 * 1000,
      examination.endAt.getTime(),
    ),
  );

  const questions = buildAttemptQuestions(examination);

  const totalPossibleMarks = questions.reduce(
    (sum, question) => sum + question.marks,
    0,
  );

  try {
    const attempt = await ExamAttempt.create({
      student: studentId,
      examination: examination._id,
      academicSession: examination.academicSession,
      term: examination.term,
      schoolClass: examination.schoolClass,
      questions,
      startedAt: now,
      expiresAt,
      totalPossibleMarks,
      status: "in_progress",
      startedFromIp: ipAddress || null,
    });

    return {
      resumed: false,
      attempt: formatStudentAttempt(attempt),
    };
  } catch (error) {
    // The unique index protects against simultaneous duplicate starts.
    if (error.code === 11000) {
      const existing = await ExamAttempt.findOne({
        student: studentId,
        examination: examinationId,
      });

      if (existing && existing.status === "in_progress") {
        return {
          resumed: true,
          attempt: formatStudentAttempt(existing),
        };
      }

      throw createError("An attempt already exists for this examination.", 409);
    }

    throw error;
  }
};

// ========================================
// 7. GET CURRENT ATTEMPT / RECOVER ATTEMPT
// ========================================

const getMyAttempt = async (attemptId, studentId, ipAddress) => {
  if (!isValidId(attemptId)) {
    throw createError("Invalid attempt ID.");
  }

  const attempt = await ExamAttempt.findOne({
    _id: attemptId,
    student: studentId,
  });

  if (!attempt) {
    throw createError("Examination attempt not found.", 404);
  }

  if (attempt.status === "in_progress" && new Date() >= attempt.expiresAt) {
    await submitAttemptInternal(attempt, "auto_submitted", ipAddress);

    const refreshed = await ExamAttempt.findById(attempt._id);

    return formatStudentAttempt(refreshed);
  }

  return formatStudentAttempt(attempt);
};

// ========================================
// 8. SAVE ANSWER
// ========================================

const saveAnswer = async (attemptId, studentId, data) => {
  if (!isValidId(attemptId)) {
    throw createError("Invalid attempt ID.");
  }

  const { questionId, selectedOptionId, responseText } = data;

  if (!isValidId(questionId)) {
    throw createError("Invalid question ID.");
  }

  const attempt = await ExamAttempt.findOne({
    _id: attemptId,
    student: studentId,
  });

  if (!attempt) {
    throw createError("Examination attempt not found.", 404);
  }

  if (attempt.status !== "in_progress") {
    throw createError("This examination attempt is no longer active.", 409);
  }

  if (new Date() >= attempt.expiresAt) {
    await submitAttemptInternal(attempt, "auto_submitted");

    throw createError("Examination time has expired.", 409);
  }

  const question = attempt.questions.id(questionId);

  if (!question) {
    throw createError("Question does not belong to this examination.", 404);
  }

  const update = {};

  if (question.questionType === "objective") {
    if (typeof selectedOptionId !== "string" || !selectedOptionId) {
      throw createError("Select an answer option.");
    }

    const validOption = question.options.some(
      (option) => option.optionId === selectedOptionId,
    );

    if (!validOption) {
      throw createError("Invalid answer option.");
    }

    update["questions.$.selectedOptionId"] = selectedOptionId;
  } else {
    if (typeof responseText !== "string") {
      throw createError("Theory answer must be text.");
    }

    if (responseText.length > 20000) {
      throw createError("Theory answer cannot exceed 20,000 characters.");
    }

    update["questions.$.responseText"] = responseText;
  }

  const savedAttempt = await ExamAttempt.findOneAndUpdate(
    {
      _id: attemptId,
      student: studentId,
      status: "in_progress",
      expiresAt: { $gt: new Date() },
      "questions._id": questionId,
    },
    { $set: update },
    { new: true },
  );

  if (!savedAttempt) {
    throw createError(
      "Your answer could not be saved because the examination has expired or is no longer active.",
      409,
    );
  }

  return {
    saved: true,
    savedAt: new Date(),
    expiresAt: savedAttempt.expiresAt,
  };
};

// ========================================
// 9. GRADE OBJECTIVE QUESTIONS
// ========================================

const gradeObjectiveQuestions = (attempt, examination) => {
  let objectiveMarks = 0;
  let theoryMarks = 0;
  let pendingTheory = 0;

  for (const attemptQuestion of attempt.questions) {
    const examQuestion = examination.questions.id(
      attemptQuestion.examQuestionId,
    );

    if (!examQuestion) {
      throw createError(
        "A question snapshot could not be found during grading.",
        500,
      );
    }

    if (attemptQuestion.questionType === "objective") {
      const correctOption = examQuestion.options.find(
        (option) => option.isCorrect === true,
      );

      const isCorrect =
        Boolean(correctOption) &&
        attemptQuestion.selectedOptionId === correctOption.optionId;

      const awardedMarks = isCorrect ? attemptQuestion.marks : 0;

      attemptQuestion.isCorrect = isCorrect;
      attemptQuestion.awardedMarks = awardedMarks;
      attemptQuestion.gradingStatus = "not_required";

      objectiveMarks += awardedMarks;
    } else {
      attemptQuestion.awardedMarks = null;
      attemptQuestion.isCorrect = null;
      attemptQuestion.gradingStatus = "pending";

      pendingTheory++;
    }
  }

  attempt.objectiveMarks = objectiveMarks;
  attempt.theoryMarks = theoryMarks;
  attempt.totalAwardedMarks = objectiveMarks + theoryMarks;

  attempt.gradingStatus = pendingTheory > 0 ? "pending" : "graded";
};

// ========================================
// 10. INTERNAL SUBMISSION
// ========================================

const submitAttemptInternal = async (attempt, submissionStatus, ipAddress) => {
  if (attempt.status !== "in_progress") {
    return attempt;
  }

  const examination = await loadSecureExamination(attempt.examination);

  if (!examination) {
    throw createError("Examination record not found.", 404);
  }

  gradeObjectiveQuestions(attempt, examination);

  attempt.status = submissionStatus;
  attempt.submittedAt = new Date();
  attempt.submittedFromIp = ipAddress || null;

  await attempt.save();

  if (attempt.gradingStatus === "graded") {
    await createAutomaticResult(attempt._id);
  }

  return attempt;
};

// ========================================
// 11. SUBMIT EXAMINATION
// ========================================

const submitAttempt = async (attemptId, studentId, ipAddress) => {
  if (!isValidId(attemptId)) {
    throw createError("Invalid attempt ID.");
  }

  const attempt = await ExamAttempt.findOne({
    _id: attemptId,
    student: studentId,
  });

  if (!attempt) {
    throw createError("Examination attempt not found.", 404);
  }

  // If already submitted, return a successful response.
  // Do not grade or generate another result.
  if (attempt.status !== "in_progress") {
    return {
      success: true,
      alreadySubmitted: true,
      message: "This examination has already been submitted.",
      status: attempt.status,
      submittedAt: attempt.submittedAt,
    };
  }

  const submissionStatus =
    new Date() >= attempt.expiresAt ? "auto_submitted" : "submitted";

  const submitted = await submitAttemptInternal(
    attempt,
    submissionStatus,
    ipAddress,
  );

  return {
    success: true,
    alreadySubmitted: false,
    message:
      submissionStatus === "auto_submitted"
        ? "Your examination time expired. Your answers were submitted automatically."
        : "Your examination was submitted successfully.",
    status: submitted.status,
    submittedAt: submitted.submittedAt,
  };
};

// ========================================
// 12. EXPIRE AND AUTO-SUBMIT ATTEMPTS
// ========================================

const expireAttempts = async () => {
  const now = new Date();

  const expiredAttempts = await ExamAttempt.find({
    status: "in_progress",
    expiresAt: { $lte: now },
  })
    .select("_id")
    .limit(100);

  let processed = 0;

  for (const item of expiredAttempts) {
    try {
      const attempt = await ExamAttempt.findById(item._id);

      if (!attempt || attempt.status !== "in_progress") {
        continue;
      }

      await submitAttemptInternal(attempt, "auto_submitted", null);

      processed++;
    } catch (error) {
      console.error(
        `Auto-submission failed for attempt ${item._id}:`,
        error.message,
      );
    }
  }

  return processed;
};

module.exports = {
  startExamination,
  getMyAttempt,
  saveAnswer,
  submitAttempt,
  expireAttempts,
};
