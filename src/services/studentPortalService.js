const mongoose = require("mongoose");

const User = require("../models/User");
const StudentEnrollment = require("../models/StudentEnrollment");
const Examination = require("../models/Examination");
const ExamAttempt = require("../models/ExamAttempt");

const createError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ========================================
// 1. GET STUDENT AND ACTIVE ENROLLMENT
// ========================================

const getStudentContext = async (studentId) => {
  const student = await User.findOne({
    _id: studentId,
    role: "student",
    status: "active",
  }).select(
    "firstName lastName middleName email admissionNumber currentClass status",
  );

  if (!student) {
    throw createError("Active student account not found.", 404);
  }

  const enrollment = await StudentEnrollment.findOne({
    student: studentId,
    status: "active",
  })
    .populate("academicSession", "name status startDate endDate")
    .populate("class", "name level arm");

  if (!enrollment) {
    throw createError(
      "You do not have an active class enrollment. Please contact the school administrator.",
      403,
    );
  }

  return { student, enrollment };
};

// ========================================
// 2. DETERMINE STUDENT EXAMINATION STATUS
// ========================================

const getStudentExamStatus = (examination, attempt, now = new Date()) => {
  if (attempt) {
    if (attempt.status === "in_progress") {
      if (now >= attempt.expiresAt) return "expired";
      return "in_progress";
    }

    return "completed";
  }

  if (examination.status === "closed" || now >= examination.endAt) {
    return "missed";
  }

  if (now < examination.startAt) {
    return "upcoming";
  }

  return "available";
};

// ========================================
// 3. FORMAT EXAMINATION FOR STUDENTS
// ========================================

const formatStudentExamination = (examination, attempt, now) => {
  const subject = examination.subject;
  const schoolClass = examination.schoolClass;
  const session = examination.academicSession;
  const term = examination.term;

  return {
    id: examination._id,
    title: examination.title,
    description: examination.description || "",
    instructions: examination.instructions || "",
    subject: subject
      ? {
          id: subject._id,
          name: subject.name,
          code: subject.code,
        }
      : null,
    class: schoolClass
      ? {
          id: schoolClass._id,
          name: schoolClass.name,
          level: schoolClass.level,
          arm: schoolClass.arm,
        }
      : null,
    academicSession: session
      ? {
          id: session._id,
          name: session.name,
        }
      : null,
    term: term
      ? {
          id: term._id,
          name: term.name,
          termNumber: term.termNumber,
        }
      : null,
    durationMinutes: examination.durationMinutes,
    totalQuestions: examination.totalQuestions,
    totalMarks: examination.totalMarks,
    passMarks: examination.passMarks,
    startAt: examination.startAt,
    endAt: examination.endAt,
    status: getStudentExamStatus(examination, attempt, now),
    attempt: attempt
      ? {
          id: attempt._id,
          status: attempt.status,
          startedAt: attempt.startedAt,
          expiresAt: attempt.expiresAt,
          submittedAt: attempt.submittedAt,
        }
      : null,
  };
};

// ========================================
// 4. GET STUDENT EXAMINATIONS
// ========================================

const getMyExaminations = async (studentId, filters = {}) => {
  const { enrollment } = await getStudentContext(studentId);

  const now = new Date();

  const query = {
    academicSession: enrollment.academicSession._id,
    schoolClass: enrollment.class._id,
    status: { $in: ["published", "closed"] },
  };

  const examinations = await Examination.find(query)
    .populate("subject", "name code")
    .populate("schoolClass", "name level arm")
    .populate("academicSession", "name")
    .populate("term", "name termNumber")
    .sort({ startAt: -1 })
    .lean();

  const attempts = await ExamAttempt.find({
    student: studentId,
    examination: { $in: examinations.map((exam) => exam._id) },
  })
    .select("examination status startedAt expiresAt submittedAt")
    .lean();

  const attemptMap = new Map(
    attempts.map((attempt) => [attempt.examination.toString(), attempt]),
  );

  let formatted = examinations.map((examination) => {
    const attempt = attemptMap.get(examination._id.toString()) || null;

    return formatStudentExamination(examination, attempt, now);
  });

  // Optional status filtering.
  if (filters.status) {
    const allowedStatuses = [
      "upcoming",
      "available",
      "in_progress",
      "completed",
      "expired",
      "missed",
    ];

    if (!allowedStatuses.includes(filters.status)) {
      throw createError("Invalid examination status filter.");
    }

    formatted = formatted.filter(
      (examination) => examination.status === filters.status,
    );
  }

  // Optional subject filtering.
  if (filters.subjectId) {
    if (!isValidId(filters.subjectId)) {
      throw createError("Invalid subject ID.");
    }

    formatted = formatted.filter(
      (examination) => examination.subject?.id.toString() === filters.subjectId,
    );
  }

  return {
    examinations: formatted,
    summary: {
      total: formatted.length,
      upcoming: formatted.filter((item) => item.status === "upcoming").length,
      available: formatted.filter((item) => item.status === "available").length,
      inProgress: formatted.filter((item) => item.status === "in_progress")
        .length,
      completed: formatted.filter((item) => item.status === "completed").length,
      missed: formatted.filter((item) => item.status === "missed").length,
      expired: formatted.filter((item) => item.status === "expired").length,
    },
  };
};

// ========================================
// 5. GET ONE STUDENT EXAMINATION
// ========================================

const getMyExaminationById = async (examinationId, studentId) => {
  if (!isValidId(examinationId)) {
    throw createError("Invalid examination ID.");
  }

  const { enrollment } = await getStudentContext(studentId);

  const examination = await Examination.findOne({
    _id: examinationId,
    academicSession: enrollment.academicSession._id,
    schoolClass: enrollment.class._id,
    status: { $in: ["published", "closed"] },
  })
    .populate("subject", "name code")
    .populate("schoolClass", "name level arm")
    .populate("academicSession", "name")
    .populate("term", "name termNumber")
    .lean();

  if (!examination) {
    throw createError(
      "Examination not found or is not available to your class.",
      404,
    );
  }

  const attempt = await ExamAttempt.findOne({
    student: studentId,
    examination: examination._id,
  })
    .select("status startedAt expiresAt submittedAt")
    .lean();

  return formatStudentExamination(examination, attempt, new Date());
};

// ========================================
// 6. STUDENT DASHBOARD
// ========================================

const getStudentDashboard = async (studentId) => {
  const { student, enrollment } = await getStudentContext(studentId);

  const { examinations, summary } = await getMyExaminations(studentId);

  const recentExaminations = [...examinations]
    .sort((a, b) => new Date(b.startAt) - new Date(a.startAt))
    .slice(0, 5);

  return {
    student: {
      id: student._id,
      firstName: student.firstName,
      lastName: student.lastName,
      middleName: student.middleName,
      fullName: [student.firstName, student.middleName, student.lastName]
        .filter(Boolean)
        .join(" "),
      email: student.email,
      admissionNumber: student.admissionNumber,
    },
    enrollment: {
      id: enrollment._id,
      class: enrollment.class,
      academicSession: enrollment.academicSession,
      enrollmentDate: enrollment.enrollmentDate,
    },
    statistics: summary,
    recentExaminations,
  };
};

module.exports = {
  getStudentDashboard,
  getMyExaminations,
  getMyExaminationById,
};
