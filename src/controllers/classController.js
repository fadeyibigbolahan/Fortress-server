const classService = require("../services/classService");

const createClass = async (req, res, next) => {
  try {
    const schoolClass = await classService.createClass(req.body, req.user._id);

    res.status(201).json({
      success: true,
      message: "Class created successfully.",
      data: schoolClass,
    });
  } catch (error) {
    next(error);
  }
};

const getClasses = async (req, res, next) => {
  try {
    const classes = await classService.getClasses(req.query);

    res.status(200).json({
      success: true,
      count: classes.length,
      data: classes,
    });
  } catch (error) {
    next(error);
  }
};

const getClassById = async (req, res, next) => {
  try {
    const schoolClass = await classService.getClassById(req.params.id);

    res.status(200).json({
      success: true,
      data: schoolClass,
    });
  } catch (error) {
    next(error);
  }
};

const updateClass = async (req, res, next) => {
  try {
    const schoolClass = await classService.updateClass(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Class updated successfully.",
      data: schoolClass,
    });
  } catch (error) {
    next(error);
  }
};

const deactivateClass = async (req, res, next) => {
  try {
    const schoolClass = await classService.deactivateClass(req.params.id);

    res.status(200).json({
      success: true,
      message: "Class deactivated successfully.",
      data: schoolClass,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createClass,
  getClasses,
  getClassById,
  updateClass,
  deactivateClass,
};
