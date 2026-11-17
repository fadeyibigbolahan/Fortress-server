const mongoose = require("mongoose");

const TeacherAssignment = require("../models/TeacherAssignment");
const Examination = require("../models/Examination");
const ExamAttempt = require("../models/ExamAttempt");

const { getTeacherGradingQueue } = require("./resultService");

const getTeacherDashboard = async (teacherId) => {
  if (!mongoose.Types.ObjectId.isValid(teacherId)) {
    const error = new Error("Invalid teacher account.");
    error.status = 400;
    throw error;
  }

  // Only assignments belonging to this teacher are considered.
  const assignments = await TeacherAssignment.find({
    teacher: teacherId,
    status: "active",
  })
    .populate("subject", "name code levels")
    .populate("class", "name level arm")
    .populate("academicSession", "name startDate endDate status")
    .sort({ createdAt: -1 })
    .lean();

  // Map assignment.class to examination.schoolClass.
  const assignmentPairs = assignments
    .filter(
      (assignment) =>
        assignment.subject && assignment.class && assignment.academicSession,
    )
    .map((assignment) => ({
      subject: assignment.subject._id,
      schoolClass: assignment.class._id,
      academicSession: assignment.academicSession._id,
    }));

  const uniquePairs = [
    ...new Map(
      assignmentPairs.map((pair) => [
        `${pair.subject}-${pair.schoolClass}-${pair.academicSession}`,
        pair,
      ]),
    ).values(),
  ];

  let recentExaminations = [];
  let recentGradingActivity = [];
  let totalGradedAttempts = 0;
  let gradingQueue = [];

  if (uniquePairs.length > 0) {
    const assignmentFilter = { $or: uniquePairs };

    const [examinations, gradedAttempts, gradedAttemptCount, queue] =
      await Promise.all([
        Examination.find(assignmentFilter)
          .select(
            "title status startAt endAt totalQuestions totalMarks resultsReleased createdAt subject schoolClass academicSession",
          )
          .populate("subject", "name code")
          .populate("schoolClass", "name level arm")
          .populate("academicSession", "name")
          .sort({ createdAt: -1 })
          .limit(6)
          .lean(),

        ExamAttempt.find({
          ...assignmentFilter,
          status: { $in: ["submitted", "auto_submitted"] },
          questions: {
            $elemMatch: {
              questionType: "theory",
              gradingStatus: "graded",
              gradedBy: teacherId,
            },
          },
        })
          .select(
            "student examination schoolClass submittedAt questions gradingStatus",
          )
          .populate("student", "firstName lastName admissionNumber")
          .populate("examination", "title")
          .populate("schoolClass", "name level arm")
          .sort({ updatedAt: -1 })
          .limit(6)
          .lean(),

        ExamAttempt.countDocuments({
          ...assignmentFilter,
          status: { $in: ["submitted", "auto_submitted"] },
          questions: {
            $elemMatch: {
              questionType: "theory",
              gradingStatus: "graded",
              gradedBy: teacherId,
            },
          },
        }),

        getTeacherGradingQueue(teacherId),
      ]);

    recentExaminations = examinations.map((exam) => ({
      id: exam._id,
      title: exam.title,
      status: exam.status,
      startAt: exam.startAt,
      endAt: exam.endAt,
      totalQuestions: exam.totalQuestions,
      subject: exam.subject,
      schoolClass: exam.schoolClass,
      academicSession: exam.academicSession,
      resultsReleased: exam.resultsReleased,
    }));

    recentGradingActivity = gradedAttempts.map((attempt) => {
      const gradedTheoryQuestions = attempt.questions.filter(
        (question) =>
          question.questionType === "theory" &&
          question.gradingStatus === "graded" &&
          String(question.gradedBy) === String(teacherId),
      ).length;

      return {
        attemptId: attempt._id,
        examination: attempt.examination,
        student: attempt.student,
        schoolClass: attempt.schoolClass,
        submittedAt: attempt.submittedAt,
        gradedTheoryQuestions,
      };
    });

    totalGradedAttempts = gradedAttemptCount;
    gradingQueue = Array.isArray(queue) ? queue : [];
  }

  const pendingGrading = gradingQueue.map((item) => ({
    attemptId: item.attemptId,
    examinationId: item.examinationId,
    student: item.student,
    schoolClass: item.schoolClass,
    submittedAt: item.submittedAt,
    status: item.status,
    gradingStatus: item.gradingStatus,
    totalQuestions: item.totalQuestions,
    theoryQuestions: item.theoryQuestions,
    gradedTheoryQuestions: item.gradedTheoryQuestions,
  }));

  const totalPendingTheoryQuestions = pendingGrading.reduce(
    (total, item) =>
      total +
      Math.max(
        0,
        Number(item.theoryQuestions || 0) -
          Number(item.gradedTheoryQuestions || 0),
      ),
    0,
  );

  return {
    statistics: {
      totalAssignments: assignments.length,
      totalSubjects: new Set(
        assignments
          .filter((item) => item.subject)
          .map((item) => String(item.subject._id)),
      ).size,
      totalClasses: new Set(
        assignments
          .filter((item) => item.class)
          .map((item) => String(item.class._id)),
      ).size,
      pendingGradingCount: pendingGrading.length,
      pendingTheoryQuestions: totalPendingTheoryQuestions,
      gradedAttemptsCount: totalGradedAttempts,
    },

    assignments: assignments.map((assignment) => ({
      id: assignment._id,
      subject: assignment.subject,
      schoolClass: assignment.class,
      academicSession: assignment.academicSession,
      status: assignment.status,
    })),

    pendingGrading,

    recentGradingActivity,

    recentExaminations,
  };
};

module.exports = {
  getTeacherDashboard,
};
