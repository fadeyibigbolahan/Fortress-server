const teacherService = require("../services/teacherService");

// ========================================
// 1. CREATE TEACHER
// ========================================

const createTeacher = async (req, res, next) => {
  try {
    const teacher = await teacherService.createTeacher(req.body, req.user._id);

    res.status(201).json({
      success: true,
      message: "Teacher registered successfully.",
      teacher,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 2. GET ALL TEACHERS
// ========================================

const getTeachers = async (req, res, next) => {
  try {
    const result = await teacherService.getTeachers(req.query);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 3. GET TEACHER BY ID
// ========================================

const getTeacherById = async (req, res, next) => {
  try {
    const teacher = await teacherService.getTeacherById(req.params.id);

    res.status(200).json({
      success: true,
      teacher,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 4. UPDATE TEACHER
// ========================================

const updateTeacher = async (req, res, next) => {
  try {
    const teacher = await teacherService.updateTeacher(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Teacher information updated successfully.",
      teacher,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 5. UPDATE TEACHER STATUS
// ========================================

const updateTeacherStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const teacher = await teacherService.updateTeacherStatus(
      req.params.id,
      status,
    );

    res.status(200).json({
      success: true,
      message: `Teacher status changed to ${status}.`,
      teacher,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 6. GET TEACHER ASSIGNMENTS
// ========================================

const getTeacherAssignments = async (req, res, next) => {
  try {
    const assignments = await teacherService.getTeacherAssignments(
      req.params.id,
      req.query,
    );

    res.status(200).json({
      success: true,
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 7. TEACHER STATISTICS
// ========================================

const getTeacherStatistics = async (req, res, next) => {
  try {
    const statistics = await teacherService.getTeacherStatistics();

    res.status(200).json({
      success: true,
      statistics,
    });
  } catch (error) {
    next(error);
  }
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
