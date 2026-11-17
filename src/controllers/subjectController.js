const subjectService = require("../services/subjectService");

const createSubject = async (req, res, next) => {
  try {
    const subject = await subjectService.createSubject(req.body, req.user._id);

    res.status(201).json({
      success: true,
      message: "Subject created successfully.",
      data: subject,
    });
  } catch (error) {
    next(error);
  }
};

const getSubjects = async (req, res, next) => {
  try {
    const subjects = await subjectService.getSubjects(req.query);

    res.status(200).json({
      success: true,
      count: subjects.length,
      data: subjects,
    });
  } catch (error) {
    next(error);
  }
};

const getSubjectById = async (req, res, next) => {
  try {
    const subject = await subjectService.getSubjectById(req.params.id);

    res.status(200).json({
      success: true,
      data: subject,
    });
  } catch (error) {
    next(error);
  }
};

const updateSubject = async (req, res, next) => {
  try {
    const subject = await subjectService.updateSubject(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Subject updated successfully.",
      data: subject,
    });
  } catch (error) {
    next(error);
  }
};

const deactivateSubject = async (req, res, next) => {
  try {
    const subject = await subjectService.deactivateSubject(req.params.id);

    res.status(200).json({
      success: true,
      message: "Subject deactivated successfully.",
      data: subject,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSubject,
  getSubjects,
  getSubjectById,
  updateSubject,
  deactivateSubject,
};
