const termService = require("../services/termService");

const createTerm = async (req, res, next) => {
  try {
    const term = await termService.createTerm(req.body, req.user._id);

    res.status(201).json({
      success: true,
      message: "Academic term created successfully.",
      data: term,
    });
  } catch (error) {
    next(error);
  }
};

const getTerms = async (req, res, next) => {
  try {
    const terms = await termService.getTerms(req.query);

    res.status(200).json({
      success: true,
      count: terms.length,
      data: terms,
    });
  } catch (error) {
    next(error);
  }
};

const getTermById = async (req, res, next) => {
  try {
    const term = await termService.getTermById(req.params.id);

    res.status(200).json({
      success: true,
      data: term,
    });
  } catch (error) {
    next(error);
  }
};

const updateTerm = async (req, res, next) => {
  try {
    const term = await termService.updateTerm(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Academic term updated successfully.",
      data: term,
    });
  } catch (error) {
    next(error);
  }
};

const activateTerm = async (req, res, next) => {
  try {
    const term = await termService.activateTerm(req.params.id);

    res.status(200).json({
      success: true,
      message: "Academic term activated successfully.",
      data: term,
    });
  } catch (error) {
    next(error);
  }
};

const completeTerm = async (req, res, next) => {
  try {
    const term = await termService.completeTerm(req.params.id);

    res.status(200).json({
      success: true,
      message: "Academic term completed successfully.",
      data: term,
    });
  } catch (error) {
    next(error);
  }
};

const getCurrentTerm = async (req, res, next) => {
  try {
    const term = await termService.getCurrentTerm();

    res.status(200).json({
      success: true,
      data: term,
    });
  } catch (error) {
    next(error);
  }
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
