const mongoose = require("mongoose");

const User = require("../models/User");
const Subject = require("../models/Subject");
const SchoolClass = require("../models/Class");
const AcademicSession = require("../models/AcademicSession");
const TeacherAssignment = require("../models/TeacherAssignment");

const createAssignment = async (data, adminId) => {
  const { teacher, subject, class: classId, academicSession } = data;

  if (!teacher || !subject || !classId || !academicSession) {
    throw new Error(
      "Teacher, subject, class and academic session are required.",
    );
  }

  // Validate ObjectIds
  const ids = [teacher, subject, classId, academicSession];

  if (!ids.every((id) => mongoose.isValidObjectId(id))) {
    throw new Error("One or more supplied IDs are invalid.");
  }

  // Verify teacher
  const teacherUser = await User.findOne({
    _id: teacher,
    role: "teacher",
    status: "active",
  });

  if (!teacherUser) {
    throw new Error("Active teacher account not found.");
  }

  // Verify subject
  const subjectRecord = await Subject.findOne({
    _id: subject,
    status: "active",
  });

  if (!subjectRecord) {
    throw new Error("Active subject not found.");
  }

  // Verify class
  const classRecord = await SchoolClass.findOne({
    _id: classId,
    status: "active",
  });

  if (!classRecord) {
    throw new Error("Active class not found.");
  }

  // Verify that the subject is available for this class level
  if (!subjectRecord.levels.includes(classRecord.level)) {
    throw new Error(
      "This subject is not assigned to the selected class level.",
    );
  }

  // Verify academic session
  const session = await AcademicSession.findById(academicSession);

  if (!session || session.status === "completed") {
    throw new Error("Valid academic session not found.");
  }

  // Check for existing assignment
  const existing = await TeacherAssignment.findOne({
    subject,
    class: classId,
    academicSession,
  });

  if (existing) {
    throw new Error(
      "A teacher is already assigned to this subject and class for this session.",
    );
  }

  return TeacherAssignment.create({
    teacher,
    subject,
    class: classId,
    academicSession,
    assignedBy: adminId,
  });
};

const getAssignments = async (filters = {}) => {
  const query = {};

  if (filters.teacher) query.teacher = filters.teacher;
  if (filters.subject) query.subject = filters.subject;
  if (filters.class) query.class = filters.class;
  if (filters.academicSession) {
    query.academicSession = filters.academicSession;
  }
  if (filters.status) query.status = filters.status;

  return TeacherAssignment.find(query)
    .populate("teacher", "firstName lastName staffId email")
    .populate("subject", "name code")
    .populate("class", "name level arm")
    .populate("academicSession", "name status")
    .populate("assignedBy", "firstName lastName")
    .sort({ createdAt: -1 });
};

const getAssignmentById = async (assignmentId) => {
  const assignment = await TeacherAssignment.findById(assignmentId)
    .populate("teacher", "firstName lastName staffId email")
    .populate("subject", "name code")
    .populate("class", "name level arm")
    .populate("academicSession", "name status");

  if (!assignment) {
    throw new Error("Teacher assignment not found.");
  }

  return assignment;
};

const updateAssignment = async (assignmentId, data) => {
  const assignment = await TeacherAssignment.findById(assignmentId);

  if (!assignment) {
    throw new Error("Teacher assignment not found.");
  }

  if (assignment.status === "inactive") {
    throw new Error("Inactive assignments cannot be edited.");
  }

  // Allow changing the assigned teacher
  if (data.teacher !== undefined) {
    if (!mongoose.isValidObjectId(data.teacher)) {
      throw new Error("Invalid teacher ID.");
    }

    const teacher = await User.findOne({
      _id: data.teacher,
      role: "teacher",
      status: "active",
    });

    if (!teacher) {
      throw new Error("Active teacher account not found.");
    }

    assignment.teacher = data.teacher;
  }

  return assignment.save();
};

const deactivateAssignment = async (assignmentId) => {
  const assignment = await TeacherAssignment.findById(assignmentId);

  if (!assignment) {
    throw new Error("Teacher assignment not found.");
  }

  assignment.status = "inactive";

  return assignment.save();
};

const getTeacherAssignments = async (teacherId, filters = {}) => {
  const query = {
    teacher: teacherId,
    status: "active",
  };

  if (filters.academicSession) {
    query.academicSession = filters.academicSession;
  }

  return TeacherAssignment.find(query)
    .populate("subject", "name code levels")
    .populate("class", "name level arm")
    .populate("academicSession", "name status")
    .sort({ createdAt: -1 });
};

const getAvailableTeachers = async (filters = {}) => {
  const query = {
    role: "teacher",
    status: "active",
  };

  const search = filters.search?.trim();

  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    query.$or = [
      { firstName: { $regex: escapedSearch, $options: "i" } },
      { lastName: { $regex: escapedSearch, $options: "i" } },
      { middleName: { $regex: escapedSearch, $options: "i" } },
      { staffId: { $regex: escapedSearch, $options: "i" } },
      { email: { $regex: escapedSearch, $options: "i" } },
    ];
  }

  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 100, 1), 200);

  return User.find(query)
    .select("firstName lastName middleName staffId email")
    .sort({ firstName: 1, lastName: 1 })
    .limit(limit)
    .lean();
};

module.exports = {
  createAssignment,
  getAssignments,
  getAssignmentById,
  updateAssignment,
  deactivateAssignment,
  getTeacherAssignments,
  getAvailableTeachers,
};
