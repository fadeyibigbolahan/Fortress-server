const mongoose = require("mongoose");

const User = require("../models/User");
const StudentEnrollment = require("../models/StudentEnrollment");
const SchoolClass = require("../models/Class");
const AcademicSession = require("../models/AcademicSession");

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.status = statusCode;
  return error;
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ========================================
// 1. VALIDATE STUDENT
// ========================================

const validateStudent = async (studentId) => {
  if (!isValidId(studentId)) {
    throw createError("Invalid student ID.");
  }

  const student = await User.findOne({
    _id: studentId,
    role: "student",
  });

  if (!student) {
    throw createError("Student not found.", 404);
  }

  if (student.status !== "active") {
    throw createError("Only active students can be enrolled.");
  }

  return student;
};

// ========================================
// 2. VALIDATE CLASS
// ========================================

const validateClass = async (classId) => {
  if (!isValidId(classId)) {
    throw createError("Invalid class ID.");
  }

  const schoolClass = await SchoolClass.findById(classId);

  if (!schoolClass) {
    throw createError("Class not found.", 404);
  }

  if (schoolClass.status !== "active") {
    throw createError("Students cannot be enrolled in an inactive class.");
  }

  return schoolClass;
};

// ========================================
// 3. VALIDATE ACADEMIC SESSION
// ========================================

const validateAcademicSession = async (sessionId) => {
  if (!isValidId(sessionId)) {
    throw createError("Invalid academic session ID.");
  }

  const academicSession = await AcademicSession.findById(sessionId);

  if (!academicSession) {
    throw createError("Academic session not found.", 404);
  }

  if (academicSession.status === "completed") {
    throw createError("Cannot enroll students in a completed session.");
  }

  return academicSession;
};

// ========================================
// 4. CHECK CLASS CAPACITY
// ========================================

const checkClassCapacity = async (classId, sessionId) => {
  const schoolClass = await SchoolClass.findById(classId).select("capacity");

  const enrolledCount = await StudentEnrollment.countDocuments({
    class: classId,
    academicSession: sessionId,
    status: "active",
  });

  if (enrolledCount >= schoolClass.capacity) {
    throw createError(
      `This class has reached its capacity of ${schoolClass.capacity} students.`,
      409,
    );
  }
};

// ========================================
// 5. CHECK EXISTING ENROLLMENT
// ========================================

const checkExistingEnrollment = async (studentId, sessionId) => {
  const existing = await StudentEnrollment.findOne({
    student: studentId,
    academicSession: sessionId,
  });

  if (existing) {
    throw createError(
      "This student already has an enrollment record for this academic session.",
      409,
    );
  }
};

// ========================================
// 6. CREATE ENROLLMENT
// ========================================

const createEnrollment = async (data, adminId) => {
  const { studentId, classId, academicSessionId, enrollmentDate, remarks } =
    data;

  if (!studentId || !classId || !academicSessionId) {
    throw createError("Student, class and academic session are required.");
  }

  const student = await validateStudent(studentId);
  const schoolClass = await validateClass(classId);
  const academicSession = await validateAcademicSession(academicSessionId);

  await checkExistingEnrollment(studentId, academicSessionId);
  await checkClassCapacity(classId, academicSessionId);

  const enrollment = await StudentEnrollment.create({
    student: student._id,
    class: schoolClass._id,
    academicSession: academicSession._id,
    enrollmentDate: enrollmentDate || new Date(),
    status: "active",
    remarks: remarks?.trim() || undefined,
    createdBy: adminId,
  });

  // Update the convenience pointer only for the current session.
  if (academicSession.isCurrent || academicSession.status === "active") {
    student.currentClass = schoolClass._id;
    await student.save();
  }

  return StudentEnrollment.findById(enrollment._id)
    .populate("student", "firstName lastName admissionNumber")
    .populate("class", "name level arm")
    .populate("academicSession", "name status startDate endDate")
    .populate("createdBy", "firstName lastName");
};

// ========================================
// 7. GET ALL ENROLLMENTS
// ========================================

const getEnrollments = async (filters = {}) => {
  const {
    studentId,
    classId,
    academicSessionId,
    status,
    page = 1,
    limit = 20,
  } = filters;

  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const query = {};

  if (studentId) {
    if (!isValidId(studentId)) {
      throw createError("Invalid student ID.");
    }
    query.student = studentId;
  }

  if (classId) {
    if (!isValidId(classId)) {
      throw createError("Invalid class ID.");
    }
    query.class = classId;
  }

  if (academicSessionId) {
    if (!isValidId(academicSessionId)) {
      throw createError("Invalid academic session ID.");
    }
    query.academicSession = academicSessionId;
  }

  if (status) {
    if (!["active", "promoted", "repeated", "withdrawn"].includes(status)) {
      throw createError("Invalid enrollment status.");
    }
    query.status = status;
  }

  const skip = (pageNumber - 1) * pageSize;

  const [enrollments, total] = await Promise.all([
    StudentEnrollment.find(query)
      .populate("student", "firstName lastName admissionNumber status")
      .populate("class", "name level arm")
      .populate("academicSession", "name status startDate endDate")
      .populate("previousEnrollment", "status enrollmentDate")
      .populate("createdBy", "firstName lastName")
      .sort({ enrollmentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),

    StudentEnrollment.countDocuments(query),
  ]);

  return {
    enrollments,
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
// 8. GET ENROLLMENT BY ID
// ========================================

const getEnrollmentById = async (enrollmentId) => {
  if (!isValidId(enrollmentId)) {
    throw createError("Invalid enrollment ID.");
  }

  const enrollment = await StudentEnrollment.findById(enrollmentId)
    .populate("student", "firstName lastName admissionNumber status")
    .populate("class", "name level arm capacity")
    .populate("academicSession", "name status startDate endDate")
    .populate("previousEnrollment")
    .populate("createdBy", "firstName lastName")
    .lean();

  if (!enrollment) {
    throw createError("Enrollment record not found.", 404);
  }

  return enrollment;
};

// ========================================
// 9. PROMOTE OR REPEAT STUDENT
// ========================================

const moveStudentToNextEnrollment = async (
  enrollmentId,
  data,
  adminId,
  newStatus,
) => {
  if (!isValidId(enrollmentId)) {
    throw createError("Invalid enrollment ID.");
  }

  const { newClassId, newAcademicSessionId, enrollmentDate, remarks } = data;

  if (!newClassId || !newAcademicSessionId) {
    throw createError("New class and new academic session are required.");
  }

  const previousEnrollment = await StudentEnrollment.findById(enrollmentId);

  if (!previousEnrollment) {
    throw createError("Previous enrollment not found.", 404);
  }

  if (previousEnrollment.status !== "active") {
    throw createError("Only an active enrollment can be promoted or repeated.");
  }

  const student = await validateStudent(previousEnrollment.student);
  const schoolClass = await validateClass(newClassId);
  const academicSession = await validateAcademicSession(newAcademicSessionId);

  if (
    previousEnrollment.academicSession.toString() ===
    newAcademicSessionId.toString()
  ) {
    throw createError(
      "The new academic session must be different from the previous session.",
    );
  }

  await checkExistingEnrollment(
    previousEnrollment.student,
    newAcademicSessionId,
  );

  await checkClassCapacity(newClassId, newAcademicSessionId);

  // Create the new enrollment first.
  const newEnrollment = await StudentEnrollment.create({
    student: student._id,
    class: schoolClass._id,
    academicSession: academicSession._id,
    enrollmentDate: enrollmentDate || new Date(),
    status: "active",
    previousEnrollment: previousEnrollment._id,
    remarks: remarks?.trim() || undefined,
    createdBy: adminId,
  });

  try {
    previousEnrollment.status = newStatus;

    if (remarks?.trim()) {
      previousEnrollment.remarks = remarks.trim();
    }

    await previousEnrollment.save();

    // Keep the current class pointer aligned with the current session.
    if (academicSession.isCurrent || academicSession.status === "active") {
      student.currentClass = schoolClass._id;
      await student.save();
    }
  } catch (error) {
    // Remove the new record if the previous record or student update fails.
    await StudentEnrollment.findByIdAndDelete(newEnrollment._id);
    throw error;
  }

  return StudentEnrollment.findById(newEnrollment._id)
    .populate("student", "firstName lastName admissionNumber")
    .populate("class", "name level arm")
    .populate("academicSession", "name status")
    .populate("previousEnrollment");
};

// ========================================
// 10. PROMOTE STUDENT
// ========================================

const promoteStudent = async (enrollmentId, data, adminId) => {
  return moveStudentToNextEnrollment(enrollmentId, data, adminId, "promoted");
};

// ========================================
// 11. REPEAT CLASS
// ========================================

const repeatStudent = async (enrollmentId, data, adminId) => {
  return moveStudentToNextEnrollment(enrollmentId, data, adminId, "repeated");
};

// ========================================
// 12. WITHDRAW STUDENT
// ========================================

const withdrawStudent = async (enrollmentId, remarks) => {
  if (!isValidId(enrollmentId)) {
    throw createError("Invalid enrollment ID.");
  }

  const enrollment = await StudentEnrollment.findById(enrollmentId);

  if (!enrollment) {
    throw createError("Enrollment record not found.", 404);
  }

  if (enrollment.status !== "active") {
    throw createError("Only an active enrollment can be withdrawn.");
  }

  enrollment.status = "withdrawn";

  if (remarks?.trim()) {
    enrollment.remarks = remarks.trim();
  }

  await enrollment.save();

  // Clear currentClass only if this is the student's current enrollment.
  const student = await User.findOne({
    _id: enrollment.student,
    role: "student",
    currentClass: enrollment.class,
  });

  if (student) {
    student.currentClass = undefined;
    await student.save();
  }

  return StudentEnrollment.findById(enrollment._id)
    .populate("student", "firstName lastName admissionNumber")
    .populate("class", "name level arm")
    .populate("academicSession", "name status");
};

// ========================================
// 13. ENROLLMENT STATISTICS
// ========================================

const getEnrollmentStatistics = async (filters = {}) => {
  const match = {};

  if (filters.academicSessionId) {
    if (!isValidId(filters.academicSessionId)) {
      throw createError("Invalid academic session ID.");
    }

    match.academicSession = new mongoose.Types.ObjectId(
      filters.academicSessionId,
    );
  }

  if (filters.classId) {
    if (!isValidId(filters.classId)) {
      throw createError("Invalid class ID.");
    }

    match.class = new mongoose.Types.ObjectId(filters.classId);
  }

  const results = await StudentEnrollment.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const statistics = {
    total: 0,
    active: 0,
    promoted: 0,
    repeated: 0,
    withdrawn: 0,
  };

  results.forEach((item) => {
    statistics[item._id] = item.count;
    statistics.total += item.count;
  });

  return statistics;
};

module.exports = {
  createEnrollment,
  getEnrollments,
  getEnrollmentById,
  promoteStudent,
  repeatStudent,
  withdrawStudent,
  getEnrollmentStatistics,
};
