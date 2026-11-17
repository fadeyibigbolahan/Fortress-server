const assignmentService = require("../services/teacherAssignmentService");

const createAssignment = async (req, res, next) => {
  try {
    const assignment = await assignmentService.createAssignment(
      req.body,
      req.user._id,
    );

    res.status(201).json({
      success: true,
      message: "Teacher assigned successfully.",
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
};

const getAssignments = async (req, res, next) => {
  try {
    const assignments = await assignmentService.getAssignments(req.query);

    res.status(200).json({
      success: true,
      count: assignments.length,
      data: assignments,
    });
  } catch (error) {
    next(error);
  }
};

const getAssignmentById = async (req, res, next) => {
  try {
    const assignment = await assignmentService.getAssignmentById(req.params.id);

    res.status(200).json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
};

const updateAssignment = async (req, res, next) => {
  try {
    const assignment = await assignmentService.updateAssignment(
      req.params.id,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "Teacher assignment updated successfully.",
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
};

const deactivateAssignment = async (req, res, next) => {
  try {
    const assignment = await assignmentService.deactivateAssignment(
      req.params.id,
    );

    res.status(200).json({
      success: true,
      message: "Teacher assignment deactivated successfully.",
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
};

const getMyAssignments = async (req, res, next) => {
  try {
    const assignments = await assignmentService.getTeacherAssignments(
      req.user._id,
      req.query,
    );

    res.status(200).json({
      success: true,
      count: assignments.length,
      data: assignments,
    });
  } catch (error) {
    next(error);
  }
};

const getAvailableTeachers = async (req, res, next) => {
  try {
    const teachers = await assignmentService.getAvailableTeachers(req.query);

    res.status(200).json({
      success: true,
      count: teachers.length,
      data: teachers,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAssignment,
  getAssignments,
  getAssignmentById,
  updateAssignment,
  deactivateAssignment,
  getMyAssignments,
  getAvailableTeachers,
};
