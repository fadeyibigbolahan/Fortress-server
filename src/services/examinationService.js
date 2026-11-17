const mongoose = require("mongoose");

const Examination = require("../models/Examination");
const Question = require("../models/Question");
const Subject = require("../models/Subject");
const SchoolClass = require("../models/Class");
const AcademicSession = require("../models/AcademicSession");
const Term = require("../models/Term");

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.status = statusCode;
  return error;
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const allowedLevels = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];

const validateExaminationData = (data) => {
  const {
    title,
    academicSessionId,
    termId,
    classId,
    subjectId,
    questionIds,
    passMarks,
    durationMinutes,
    startAt,
    endAt,
  } = data;

  if (!title || !academicSessionId || !termId || !classId || !subjectId) {
    throw createError(
      "Title, academic session, term, class and subject are required.",
    );
  }

  for (const [name, value] of [
    ["Academic session", academicSessionId],
    ["Term", termId],
    ["Class", classId],
    ["Subject", subjectId],
  ]) {
    if (!isValidId(value)) {
      throw createError(`Invalid ${name.toLowerCase()} ID.`);
    }
  }

  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    throw createError("Select at least one examination question.");
  }

  if (questionIds.length > 200) {
    throw createError("An examination cannot contain more than 200 questions.");
  }

  if (!questionIds.every(isValidId)) {
    throw createError("One or more question IDs are invalid.");
  }

  if (new Set(questionIds.map(String)).size !== questionIds.length) {
    throw createError("Duplicate questions are not allowed.");
  }

  const duration = Number(durationMinutes);
  const pass = Number(passMarks);

  if (!Number.isInteger(duration) || duration < 1 || duration > 600) {
    throw createError("Duration must be between 1 and 600 minutes.");
  }

  if (!Number.isFinite(pass) || pass < 0) {
    throw createError("Pass marks must be zero or greater.");
  }

  const start = new Date(startAt);
  const end = new Date(endAt);

  if (
    !startAt ||
    !endAt ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    throw createError("Valid examination start and end dates are required.");
  }

  if (end <= start) {
    throw createError("Examination end time must be later than start time.");
  }

  const availableMinutes = (end - start) / 60000;

  if (duration > availableMinutes) {
    throw createError(
      "Examination duration cannot exceed its availability window.",
    );
  }

  return {
    start,
    end,
    duration,
    pass,
  };
};

// ========================================
// 1. VALIDATE EXAMINATION REFERENCES
// ========================================

const validateReferences = async ({
  academicSessionId,
  termId,
  classId,
  subjectId,
}) => {
  const [academicSession, term, schoolClass, subject] = await Promise.all([
    AcademicSession.findById(academicSessionId),
    Term.findById(termId),
    SchoolClass.findById(classId),
    Subject.findById(subjectId),
  ]);

  if (!academicSession) {
    throw createError("Academic session not found.", 404);
  }

  if (academicSession.status === "completed") {
    throw createError("Cannot create an examination for a completed session.");
  }

  if (!term) {
    throw createError("Term not found.", 404);
  }

  if (term.academicSession.toString() !== academicSession._id.toString()) {
    throw createError(
      "The selected term does not belong to this academic session.",
    );
  }

  if (term.status === "completed") {
    throw createError("Cannot create an examination for a completed term.");
  }

  if (!schoolClass || schoolClass.status !== "active") {
    throw createError("Selected class does not exist or is inactive.", 404);
  }

  if (!subject || subject.status !== "active") {
    throw createError("Selected subject does not exist or is inactive.", 404);
  }

  if (!allowedLevels.includes(schoolClass.level)) {
    throw createError("Invalid class level.");
  }

  if (!subject.levels.includes(schoolClass.level)) {
    throw createError("This subject is not available for the selected class.");
  }

  return {
    academicSession,
    term,
    schoolClass,
    subject,
  };
};

// ========================================
// 2. BUILD QUESTION SNAPSHOTS
// ========================================

const buildQuestionSnapshots = async ({
  questionIds,
  subjectId,
  classLevel,
}) => {
  const questions = await Question.find({
    _id: { $in: questionIds },
    subject: subjectId,
    classLevel,
    status: "active",
  })
    .select("+markingGuide")
    .lean();

  if (questions.length !== questionIds.length) {
    throw createError(
      "One or more selected questions are unavailable, inactive, or do not match the selected subject and class.",
    );
  }

  const questionMap = new Map(
    questions.map((question) => [question._id.toString(), question]),
  );

  // Preserve the order selected by the administrator.
  return questionIds.map((id) => {
    const question = questionMap.get(id.toString());

    if (question.questionType === "objective") {
      if (
        !Array.isArray(question.options) ||
        question.options.length < 2 ||
        question.options.filter((option) => option.isCorrect).length !== 1
      ) {
        throw createError(
          `Question "${question._id}" has invalid objective options.`,
        );
      }
    }

    if (question.questionType === "theory" && !question.markingGuide?.trim()) {
      throw createError(
        `Theory question "${question._id}" has no marking guide.`,
      );
    }

    return {
      originalQuestion: question._id,
      questionText: question.questionText,
      questionType: question.questionType,
      options:
        question.questionType === "objective"
          ? question.options.map((option) => ({
              optionId: option._id.toString(),
              text: option.text,
              isCorrect: option.isCorrect === true,
            }))
          : [],
      markingGuide:
        question.questionType === "theory" ? question.markingGuide : undefined,
      marks: question.marks,
      difficulty: question.difficulty,
    };
  });
};

// ========================================
// 3. CREATE EXAMINATION
// ========================================

const createExamination = async (data, userId) => {
  const validated = validateExaminationData(data);

  const references = await validateReferences({
    academicSessionId: data.academicSessionId,
    termId: data.termId,
    classId: data.classId,
    subjectId: data.subjectId,
  });

  if (
    validated.start < references.term.startDate ||
    validated.end > references.term.endDate
  ) {
    throw createError(
      "The examination schedule must fall within the selected term dates.",
    );
  }

  const questionSnapshots = await buildQuestionSnapshots({
    questionIds: data.questionIds,
    subjectId: references.subject._id,
    classLevel: references.schoolClass.level,
  });

  const totalMarks = questionSnapshots.reduce(
    (sum, question) => sum + question.marks,
    0,
  );

  if (validated.pass > totalMarks) {
    throw createError("Pass marks cannot exceed the total examination marks.");
  }

  const examination = await Examination.create({
    title: data.title.trim(),
    description: data.description?.trim() || undefined,
    instructions: data.instructions?.trim() || undefined,
    academicSession: references.academicSession._id,
    term: references.term._id,
    schoolClass: references.schoolClass._id,
    subject: references.subject._id,
    questions: questionSnapshots,
    totalQuestions: questionSnapshots.length,
    totalMarks,
    passMarks: validated.pass,
    durationMinutes: validated.duration,
    startAt: validated.start,
    endAt: validated.end,
    shuffleQuestions: data.shuffleQuestions !== false,
    shuffleOptions: data.shuffleOptions !== false,
    allowBackNavigation: data.allowBackNavigation !== false,
    status: "draft",
    createdBy: userId,
  });

  return getExaminationById(examination._id);
};

// ========================================
// 4. GET EXAMINATIONS
// ========================================

const getExaminations = async (filters = {}) => {
  const {
    academicSessionId,
    termId,
    classId,
    subjectId,
    status,
    page = 1,
    limit = 20,
  } = filters;

  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const query = {};

  for (const [filter, field] of [
    [academicSessionId, "academicSession"],
    [termId, "term"],
    [classId, "schoolClass"],
    [subjectId, "subject"],
  ]) {
    if (filter) {
      if (!isValidId(filter)) {
        throw createError(`Invalid ${field} ID.`);
      }
      query[field] = filter;
    }
  }

  if (status) {
    if (!["draft", "published", "closed", "cancelled"].includes(status)) {
      throw createError("Invalid examination status.");
    }
    query.status = status;
  }

  const skip = (pageNumber - 1) * pageSize;

  const [examinations, total] = await Promise.all([
    Examination.find(query)
      .select("-questions.options.isCorrect -questions.markingGuide")
      .populate("academicSession", "name status")
      .populate("term", "name termNumber")
      .populate("schoolClass", "name level arm")
      .populate("subject", "name code")
      .populate("createdBy", "firstName lastName")
      .sort({ startAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),

    Examination.countDocuments(query),
  ]);

  return {
    examinations,
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
// 5. GET EXAMINATION BY ID
// ========================================

const getExaminationById = async (examinationId) => {
  if (!isValidId(examinationId)) {
    throw createError("Invalid examination ID.");
  }

  const examination = await Examination.findById(examinationId)
    .select("-questions.options.isCorrect -questions.markingGuide")
    .populate("academicSession", "name status startDate endDate")
    .populate("term", "name termNumber startDate endDate")
    .populate("schoolClass", "name level arm")
    .populate("subject", "name code")
    .populate("createdBy", "firstName lastName")
    .populate("updatedBy", "firstName lastName")
    .lean();

  if (!examination) {
    throw createError("Examination not found.", 404);
  }

  return examination;
};

// ========================================
// 6. UPDATE DRAFT EXAMINATION
// ========================================

const updateExamination = async (examinationId, data, userId) => {
  if (!isValidId(examinationId)) {
    throw createError("Invalid examination ID.");
  }

  const examination = await Examination.findById(examinationId);

  if (!examination) {
    throw createError("Examination not found.", 404);
  }

  if (examination.status !== "draft") {
    throw createError(
      "Only draft examinations can be edited. Published examinations cannot be changed.",
    );
  }

  const allowedFields = [
    "title",
    "description",
    "instructions",
    "academicSessionId",
    "termId",
    "classId",
    "subjectId",
    "questionIds",
    "passMarks",
    "durationMinutes",
    "startAt",
    "endAt",
    "shuffleQuestions",
    "shuffleOptions",
    "allowBackNavigation",
  ];

  const merged = {
    title: data.title ?? examination.title,
    description: data.description ?? examination.description,
    instructions: data.instructions ?? examination.instructions,
    academicSessionId: data.academicSessionId ?? examination.academicSession,
    termId: data.termId ?? examination.term,
    classId: data.classId ?? examination.schoolClass,
    subjectId: data.subjectId ?? examination.subject,
    questionIds:
      data.questionIds ??
      examination.questions.map((question) => question.originalQuestion),
    passMarks: data.passMarks ?? examination.passMarks,
    durationMinutes: data.durationMinutes ?? examination.durationMinutes,
    startAt: data.startAt ?? examination.startAt,
    endAt: data.endAt ?? examination.endAt,
  };

  const validated = validateExaminationData(merged);

  const references = await validateReferences(merged);

  if (
    validated.start < references.term.startDate ||
    validated.end > references.term.endDate
  ) {
    throw createError(
      "The examination schedule must fall within the selected term dates.",
    );
  }

  const questionSnapshots = await buildQuestionSnapshots({
    questionIds: merged.questionIds,
    subjectId: references.subject._id,
    classLevel: references.schoolClass.level,
  });

  const totalMarks = questionSnapshots.reduce(
    (sum, question) => sum + question.marks,
    0,
  );

  if (validated.pass > totalMarks) {
    throw createError("Pass marks cannot exceed total examination marks.");
  }

  examination.title = merged.title.trim();
  examination.description = merged.description?.trim() || undefined;
  examination.instructions = merged.instructions?.trim() || undefined;
  examination.academicSession = references.academicSession._id;
  examination.term = references.term._id;
  examination.schoolClass = references.schoolClass._id;
  examination.subject = references.subject._id;
  examination.questions = questionSnapshots;
  examination.totalQuestions = questionSnapshots.length;
  examination.totalMarks = totalMarks;
  examination.passMarks = validated.pass;
  examination.durationMinutes = validated.duration;
  examination.startAt = validated.start;
  examination.endAt = validated.end;

  for (const field of [
    "shuffleQuestions",
    "shuffleOptions",
    "allowBackNavigation",
  ]) {
    if (data[field] !== undefined) {
      examination[field] = data[field];
    }
  }

  examination.updatedBy = userId;

  await examination.save();

  return getExaminationById(examination._id);
};

// ========================================
// 7. PUBLISH EXAMINATION
// ========================================

const publishExamination = async (examinationId, userId) => {
  if (!isValidId(examinationId)) {
    throw createError("Invalid examination ID.");
  }

  const examination = await Examination.findById(examinationId);

  if (!examination) {
    throw createError("Examination not found.", 404);
  }

  if (examination.status !== "draft") {
    throw createError("Only draft examinations can be published.");
  }

  if (examination.endAt <= new Date()) {
    throw createError(
      "Cannot publish an examination whose end time has passed.",
    );
  }

  examination.status = "published";
  examination.updatedBy = userId;

  await examination.save();

  return getExaminationById(examination._id);
};

// ========================================
// 8. CLOSE EXAMINATION
// ========================================

const closeExamination = async (examinationId, userId) => {
  if (!isValidId(examinationId)) {
    throw createError("Invalid examination ID.");
  }

  const examination = await Examination.findById(examinationId);

  if (!examination) {
    throw createError("Examination not found.", 404);
  }

  if (examination.status !== "published") {
    throw createError("Only published examinations can be closed.");
  }

  examination.status = "closed";
  examination.updatedBy = userId;

  await examination.save();

  return getExaminationById(examination._id);
};

// ========================================
// 9. CANCEL EXAMINATION
// ========================================

const cancelExamination = async (examinationId, userId) => {
  if (!isValidId(examinationId)) {
    throw createError("Invalid examination ID.");
  }

  const examination = await Examination.findById(examinationId);

  if (!examination) {
    throw createError("Examination not found.", 404);
  }

  if (!["draft", "published"].includes(examination.status)) {
    throw createError("This examination cannot be cancelled.");
  }

  examination.status = "cancelled";
  examination.updatedBy = userId;

  await examination.save();

  return getExaminationById(examination._id);
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
