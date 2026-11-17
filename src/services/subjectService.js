const Subject = require("../models/Subject");

const VALID_LEVELS = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];

const createSubject = async (data, userId) => {
  const { name, code, description, levels } = data;

  if (!name || !code || !Array.isArray(levels) || levels.length === 0) {
    throw new Error("Subject name, code and levels are required.");
  }

  const normalizedCode = code.trim().toUpperCase();

  const invalidLevels = levels.filter((level) => !VALID_LEVELS.includes(level));

  if (invalidLevels.length > 0) {
    throw new Error("One or more class levels are invalid.");
  }

  const existing = await Subject.findOne({
    code: normalizedCode,
  });

  if (existing) {
    throw new Error("Subject code already exists.");
  }

  return Subject.create({
    name,
    code: normalizedCode,
    description,
    levels: [...new Set(levels)],
    createdBy: userId,
  });
};

const getSubjects = async (filters = {}) => {
  const query = {};

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.level) {
    query.levels = filters.level;
  }

  return Subject.find(query)
    .populate("createdBy", "firstName lastName")
    .sort({ name: 1 });
};

const getSubjectById = async (subjectId) => {
  const subject = await Subject.findById(subjectId);

  if (!subject) {
    throw new Error("Subject not found.");
  }

  return subject;
};

const updateSubject = async (subjectId, data) => {
  const subject = await Subject.findById(subjectId);

  if (!subject) {
    throw new Error("Subject not found.");
  }

  if (subject.status === "inactive") {
    throw new Error("Inactive subjects cannot be edited.");
  }

  if (data.code !== undefined) {
    subject.code = data.code.trim().toUpperCase();
  }

  if (data.name !== undefined) {
    subject.name = data.name.trim();
  }

  if (data.description !== undefined) {
    subject.description = data.description;
  }

  if (data.levels !== undefined) {
    if (
      !Array.isArray(data.levels) ||
      data.levels.length === 0 ||
      data.levels.some((level) => !VALID_LEVELS.includes(level))
    ) {
      throw new Error("Invalid subject class levels.");
    }

    subject.levels = [...new Set(data.levels)];
  }

  return subject.save();
};

const deactivateSubject = async (subjectId) => {
  const subject = await Subject.findById(subjectId);

  if (!subject) {
    throw new Error("Subject not found.");
  }

  subject.status = "inactive";

  return subject.save();
};

module.exports = {
  createSubject,
  getSubjects,
  getSubjectById,
  updateSubject,
  deactivateSubject,
};
