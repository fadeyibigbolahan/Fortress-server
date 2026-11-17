const mongoose = require("mongoose");
const User = require("../models/User");
const TeacherAssignment = require("../models/TeacherAssignment");

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.status = statusCode;
  return error;
};

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// ========================================
// 1. REGISTER TEACHER
// ========================================

const createTeacher = async (data, adminId) => {
  const {
    firstName,
    lastName,
    middleName,
    email,
    phone,
    gender,
    staffId,
    password,
  } = data;

  if (!firstName || !lastName || !staffId || !password) {
    throw createError(
      "First name, last name, staff ID and password are required.",
    );
  }

  if (
    typeof firstName !== "string" ||
    typeof lastName !== "string" ||
    typeof staffId !== "string" ||
    typeof password !== "string"
  ) {
    throw createError("Invalid teacher registration details.");
  }

  if (password.length < 8) {
    throw createError("Teacher password must be at least 8 characters.");
  }

  const normalizedStaffId = staffId.trim().toUpperCase();

  if (!normalizedStaffId) {
    throw createError("Staff ID cannot be empty.");
  }

  const existingTeacher = await User.findOne({
    staffId: normalizedStaffId,
  });

  if (existingTeacher) {
    throw createError("This staff ID is already registered.", 409);
  }

  let normalizedEmail;

  if (email && email.trim()) {
    normalizedEmail = email.trim().toLowerCase();

    const existingEmail = await User.findOne({
      email: normalizedEmail,
    });

    if (existingEmail) {
      throw createError("This email address is already registered.", 409);
    }
  }

  try {
    const teacher = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      middleName: middleName?.trim() || undefined,
      email: normalizedEmail,
      phone: phone?.trim() || undefined,
      gender: gender || undefined,
      staffId: normalizedStaffId,
      password,
      role: "teacher",
      status: "active",
      createdBy: adminId,
    });

    return User.findById(teacher._id)
      .select("-password -failedLoginAttempts -lockUntil")
      .lean();
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern?.staffId) {
        throw createError("This staff ID is already registered.", 409);
      }

      if (error.keyPattern?.email) {
        throw createError("This email address is already registered.", 409);
      }
    }

    throw error;
  }
};

// ========================================
// 2. GET ALL TEACHERS
// ========================================

const getTeachers = async (filters = {}) => {
  const { search, status, page = 1, limit = 20 } = filters;

  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const query = { role: "teacher" };

  if (status) {
    if (!["active", "inactive", "suspended"].includes(status)) {
      throw createError("Invalid teacher status.");
    }

    query.status = status;
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(escapeRegex(search.trim()), "i");

    query.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { middleName: searchRegex },
      { staffId: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
    ];
  }

  const skip = (pageNumber - 1) * pageSize;

  const [teachers, total] = await Promise.all([
    User.find(query)
      .select("-password -failedLoginAttempts -lockUntil")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),

    User.countDocuments(query),
  ]);

  return {
    teachers,
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
// 3. GET TEACHER BY ID
// ========================================

const getTeacherById = async (teacherId) => {
  if (!mongoose.Types.ObjectId.isValid(teacherId)) {
    throw createError("Invalid teacher ID.");
  }

  const teacher = await User.findOne({
    _id: teacherId,
    role: "teacher",
  })
    .select("-password -failedLoginAttempts -lockUntil")
    .lean();

  if (!teacher) {
    throw createError("Teacher not found.", 404);
  }

  const assignments = await TeacherAssignment.find({
    teacher: teacherId,
  })
    .populate("subject", "name code levels")
    .populate("class", "name level arm")
    .populate("academicSession", "name startDate endDate status")
    .populate("assignedBy", "firstName lastName")
    .sort({ createdAt: -1 })
    .lean();

  return {
    ...teacher,
    assignments,
  };
};

// ========================================
// 4. UPDATE TEACHER
// ========================================

const updateTeacher = async (teacherId, data) => {
  if (!mongoose.Types.ObjectId.isValid(teacherId)) {
    throw createError("Invalid teacher ID.");
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
    throw createError("No valid teacher information was provided.");
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
        _id: { $ne: teacherId },
      });

      if (existingEmail) {
        throw createError("This email address is already in use.", 409);
      }
    } else {
      updateData.email = undefined;
    }
  }

  try {
    const teacher = await User.findOneAndUpdate(
      {
        _id: teacherId,
        role: "teacher",
      },
      { $set: updateData },
      {
        new: true,
        runValidators: true,
      },
    ).select("-password -failedLoginAttempts -lockUntil");

    if (!teacher) {
      throw createError("Teacher not found.", 404);
    }

    return teacher;
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.email) {
      throw createError("This email address is already in use.", 409);
    }

    throw error;
  }
};

// ========================================
// 5. CHANGE TEACHER STATUS
// ========================================

const updateTeacherStatus = async (teacherId, status) => {
  if (!mongoose.Types.ObjectId.isValid(teacherId)) {
    throw createError("Invalid teacher ID.");
  }

  const allowedStatuses = ["active", "inactive", "suspended"];

  if (!allowedStatuses.includes(status)) {
    throw createError("Invalid teacher status.");
  }

  const teacher = await User.findOneAndUpdate(
    {
      _id: teacherId,
      role: "teacher",
    },
    { $set: { status } },
    {
      new: true,
      runValidators: true,
    },
  ).select("-password -failedLoginAttempts -lockUntil");

  if (!teacher) {
    throw createError("Teacher not found.", 404);
  }

  return teacher;
};

// ========================================
// 6. GET TEACHER ASSIGNMENTS
// ========================================

const getTeacherAssignments = async (teacherId, filters = {}) => {
  if (!mongoose.Types.ObjectId.isValid(teacherId)) {
    throw createError("Invalid teacher ID.");
  }

  const teacherExists = await User.exists({
    _id: teacherId,
    role: "teacher",
  });

  if (!teacherExists) {
    throw createError("Teacher not found.", 404);
  }

  const query = { teacher: teacherId };

  if (filters.status) {
    if (!["active", "inactive"].includes(filters.status)) {
      throw createError("Invalid assignment status.");
    }

    query.status = filters.status;
  }

  if (filters.academicSession) {
    if (!mongoose.Types.ObjectId.isValid(filters.academicSession)) {
      throw createError("Invalid academic session ID.");
    }

    query.academicSession = filters.academicSession;
  }

  const assignments = await TeacherAssignment.find(query)
    .populate("subject", "name code levels")
    .populate("class", "name level arm")
    .populate("academicSession", "name startDate endDate status")
    .populate("assignedBy", "firstName lastName")
    .sort({ createdAt: -1 })
    .lean();

  return assignments;
};

// ========================================
// 7. TEACHER STATISTICS
// ========================================

const getTeacherStatistics = async () => {
  const [total, active, inactive, suspended, activeAssignments] =
    await Promise.all([
      User.countDocuments({ role: "teacher" }),
      User.countDocuments({ role: "teacher", status: "active" }),
      User.countDocuments({ role: "teacher", status: "inactive" }),
      User.countDocuments({ role: "teacher", status: "suspended" }),
      TeacherAssignment.countDocuments({ status: "active" }),
    ]);

  return {
    total,
    active,
    inactive,
    suspended,
    activeAssignments,
  };
};

module.exports = {
  createTeacher,
  getTeachers,
  getTeacherById,
  updateTeacher,
  updateTeacherStatus,
  getTeacherAssignments,
  getTeacherStatistics,
};
