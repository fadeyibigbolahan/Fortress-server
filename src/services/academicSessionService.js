const AcademicSession = require("../models/AcademicSession");
const Term = require("../models/Term");

const createSession = async (data, userId) => {
  const { name, startDate, endDate } = data;

  if (!name || !startDate || !endDate) {
    throw new Error("All academic session fields are required.");
  }

  const existing = await AcademicSession.findOne({ name });

  if (existing) {
    throw new Error("Academic session already exists.");
  }

  return AcademicSession.create({
    name,
    startDate,
    endDate,
    createdBy: userId,
  });
};

const getSessions = async () => {
  return AcademicSession.find()
    .populate("createdBy", "firstName lastName")
    .sort({ startDate: -1 });
};

const getSessionById = async (sessionId) => {
  const session = await AcademicSession.findById(sessionId);

  if (!session) {
    throw new Error("Academic session not found.");
  }

  return session;
};

const updateSession = async (sessionId, data) => {
  const session = await AcademicSession.findById(sessionId);

  if (!session) {
    throw new Error("Academic session not found.");
  }

  if (session.status === "completed") {
    throw new Error("Completed academic sessions cannot be edited.");
  }

  const allowedFields = ["name", "startDate", "endDate"];

  allowedFields.forEach((field) => {
    if (data[field] !== undefined) {
      session[field] = data[field];
    }
  });

  return session.save();
};

const activateSession = async (sessionId) => {
  const session = await AcademicSession.findById(sessionId);

  if (!session) {
    throw new Error("Academic session not found.");
  }

  if (session.status === "completed") {
    throw new Error("Completed sessions cannot be activated.");
  }

  const now = new Date();

  if (now < session.startDate || now > session.endDate) {
    throw new Error(
      "The current date must fall within the academic session dates.",
    );
  }

  // Deactivate the previous current session first.
  // This also respects the unique current-session index.
  await AcademicSession.updateMany(
    { isCurrent: true },
    { $set: { isCurrent: false, status: "upcoming" } },
  );

  session.isCurrent = true;
  session.status = "active";

  return session.save();
};

const completeSession = async (sessionId) => {
  const session = await AcademicSession.findById(sessionId);

  if (!session) {
    throw new Error("Academic session not found.");
  }

  const currentTerm = await Term.findOne({
    academicSession: sessionId,
    isCurrent: true,
  });

  if (currentTerm) {
    throw new Error(
      "Complete or deactivate the current term before completing this session.",
    );
  }

  session.status = "completed";
  session.isCurrent = false;

  return session.save();
};

const getCurrentSession = async () => {
  return AcademicSession.findOne({
    isCurrent: true,
    status: "active",
  });
};

module.exports = {
  createSession,
  getSessions,
  getSessionById,
  updateSession,
  activateSession,
  completeSession,
  getCurrentSession,
};
