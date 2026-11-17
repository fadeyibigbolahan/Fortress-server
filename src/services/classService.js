const SchoolClass = require("../models/Class");

const createClass = async (data, userId) => {
  const { level, arm, capacity } = data;

  if (!level || !arm) {
    throw new Error("Class level and arm are required.");
  }

  const normalizedArm = arm.trim().toUpperCase();

  const existing = await SchoolClass.findOne({
    level,
    arm: normalizedArm,
  });

  if (existing) {
    throw new Error("This class and arm already exist.");
  }

  return SchoolClass.create({
    name: `${level}${normalizedArm}`,
    level,
    arm: normalizedArm,
    capacity: capacity || 40,
    createdBy: userId,
  });
};

const getClasses = async (filters = {}) => {
  const query = {};

  if (filters.level) {
    query.level = filters.level;
  }

  if (filters.status) {
    query.status = filters.status;
  }

  return SchoolClass.find(query)
    .populate("createdBy", "firstName lastName")
    .sort({ level: 1, arm: 1 });
};

const getClassById = async (classId) => {
  const schoolClass = await SchoolClass.findById(classId);

  if (!schoolClass) {
    throw new Error("Class not found.");
  }

  return schoolClass;
};

const updateClass = async (classId, data) => {
  const schoolClass = await SchoolClass.findById(classId);

  if (!schoolClass) {
    throw new Error("Class not found.");
  }

  if (data.level !== undefined) {
    schoolClass.level = data.level;
  }

  if (data.arm !== undefined) {
    schoolClass.arm = data.arm.trim().toUpperCase();
  }

  if (data.capacity !== undefined) {
    schoolClass.capacity = data.capacity;
  }

  if (data.status !== undefined) {
    schoolClass.status = data.status;
  }

  schoolClass.name = `${schoolClass.level}${schoolClass.arm}`;

  return schoolClass.save();
};

const deactivateClass = async (classId) => {
  const schoolClass = await SchoolClass.findById(classId);

  if (!schoolClass) {
    throw new Error("Class not found.");
  }

  schoolClass.status = "inactive";

  return schoolClass.save();
};

module.exports = {
  createClass,
  getClasses,
  getClassById,
  updateClass,
  deactivateClass,
};
