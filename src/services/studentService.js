const mongoose = require("mongoose");
const User = require("../models/User");
const StudentEnrollment = require("../models/StudentEnrollment");

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.status = statusCode;
  return error;
};

// Escape special characters before using search input in a regex.
const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// ========================================
// 1. REGISTER STUDENT
// ========================================

const createStudent = async (data, adminId) => {
  const {
    firstName,
    lastName,
    middleName,
    email,
    phone,
    gender,
    admissionNumber,
    password,
  } = data;

  if (!firstName || !lastName || !admissionNumber || !password) {
    throw createError(
      "First name, last name, admission number and password are required.",
    );
  }

  if (password.length < 8) {
    throw createError("Student password must be at least 8 characters.");
  }

  const normalizedAdmissionNumber = admissionNumber.trim().toUpperCase();

  const existingStudent = await User.findOne({
    admissionNumber: normalizedAdmissionNumber,
  });

  if (existingStudent) {
    throw createError("This admission number is already registered.", 409);
  }

  if (email) {
    const existingEmail = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (existingEmail) {
      throw createError("This email address is already registered.", 409);
    }
  }

  const student = await User.create({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    middleName: middleName?.trim() || undefined,
    email: email?.trim().toLowerCase() || undefined,
    phone: phone?.trim() || undefined,
    gender: gender || undefined,
    admissionNumber: normalizedAdmissionNumber,
    password,
    role: "student",
    status: "active",
    createdBy: adminId,
  });

  return student;
};

// ========================================
// 2. GET ALL STUDENTS
// ========================================

const getStudents = async (filters = {}) => {
  const { search, status, currentClass, page = 1, limit = 20 } = filters;

  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const query = { role: "student" };

  if (status) {
    if (!["active", "inactive", "suspended"].includes(status)) {
      throw createError("Invalid student status.");
    }

    query.status = status;
  }

  if (currentClass) {
    if (!mongoose.Types.ObjectId.isValid(currentClass)) {
      throw createError("Invalid class ID.");
    }

    query.currentClass = currentClass;
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(escapeRegex(search.trim()), "i");

    query.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { middleName: searchRegex },
      { admissionNumber: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
    ];
  }

  const skip = (pageNumber - 1) * pageSize;

  const [students, total] = await Promise.all([
    User.find(query)
      .select("-password")
      .populate("currentClass", "name level arm")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),

    User.countDocuments(query),
  ]);

  return {
    students,
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
// 3. GET STUDENT BY ID
// ========================================

const getStudentById = async (studentId) => {
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    throw createError("Invalid student ID.");
  }

  const student = await User.findOne({
    _id: studentId,
    role: "student",
  })
    .select("-password")
    .populate("currentClass", "name level arm capacity")
    .lean();

  if (!student) {
    throw createError("Student not found.", 404);
  }

  const enrollments = await StudentEnrollment.find({
    student: studentId,
  })
    .populate("academicSession", "name startDate endDate status")
    .populate("class", "name level arm")
    .populate("previousEnrollment", "status enrollmentDate")
    .populate("createdBy", "firstName lastName")
    .sort({ enrollmentDate: -1 })
    .lean();

  return {
    ...student,
    enrollments,
  };
};

// ========================================
// 4. UPDATE STUDENT
// ========================================

const updateStudent = async (studentId, data) => {
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    throw createError("Invalid student ID.");
  }

  const allowedFields = [
    "firstName",
    "lastName",
    "middleName",
    "email",
    "phone",
    "gender",
  ];

  const updateData = {};

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] =
        typeof data[field] === "string" ? data[field].trim() : data[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw createError("No valid student information was provided.");
  }

  if (updateData.firstName !== undefined && !updateData.firstName) {
    throw createError("First name cannot be empty.");
  }

  if (updateData.lastName !== undefined && !updateData.lastName) {
    throw createError("Last name cannot be empty.");
  }

  if (updateData.email !== undefined) {
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase();

      const existingEmail = await User.findOne({
        email: updateData.email,
        _id: { $ne: studentId },
      });

      if (existingEmail) {
        throw createError("This email address is already in use.", 409);
      }
    } else {
      updateData.email = undefined;
    }
  }

  const student = await User.findOneAndUpdate(
    {
      _id: studentId,
      role: "student",
    },
    { $set: updateData },
    {
      new: true,
      runValidators: true,
    },
  )
    .select("-password")
    .populate("currentClass", "name level arm");

  if (!student) {
    throw createError("Student not found.", 404);
  }

  return student;
};

// ========================================
// 5. CHANGE STUDENT STATUS
// ========================================

const updateStudentStatus = async (studentId, status) => {
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    throw createError("Invalid student ID.");
  }

  const allowedStatuses = ["active", "inactive", "suspended"];

  if (!allowedStatuses.includes(status)) {
    throw createError("Invalid student status.");
  }

  const student = await User.findOneAndUpdate(
    {
      _id: studentId,
      role: "student",
    },
    { $set: { status } },
    {
      new: true,
      runValidators: true,
    },
  )
    .select("-password")
    .populate("currentClass", "name level arm");

  if (!student) {
    throw createError("Student not found.", 404);
  }

  return student;
};

// ========================================
// 6. GET STUDENT STATISTICS
// ========================================

const getStudentStatistics = async () => {
  const [total, active, inactive, suspended] = await Promise.all([
    User.countDocuments({ role: "student" }),
    User.countDocuments({ role: "student", status: "active" }),
    User.countDocuments({ role: "student", status: "inactive" }),
    User.countDocuments({ role: "student", status: "suspended" }),
  ]);

  return {
    total,
    active,
    inactive,
    suspended,
  };
};

module.exports = {
  createStudent,
  getStudents,
  getStudentById,
  updateStudent,
  updateStudentStatus,
  getStudentStatistics,
};
