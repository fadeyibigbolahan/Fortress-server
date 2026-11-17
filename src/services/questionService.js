const mongoose = require("mongoose");

const Question = require("../models/Question");
const Subject = require("../models/Subject");
const TeacherAssignment = require("../models/TeacherAssignment");
const User = require("../models/User");

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.status = statusCode;
  return error;
};

const allowedLevels = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sameId = (first, second) =>
  first && second && first.toString() === second.toString();

// ========================================
// 1. VALIDATE QUESTION DATA
// ========================================

const validateQuestionData = (data) => {
  if (!data.subject || !isValidId(data.subject)) {
    throw createError("A valid subject is required.");
  }

  if (!allowedLevels.includes(data.classLevel)) {
    throw createError("Invalid class level.");
  }

  if (!data.topic || !data.topic.trim()) {
    throw createError("Question topic is required.");
  }

  if (!data.questionText || !data.questionText.trim()) {
    throw createError("Question text is required.");
  }

  if (!["objective", "theory"].includes(data.questionType)) {
    throw createError("Question type must be objective or theory.");
  }

  if (
    data.marks === undefined ||
    !Number.isFinite(Number(data.marks)) ||
    Number(data.marks) <= 0
  ) {
    throw createError("Question marks must be greater than zero.");
  }

  if (
    data.difficulty &&
    !["easy", "medium", "hard"].includes(data.difficulty)
  ) {
    throw createError("Invalid question difficulty.");
  }

  if (data.status && !["draft", "active", "archived"].includes(data.status)) {
    throw createError("Invalid question status.");
  }

  if (data.questionType === "objective") {
    if (!Array.isArray(data.options) || data.options.length < 2) {
      throw createError("Objective questions require at least two options.");
    }

    if (data.options.length > 6) {
      throw createError(
        "Objective questions cannot have more than six options.",
      );
    }

    const validOptions = data.options.every(
      (option) =>
        option &&
        typeof option.text === "string" &&
        option.text.trim().length > 0,
    );

    if (!validOptions) {
      throw createError("Every option must contain text.");
    }

    const correctCount = data.options.filter(
      (option) => option.isCorrect === true,
    ).length;

    if (correctCount !== 1) {
      throw createError(
        "Exactly one option must be marked as the correct answer.",
      );
    }
  }

  if (
    data.questionType === "theory" &&
    Array.isArray(data.options) &&
    data.options.length > 0
  ) {
    throw createError("Theory questions must not contain options.");
  }

  if (
    data.status === "active" &&
    data.questionType === "theory" &&
    (!data.markingGuide || !data.markingGuide.trim())
  ) {
    throw createError(
      "A marking guide is required before activating a theory question.",
    );
  }
};

// ========================================
// 2. VALIDATE SUBJECT
// ========================================

const validateSubject = async (subjectId, classLevel) => {
  if (!isValidId(subjectId)) {
    throw createError("Invalid subject ID.");
  }

  const subject = await Subject.findById(subjectId);

  if (!subject) {
    throw createError("Subject not found.", 404);
  }

  if (subject.status !== "active") {
    throw createError("Questions cannot be added to an inactive subject.");
  }

  if (!subject.levels.includes(classLevel)) {
    throw createError(`This subject is not available for ${classLevel}.`);
  }

  return subject;
};

// ========================================
// 3. GET TEACHER ASSIGNMENTS
// ========================================

const getTeacherAssignments = async (teacherId) => {
  return TeacherAssignment.find({
    teacher: teacherId,
    status: "active",
  })
    .populate("class", "level status")
    .populate("subject", "name code status")
    .lean();
};

// ========================================
// 4. CHECK TEACHER ASSIGNMENT
// ========================================

// Used when a teacher creates a question or when
// checking whether a question belongs to an assigned class/subject.

const checkTeacherAssignmentPermission = async (
  user,
  subjectId,
  classLevel,
) => {
  if (user.role === "admin") {
    return true;
  }

  if (user.role !== "teacher") {
    throw createError("You are not authorized to manage questions.", 403);
  }

  const assignments = await getTeacherAssignments(user._id);

  const hasAssignment = assignments.some((assignment) => {
    return (
      assignment.subject &&
      assignment.class &&
      sameId(assignment.subject._id, subjectId) &&
      assignment.class.level === classLevel &&
      assignment.class.status === "active" &&
      assignment.subject.status === "active"
    );
  });

  if (!hasAssignment) {
    throw createError(
      "You are not assigned to this subject and class level.",
      403,
    );
  }

  return true;
};

// ========================================
// 5. CHECK QUESTION VIEW PERMISSION
// ========================================

// Teachers can view:
// 1. Questions created by an admin.
// 2. Questions created by themselves.
//
// They cannot view questions created by other teachers.

const checkQuestionViewPermission = async (question, user) => {
  if (user.role === "admin") {
    return true;
  }

  if (user.role !== "teacher") {
    throw createError("You are not authorized to view questions.", 403);
  }

  await checkTeacherAssignmentPermission(
    user,
    question.subject,
    question.classLevel,
  );

  // Teachers can always view their own questions.
  if (sameId(question.createdBy, user._id)) {
    return true;
  }

  // Otherwise, the question must have been created by an admin.
  const creator = await User.findById(question.createdBy).select("role").lean();

  if (!creator || creator.role !== "admin") {
    throw createError("You are not authorized to view this question.", 403);
  }

  return true;
};

// ========================================
// 6. CHECK QUESTION MANAGEMENT PERMISSION
// ========================================

// Admins can manage all questions.
// Teachers can manage only questions they created.

const checkQuestionManagementPermission = async (question, user) => {
  if (user.role === "admin") {
    return true;
  }

  if (user.role !== "teacher") {
    throw createError("You are not authorized to manage questions.", 403);
  }

  if (!sameId(question.createdBy, user._id)) {
    throw createError(
      "You can only edit or archive questions you created.",
      403,
    );
  }

  await checkTeacherAssignmentPermission(
    user,
    question.subject,
    question.classLevel,
  );

  return true;
};

// ========================================
// 7. BUILD TEACHER QUESTION FILTER
// ========================================

// Returns questions matching the teacher's assignments
// AND created by either an admin or the logged-in teacher.

const applyTeacherQuestionFilter = async (query, user) => {
  if (user.role === "admin") {
    return query;
  }

  if (user.role !== "teacher") {
    throw createError("You are not authorized to view questions.", 403);
  }

  const assignments = await getTeacherAssignments(user._id);

  const pairs = assignments
    .filter(
      (assignment) =>
        assignment.subject &&
        assignment.class &&
        assignment.subject.status === "active" &&
        assignment.class.status === "active",
    )
    .map((assignment) => ({
      subject: assignment.subject._id,
      classLevel: assignment.class.level,
    }));

  if (pairs.length === 0) {
    query._id = null;
    return query;
  }

  const adminUsers = await User.find({ role: "admin" }).select("_id").lean();

  const adminIds = adminUsers.map((admin) => admin._id);

  // Preserve existing $and conditions, such as search filters.
  query.$and = query.$and || [];

  // Restrict results to assigned subjects and class levels.
  query.$and.push({
    $or: pairs,
  });

  // Restrict results to admin-created questions or the teacher's own.
  query.$and.push({
    $or: [{ createdBy: user._id }, { createdBy: { $in: adminIds } }],
  });

  return query;
};

// ========================================
// 8. CREATE QUESTION
// ========================================

const createQuestion = async (data, user) => {
  validateQuestionData(data);

  const subject = await validateSubject(data.subject, data.classLevel);

  await checkTeacherAssignmentPermission(user, subject._id, data.classLevel);

  const question = await Question.create({
    subject: subject._id,
    classLevel: data.classLevel,
    topic: data.topic.trim(),
    subtopic: data.subtopic?.trim() || undefined,
    questionText: data.questionText.trim(),
    questionType: data.questionType,
    options:
      data.questionType === "objective"
        ? data.options.map((option) => ({
            text: option.text.trim(),
            isCorrect: option.isCorrect === true,
          }))
        : [],
    markingGuide:
      data.questionType === "theory" ? data.markingGuide?.trim() : undefined,
    explanation: data.explanation?.trim() || undefined,
    marks: Number(data.marks),
    difficulty: data.difficulty || "medium",
    status: data.status || "draft",
    createdBy: user._id,
  });

  return Question.findById(question._id)
    .populate("subject", "name code")
    .populate("createdBy", "firstName lastName role");
};

// ========================================
// 9. GET ALL QUESTIONS
// ========================================

const getQuestions = async (filters = {}, user) => {
  const {
    subject,
    classLevel,
    questionType,
    difficulty,
    status,
    topic,
    search,
    page = 1,
    limit = 20,
  } = filters;

  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const query = {};

  if (subject) {
    if (!isValidId(subject)) {
      throw createError("Invalid subject ID.");
    }

    query.subject = subject;
  }

  if (classLevel) {
    if (!allowedLevels.includes(classLevel)) {
      throw createError("Invalid class level.");
    }

    query.classLevel = classLevel;
  }

  if (questionType) {
    if (!["objective", "theory"].includes(questionType)) {
      throw createError("Invalid question type.");
    }

    query.questionType = questionType;
  }

  if (difficulty) {
    if (!["easy", "medium", "hard"].includes(difficulty)) {
      throw createError("Invalid difficulty.");
    }

    query.difficulty = difficulty;
  }

  if (status) {
    if (!["draft", "active", "archived"].includes(status)) {
      throw createError("Invalid question status.");
    }

    query.status = status;
  }

  if (topic) {
    query.topic = new RegExp(escapeRegex(topic.trim()), "i");
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(escapeRegex(search.trim()), "i");

    query.$and = query.$and || [];

    query.$and.push({
      $or: [
        { questionText: searchRegex },
        { topic: searchRegex },
        { subtopic: searchRegex },
      ],
    });
  }

  await applyTeacherQuestionFilter(query, user);

  const skip = (pageNumber - 1) * pageSize;

  const [questions, total] = await Promise.all([
    Question.find(query)
      .populate("subject", "name code")
      .populate("createdBy", "firstName lastName role")
      .populate("updatedBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),

    Question.countDocuments(query),
  ]);

  return {
    questions,
    pagination: {
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNextPage: pageNumber * pageSize < total,
      hasPreviousPage: pageNumber > 1,
    },
  };
};

// ========================================
// 10. GET QUESTION BY ID
// ========================================

const getQuestionById = async (questionId, user) => {
  if (!isValidId(questionId)) {
    throw createError("Invalid question ID.");
  }

  const question = await Question.findById(questionId)
    .populate("subject", "name code levels")
    .populate("createdBy", "firstName lastName role")
    .populate("updatedBy", "firstName lastName")
    .lean();

  if (!question) {
    throw createError("Question not found.", 404);
  }

  await checkQuestionViewPermission(
    {
      ...question,
      subject: question.subject?._id,
      createdBy: question.createdBy?._id,
    },
    user,
  );

  return question;
};

// ========================================
// 11. UPDATE QUESTION
// ========================================

const updateQuestion = async (questionId, data, user) => {
  if (!isValidId(questionId)) {
    throw createError("Invalid question ID.");
  }

  const question = await Question.findById(questionId);

  if (!question) {
    throw createError("Question not found.", 404);
  }

  await checkQuestionManagementPermission(question, user);

  const allowedFields = [
    "subject",
    "classLevel",
    "topic",
    "subtopic",
    "questionText",
    "questionType",
    "options",
    "markingGuide",
    "explanation",
    "marks",
    "difficulty",
    "status",
  ];

  const updatedData = {};

  allowedFields.forEach((field) => {
    if (data[field] !== undefined) {
      updatedData[field] = data[field];
    }
  });

  const nextSubject = updatedData.subject || question.subject;
  const nextLevel = updatedData.classLevel || question.classLevel;

  await validateSubject(nextSubject, nextLevel);

  await checkTeacherAssignmentPermission(user, nextSubject, nextLevel);

  const nextQuestionType = updatedData.questionType ?? question.questionType;

  const nextOptions =
    nextQuestionType === "theory"
      ? []
      : (updatedData.options ?? question.options);

  const merged = {
    subject: nextSubject,
    classLevel: nextLevel,
    topic: updatedData.topic ?? question.topic,
    questionText: updatedData.questionText ?? question.questionText,
    questionType: nextQuestionType,
    options: nextOptions,
    markingGuide: updatedData.markingGuide ?? question.markingGuide,
    marks: updatedData.marks ?? question.marks,
    difficulty: updatedData.difficulty ?? question.difficulty,
    status: updatedData.status ?? question.status,
  };

  validateQuestionData(merged);

  if (updatedData.topic !== undefined) {
    question.topic = updatedData.topic.trim();
  }

  if (updatedData.subtopic !== undefined) {
    question.subtopic = updatedData.subtopic.trim();
  }

  if (updatedData.questionText !== undefined) {
    question.questionText = updatedData.questionText.trim();
  }

  if (updatedData.subject !== undefined) {
    question.subject = updatedData.subject;
  }

  if (updatedData.classLevel !== undefined) {
    question.classLevel = updatedData.classLevel;
  }

  if (updatedData.questionType !== undefined) {
    question.questionType = updatedData.questionType;
  }

  if (updatedData.options !== undefined) {
    question.options =
      merged.questionType === "objective"
        ? updatedData.options.map((option) => ({
            text: option.text.trim(),
            isCorrect: option.isCorrect === true,
          }))
        : [];
  } else if (updatedData.questionType === "theory") {
    question.options = [];
  }

  if (updatedData.markingGuide !== undefined) {
    question.markingGuide = updatedData.markingGuide.trim();
  }

  if (updatedData.explanation !== undefined) {
    question.explanation = updatedData.explanation.trim();
  }

  if (updatedData.marks !== undefined) {
    question.marks = Number(updatedData.marks);
  }

  if (updatedData.difficulty !== undefined) {
    question.difficulty = updatedData.difficulty;
  }

  if (updatedData.status !== undefined) {
    question.status = updatedData.status;
  }

  question.updatedBy = user._id;

  await question.save();

  return Question.findById(question._id)
    .populate("subject", "name code")
    .populate("createdBy", "firstName lastName role")
    .populate("updatedBy", "firstName lastName");
};

// ========================================
// 12. ARCHIVE QUESTION
// ========================================

const archiveQuestion = async (questionId, user) => {
  if (!isValidId(questionId)) {
    throw createError("Invalid question ID.");
  }

  const question = await Question.findById(questionId);

  if (!question) {
    throw createError("Question not found.", 404);
  }

  await checkQuestionManagementPermission(question, user);

  question.status = "archived";
  question.updatedBy = user._id;

  await question.save();

  return question;
};

// ========================================
// 13. QUESTION STATISTICS
// ========================================

const getQuestionStatistics = async (filters = {}, user) => {
  const query = {};

  if (filters.subject) {
    if (!isValidId(filters.subject)) {
      throw createError("Invalid subject ID.");
    }

    query.subject = new mongoose.Types.ObjectId(filters.subject);
  }

  if (filters.classLevel) {
    if (!allowedLevels.includes(filters.classLevel)) {
      throw createError("Invalid class level.");
    }

    query.classLevel = filters.classLevel;
  }

  await applyTeacherQuestionFilter(query, user);

  const results = await Question.aggregate([
    { $match: query },
    {
      $group: {
        _id: {
          questionType: "$questionType",
          status: "$status",
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const statistics = {
    total: 0,
    objective: 0,
    theory: 0,
    draft: 0,
    active: 0,
    archived: 0,
  };

  results.forEach((item) => {
    statistics[item._id.questionType] += item.count;
    statistics[item._id.status] += item.count;
    statistics.total += item.count;
  });

  return statistics;
};

module.exports = {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  archiveQuestion,
  getQuestionStatistics,
};
