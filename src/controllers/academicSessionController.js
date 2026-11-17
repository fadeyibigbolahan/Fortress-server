const sessionService = require("../services/academicSessionService");

const createSession = async (req, res, next) => {
  try {
    const session = await sessionService.createSession(req.body, req.user._id);

    res.status(201).json({
      success: true,
      message: "Academic session created successfully.",
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

const getSessions = async (req, res, next) => {
  try {
    const sessions = await sessionService.getSessions();

    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions,
    });
  } catch (error) {
    next(error);
  }
};

const getSessionById = async (req, res, next) => {
  try {
    const session = await sessionService.getSessionById(req.params.id);

    res.status(200).json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

const updateSession = async (req, res, next) => {
  try {
    const session = await sessionService.updateSession(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Academic session updated successfully.",
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

const activateSession = async (req, res, next) => {
  try {
    const session = await sessionService.activateSession(req.params.id);

    res.status(200).json({
      success: true,
      message: "Academic session activated successfully.",
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

const completeSession = async (req, res, next) => {
  try {
    const session = await sessionService.completeSession(req.params.id);

    res.status(200).json({
      success: true,
      message: "Academic session completed successfully.",
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

const getCurrentSession = async (req, res, next) => {
  try {
    const session = await sessionService.getCurrentSession();

    res.status(200).json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
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
