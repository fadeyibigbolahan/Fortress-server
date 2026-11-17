const Term = require("../models/Term");
const AcademicSession = require("../models/AcademicSession");

const termNames = {
  1: "First Term",
  2: "Second Term",
  3: "Third Term",
};

const validateTermDates = (session, startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start >= end) {
    throw new Error("Term end date must be after its start date.");
  }

  if (start < session.startDate || end > session.endDate) {
    throw new Error("Term dates must fall within the academic session dates.");
  }
};

const createTerm = async (data, userId) => {
  const { academicSession, termNumber, startDate, endDate } = data;

  if (!academicSession || !termNumber || !startDate || !endDate) {
    throw new Error("All term fields are required.");
  }

  if (![1, 2, 3].includes(Number(termNumber))) {
    throw new Error("Invalid academic term number.");
  }

  const session = await AcademicSession.findById(academicSession);

  if (!session || session.status === "completed") {
    throw new Error("A valid, incomplete academic session is required.");
  }

  validateTermDates(session, startDate, endDate);

  const existing = await Term.findOne({
    academicSession,
    termNumber,
  });

  if (existing) {
    throw new Error("This term already exists in the selected session.");
  }

  return Term.create({
    academicSession,
    termNumber,
    name: termNames[Number(termNumber)],
    startDate,
    endDate,
    createdBy: userId,
  });
};

const getTerms = async (filters = {}) => {
  const query = {};

  if (filters.academicSession) {
    query.academicSession = filters.academicSession;
  }

  if (filters.status) {
    query.status = filters.status;
  }

  return Term.find(query)
    .populate("academicSession", "name status")
    .populate("createdBy", "firstName lastName")
    .sort({ termNumber: 1 });
};

const getTermById = async (termId) => {
  const term = await Term.findById(termId).populate(
    "academicSession",
    "name status",
  );

  if (!term) {
    throw new Error("Academic term not found.");
  }

  return term;
};

const updateTerm = async (termId, data) => {
  const term = await Term.findById(termId);

  if (!term) {
    throw new Error("Academic term not found.");
  }

  if (term.status === "completed") {
    throw new Error("Completed terms cannot be edited.");
  }

  const session = await AcademicSession.findById(term.academicSession);

  if (!session) {
    throw new Error("Academic session not found.");
  }

  const startDate = data.startDate ?? term.startDate;
  const endDate = data.endDate ?? term.endDate;

  validateTermDates(session, startDate, endDate);

  if (data.startDate !== undefined) {
    term.startDate = data.startDate;
  }

  if (data.endDate !== undefined) {
    term.endDate = data.endDate;
  }

  return term.save();
};

const activateTerm = async (termId) => {
  const term = await Term.findById(termId);

  if (!term) {
    throw new Error("Academic term not found.");
  }

  if (term.status === "completed") {
    throw new Error("Completed terms cannot be activated.");
  }

  const session = await AcademicSession.findById(term.academicSession);

  if (!session || session.status !== "active" || !session.isCurrent) {
    throw new Error("The term's academic session must be active and current.");
  }

  const now = new Date();

  if (now < term.startDate || now > term.endDate) {
    throw new Error("The current date must fall within the term dates.");
  }

  // Only one current term is permitted.
  await Term.updateMany(
    { isCurrent: true },
    { $set: { isCurrent: false, status: "upcoming" } },
  );

  term.isCurrent = true;
  term.status = "active";

  return term.save();
};

const completeTerm = async (termId) => {
  const term = await Term.findById(termId);

  if (!term) {
    throw new Error("Academic term not found.");
  }

  term.status = "completed";
  term.isCurrent = false;

  return term.save();
};

const getCurrentTerm = async () => {
  return Term.findOne({
    isCurrent: true,
    status: "active",
  }).populate("academicSession", "name");
};

module.exports = {
  createTerm,
  getTerms,
  getTermById,
  updateTerm,
  activateTerm,
  completeTerm,
  getCurrentTerm,
};
